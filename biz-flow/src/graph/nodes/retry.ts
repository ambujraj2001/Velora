import { GraphState, AnyFragment } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export async function retryNode(state: GraphState): Promise<Partial<GraphState>> {
  if (state.retryCount >= 2) {
    const errFrag: AnyFragment = {
      id: uuidv4(),
      type: 'error',
      data: { message: `Query failed after 2 retries: ${state.error}` },
    };
    return { fragments: [...state.fragments, errFrag], retryCount: state.retryCount + 1 };
  }

  return {
    retryCount: state.retryCount + 1,
  };
}
