import type { AgentContext, AgentResult, StepResult } from './types';
import type { AnyFragment } from '../types';
import { planner } from './planner';
import { buildGraph, validateDependencyGraph } from './graphBuilder';
import type { AgentGraphOutput } from './graphBuilder';
import { invokeWithLogging } from '../lib/llmLogger';
import { v4 as uuidv4 } from 'uuid';

export type { AgentContext, AgentResult } from './types';

function buildFragments(stepResults: StepResult[]): AnyFragment[] {
  const fragments: AnyFragment[] = [];

  for (const result of stepResults) {
    if (result.error || !result.data) continue;

    switch (result.tool) {
      case 'chat_response': {
        fragments.push({
          id: uuidv4(),
          type: 'md',
          data: { content: result.data.content },
        });
        break;
      }
      case 'sql_query': {
        const { sql, rows, columns } = result.data;
        if (rows && rows.length > 0) {
          fragments.push({
            id: uuidv4(),
            type: 'table',
            data: { columns, rows },
          });
          fragments.push({
            id: uuidv4(),
            type: 'code',
            data: { language: 'sql', code: sql },
          });
        }
        break;
      }
      case 'dashboard_builder': {
        if (result.data.fragments) {
          fragments.push(...result.data.fragments);
        }
        break;
      }
    }
  }

  return fragments;
}

function toStepResults(plan: import('./types').AgentPlan, state: AgentGraphOutput): StepResult[] {
  return plan.steps.map((step) => ({
    stepId: step.id,
    tool: step.tool,
    data: state.results[step.id] ?? null,
    durationMs: state.timings[step.id] ?? 0,
    error: state.errors[step.id],
  }));
}

export async function runAgent(
  userInput: string,
  context: AgentContext,
): Promise<AgentResult> {
  const start = Date.now();
  context.logger.info('agent_start', { userInput });

  try {
    let plan = await planner(userInput, context);

    const validationError = validateDependencyGraph(plan);
    if (validationError) {
      context.logger.error('agent_validation_error', {
        error: validationError,
      });
      plan = { steps: [{ id: 'step-1', tool: 'chat_response', input: {} }] };
    }

    const graph = buildGraph(plan, context);

    const finalState: AgentGraphOutput = await graph.invoke({
      results: {},
      errors: {},
      timings: {},
    });

    const stepResults = toStepResults(plan, finalState);
    let fragments = buildFragments(stepResults);

    const sqlResult = stepResults.find(
      (r) =>
        r.tool === 'sql_query' && !r.error && r.data?.rows?.length > 0,
    );
    if (sqlResult) {
      try {
        const summaryRes = await invokeWithLogging(
          [
            [
              'system',
              'You are a data analyst. Generate a catchy heading and a 1-2 sentence summary of the data. Keep it professional and insightful.',
            ],
            [
              'user',
              `Query: ${userInput}\nData Sample: ${JSON.stringify(
                sqlResult.data.rows.slice(0, 3),
              )}`,
            ],
          ],
          { logger: context.logger, tool: 'summary' },
        );
        const lines = summaryRes.content
          .toString()
          .split('\n')
          .filter(Boolean);
        const heading = lines[0] || 'Query Results';
        const summary =
          lines.slice(1).join(' ') ||
          'Here is the data based on your request.';

        fragments.unshift({
          id: uuidv4(),
          type: 'md',
          data: { content: `### ${heading}\n${summary}` },
        });
      } catch {
        // Non-critical — skip the summary
      }
    }

    if (fragments.length === 0) {
      let lastError: string | undefined;
      for (const r of stepResults) {
        if (r.error) lastError = r.error;
      }
      fragments.push({
        id: uuidv4(),
        type: 'error',
        data: {
          message:
            lastError || 'The agent could not process the request.',
        },
      });
    }

    const durationMs = Date.now() - start;
    context.logger.info('agent_completed', {
      durationMs,
      stepCount: stepResults.length,
      fragmentCount: fragments.length,
    });

    return { plan, stepResults, fragments };
  } catch (err: any) {
    context.logger.error('agent_error', {
      error: err.message,
      stack: err.stack,
    });

    return {
      plan: { steps: [] },
      stepResults: [],
      fragments: [
        {
          id: uuidv4(),
          type: 'error',
          data: { message: `Agent error: ${err.message}` },
        },
      ],
    };
  }
}
