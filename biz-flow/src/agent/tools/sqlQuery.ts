import type { Tool } from './types';
import { invokeWithLogging } from '../../lib/llmLogger';
import { getClickhouseClient } from '../../lib/clickhouse';
import { sqlGeneratorPrompt } from '../../prompts';

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

    const messages = sqlGeneratorPrompt({
      schemaContext,
      historyText,
      userInput: context.userInput,
    });

    const response = await invokeWithLogging(
      messages,
      { logger: context.logger, tool: 'sql_query' },
    );

    let sql = response.content.toString().trim();
    sql = sql
      .replace(/^```sql\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/;+$/, '')
      .trim();

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
