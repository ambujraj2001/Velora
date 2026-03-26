import { GraphState, AnyFragment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../lib/logger';

export async function fragmentBuilderNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  if (state.error && state.retryCount >= 2) {
    return {};
  }

  const fragments: AnyFragment[] = [];

  if (state.rows) {
    if (state.intent === 'DATA_QUERY') {
      logger.info('tool_call', { tool: 'fragment_builder', intent: 'DATA_QUERY' });

      const { mistral } = require('../../config/llm');
      const summaryRes = await mistral.invoke([
        [
          'system',
          'You are a data analyst. Based on the user query and the fact that we found data, generate a catchy heading and a 1-2 sentence summary of what you found. Keep it professional and insightful.',
        ],
        [
          'user',
          `Query: ${state.userInput}\nData Sample: ${JSON.stringify(state.rows.slice(0, 3))}`,
        ],
      ]);

      const [heading, ...summaryParts] = summaryRes.content.toString().split('\n').filter(Boolean);
      const summary = summaryParts.join(' ');

      fragments.push({
        id: uuidv4(),
        type: 'md',
        data: {
          content: `### ${heading || 'Query Results'}\n${summary || 'Here is the data found based on your request.'}`,
        },
      });

      fragments.push({
        id: uuidv4(),
        type: 'table',
        data: {
          columns: Object.keys(state.rows[0] || {}),
          rows: state.rows,
        },
      });

      fragments.push({
        id: uuidv4(),
        type: 'code',
        data: { language: 'sql', code: state.sql || '' },
      });

      logger.info('tool_result', { tool: 'fragment_builder', fragmentCount: fragments.length });
    } else if (state.intent === 'DASHBOARD') {
      // dashboardPlanNode already built the real fragments
    }
  }

  return { fragments: fragments };
}
