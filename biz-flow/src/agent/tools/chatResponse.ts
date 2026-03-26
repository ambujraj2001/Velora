import type { Tool } from './types';
import { invokeWithLogging } from '../../lib/llmLogger';
import { chatResponsePrompt } from '../../prompts';

export const chatResponseTool: Tool = {
  name: 'chat_response',
  description:
    'Generates a conversational markdown response. Use for greetings, explanations, or questions that do not require database queries.',

  async execute(_input, context) {
    context.logger.info('tool_call', { tool: 'chat_response' });

    const historyText =
      context.history
        ?.map((h) => `${h.role}: ${h.content}`)
        .join('\n') || '';

    const messages = chatResponsePrompt({
      historyText: historyText || undefined,
      userInput: context.userInput,
    });

    const response = await invokeWithLogging(
      messages,
      { logger: context.logger, tool: 'chat_response' },
    );

    const content = response.content.toString();

    context.logger.info('tool_result', {
      tool: 'chat_response',
      contentLength: content.length,
    });

    return { content };
  },
};
