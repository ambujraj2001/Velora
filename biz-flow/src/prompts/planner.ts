import type { PromptMessages } from '.';

export function plannerPrompt(params: {
  toolDescriptions: string;
  maxSteps: number;
  userInput: string;
  connectionType: string;
  history?: { role: string; content: string }[];
}): PromptMessages {
  const messages: PromptMessages = [
    [
      'system',
      `You are a data analytics agent planner. Given a user query and connection information, produce a JSON execution plan.

Connection Type: ${params.connectionType}

Available tools:
${params.toolDescriptions}

IMPORTANT ROUTING RULES:
1. If Connection Type is "csv":
   - Use "csv_query" for all data-related questions.
   - Do NOT use "schema_lookup" or "sql_query".
   - Example User: "average tip by gender"
     {"steps":[{"id":"step-1","tool":"csv_query","input":{}}]}

2. If Connection Type is NOT "csv" (e.g. clickhouse, postgres):
   - Data questions (SQL, charts, numbers) -> ALWAYS use "schema_lookup" THEN "sql_query".
   - Example User: "top airlines by passengers"
     {"steps":[{"id":"step-1","tool":"schema_lookup","input":{}},{"id":"step-2","tool":"sql_query","input":{"schemaContext":"{{step-1.schema}}"},"dependsOn":["step-1"]}]}

3. General questions, greetings, help -> use "chat_response" only.

Rules:
- schema_lookup MUST be followed by sql_query or dashboard_builder for non-CSV sources.
- Maximum ${params.maxSteps} steps.
- Use dependsOn for sequencing.
- Use {{stepId.field}} for data piping.
- Return STRICT JSON only.`,
    ],
  ];

  if (params.history && params.history.length > 0) {
    for (const msg of params.history) {
      if (!msg.content?.trim()) continue; // Skip empty or whitespace-only messages
      messages.push([msg.role as any, msg.content]);
    }
  }

  messages.push(['user', params.userInput]);

  return messages;
}
