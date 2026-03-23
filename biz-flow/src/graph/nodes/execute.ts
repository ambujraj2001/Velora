import { GraphState } from '../../types';
import { getClickhouseClient } from '../../lib/clickhouse';

export async function executeNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.sql) {
    return { error: 'No SQL provided.' };
  }

  const client = getClickhouseClient(state.connectionSettings);

  try {
    const sqlUpper = state.sql.trim().toUpperCase();
    if (!sqlUpper.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed for safety.');
    }

    const resultSet = await client.query({
      query: state.sql,
      format: 'JSONEachRow',
    });
    const rows = await resultSet.json();

    return { rows: rows as any[], error: undefined }; // success
  } catch (err: any) {
    return { error: err.message, rows: undefined };
  } finally {
    await client.close();
  }
}
