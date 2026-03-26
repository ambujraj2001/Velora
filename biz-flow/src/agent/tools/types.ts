import type { AgentContext } from '../types';

export interface Tool {
  name: string;
  description: string;
  execute(
    input: Record<string, any>,
    context: AgentContext,
    previousResults: Record<string, any>,
  ): Promise<any>;
}
