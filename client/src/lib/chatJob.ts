import { api } from './appConfig';
import type { AnyFragment } from '../types';

export type ChatJobStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ChatJobStep {
  id: string;
  tool: string;
  label: string;
  status: ChatJobStepStatus;
  errorMessage?: string;
}

export interface ChatJobPublic {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  currentLabel: string;
  steps: ChatJobStep[];
  createdAt: number;
  result?: {
    conversationId?: string | null;
    connectionId?: string | null;
    fragments: AnyFragment[];
  };
  error?: { message: string; code?: string };
}

export async function startChatJob(body: {
  userInput: string;
  mode?: 'chat' | 'report';
  conversationId?: string;
  connectionId?: string | null;
}): Promise<string> {
  const res = await api.post<{ jobId: string }>('/chat/jobs', {
    userInput: body.userInput,
    mode: body.mode ?? 'chat',
    ...(body.conversationId ? { conversationId: body.conversationId } : {}),
    ...(body.connectionId ? { connectionId: body.connectionId } : {}),
  });
  return res.data.jobId;
}

export async function fetchChatJob(jobId: string): Promise<ChatJobPublic> {
  const res = await api.get<ChatJobPublic>(`/chat/jobs/${jobId}`);
  return res.data;
}

export async function pollUntilChatJobDone(
  jobId: string,
  opts?: {
    intervalMs?: number;
    onUpdate?: (job: ChatJobPublic) => void;
    signal?: AbortSignal;
  },
): Promise<ChatJobPublic> {
  const intervalMs = opts?.intervalMs ?? 1000;

  for (;;) {
    if (opts?.signal?.aborted) {
      throw new DOMException('Polling aborted', 'AbortError');
    }

    const job = await fetchChatJob(jobId);
    opts?.onUpdate?.(job);

    if (job.status === 'completed') {
      return job;
    }
    if (job.status === 'failed') {
      throw new Error(job.error?.message || 'Chat job failed');
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, intervalMs);
      opts?.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('Polling aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }
}
