import type { Tool } from './types';
import type { AnyFragment } from '../../types';
import { invokeWithLogging } from '../../lib/llmLogger';
import { getClickhouseClient } from '../../lib/clickhouse';
import { v4 as uuidv4 } from 'uuid';

export const dashboardBuilderTool: Tool = {
  name: 'dashboard_builder',
  description:
    'Creates a multi-chart dashboard with multiple visualizations. Use when the user asks for a "dashboard", "report", or multiple analytical views.',

  async execute(input, context, _previousResults) {
    const schemaContext = input.schemaContext || '';

    context.logger.info('tool_call', { tool: 'dashboard_builder' });

    const strategyRes = await invokeWithLogging(
      [
        [
          'system',
          `You are a Dashboard Architect. Break the request into 3-4 analytical sub-tasks.
For each sub-task, provide:
- title: short catchy title
- sql_question: a question answerable by a single SQL SELECT
- chart_type: 'bar', 'line', 'pie', or 'table'

Schema Context:
${schemaContext}

Return ONLY a valid JSON array of sub-tasks.`,
        ],
        ['user', context.userInput],
      ],
      { logger: context.logger, tool: 'dashboard_strategy' },
    );

    let raw = strategyRes.content.toString().trim();
    if (raw.startsWith('```json')) raw = raw.replace(/```json|```/g, '').trim();
    if (raw.startsWith('```')) raw = raw.replace(/```/g, '').trim();

    const subTasks = JSON.parse(raw);
    context.logger.info('tool_result', {
      tool: 'dashboard_planner',
      subTaskCount: subTasks.length,
    });

    const client = getClickhouseClient(context.connectionSettings);
    const dashboardFragments: AnyFragment[] = [];

    try {
      for (const task of subTasks) {
        try {
          context.logger.info('tool_call', {
            tool: 'dashboard_subtask',
            title: task.title,
          });

          const sqlRes = await invokeWithLogging(
            [
              [
                'system',
                `Generate a ClickHouse SELECT query for: ${task.sql_question}.
Schema:
${schemaContext}
Return ONLY the SQL. Limit to 50 rows.`,
              ],
              ['user', task.sql_question],
            ],
            { logger: context.logger, tool: 'dashboard_subtask_sql' },
          );

          const sql = sqlRes.content
            .toString()
            .trim()
            .replace(/```sql|```/g, '')
            .trim();

          context.logger.info('db_query', {
            tool: 'clickhouse',
            subtask: task.title,
          });

          const resultSet = await client.query({
            query: sql,
            format: 'JSONEachRow',
          });
          const rows = (await resultSet.json()) as any[];

          context.logger.info('db_query_result', {
            subtask: task.title,
            rowCount: rows.length,
          });

          if (rows.length === 0) continue;

          if (task.chart_type === 'table' || rows.length > 30) {
            dashboardFragments.push({
              id: uuidv4(),
              type: 'table',
              name: task.title,
              sql,
              data: { columns: Object.keys(rows[0]), rows },
            });
          } else {
            const chartRes = await invokeWithLogging(
              [
                [
                  'system',
                  `Generate a Highcharts configuration object for the given data.
The chart type is ${task.chart_type}.
The title is "${task.title}".
Return ONLY the JSON object.
Ensure it's valid for highcharts-react-official.`,
                ],
                ['user', `Data: ${JSON.stringify(rows.slice(0, 10))}`],
              ],
              { logger: context.logger, tool: 'dashboard_chart_config' },
            );

            const configStr = chartRes.content
              .toString()
              .trim()
              .replace(/```json|```/g, '')
              .trim();

            dashboardFragments.push({
              id: uuidv4(),
              type: 'chart',
              name: task.title,
              sql,
              data: { highchartOptions: JSON.parse(configStr) },
            });
          }

          context.logger.info('tool_result', {
            tool: 'dashboard_subtask',
            title: task.title,
          });
        } catch (err: any) {
          context.logger.error('dashboard_subtask_failed', {
            title: task.title,
            error: err.message,
          });
        }
      }
    } finally {
      await client.close();
    }

    if (dashboardFragments.length === 0) {
      throw new Error('Could not generate any meaningful data for this dashboard.');
    }

    const titleRes = await invokeWithLogging(
      [
        [
          'system',
          'Generate a short, professional, analysis-oriented title for a dashboard. Return ONLY the title (max 5 words).',
        ],
        ['user', context.userInput],
      ],
      { logger: context.logger, tool: 'dashboard_title' },
    );
    const dashboardTitle = titleRes.content.toString().trim().replace(/^"|"$/g, '');

    context.logger.info('tool_result', {
      tool: 'dashboard_builder',
      title: dashboardTitle,
      fragmentCount: dashboardFragments.length,
    });

    return {
      fragments: [
        {
          id: uuidv4(),
          type: 'dashboard' as const,
          name: dashboardTitle,
          data: {
            layout: 'grid',
            fragments: dashboardFragments,
            originalPrompt: context.userInput,
          },
        },
      ],
    };
  },
};
