import { GraphState, MarkdownFragment } from '../../types';
import { mistral } from '../../config/llm';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../lib/logger';

export async function chatNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  try {
    logger.info('tool_call', { tool: 'chat_llm' });

    const res = await mistral.invoke([
      [
        'system',
        'You are a helpful AI assistant. Provide a clear, concise, and helpful markdown response to the user.',
      ],
      ['user', state.userInput],
    ]);

    logger.info('tool_result', { tool: 'chat_llm', responseLength: res.content.toString().length });

    const fragment: MarkdownFragment = {
      id: uuidv4(),
      type: 'md',
      data: { content: res.content.toString() },
    };

    return {
      fragments: [fragment],
    };
  } catch (err: any) {
    logger.error('chat_llm_error', { error: err.message });
    return {
      fragments: [
        { id: uuidv4(), type: 'error', data: { message: 'Failed to process chat query' } },
      ],
    };
  }
}
