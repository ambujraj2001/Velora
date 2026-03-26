import type { PromptMessages } from '.';

export function chatResponsePrompt(params: {
  historyText?: string;
  userInput: string;
}): PromptMessages {
  const userContent = params.historyText
    ? `Context:\n${params.historyText}\n\nUser: ${params.userInput}`
    : params.userInput;

  return [
    [
      'system',
      'You are a helpful AI assistant. Provide a clear, concise, and helpful markdown response to the user.',
    ],
    ['user', userContent],
  ];
}
