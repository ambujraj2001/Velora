import { GraphState, AnyFragment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { mistral } from '../../config/llm';
import { getClickhouseClient } from '../../lib/clickhouse';
import { createLogger } from '../../lib/logger';

export async function dashboardPlanningNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  try {
    logger.info('tool_call', { tool: 'dashboard_planner', userInput: state.userInput });

    const strategyRes = await mistral.invoke([
      [
        'system',
        `You are a Dashboard Architect. Analyze the user request and break it down into 3-4 distinct analytical sub-tasks that would make a great dashboard.
For each sub-task, provide: 
- title: A short catchy title
- sql_question: A specific question that can be answered with a single SQL SELECT query
- chart_type: Either 'bar', 'line', 'pie', or 'table'

Schema Context:
${state.schemaContext}

Return ONLY a valid JSON array of sub-tasks.`,
      ],
      ['user', state.userInput],
    ]);

    let content = strategyRes.content.toString().trim();
    if (content.startsWith('```json')) content = content.replace(/```json|```/g, '').trim();

    const subTasks = JSON.parse(content);
    const dashboardFragments: AnyFragment[] = [];

    logger.info('tool_result', { tool: 'dashboard_planner', subTaskCount: subTasks.length });

    const client = getClickhouseClient(state.connectionSettings as any);

    for (const task of subTasks) {
      try {
        logger.info('tool_call', { tool: 'dashboard_subtask', title: task.title });

        const sqlRes = await mistral.invoke([
          [
            'system',
            `Generate a ClickHouse SELECT query for: ${task.sql_question}.
Schema:
${state.schemaContext}
Return ONLY the SQL. Limit to 50 rows.`,
          ],
          ['user', task.sql_question],
        ]);

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
          const chartConfigRes = await mistral.invoke([
            [
              'system',
              `Generate a Highcharts configuration object for the given data.
The chart type is ${task.chart_type}. 
The title is "${task.title}".
Return ONLY the JSON object. 
Ensure it's a valid object that highcharts-react-official can consume.`,
            ],
            ['user', `Data: ${JSON.stringify(rows.slice(0, 10))}`],
          ]);

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

    const titleRes = await mistral.invoke([
      [
        'system',
        'Generate a short, professional, analysis-oriented title for a dashboard based on the user query. Return ONLY the title (max 5 words).',
      ],
      ['user', state.userInput],
    ]);
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
