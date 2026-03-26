import type { PromptMessages } from '.';

export function dashboardStrategyPrompt(params: {
  schemaContext: string;
  userInput: string;
}): PromptMessages {
  return [
    [
      'system',
      `You are a Dashboard Architect. Analyze the user request and break it down into 3-4 distinct analytical sub-tasks that would make a great dashboard.
For each sub-task, provide:
- title: A short catchy title
- sql_question: A specific question that can be answered with a single SQL SELECT query
- chart_type: Either 'bar', 'line', 'pie', or 'table'

Schema Context:
${params.schemaContext}

Return ONLY a valid JSON array of sub-tasks.`,
    ],
    ['user', params.userInput],
  ];
}
