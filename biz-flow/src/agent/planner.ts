import type { AgentPlan, AgentContext } from './types';
import { toolRegistry } from './tools/registry';
import { invokeWithLogging } from '../lib/llmLogger';

const MAX_STEPS = 5;

function repairPlan(plan: AgentPlan): AgentPlan {
  const tools = plan.steps.map((s) => s.tool);
  const hasSchema = tools.includes('schema_lookup');
  const hasConsumer =
    tools.includes('sql_query') || tools.includes('dashboard_builder');

  if (hasSchema && !hasConsumer) {
    const schemaStep = plan.steps.find((s) => s.tool === 'schema_lookup')!;
    plan.steps.push({
      id: `step-${plan.steps.length + 1}`,
      tool: 'sql_query',
      input: { schemaContext: `{{${schemaStep.id}.schema}}` },
      dependsOn: [schemaStep.id],
    });
  }

  for (const step of plan.steps) {
    if (
      (step.tool === 'sql_query' || step.tool === 'dashboard_builder') &&
      !step.dependsOn
    ) {
      const schemaStep = plan.steps.find((s) => s.tool === 'schema_lookup');
      if (schemaStep && schemaStep.id !== step.id) {
        step.dependsOn = [schemaStep.id];
        if (!step.input.schemaContext) {
          step.input.schemaContext = `{{${schemaStep.id}.schema}}`;
        }
      }
    }
  }

  return plan;
}

export async function planner(
  input: string,
  context: AgentContext,
): Promise<AgentPlan> {
  const toolDescriptions = Object.values(toolRegistry)
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');

  context.logger.info('agent_planning', { userInput: input });

  const response = await invokeWithLogging(
    [
      [
        'system',
        `You are a data analytics agent planner. Given a user query, produce a JSON execution plan.

Available tools:
${toolDescriptions}

IMPORTANT: schema_lookup NEVER appears alone. It MUST always be followed by sql_query or dashboard_builder.

Each step may include:
- "dependsOn": array of step IDs that must complete before this step runs
- Input templates like "{{step-1.schema}}" to reference output from a prior step

Examples:

User: "top airlines by passengers"
{"steps":[{"id":"step-1","tool":"schema_lookup","input":{}},{"id":"step-2","tool":"sql_query","input":{"schemaContext":"{{step-1.schema}}"},"dependsOn":["step-1"]}]}

User: "hello, who are you?"
{"steps":[{"id":"step-1","tool":"chat_response","input":{}}]}

User: "create a flight operations dashboard"
{"steps":[{"id":"step-1","tool":"schema_lookup","input":{}},{"id":"step-2","tool":"dashboard_builder","input":{"schemaContext":"{{step-1.schema}}"},"dependsOn":["step-1"]}]}

User: "show me total revenue by month"
{"steps":[{"id":"step-1","tool":"schema_lookup","input":{}},{"id":"step-2","tool":"sql_query","input":{"schemaContext":"{{step-1.schema}}"},"dependsOn":["step-1"]}]}

Rules:
- Data questions (SQL, numbers, tables, charts, comparisons, trends) → schema_lookup THEN sql_query (ALWAYS both)
- General questions, greetings, explanations → chat_response only
- Dashboard / report requests → schema_lookup THEN dashboard_builder
- Maximum ${MAX_STEPS} steps
- Use dependsOn when a step needs another step's output
- Use {{stepId.field}} in input to reference prior step outputs
- Return STRICT JSON only. No markdown. No explanation.`,
      ],
      ['user', input],
    ],
    { logger: context.logger, tool: 'planner' },
  );

  try {
    let content = response.content.toString().trim();
    content = content
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '');

    const plan = JSON.parse(content) as AgentPlan;

    if (
      !plan.steps ||
      !Array.isArray(plan.steps) ||
      plan.steps.length === 0
    ) {
      throw new Error('Empty or invalid plan');
    }

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!toolRegistry[step.tool]) {
        throw new Error(`Unknown tool: ${step.tool}`);
      }
      if (!step.id) step.id = `step-${i + 1}`;
      if (!step.input) step.input = {};
    }

    if (plan.steps.length > MAX_STEPS) {
      plan.steps = plan.steps.slice(0, MAX_STEPS);
    }

    const repairedPlan = repairPlan(plan);

    context.logger.info('agent_plan_created', {
      stepCount: repairedPlan.steps.length,
      tools: repairedPlan.steps.map((s) => s.tool),
    });

    return repairedPlan;
  } catch (err: any) {
    context.logger.warn('agent_plan_fallback', { error: err.message });
    return {
      steps: [{ id: 'step-1', tool: 'chat_response', input: {} }],
    };
  }
}
