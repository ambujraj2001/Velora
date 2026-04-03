import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/db';
import type { AnyFragment } from '../types';
import type { AgentProgressEvent } from '../agent/types';
import { toolLabel } from '../agent/progressLabels';

const JOB_KEY = (id: string) => `chat:job:${id}`;
const TTL_SEC = 45 * 60;
const TTL_MS = TTL_SEC * 1000;

export type ChatJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ChatJobStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ChatJobStep {
  id: string;
  tool: string;
  label: string;
  status: ChatJobStepStatus;
  errorMessage?: string;
}

export interface ChatJobSnapshot {
  jobId: string;
  userId: string;
  status: ChatJobStatus;
  currentLabel: string;
  steps: ChatJobStep[];
  createdAt: number;
  result?: {
    conversationId: string | null | undefined;
    connectionId: string | null | undefined;
    fragments: AnyFragment[];
  };
  error?: { message: string; code?: string };
}

/** In-memory fallback when Upstash is not configured (single-process only). */
const memoryJobs = new Map<string, ChatJobSnapshot>();

function hasRedis(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

async function readRaw(jobId: string): Promise<ChatJobSnapshot | null> {
  if (hasRedis()) {
    const raw = await redis.get(JOB_KEY(jobId));
    if (raw == null) return null;
    const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
    try {
      return JSON.parse(str) as ChatJobSnapshot;
    } catch {
      return null;
    }
  }
  const snap = memoryJobs.get(jobId);
  if (!snap) return null;
  if (Date.now() - snap.createdAt > TTL_MS) {
    memoryJobs.delete(jobId);
    return null;
  }
  return snap;
}

async function writeRaw(jobId: string, snapshot: ChatJobSnapshot): Promise<void> {
  if (hasRedis()) {
    await redis.set(JOB_KEY(jobId), JSON.stringify(snapshot), { ex: TTL_SEC });
  } else {
    memoryJobs.set(jobId, snapshot);
  }
}

export async function createChatJob(userId: string): Promise<string> {
  const jobId = uuidv4();
  const snapshot: ChatJobSnapshot = {
    jobId,
    userId,
    status: 'queued',
    currentLabel: 'Queued…',
    steps: [],
    createdAt: Date.now(),
  };
  await writeRaw(jobId, snapshot);
  return jobId;
}

export async function getChatJob(jobId: string): Promise<ChatJobSnapshot | null> {
  return readRaw(jobId);
}

export async function markChatJobRunning(jobId: string): Promise<void> {
  const j = await readRaw(jobId);
  if (!j) return;
  j.status = 'running';
  j.currentLabel = 'Starting…';
  await writeRaw(jobId, j);
}

export async function setChatJobPhase(jobId: string, label: string): Promise<void> {
  const j = await readRaw(jobId);
  if (!j) return;
  if (j.status === 'queued') j.status = 'running';
  j.currentLabel = label;
  await writeRaw(jobId, j);
}

export async function completeChatJob(
  jobId: string,
  result: ChatJobSnapshot['result'],
): Promise<void> {
  const j = await readRaw(jobId);
  if (!j) return;
  j.status = 'completed';
  j.currentLabel = 'Done';
  j.result = result;
  await writeRaw(jobId, j);
}

export async function failChatJob(jobId: string, message: string, code?: string): Promise<void> {
  const j = await readRaw(jobId);
  if (!j) return;
  j.status = 'failed';
  j.currentLabel = 'Failed';
  j.error = { message, code };
  await writeRaw(jobId, j);
}

function ensureStep(j: ChatJobSnapshot, stepId: string, tool: string): ChatJobStep {
  let s = j.steps.find((x) => x.id === stepId);
  if (!s) {
    s = {
      id: stepId,
      tool,
      label: toolLabel(tool),
      status: 'pending',
    };
    j.steps.push(s);
  }
  return s;
}

/**
 * Maps agent/graph progress events into the persisted job snapshot.
 */
export async function applyAgentProgressToJob(
  jobId: string,
  event: AgentProgressEvent,
): Promise<void> {
  const j = await readRaw(jobId);
  if (!j || j.status === 'completed' || j.status === 'failed') return;

  if (j.status === 'queued') j.status = 'running';

  switch (event.kind) {
    case 'phase':
      j.currentLabel = event.label;
      break;
    case 'plan':
      j.steps = event.steps.map((s) => ({
        id: s.id,
        tool: s.tool,
        label: toolLabel(s.tool),
        status: 'pending' as ChatJobStepStatus,
      }));
      j.currentLabel = 'Running tasks…';
      break;
    case 'replanning':
      j.currentLabel = 'Adjusting plan…';
      break;
    case 'step_start': {
      const step = ensureStep(j, event.stepId, event.tool);
      step.status = 'running';
      step.errorMessage = undefined;
      j.currentLabel = step.label;
      break;
    }
    case 'step_done': {
      const step = ensureStep(j, event.stepId, event.tool);
      step.status = 'done';
      break;
    }
    case 'step_error': {
      const step = ensureStep(j, event.stepId, event.tool);
      step.status = 'error';
      step.errorMessage = event.message;
      j.currentLabel = `Error: ${step.label}`;
      break;
    }
    default:
      break;
  }

  await writeRaw(jobId, j);
}

export type PublicChatJobSnapshot = Omit<ChatJobSnapshot, 'userId'>;

export function toPublicJobSnapshot(j: ChatJobSnapshot): PublicChatJobSnapshot {
  const { userId: _, ...rest } = j;
  return rest;
}
