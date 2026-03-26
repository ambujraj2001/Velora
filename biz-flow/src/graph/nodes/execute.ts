import { GraphState } from '../../types';
import { getClickhouseClient } from '../../lib/clickhouse';
import { createLogger } from '../../lib/logger';

export async function executeNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  if (!state.sql) {
    return { error: 'No SQL provided.' };
  }

  const client = getClickhouseClient(state.connectionSettings);

  try {
    const sqlUpper = state.sql.trim().toUpperCase();
    if (!sqlUpper.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed for safety.');
    }

    logger.info('db_query', { tool: 'clickhouse', sqlLength: state.sql.length });

    const resultSet = await client.query({
      query: state.sql,
      format: 'JSONEachRow',
    });
    const rows = await resultSet.json();

    logger.info('db_query_result', { tool: 'clickhouse', rowCount: (rows as any[]).length });

    return { rows: rows as any[], error: undefined };
  } catch (err: any) {
    logger.error('db_query_error', { error: err.message });
    return { error: err.message, rows: undefined };
  } finally {
    await client.close();
  }
}
