import { GraphState, IntentData } from '../../types';
import { mistral } from '../../config/llm';
import { createLogger } from '../../lib/logger';
import { intentClassifierPrompt } from '../../prompts';

export async function intentNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  try {
    const historyText = state.history?.map((h) => `${h.role}: ${h.content}`).join('\n') || '';

    logger.info('tool_call', { tool: 'intent_classifier' });

    const messages = intentClassifierPrompt({
      historyText,
      userInput: state.userInput,
    });
    const response = await mistral.invoke(messages);

    let classification = response.content
      .toString()
      .trim()
      .toUpperCase()
      .split('\n')[0]
      .replace(/[^A-Z_]/g, '');
    if (!['CHAT', 'DATA_QUERY', 'DASHBOARD'].includes(classification)) {
      classification = 'CHAT';
    }

    logger.info('tool_result', { tool: 'intent_classifier', intent: classification });

    return {
      intent: classification as IntentData,
    };
  } catch (err: any) {
    logger.error('intent_classification_error', { error: err.message });
    return { intent: 'CHAT' };
  }
}
