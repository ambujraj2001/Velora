import { createGraph } from '../graph';
import { supabase } from '../config/db';
import { GraphState } from '../types';
import { requireSessionUser } from '../utils/auth';

export const handleChat = async (req: any, res: any) => {
  const { logger, traceId, requestId } = req.context;

  try {
    logger.info('chat_request', { body: req.body });

    const user = requireSessionUser(req, res);
    if (!user) return;

    const { userInput, conversationId, connectionId } = req.body;

    let connSettings = undefined;
    let finalConnId = connectionId;

    const connQuery = supabase.from('velora_connections').select('*');
    if (finalConnId) {
      connQuery.eq('id', finalConnId);
    } else {
      connQuery.eq('user_id', user.userId).order('created_at', { ascending: false }).limit(1);
    }

    const { data: conn } = await connQuery.maybeSingle();

    if (conn) {
      finalConnId = conn.id;
      const { decrypt } = require('../utils/crypto');
      try {
        connSettings = {
          host: conn.host,
          port: conn.port,
          database: conn.database,
          username: conn.username,
          password: decrypt(conn.password),
        };
        logger.info('connection_resolved', { connId: finalConnId, type: conn.type });
      } catch (decErr: any) {
        logger.error('connection_decrypt_failed', { error: decErr.message });
      }
    } else {
      logger.warn('connection_not_found', { userId: user.userId });
    }

    const { fetchSchema } = require('../services/schemaService');
    const schemaContext = await fetchSchema(connSettings);
    logger.info('schema_fetched', { schemaLength: schemaContext.length });

    let history: any[] = [];
    if (conversationId) {
      const { data: msgs } = await supabase
        .from('velora_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);
      if (msgs) history = msgs;
    }

    const builder = createGraph();

    const initialState = {
      userInput,
      intent: 'CHAT' as const,
      sql: undefined,
      rows: undefined,
      error: undefined,
      retryCount: 0,
      fragments: [],
      dashboardPlan: undefined,
      connectionId: finalConnId,
      connectionSettings: connSettings,
      conversationId,
      schemaContext,
      history,
      traceId,
      requestId,
    } satisfies GraphState;

    const result = await builder.invoke(initialState);
    logger.info('graph_complete', { resultKeys: Object.keys(result || {}) });

    let convId = conversationId;
    if (!convId) {
      logger.info('conversation_creating', { userId: user.userId });
      const { data: conv, error: convError } = await supabase
        .from('velora_conversations')
        .insert({
          user_id: user.userId,
          title: userInput.substring(0, 50) + '...',
        })
        .select()
        .single();

      if (convError) {
        logger.error('conversation_create_failed', { error: convError });
      }
      if (conv) {
        convId = conv.id;

        const { mistral } = require('../config/llm');
        mistral
          .invoke([
            [
              'system',
              'Generate a short, 3-5 word title for a chat conversation based on this starting query. No quotes, just the words.',
            ],
            ['user', userInput],
          ])
          .then(async (res: any) => {
            await supabase
              .from('velora_conversations')
              .update({ title: res.content.toString() })
              .eq('id', convId);
          })
          .catch((e: any) => logger.error('title_generation_failed', { error: e.message }));
      }
    }

    if (convId) {
      logger.info('messages_inserting', { convId });
      const { error: msgError } = await supabase.from('velora_messages').insert([
        {
          conversation_id: convId,
          role: 'user',
          content: userInput,
          fragments: [],
        },
        {
          conversation_id: convId,
          role: 'assistant',
          content: '',
          fragments: result.fragments || [],
          sql: result.sql,
          connection_id: finalConnId,
        },
      ]);
      if (msgError) {
        logger.error('messages_insert_failed', { error: msgError });
      }
    } else {
      logger.warn('messages_skipped_no_conversation');
    }

    logger.info('chat_response', { convId, fragmentsCount: result.fragments?.length });
    res.status(200).json({
      conversationId: convId,
      connectionId: finalConnId,
      fragments: result.fragments || [],
    });
  } catch (err: any) {
    logger.error('chat_controller_error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
};
