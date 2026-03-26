import type { Tool } from './types';
import { getClickhouseClient } from '../../lib/clickhouse';

export const schemaLookupTool: Tool = {
  name: 'schema_lookup',
  description:
    'Fetches the database schema (table names and column definitions). Use before sql_query or dashboard_builder.',

  async execute(_input, context) {
    context.logger.info('tool_call', { tool: 'schema_lookup' });

    const client = getClickhouseClient(context.connectionSettings);
    try {
      await client.ping();

      const tableResult = await client.query({
        query: 'SHOW TABLES',
        format: 'JSONEachRow',
      });
      const tables = (await tableResult.json()) as any[];

      let schema = '';
      for (const table of tables) {
        const name = table.name;
        const colResult = await client.query({
          query: `DESCRIBE TABLE ${name}`,
          format: 'JSONEachRow',
        });
        const columns = (await colResult.json()) as any[];
        schema += `Table: ${name}\nColumns:\n`;
        columns.forEach((col) => {
          schema += `- ${col.name} (${col.type})\n`;
        });
        schema += '\n';
      }

      context.logger.info('tool_result', {
        tool: 'schema_lookup',
        tableCount: tables.length,
      });

      return { schema: schema || 'No tables found in database.' };
    } catch (err: any) {
      context.logger.error('tool_error', {
        tool: 'schema_lookup',
        error: err.message,
      });
      throw new Error(`Schema lookup failed: ${err.message}`);
    } finally {
      await client.close();
    }
  },
};
