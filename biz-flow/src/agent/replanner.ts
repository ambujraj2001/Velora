import type { AgentPlan, AgentContext } from './types';
import { toolRegistry } from './tools/registry';
import { invokeWithLogging } from '../lib/llmLogger';
import { replannerPrompt } from '../prompts';

const MAX_STEPS = 5;

export interface ReplanInput {
  userInput: string;
  previousPlan: AgentPlan;
  results: Record<string, any>;
  errors: Record<string, string>;
  context: AgentContext;
}

function summarizeResults(
  results: Record<string, any>,
  plan: AgentPlan,
): string {
  const lines: string[] = [];
  for (const step of plan.steps) {
    if (results[step.id] !== undefined) {
      const preview = JSON.stringify(results[step.id]);
      const truncated =
        preview.length > 200 ? preview.slice(0, 200) + '...' : preview;
      lines.push(`- ${step.id} (${step.tool}): OK — ${truncated}`);
    }
  }
  return lines.join('\n');
}

function summarizeErrors(
  errors: Record<string, string>,
  plan: AgentPlan,
): string {
  const lines: string[] = [];
  for (const step of plan.steps) {
    if (errors[step.id]) {
      lines.push(`- ${step.id} (${step.tool}): FAILED — ${errors[step.id]}`);
    }
  }
  return lines.join('\n');
}

export async function replan(input: ReplanInput): Promise<AgentPlan> {
  const { userInput, previousPlan, results, errors, context } = input;

  const toolDescriptions = Object.values(toolRegistry)
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');

  context.logger.info('agent_replanning', {
    userInput,
    errorCount: Object.keys(errors).length,
  });

  const messages = replannerPrompt({
    toolDescriptions,
    maxSteps: MAX_STEPS,
    userInput,
    previousPlanJson: JSON.stringify(previousPlan, null, 2),
    succeededSummary: summarizeResults(results, previousPlan),
    failedSummary: summarizeErrors(errors, previousPlan),
  });

  const response = await invokeWithLogging(messages, {
    logger: context.logger,
    tool: 'replanner',
  });

  let content = response.content.toString().trim();
  content = content
    .replace(/^```json\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '');

  const plan = JSON.parse(content) as AgentPlan;

  if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error('Replanner produced empty or invalid plan');
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!toolRegistry[step.tool]) {
      throw new Error(`Unknown tool in replan: ${step.tool}`);
    }
    if (!step.id) step.id = `step-${i + 1}`;
    if (!step.input) step.input = {};
  }

  if (plan.steps.length > MAX_STEPS) {
    plan.steps = plan.steps.slice(0, MAX_STEPS);
  }

  context.logger.info('agent_replan_plan_created', {
    stepCount: plan.steps.length,
    tools: plan.steps.map((s) => s.tool),
  });

  return plan;
}
