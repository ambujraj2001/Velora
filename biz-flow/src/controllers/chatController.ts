import { runAgent } from '../agent';
import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { conversationTitlePrompt } from '../prompts';
import { selectBestConnection } from '../services/connectionEmbeddingService';

/**
 * Helper to process queries within the chat flow.
 * Phase 6: Automatic connection selection if not provided.
 */
export const handleChat = async (req: any, res: any) => {
  const { logger, traceId, requestId } = req.context;

  try {
    logger.info('chat_request', { body: req.body });

    const user = requireSessionUser(req, res);
    if (!user) return;

    const { userInput, conversationId, connectionId, mode = 'chat' } = req.body;

    // ... (unchanged connection selecting logic) ...
    let finalConnId = connectionId;

    if (!finalConnId) {
      const autoConnId = await selectBestConnection({
        query: userInput,
        userId: user.userId,
        logger,
      });
      if (autoConnId) {
        finalConnId = autoConnId;
        logger.info('connection_auto_selected', { connId: finalConnId });
      }
    }

    let connSettings: any = undefined;
    const connQuery = supabase.from('velora_connections').select('*');
    if (finalConnId) {
      connQuery.eq('id', finalConnId);
    } else {
      // Existing fallback: latest connection
      connQuery
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: conn } = await connQuery.maybeSingle();

    if (conn) {
      finalConnId = conn.id;

      if (conn.type === 'csv') {
        connSettings = {
          type: 'csv',
          file_url: conn.file_url,
          schema_json: conn.schema_json,
          description: conn.description,
        };
      } else {
        const { decrypt } = require('../utils/crypto');
        try {
          connSettings = {
            type: conn.type,
            host: conn.host,
            port: conn.port,
            database: conn.database,
            username: conn.username,
            password: decrypt(conn.password),
          };
        } catch (decErr: any) {
          logger.error('connection_decrypt_failed', { error: decErr.message });
        }
      }

      logger.info('connection_resolved', {
        connId: finalConnId,
        type: conn.type,
      });
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

    // --- Step 1 - Existing execution (replaces graph) ---
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

    // --- Step 2 - Report mode branch ---
    if (mode === 'report') {
      const { runReportFlow } = require('../services/reportService');
      const reportResult = await runReportFlow({
        query: userInput,
        userId: user.userId,
        userEmail: user.email,
        agentResult,
      });

      // ONLY include the report fragment in report mode for a clean business experience
      const reportFragment = {
        id: `report-${Date.now()}`,
        type: 'report',
        data: {
          markdown: reportResult.reportMarkdown,
          pdfBase64: reportResult.pdfBase64,
          actions: reportResult.actions,
        },
      };

      // Persist ONLY the report fragment for this message
      agentResult.fragments = [reportFragment as any];
    }

    // Extract SQL from step results for persistence
    const sqlStep = agentResult.stepResults.find(
      (r) => (r.tool === 'sql_query' || r.tool === 'csv_query') && !r.error,
    );

    // --- Supabase persistence (unchanged) ---
    let convId = conversationId;
    // ... insert conversation and messages if chat mode ...
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

export const handleEmailReport = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 is required' });

    const { sendReportEmail } = require('../services/reportService');
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    
    await sendReportEmail(user.email, pdfBuffer);
    
    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('handleEmailReport_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};
