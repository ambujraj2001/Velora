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

  // Safety: handle cases where LLM might return unescaped control characters (e.g. literal newlines inside string literals)
  const sanitized = content.replace(/[\u0000-\u001F]+/g, (match) => {
    // Preserve normal space/tab in formatting context if they are between keys? 
    // Actually, JSON.parse handles \n outside strings fine. 
    // But literal control chars INSIDE strings are what cause the error.
    // It's safer to just let JSON.parse handle it after some targeted cleanup.
    // Replace only literal control codes that must be escaped.
    return match; // (placeholder logic, will refine in the next step or keep if simple replacement)
  });

  // Most robust cleanup for "Bad control character in string literal" errors:
  // We need to keep structural newlines but escape newlines INSIDE value quotes.
  // Instead of complex regex, let's just use a try-catch with a slightly cleaner input.
  
  const finalContent = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  // Wait, if I replace ALL \n with \\n, then { "a": 1, \n "b": 2} -> { "a": 1, \\n "b": 2} which is invalid JSON if not inside quotes.
  
  // Real fix: only sanitize the characters that JSON.parse explicitly fails on.
  // Actually, standard JSON.parse() in node fails on literal \n in string. 
  // Let's use a simpler heuristic: if it fails, try to "un-break" it.
  
  let plan: AgentPlan;
  try {
    plan = JSON.parse(content) as AgentPlan;
  } catch (err) {
    // Attempt second-pass cleaning if first fails
    const cleaned = content.replace(/(\r\n|\n|\r)/gm, " ");
    plan = JSON.parse(cleaned) as AgentPlan;
  }

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
