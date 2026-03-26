import { GraphState, IntentData } from '../../types';
import { mistral } from '../../config/llm';
import { createLogger } from '../../lib/logger';

export async function intentNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  try {
    const historyText = state.history?.map((h) => `${h.role}: ${h.content}`).join('\n') || '';

    logger.info('tool_call', { tool: 'intent_classifier' });

    const response = await mistral.invoke([
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
      ['user', `Context:\n${historyText}\n\nUser Input: ${state.userInput}`],
    ]);

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
