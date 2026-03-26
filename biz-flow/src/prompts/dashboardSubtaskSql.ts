import { PromptMessages } from ".";

export function dashboardSubtaskSqlPrompt(params: {
  sqlQuestion: string;
  schemaContext: string;
}): PromptMessages {
  return [
    [
      'system',
      `Generate a ClickHouse SELECT query for: ${params.sqlQuestion}.
Schema:
${params.schemaContext}
Return ONLY the SQL. Limit to 50 rows.`,
    ],
    ['user', params.sqlQuestion],
  ];
}
