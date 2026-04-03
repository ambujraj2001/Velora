import type { ContextLogger } from '../lib/logger';
import type { AnyFragment } from '../types';

export interface AgentStep {
  id: string;
  tool: string;
  input: Record<string, any>;
  dependsOn?: string[];
}

export interface AgentPlan {
  steps: AgentStep[];
}

export type AgentProgressEvent =
  | { kind: 'phase'; label: string }
  | { kind: 'plan'; steps: Array<{ id: string; tool: string }> }
  | { kind: 'step_start'; stepId: string; tool: string }
  | { kind: 'step_done'; stepId: string; tool: string }
  | { kind: 'step_error'; stepId: string; tool: string; message: string }
  | { kind: 'replanning' };

export interface AgentContext {
  traceId: string;
  requestId: string;
  logger: ContextLogger;
  userId?: string;
  userInput: string;
  /** Optional: chat jobs, UI progress, etc. */
  onProgress?: (event: AgentProgressEvent) => void;
  connectionSettings?: {
    type?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    file_url?: string;
    schema_json?: any;
    description?: string;
  };
  connectionId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface StepResult {
  stepId: string;
  tool: string;
  data: any;
  durationMs: number;
  error?: string;
}

export interface AgentResult {
  plan: AgentPlan;
  stepResults: StepResult[];
  fragments: AnyFragment[];
  summary?: string;
  finalData?: any;
}
