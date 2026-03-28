import type { PromptMessages } from '.';

export function sqlGeneratorPrompt(params: {
  schemaContext: string;
  historyText: string;
  userInput: string;
}): PromptMessages {
  return [
    [
      'system',
      `You are a ClickHouse SQL generator.
Rules:
1. ONLY return the SQL query.
2. Only SELECT queries are allowed.
3. Use the provided schema.
4. If a query is a follow-up, consider the history.
5. Limit results to 100 unless specified.
6. DO NOT use semicolons (;) at the end of the query.

Schema:
${params.schemaContext}`,
    ],
    [
      'user',
      `History:\n${params.historyText}\n\nNew Request: ${params.userInput}`,
    ],
  ];
}
