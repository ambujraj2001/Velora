import { getClickhouseClient } from '../lib/clickhouse';
import { log } from '../lib/logger';

export async function fetchSchema(connectionSettings?: any) {
  const client = getClickhouseClient(connectionSettings);
  try {
    log('info', 'db_query', { tool: 'clickhouse', query: 'SHOW TABLES (schema fetch)' });

    const tableResult = await client.query({
      query: 'SHOW TABLES',
      format: 'JSONEachRow',
    });
    const tables = (await tableResult.json()) as any[];

    let schemaContext = '';

    for (const table of tables) {
      const tableName = table.name;
      const schemaResult = await client.query({
        query: `DESCRIBE TABLE ${tableName}`,
        format: 'JSONEachRow',
      });
      const columns = (await schemaResult.json()) as any[];

      schemaContext += `Table: ${tableName}\nColumns:\n`;
      columns.forEach((col) => {
        schemaContext += `- ${col.name} (${col.type})\n`;
      });
      schemaContext += '\n';
    }

    log('info', 'schema_fetch_complete', { tableCount: tables.length });
    return schemaContext || 'No tables found in database.';
  } catch (err: any) {
    log('error', 'schema_fetch_error', { error: err.message });
    return `Error fetching schema: ${err.message}`;
  } finally {
    await client.close();
  }
}
