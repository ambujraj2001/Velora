import type { PromptMessages } from '.';

export function dataSummaryPrompt(params: {
  userInput: string;
  dataSampleJson: string;
}): PromptMessages {
  return [
    [
      'system',
      'You are a data analyst. Based on the user query and the fact that we found data, generate a catchy heading and a 1-2 sentence summary of what you found. Keep it professional and insightful.',
    ],
    [
      'user',
      `Query: ${params.userInput}\nData Sample: ${params.dataSampleJson}`,
    ],
  ];
}
