import type { PromptMessages } from '.';

export function dashboardTitlePrompt(params: {
  userInput: string;
}): PromptMessages {
  return [
    [
      'system',
      'Generate a short, professional, analysis-oriented title for a dashboard based on the user query. Return ONLY the title (max 5 words).',
    ],
    ['user', params.userInput],
  ];
}
