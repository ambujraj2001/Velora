import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import type { AgentPlan, AgentContext, AgentStep } from './types';
import { toolRegistry } from './tools/registry';
import { resolveInputs } from './utils/resolveInputs';
import { replan } from './replanner';

export const MAX_RETRIES = 2;
export const MAX_REPLANS = 2;
const STEP_TIMEOUT_MS = 30_000;

const AgentGraphState = Annotation.Root({
  results: Annotation<Record<string, any>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  errors: Annotation<Record<string, string>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  timings: Annotation<Record<string, number>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  retries: Annotation<Record<string, number>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  replanCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  originalInput: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  currentPlan: Annotation<AgentPlan>({
    reducer: (_, next) => next,
    default: () => ({ steps: [] }),
  }),
  __retry: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  __needsReplan: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

export type AgentGraphOutput = typeof AgentGraphState.State;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isBadResult(step: AgentStep, result: any): boolean {
  if (
    step.tool === 'sql_query' &&
    result?.rows?.length === 0 &&
    step.input.expectedNonEmpty !== false
  ) {
    return true;
  }
  return false;
}

function getSuccessors(step: AgentStep, plan: AgentPlan): string[] {
  return plan.steps
    .filter((s) => s.dependsOn?.includes(step.id))
    .map((s) => s.id);
}

function filterReusableResults(
  oldResults: Record<string, any>,
  newPlan: AgentPlan,
): Record<string, any> {
  const newStepIds = new Set(newPlan.steps.map((s) => s.id));
  return Object.fromEntries(
    Object.entries(oldResults).filter(([stepId]) => newStepIds.has(stepId)),
  );
}

// ---------------------------------------------------------------------------
// Validation (unchanged)
// ---------------------------------------------------------------------------

export function validateDependencyGraph(plan: AgentPlan): string | null {
  const stepIds = new Set(plan.steps.map((s) => s.id));

  for (const step of plan.steps) {
    if (!step.dependsOn) continue;
    for (const dep of step.dependsOn) {
      if (!stepIds.has(dep)) {
        return `Step "${step.id}" depends on non-existent step "${dep}"`;
      }
      if (dep === step.id) {
        return `Step "${step.id}" depends on itself`;
      }
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  const depsOf = new Map<string, string[]>();
  for (const step of plan.steps) {
    depsOf.set(step.id, step.dependsOn ?? []);
  }

  function hasCycle(id: string): boolean {
    visited.add(id);
    inStack.add(id);
    for (const dep of depsOf.get(id) ?? []) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) return true;
      } else if (inStack.has(dep)) {
        return true;
      }
    }
    inStack.delete(id);
    return false;
  }

  for (const step of plan.steps) {
    if (!visited.has(step.id) && hasCycle(step.id)) {
      return `Circular dependency detected involving step "${step.id}"`;
    }
  }

  const depthMemo: Record<string, number> = {};
  function depth(id: string): number {
    if (depthMemo[id] !== undefined) return depthMemo[id];
    const deps = depsOf.get(id) ?? [];
    if (deps.length === 0) return (depthMemo[id] = 0);
    depthMemo[id] = 1 + Math.max(...deps.map(depth));
    return depthMemo[id];
  }

  for (const step of plan.steps) {
    if (depth(step.id) > 5) {
      return `Dependency chain too deep for step "${step.id}" (max 5)`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step node factory
// ---------------------------------------------------------------------------

function createStepNode(step: AgentStep, context: AgentContext) {
  return async (state: typeof AgentGraphState.State) => {
    const { logger } = context;
    const start = Date.now();

    logger.info('agent_step_start', { stepId: step.id, tool: step.tool });

    if (step.dependsOn) {
      for (const dep of step.dependsOn) {
        if (state.errors[dep]) {
          const durationMs = Date.now() - start;
          logger.warn('agent_step_skipped_dependency_failed', {
            stepId: step.id,
            failedDep: dep,
          });
          return {
            errors: { [step.id]: `Skipped: dependency "${dep}" failed` },
            timings: { [step.id]: durationMs },
            __retry: null,
            __needsReplan: false,
          };
        }
      }
    }

    try {
      const tool = toolRegistry[step.tool];
      if (!tool) throw new Error(`Tool not found: ${step.tool}`);

      const resolvedInput = resolveInputs(step.input, state.results);

      logger.info('input_resolved', {
        stepId: step.id,
        resolvedKeys: Object.keys(resolvedInput),
      });

      const result = await withTimeout(
        tool.execute(resolvedInput, context, state.results),
        STEP_TIMEOUT_MS,
      );
      const durationMs = Date.now() - start;

      if (isBadResult(step, result)) {
        logger.warn('agent_step_bad_result', {
          stepId: step.id,
          tool: step.tool,
        });
        return {
          errors: { [step.id]: 'bad_result' },
          timings: { [step.id]: durationMs },
          __retry: null,
          __needsReplan: true,
        };
      }

      logger.info('agent_step_end', {
        stepId: step.id,
        tool: step.tool,
        durationMs,
      });

      return {
        results: { [step.id]: result },
        timings: { [step.id]: durationMs },
        __retry: null,
        __needsReplan: false,
      };
    } catch (error: any) {
      const durationMs = Date.now() - start;
      const retryCount = state.retries[step.id] || 0;

      if (retryCount < MAX_RETRIES) {
        logger.info('agent_step_retry', {
          stepId: step.id,
          tool: step.tool,
          retryCount: retryCount + 1,
        });
        return {
          retries: { [step.id]: retryCount + 1 },
          timings: { [step.id]: durationMs },
          __retry: step.id,
          __needsReplan: false,
        };
      }

      logger.error('agent_step_failed', {
        stepId: step.id,
        tool: step.tool,
        error: error.message,
        durationMs,
      });

      return {
        errors: { [step.id]: error.message },
        timings: { [step.id]: durationMs },
        __retry: null,
        __needsReplan: true,
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildGraph(plan: AgentPlan, context: AgentContext) {
  const { logger } = context;
  let builder: any = new StateGraph(AgentGraphState);

  // --- Step nodes ---
  for (const step of plan.steps) {
    builder = builder.addNode(step.id, createStepNode(step, context));
  }

  // --- __replan__ node ---
  builder = builder.addNode('__replan__', async (state: typeof AgentGraphState.State) => {
    if (state.replanCount >= MAX_REPLANS) {
      logger.error('agent_replan_limit_reached', {
        replanCount: state.replanCount,
      });
      return { __retry: null, __needsReplan: false };
    }

    logger.info('agent_replan_triggered', { replanCount: state.replanCount });

    let newPlan: AgentPlan;
    try {
      newPlan = await replan({
        userInput: state.originalInput,
        previousPlan: state.currentPlan,
        results: state.results,
        errors: state.errors,
        context,
      });
    } catch (err: any) {
      logger.error('agent_replan_failed', { error: err.message });
      return { __retry: null, __needsReplan: false };
    }

    logger.info('agent_replan_created', { newStepCount: newPlan.steps.length });
    logger.info('agent_replan_diff', {
      oldSteps: state.currentPlan.steps.length,
      newSteps: newPlan.steps.length,
      oldTools: state.currentPlan.steps.map((s) => s.tool),
      newTools: newPlan.steps.map((s) => s.tool),
    });

    const reusableResults = filterReusableResults(state.results, newPlan);

    const newGraph = buildGraph(newPlan, context);
    return await newGraph.invoke({
      results: reusableResults,
      errors: {},
      timings: {},
      retries: {},
      replanCount: state.replanCount + 1,
      originalInput: state.originalInput,
      currentPlan: newPlan,
      __retry: null,
      __needsReplan: false,
    });
  });

  // --- __error__ node ---
  builder = builder.addNode('__error__', async (state: typeof AgentGraphState.State) => {
    logger.error('agent_fallback_triggered', { errors: state.errors });

    const fallbackTool = toolRegistry['chat_response'];
    const result = await fallbackTool.execute(
      { message: 'Sorry, something went wrong while processing your request.' },
      context,
      state.results,
    );

    return {
      results: { fallback: result },
      __retry: null,
      __needsReplan: false,
    };
  });

  // --- START edges ---
  for (const step of plan.steps) {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      builder = builder.addEdge(START, step.id);
    }
  }

  // --- Conditional edges per step ---
  for (const step of plan.steps) {
    const successors = getSuccessors(step, plan);

    builder = builder.addConditionalEdges(
      step.id,
      (state: typeof AgentGraphState.State) => {
        if (state.__retry === step.id) return step.id;
        if (state.__needsReplan) return '__replan__';
        if (state.errors[step.id] && successors.length === 0) return '__error__';
        if (successors.length > 0) return successors;
        return END;
      },
    );
  }

  // --- __replan__ conditional edge ---
  builder = builder.addConditionalEdges(
    '__replan__',
    (state: typeof AgentGraphState.State) => {
      if (state.__needsReplan === false && !state.results.fallback) {
        return '__error__';
      }
      return END;
    },
  );

  // --- __error__ → END ---
  builder = builder.addEdge('__error__', END);

  logger.info('agent_graph_built', {
    nodes: plan.steps.length,
    hasReplan: true,
    hasErrorFallback: true,
  });

  return builder.compile();
}
