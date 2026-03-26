import type { Tool } from './types';
import { invokeWithLogging } from '../../lib/llmLogger';
import { getClickhouseClient } from '../../lib/clickhouse';

export const sqlQueryTool: Tool = {
  name: 'sql_query',
  description:
    'Generates a ClickHouse SQL SELECT query from a natural-language question and executes it. Requires schema from a prior schema_lookup step.',

  async execute(input, context, _previousResults) {
    context.logger.info('tool_call', { tool: 'sql_query' });

    const schemaContext = input.schemaContext || '';

    const historyText =
      context.history
        ?.map((h) => `${h.role}: ${h.content}`)
        .join('\n') || '';

    const response = await invokeWithLogging(
      [
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
${schemaContext}`,
        ],
        [
          'user',
          `History:\n${historyText}\n\nNew Request: ${context.userInput}`,
        ],
      ],
      { logger: context.logger, tool: 'sql_query' },
    );

    let sql = response.content.toString().trim();
    sql = sql
      .replace(/^```sql\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '');

    const upper = sql.toUpperCase();
    if (
      ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER '].some((kw) =>
        upper.includes(kw),
      )
    ) {
      throw new Error('Only SELECT queries are allowed.');
    }
    if (!upper.includes('LIMIT ')) sql = `${sql} LIMIT 100`;
    sql = sql.trim();

    const client = getClickhouseClient(context.connectionSettings);
    try {
      context.logger.info('db_query', {
        tool: 'clickhouse',
        sqlLength: sql.length,
      });

      const resultSet = await client.query({
        query: sql,
        format: 'JSONEachRow',
      });
      const rows = (await resultSet.json()) as any[];

      context.logger.info('tool_result', {
        tool: 'sql_query',
        rowCount: rows.length,
      });

      return {
        sql,
        rows,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      };
    } finally {
      await client.close();
    }
  },
};
