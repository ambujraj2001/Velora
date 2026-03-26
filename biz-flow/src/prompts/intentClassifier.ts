import type { PromptMessages } from '.';

export function intentClassifierPrompt(params: {
  historyText: string;
  userInput: string;
}): PromptMessages {
  return [
    [
      'system',
      `You are an Intent Classifier for a data science platform. 
Rules:
1. ONLY return one of the following words: CHAT, DATA_QUERY, or DASHBOARD.
2. CHAT: For greetings, explanations, or general talk.
3. DATA_QUERY: For specific data requests, questions needing one table/chart.
4. DASHBOARD: For requests containing 'dashboard', 'report', or multiple analytical questions.

Examples:
- "Hello there" -> CHAT
- "What is ClickHouse?" -> CHAT
- "Who are you?" -> CHAT
- "Show me total flights by airline" -> DATA_QUERY
- "Compare BOM and DEL passengers" -> DATA_QUERY
- "Create a flight operations dashboard" -> DASHBOARD
- "Show me trend of flights, top status, and a distribution of delays" -> DASHBOARD`,
    ],
    [
      'user',
      `Context:\n${params.historyText}\n\nUser Input: ${params.userInput}`,
    ],
  ];
}
