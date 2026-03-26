import { GraphState } from '../../types';
import { mistral } from '../../config/llm';
import { createLogger } from '../../lib/logger';

export async function sqlGenerationNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  try {
    const historyText = state.history?.map((h) => `${h.role}: ${h.content}`).join('\n') || '';

    logger.info('tool_call', { tool: 'sql_generator' });

    const response = await mistral.invoke([
      [
        'system',
        `You are a ClickHouse SQL generator.
Rules:
1. ONLY return the SQL query.
2. Only SELECT queries are allowed.
3. Use the provided schema. 
4. If a query is a follow-up, consider the history.
5. Limit results to 100 unless specified.

Schema:
${state.schemaContext}`,
      ],
      ['user', `History:\n${historyText}\n\nNew Request: ${state.userInput}`],
    ]);

    let sql = response.content.toString().trim();
    if (sql.startsWith('```sql')) {
      sql = sql.replace('```sql', '');
    }
    if (sql.startsWith('```')) {
      sql = sql.replace('```', '');
    }
    if (sql.endsWith('```')) {
      sql = sql.slice(0, sql.lastIndexOf('```'));
    }

    const upperSql = sql.toUpperCase();
    if (
      upperSql.includes('INSERT ') ||
      upperSql.includes('UPDATE ') ||
      upperSql.includes('DELETE ') ||
      upperSql.includes('DROP ') ||
      upperSql.includes('ALTER ')
    ) {
      throw new Error('Only SELECT queries are allowed.');
    }

    if (!upperSql.includes('LIMIT ')) {
      sql = `${sql} LIMIT 100`;
    }

    logger.info('tool_result', { tool: 'sql_generator', sqlLength: sql.trim().length });

    return { sql: sql.trim(), error: undefined };
  } catch (err: any) {
    logger.error('sql_generation_error', { error: err.message });
    return {
      error: err.message,
    };
  }
}
