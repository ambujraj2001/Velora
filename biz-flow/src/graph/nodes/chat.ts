import { GraphState, MarkdownFragment } from '../../types';
import { mistral } from '../../config/llm';
import { v4 as uuidv4 } from 'uuid';

export async function chatNode(state: GraphState): Promise<Partial<GraphState>> {
  try {
    const res = await mistral.invoke([
      [
        'system',
        'You are a helpful AI assistant. Provide a clear, concise, and helpful markdown response to the user.',
      ],
      ['user', state.userInput],
    ]);

    const fragment: MarkdownFragment = {
      id: uuidv4(),
      type: 'md',
      data: { content: res.content.toString() },
    };

    return {
      fragments: [fragment],
    };
  } catch (err) {
    console.error(err);
    return {
      fragments: [
        { id: uuidv4(), type: 'error', data: { message: 'Failed to process chat query' } },
      ],
    };
  }
}
