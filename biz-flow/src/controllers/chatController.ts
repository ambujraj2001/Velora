import { runAgent } from '../agent';
import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { conversationTitlePrompt } from '../prompts';
import { handleCsvChatAction } from '../services/csvChatService';

/**
 * Helper to process CSV queries within the chat flow.
 * Follows the same persistence pattern as normal chat (create conv if needed, save message, return json).
 */
const handleCsvChat = async (req: any, res: any, params: {
  userInput: string;
  conversationId: string;
  connection: any;
  user: any;
  history: any[];
}) => {
  const { logger } = req.context;
  const { userInput, conversationId, connection, user } = params;

  // 1. Run CSV execution flow
  const csvResult = await handleCsvChatAction({
    query: userInput,
    connection,
    logger
  });

  // 2. Persistence (Reuse existing pattern)
  let convId = conversationId;
  if (!convId) {
    logger.info('csv_conversation_creating', { userId: user.userId });
    const { data: conv, error: convError } = await supabase
      .from('velora_conversations')
      .insert({
        user_id: user.userId,
        title: userInput.substring(0, 50) + '...',
      })
      .select()
      .single();

    if (conv) {
      convId = conv.id;
      // Background title generation
      const { mistral } = require('../config/llm');
      const titleMessages = conversationTitlePrompt({ userInput });
      mistral
        .invoke(titleMessages)
        .then(async (titleRes: any) => {
          await supabase
            .from('velora_conversations')
            .update({ title: titleRes.content.toString() })
            .eq('id', convId);
        })
        .catch((e: any) => logger.error('csv_title_generation_failed', { error: e.message }));
    }
  }

  if (convId) {
    await supabase.from('velora_messages').insert([
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
        fragments: csvResult.fragments,
        sql: csvResult.sql,
        connection_id: connection.id,
      },
    ]);
  }

  return res.status(200).json({
    conversationId: convId,
    connectionId: connection.id,
    fragments: csvResult.fragments,
  });
};

export const handleChat = async (req: any, res: any) => {
  const { logger, traceId, requestId } = req.context;

  try {
    logger.info('chat_request', { body: req.body });

    const user = requireSessionUser(req, res);
    if (!user) return;

    const { userInput, conversationId, connectionId } = req.body;

    // --- Connection fetching (unchanged) ---
    let connSettings = undefined;
    let finalConnId = connectionId;

    const connQuery = supabase.from('velora_connections').select('*');
    if (finalConnId) {
      connQuery.eq('id', finalConnId);
    } else {
      connQuery
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: conn } = await connQuery.maybeSingle();

    if (conn) {
      finalConnId = conn.id;

      // 🎯 ROUTING CONDITION (CORE CHANGE)
      if (conn.type === 'csv') {
        logger.info('routing_to_csv_flow', { connectionId: finalConnId });
        return handleCsvChat(req, res, {
          userInput,
          conversationId,
          connection: conn,
          user,
          history: [] // currently history not used in simple csv flow, can be added later
        });
      }

      const { decrypt } = require('../utils/crypto');
      try {
        connSettings = {
          host: conn.host,
          port: conn.port,
          database: conn.database,
          username: conn.username,
          password: decrypt(conn.password),
        };
        logger.info('connection_resolved', {
          connId: finalConnId,
          type: conn.type,
        });
      } catch (decErr: any) {
        logger.error('connection_decrypt_failed', {
          error: decErr.message,
        });
      }
    } else {
      logger.warn('connection_not_found', { userId: user.userId });
    }

    // --- History fetching (unchanged) ---
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

    // --- Run agent (replaces graph) ---
    const agentResult = await runAgent(userInput, {
      traceId,
      requestId,
      logger,
      userId: user.userId,
      userInput,
      connectionSettings: connSettings,
      connectionId: finalConnId,
      history,
    });

    logger.info('agent_complete', {
      stepCount: agentResult.stepResults.length,
      fragmentCount: agentResult.fragments.length,
    });

    // Extract SQL from step results for persistence
    const sqlStep = agentResult.stepResults.find(
      (r) => r.tool === 'sql_query' && !r.error,
    );

    // --- Supabase persistence (unchanged) ---
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
        const titleMessages = conversationTitlePrompt({ userInput });
        mistral
          .invoke(titleMessages)
          .then(async (titleRes: any) => {
            await supabase
              .from('velora_conversations')
              .update({ title: titleRes.content.toString() })
              .eq('id', convId);
          })
          .catch((e: any) =>
            logger.error('title_generation_failed', { error: e.message }),
          );
      }
    }

    if (convId) {
      logger.info('messages_inserting', { convId });
      const { error: msgError } = await supabase
        .from('velora_messages')
        .insert([
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
            fragments: agentResult.fragments,
            sql: sqlStep?.data?.sql,
            connection_id: finalConnId,
          },
        ]);
      if (msgError) {
        logger.error('messages_insert_failed', { error: msgError });
      }
    } else {
      logger.warn('messages_skipped_no_conversation');
    }

    logger.info('chat_response', {
      convId,
      fragmentsCount: agentResult.fragments.length,
    });
    res.status(200).json({
      conversationId: convId,
      connectionId: finalConnId,
      fragments: agentResult.fragments,
    });
  } catch (err: any) {
    logger.error('chat_controller_error', {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
};
