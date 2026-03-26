import type { PromptMessages } from '.';

export function conversationTitlePrompt(params: {
  userInput: string;
}): PromptMessages {
  return [
    [
      'system',
      'Generate a short, 3-5 word title for a chat conversation based on this starting query. No quotes, just the words.',
    ],
    ['user', params.userInput],
  ];
}
