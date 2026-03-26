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

export interface AgentContext {
  traceId: string;
  requestId: string;
  logger: ContextLogger;
  userId?: string;
  userInput: string;
  connectionSettings?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
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
}
