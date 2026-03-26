import { Axiom } from '@axiomhq/js';
import dotenv from 'dotenv';

dotenv.config();

const AXIOM_TOKEN = process.env.AXIOM_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET || 'velora';
const ENV = process.env.NODE_ENV || 'development';
const IS_DEV = ENV !== 'production';
const SAMPLE_RATE = IS_DEV ? 1 : 0.25;
const MAX_PAYLOAD_LEN = 4000;

let axiom: Axiom | null = null;
if (AXIOM_TOKEN) {
  axiom = new Axiom({ token: AXIOM_TOKEN });
}

type LogLevel = 'info' | 'warn' | 'error';

function truncateValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_PAYLOAD_LEN) {
    return value.substring(0, MAX_PAYLOAD_LEN) + '...[truncated]';
  }
  if (typeof value === 'object' && value !== null) {
    const str = JSON.stringify(value);
    if (str.length > MAX_PAYLOAD_LEN) {
      return str.substring(0, MAX_PAYLOAD_LEN) + '...[truncated]';
    }
  }
  return value;
}

function shouldSample(level: LogLevel): boolean {
  if (level === 'error') return true;
  return Math.random() < SAMPLE_RATE;
}

const COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export function log(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>,
): void {
  try {
    if (!shouldSample(level)) return;

    const entry: Record<string, unknown> = {
      _time: new Date().toISOString(),
      level,
      event,
      env: ENV,
    };

    if (data) {
      for (const [k, v] of Object.entries(data)) {
        entry[k] = truncateValue(v);
      }
    }

    if (axiom) {
      axiom.ingest(AXIOM_DATASET, [entry]);
    }

    if (IS_DEV) {
      const tag = `${COLORS[level]}[${level.toUpperCase()}]${RESET}`;
      const meta = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`${tag} ${event}${meta}`);
    }
  } catch {
    // never crash the app
  }
}

export interface ContextLogger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createLogger(context: {
  requestId: string;
  traceId?: string;
  userId?: string;
}): ContextLogger {
  const emit = (
    level: LogLevel,
    event: string,
    data?: Record<string, unknown>,
  ) => {
    log(level, event, { ...context, ...data });
  };

  return {
    info: (event, data) => emit('info', event, data),
    warn: (event, data) => emit('warn', event, data),
    error: (event, data) => emit('error', event, data),
  };
}

export async function flushLogs(): Promise<void> {
  try {
    if (axiom) await axiom.flush();
  } catch {
    // never crash the app
  }
}
