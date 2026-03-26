import { GraphState, AnyFragment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { mistral } from '../../config/llm';
import { getClickhouseClient } from '../../lib/clickhouse';
import { createLogger } from '../../lib/logger';
import {
  dashboardStrategyPrompt,
  dashboardSubtaskSqlPrompt,
  highchartsConfigPrompt,
  dashboardTitlePrompt,
} from '../../prompts';

export async function dashboardPlanningNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  try {
    logger.info('tool_call', { tool: 'dashboard_planner', userInput: state.userInput });

    const strategyMessages = dashboardStrategyPrompt({
      schemaContext: state.schemaContext || '',
      userInput: state.userInput,
    });
    const strategyRes = await mistral.invoke(strategyMessages);

    let content = strategyRes.content.toString().trim();
    if (content.startsWith('```json')) content = content.replace(/```json|```/g, '').trim();

    const subTasks = JSON.parse(content);
    const dashboardFragments: AnyFragment[] = [];

    logger.info('tool_result', { tool: 'dashboard_planner', subTaskCount: subTasks.length });

    const client = getClickhouseClient(state.connectionSettings as any);

    for (const task of subTasks) {
      try {
        logger.info('tool_call', { tool: 'dashboard_subtask', title: task.title });

        const sqlMessages = dashboardSubtaskSqlPrompt({
          sqlQuestion: task.sql_question,
          schemaContext: state.schemaContext || '',
        });
        const sqlRes = await mistral.invoke(sqlMessages);

        let sql = sqlRes.content
          .toString()
          .trim()
          .replace(/```sql|```/g, '')
          .trim();

        logger.info('db_query', { tool: 'clickhouse', subtask: task.title });

        const resultSet = await client.query({
          query: sql,
          format: 'JSONEachRow',
        });
        const rows = (await resultSet.json()) as any[];

        logger.info('db_query_result', { subtask: task.title, rowCount: rows.length });

        if (rows.length === 0) continue;

        if (task.chart_type === 'table' || rows.length > 30) {
          dashboardFragments.push({
            id: uuidv4(),
            type: 'table',
            name: task.title,
            sql,
            data: {
              columns: Object.keys(rows[0]),
              rows: rows,
            },
          });
        } else {
          const chartMessages = highchartsConfigPrompt({
            chartType: task.chart_type,
            title: task.title,
            dataJson: JSON.stringify(rows.slice(0, 10)),
          });
          const chartConfigRes = await mistral.invoke(chartMessages);

          let configStr = chartConfigRes.content
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

        logger.info('tool_result', { tool: 'dashboard_subtask', title: task.title });
      } catch (err: any) {
        logger.error('dashboard_subtask_failed', { title: task.title, error: err.message });
      }
    }

    await client.close();

    if (dashboardFragments.length === 0) {
      return { error: 'Could not generate any meaningful data for this dashboard.' };
    }

    const titleMessages = dashboardTitlePrompt({
      userInput: state.userInput,
    });
    const titleRes = await mistral.invoke(titleMessages);
    const dashboardTitle = titleRes.content.toString().trim().replace(/^"|"$/g, '');

    const finalDashboard: AnyFragment = {
      id: uuidv4(),
      type: 'dashboard',
      name: dashboardTitle,
      data: {
        layout: 'grid',
        fragments: dashboardFragments,
        originalPrompt: state.userInput,
      },
    };

    logger.info('dashboard_complete', {
      title: dashboardTitle,
      fragmentCount: dashboardFragments.length,
    });

    return {
      fragments: [finalDashboard],
    };
  } catch (err: any) {
    logger.error('dashboard_planning_error', { error: err.message });
    return { error: `Dashboard planning failed: ${err.message}` };
  }
}
