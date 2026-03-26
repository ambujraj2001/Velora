import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import type { AgentPlan, AgentContext, AgentStep } from './types';
import { toolRegistry } from './tools/registry';
import { resolveInputs } from './utils/resolveInputs';

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
});

export type AgentGraphOutput = typeof AgentGraphState.State;

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

function createStepNode(step: AgentStep, context: AgentContext) {
  return async (state: typeof AgentGraphState.State) => {
    const { logger } = context;
    const start = Date.now();

    logger.info('agent_step_start', { stepId: step.id, tool: step.tool });

    if (step.dependsOn) {
      for (const dep of step.dependsOn) {
        if (state.errors[dep]) {
          const durationMs = Date.now() - start;
          logger.warn('agent_step_skipped', {
            stepId: step.id,
            reason: `Dependency "${dep}" failed`,
          });
          return {
            errors: { [step.id]: `Skipped: dependency "${dep}" failed` },
            timings: { [step.id]: durationMs },
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

      const result = await tool.execute(resolvedInput, context, state.results);
      const durationMs = Date.now() - start;

      logger.info('agent_step_end', {
        stepId: step.id,
        tool: step.tool,
        durationMs,
      });

      return {
        results: { [step.id]: result },
        timings: { [step.id]: durationMs },
      };
    } catch (error: any) {
      const durationMs = Date.now() - start;
      logger.error('agent_step_error', {
        stepId: step.id,
        tool: step.tool,
        error: error.message,
        durationMs,
      });

      return {
        errors: { [step.id]: error.message },
        timings: { [step.id]: durationMs },
      };
    }
  };
}

export function buildGraph(plan: AgentPlan, context: AgentContext) {
  // Use `any` for the builder because node IDs are dynamic at runtime
  let builder: any = new StateGraph(AgentGraphState);

  for (const step of plan.steps) {
    builder = builder.addNode(step.id, createStepNode(step, context));
  }

  const dependedUpon = new Set<string>();
  for (const step of plan.steps) {
    if (step.dependsOn) {
      for (const dep of step.dependsOn) {
        dependedUpon.add(dep);
      }
    }
  }

  for (const step of plan.steps) {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      builder = builder.addEdge(START, step.id);
    } else {
      for (const dep of step.dependsOn) {
        builder = builder.addEdge(dep, step.id);
      }
    }
  }

  for (const step of plan.steps) {
    if (!dependedUpon.has(step.id)) {
      builder = builder.addEdge(step.id, END);
    }
  }

  context.logger.info('agent_graph_built', { nodes: plan.steps.length });

  return builder.compile();
}
