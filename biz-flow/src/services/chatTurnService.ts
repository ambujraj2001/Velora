import { runAgent } from '../agent';
import type { AgentContext, AgentProgressEvent } from '../agent/types';
import { supabase } from '../config/db';
import { mistral } from '../config/llm';
import { decrypt } from '../utils/crypto';
import type { SessionUser } from '../utils/auth';
import { conversationTitlePrompt } from '../prompts';
import { selectBestConnection } from './connectionEmbeddingService';
import { runReportFlow } from './reportService';
import { applyAgentProgressToJob, setChatJobPhase } from './chatJobService';
import type { ChatRequestBody } from '../schemas';
import type { ContextLogger } from '../lib/logger';
import type { AnyFragment } from '../types';

export interface ChatTurnResult {
  conversationId: string | null | undefined;
  connectionId: string | null | undefined;
  fragments: AnyFragment[];
}

export async function executeChatTurn(params: {
  body: ChatRequestBody;
  user: SessionUser;
  traceId: string;
  requestId: string;
  logger: ContextLogger;
  jobId?: string;
}): Promise<ChatTurnResult> {
  const { body, user, traceId, requestId, logger, jobId } = params;
  const { userInput, conversationId, connectionId, mode = 'chat' } = body;

  const phase = async (label: string) => {
    if (jobId) await setChatJobPhase(jobId, label);
  };

  await phase('Choosing data connection…');

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

  await phase('Resolving connection…');

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

  await phase('Loading conversation…');

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

  const onProgress: ((event: AgentProgressEvent) => void) | undefined = jobId
    ? (event) => {
        void applyAgentProgressToJob(jobId, event).catch((err) =>
          logger.error('chat_job_progress_error', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    : undefined;

  await phase('Running agent…');

  const agentResult = await runAgent(userInput, {
    traceId,
    requestId,
    logger,
    userId: user.userId,
    userInput,
    connectionSettings: connSettings,
    connectionId: finalConnId,
    history,
    onProgress,
  });

  logger.info('agent_complete', {
    stepCount: agentResult.stepResults.length,
    fragmentCount: agentResult.fragments.length,
  });

  if (mode === 'report') {
    await phase('Generating report…');
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

  await phase('Saving messages…');

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

  return {
    conversationId: convId,
    connectionId: finalConnId,
    fragments: agentResult.fragments,
  };
}
