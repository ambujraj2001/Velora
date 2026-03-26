import type { AgentPlan, AgentContext, StepResult } from './types';
import { toolRegistry } from './tools/registry';

const STEP_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>(
      (_, reject) =>
        (timer = setTimeout(
          () => reject(new Error(`Step timed out after ${ms}ms`)),
          ms,
        )),
    ),
  ]).finally(() => clearTimeout(timer));
}

export async function executor(
  plan: AgentPlan,
  context: AgentContext,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const resultMap: Record<string, any> = {};
  const cache = new Map<string, any>();

  for (const step of plan.steps) {
    const tool = toolRegistry[step.tool];

    if (!tool) {
      context.logger.error('agent_step_unknown_tool', {
        stepId: step.id,
        tool: step.tool,
      });
      results.push({
        stepId: step.id,
        tool: step.tool,
        data: null,
        durationMs: 0,
        error: `Unknown tool: ${step.tool}`,
      });
      continue;
    }

    const cacheKey = `${step.tool}:${JSON.stringify(step.input)}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      resultMap[step.id] = cached;
      results.push({
        stepId: step.id,
        tool: step.tool,
        data: cached,
        durationMs: 0,
      });
      context.logger.info('agent_step_cache_hit', {
        stepId: step.id,
        tool: step.tool,
      });
      continue;
    }

    const start = Date.now();
    let lastError: string | undefined;
    let data: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        context.logger.info('agent_step_start', {
          stepId: step.id,
          tool: step.tool,
          ...(attempt > 0 ? { attempt: attempt + 1 } : {}),
        });

        data = await withTimeout(
          tool.execute(step.input, context, resultMap),
          STEP_TIMEOUT_MS,
        );
        lastError = undefined;
        break;
      } catch (err: any) {
        lastError = err.message;
        if (attempt < MAX_RETRIES) {
          context.logger.warn('agent_step_retry', {
            stepId: step.id,
            tool: step.tool,
            attempt: attempt + 1,
            error: err.message,
          });
        }
      }
    }

    const durationMs = Date.now() - start;

    if (lastError) {
      context.logger.error('agent_step_error', {
        stepId: step.id,
        tool: step.tool,
        error: lastError,
        durationMs,
      });
      results.push({
        stepId: step.id,
        tool: step.tool,
        data: null,
        durationMs,
        error: lastError,
      });
    } else {
      resultMap[step.id] = data;
      cache.set(cacheKey, data);
      results.push({
        stepId: step.id,
        tool: step.tool,
        data,
        durationMs,
      });
      context.logger.info('agent_step_end', {
        stepId: step.id,
        tool: step.tool,
        durationMs,
      });
    }
  }

  return results;
}
