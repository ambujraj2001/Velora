import { GraphState, AnyFragment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { mistral } from '../../config/llm';
import { getClickhouseClient } from '../../lib/clickhouse';
import logger from '../../lib/logger';

export async function dashboardPlanningNode(state: GraphState): Promise<Partial<GraphState>> {
   try {
       logger.info("Starting Dashboard Planning...", { userInput: state.userInput });

       // 1. Generate Planning Strategy
       const strategyRes = await mistral.invoke([
           ["system", `You are a Dashboard Architect. Analyze the user request and break it down into 3-4 distinct analytical sub-tasks that would make a great dashboard.
For each sub-task, provide: 
- title: A short catchy title
- sql_question: A specific question that can be answered with a single SQL SELECT query
- chart_type: Either 'bar', 'line', 'pie', or 'table'

Schema Context:
${state.schemaContext}

Return ONLY a valid JSON array of sub-tasks.`],
           ["user", state.userInput]
       ]);

       let content = strategyRes.content.toString().trim();
       if (content.startsWith("```json")) content = content.replace(/```json|```/g, "").trim();
       
       const subTasks = JSON.parse(content);
       const dashboardFragments: AnyFragment[] = [];

       // 2. Process each sub-task
       const client = getClickhouseClient(state.connectionSettings as any);

       for (const task of subTasks) {
           try {
               logger.info(`Processing dashboard sub-task: ${task.title}`);

               // Generate SQL for sub-task
               const sqlRes = await mistral.invoke([
                   ["system", `Generate a ClickHouse SELECT query for: ${task.sql_question}.
Schema:
${state.schemaContext}
Return ONLY the SQL. Limit to 50 rows.`],
                   ["user", task.sql_question]
               ]);

               let sql = sqlRes.content.toString().trim().replace(/```sql|```/g, "").trim();
               
               // Execute
               const resultSet = await client.query({
                   query: sql,
                   format: 'JSONEachRow'
               });
               const rows = (await resultSet.json()) as any[];

               if (rows.length === 0) continue;

               if (task.chart_type === 'table' || rows.length > 30) {
                   dashboardFragments.push({
                       id: uuidv4(),
                       type: 'table',
                       name: task.title,
                       data: {
                           columns: Object.keys(rows[0]),
                           rows: rows
                       }
                   });
               } else {
                   // Generate Chart Config
                   const chartConfigRes = await mistral.invoke([
                       ["system", `Generate a Highcharts configuration object for the given data.
The chart type is ${task.chart_type}. 
The title is "${task.title}".
Return ONLY the JSON object. 
Ensure it's a valid object that highcharts-react-official can consume.`],
                       ["user", `Data: ${JSON.stringify(rows.slice(0, 10))}`]
                   ]);

                   let configStr = chartConfigRes.content.toString().trim().replace(/```json|```/g, "").trim();
                   dashboardFragments.push({
                       id: uuidv4(),
                       type: 'chart',
                       name: task.title,
                       data: { highchartOptions: JSON.parse(configStr) }
                   });
               }
           } catch (err) {
               logger.error(`Failed sub-task: ${task.title}`, { error: err });
           } finally {
               // Each sub-task creates its own client connection in the loop? 
               // Actually the client is created once outside.
           }
       }
       
       await client.close();

       if (dashboardFragments.length === 0) {
           return { error: "Could not generate any meaningful data for this dashboard." };
       }

       // 3. Assemble Final Dashboard Fragment
       const finalDashboard: AnyFragment = {
           id: uuidv4(),
           type: 'dashboard',
           data: {
               layout: "grid",
               fragments: dashboardFragments
           }
       };

       return { 
           fragments: [finalDashboard] // This replaces the fragments since it's a new dashboard
       };

   } catch (err: any) {
       logger.error("Dashboard Planning Error", { error: err.message });
       return { error: `Dashboard planning failed: ${err.message}` };
   }
}


