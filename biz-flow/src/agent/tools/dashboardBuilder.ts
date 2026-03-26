import type { Tool } from './types';
import type { AnyFragment } from '../../types';
import { invokeWithLogging } from '../../lib/llmLogger';
import { getClickhouseClient } from '../../lib/clickhouse';
import {
  dashboardStrategyPrompt,
  dashboardSubtaskSqlPrompt,
  highchartsConfigPrompt,
  dashboardTitlePrompt,
} from '../../prompts';
import { v4 as uuidv4 } from 'uuid';

export const dashboardBuilderTool: Tool = {
  name: 'dashboard_builder',
  description:
    'Creates a multi-chart dashboard with multiple visualizations. Use when the user asks for a "dashboard", "report", or multiple analytical views.',

  async execute(input, context, _previousResults) {
    const schemaContext = input.schemaContext || '';

    context.logger.info('tool_call', { tool: 'dashboard_builder' });

    const strategyMessages = dashboardStrategyPrompt({
      schemaContext,
      userInput: context.userInput,
    });
    const strategyRes = await invokeWithLogging(
      strategyMessages,
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

          const sqlMessages = dashboardSubtaskSqlPrompt({
            sqlQuestion: task.sql_question,
            schemaContext,
          });
          const sqlRes = await invokeWithLogging(
            sqlMessages,
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
            const chartMessages = highchartsConfigPrompt({
              chartType: task.chart_type,
              title: task.title,
              dataJson: JSON.stringify(rows.slice(0, 10)),
            });
            const chartRes = await invokeWithLogging(
              chartMessages,
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

    const titleMessages = dashboardTitlePrompt({
      userInput: context.userInput,
    });
    const titleRes = await invokeWithLogging(
      titleMessages,
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
