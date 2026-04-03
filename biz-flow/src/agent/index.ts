import type { AgentContext, AgentResult, StepResult } from './types';
import type { AnyFragment } from '../types';
import { planner } from './planner';
import { buildGraph, validateDependencyGraph } from './graphBuilder';
import type { AgentGraphOutput } from './graphBuilder';
import { invokeWithLogging } from '../lib/llmLogger';
import { dataSummaryPrompt } from '../prompts';
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
      case 'dashboard_builder':
      case 'csv_query': {
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
    context.onProgress?.({ kind: 'phase', label: 'Planning next steps…' });
    let plan = await planner(userInput, context);

    const validationError = validateDependencyGraph(plan);
    if (validationError) {
      context.logger.error('agent_validation_error', {
        error: validationError,
      });
      plan = { steps: [{ id: 'step-1', tool: 'chat_response', input: {} }] };
    }

    context.onProgress?.({
      kind: 'plan',
      steps: plan.steps.map((s) => ({ id: s.id, tool: s.tool })),
    });

    const graph = buildGraph(plan, context);

    const finalState: AgentGraphOutput = await graph.invoke({
      results: {},
      errors: {},
      timings: {},
      retries: {},
      replanCount: 0,
      originalInput: userInput,
      currentPlan: plan,
      __retry: null,
      __needsReplan: false,
    });

    const activePlan = finalState.currentPlan ?? plan;
    const stepResults = toStepResults(activePlan, finalState);
    let fragments = buildFragments(stepResults);

    const sqlResult = stepResults.find(
      (r) =>
        (r.tool === 'sql_query' || r.tool === 'csv_query') &&
        !r.error &&
        r.data?.rows?.length > 0,
    );

    let summaryText: string | undefined;
    let finalData: any | undefined;

    if (sqlResult) {
      finalData = sqlResult.data.rows;
      try {
        context.onProgress?.({ kind: 'phase', label: 'Summarizing results…' });
        const summaryMessages = dataSummaryPrompt({
          userInput,
          dataSampleJson: JSON.stringify(sqlResult.data.rows.slice(0, 3)),
        });
        const summaryRes = await invokeWithLogging(
          summaryMessages,
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

        summaryText = `${heading}: ${summary}`;

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

    return { 
      plan: activePlan, 
      stepResults, 
      fragments, 
      summary: summaryText, 
      finalData 
    };
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
