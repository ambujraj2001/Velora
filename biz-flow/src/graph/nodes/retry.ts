import { GraphState, AnyFragment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../lib/logger';

export async function retryNode(state: GraphState): Promise<Partial<GraphState>> {
  const logger = createLogger({
    requestId: state.requestId || 'unknown',
    traceId: state.traceId,
  });

  if (state.retryCount >= 2) {
    logger.warn('retry_exhausted', { retryCount: state.retryCount, error: state.error });
    const errFrag: AnyFragment = {
      id: uuidv4(),
      type: 'error',
      data: { message: `Query failed after 2 retries: ${state.error}` },
    };
    return { fragments: [...state.fragments, errFrag], retryCount: state.retryCount + 1 };
  }

  logger.info('retry_attempt', { retryCount: state.retryCount + 1 });
  return {
    retryCount: state.retryCount + 1,
  };
}
