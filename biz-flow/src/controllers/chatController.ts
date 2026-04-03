import type { Request, Response } from 'express';
import { runAgent } from '../agent';
import { supabase } from '../config/db';
import { mistral } from '../config/llm';
import { requireSessionUser } from '../utils/auth';
import { decrypt } from '../utils/crypto';
import { sendSuccess, sendError } from '../utils/response';
import { conversationTitlePrompt } from '../prompts';
import { selectBestConnection } from '../services/connectionEmbeddingService';
import { runReportFlow, sendReportEmail } from '../services/reportService';
import type { AgentContext } from '../agent/types';
import type { ChatRequestBody, EmailReportBody } from '../schemas';

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  const { logger, traceId, requestId } = req.context;

  try {
    logger.info('chat_request', { body: req.body });

    const user = requireSessionUser(req, res);
    if (!user) return;

    const { userInput, conversationId, connectionId, mode = 'chat' } = req.body as ChatRequestBody;

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

    let connSettings: AgentContext['connectionSettings'] = undefined;
    const connQuery = supabase.from('velora_connections').select('*');
    if (finalConnId) {
      connQuery.eq('id', finalConnId);
    } else {
      connQuery.eq('user_id', user.userId).order('created_at', { ascending: false }).limit(1);
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
        try {
          connSettings = {
            type: conn.type,
            host: conn.host,
            port: conn.port,
            database: conn.database,
            username: conn.username,
            password: decrypt(conn.password),
          };
        } catch (decErr: unknown) {
          const msg = decErr instanceof Error ? decErr.message : String(decErr);
          logger.error('connection_decrypt_failed', { error: msg });
        }
      }

      logger.info('connection_resolved', {
        connId: finalConnId,
        type: conn.type,
      });
    } else {
      logger.warn('connection_not_found', { userId: user.userId });
    }

    let history: AgentContext['history'] = [];
    if (conversationId) {
      const { data: msgs } = await supabase
        .from('velora_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);
      if (msgs) {
        history = msgs as Array<{ role: 'user' | 'assistant'; content: string }>;
      }
    }

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

    if (mode === 'report') {
      const reportResult = await runReportFlow({
        query: userInput,
        userId: user.userId,
        userEmail: user.email,
        agentResult,
      });

      const reportFragment = {
        id: `report-${Date.now()}`,
        type: 'report' as const,
        data: {
          markdown: reportResult.reportMarkdown,
          pdfBase64: reportResult.pdfBase64,
          actions: reportResult.actions,
        },
      };

      agentResult.fragments = [reportFragment as (typeof agentResult.fragments)[number]];
    }

    const sqlStep = agentResult.stepResults.find(
      (r) => (r.tool === 'sql_query' || r.tool === 'csv_query') && !r.error,
    );

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

        const titleMessages = conversationTitlePrompt({ userInput });
        mistral
          .invoke(titleMessages)
          .then(async (titleRes: { content: unknown }) => {
            await supabase
              .from('velora_conversations')
              .update({ title: titleRes.content?.toString() })
              .eq('id', convId);
          })
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('title_generation_failed', { error: msg });
          });
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
          fragments: agentResult.fragments,
          sql: (sqlStep?.data as { sql?: string } | null)?.sql,
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
    sendSuccess(res, {
      conversationId: convId,
      connectionId: finalConnId,
      fragments: agentResult.fragments,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('chat_controller_error', {
      error: message,
      stack,
    });
    sendError(res, 'INTERNAL_ERROR', message);
  }
};

export const handleEmailReport = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { pdfBase64 } = req.body as EmailReportBody;

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await sendReportEmail(user.email, pdfBuffer);

    sendSuccess(res, { success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('handleEmailReport_error', { error: message });
    sendError(res, 'INTERNAL_ERROR', message);
  }
};
