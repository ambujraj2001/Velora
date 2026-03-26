import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { GraphState, AnyFragment, IntentData } from '../types';

import { intentNode } from './nodes/intent';
import { chatNode } from './nodes/chat';
import { sqlGenerationNode } from './nodes/sql';
import { executeNode } from './nodes/execute';
import { retryNode } from './nodes/retry';
import { dashboardPlanningNode } from './nodes/dashboardPlan';
import { fragmentBuilderNode } from './nodes/fragmentBuilder';
import { createLogger } from '../lib/logger';

const withLogging = (name: string, node: any) => {
  return async (state: any, config: any) => {
    const logger = createLogger({
      requestId: state.requestId || 'unknown',
      traceId: state.traceId,
    });

    logger.info('node_start', { node: name, stateKeys: Object.keys(state) });
    const start = Date.now();

    try {
      const result = await node(state, config);
      logger.info('node_end', {
        node: name,
        duration: Date.now() - start,
        resultKeys: Object.keys(result || {}),
      });
      return result;
    } catch (error: any) {
      logger.error('node_error', {
        node: name,
        duration: Date.now() - start,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  };
};

export const GraphStateAnnotation = Annotation.Root({
  userInput: Annotation<string>(),
  intent: Annotation<IntentData>({
    reducer: (curr, next) => next ?? curr,
    default: () => 'CHAT',
  }),
  sql: Annotation<string | undefined>(),
  rows: Annotation<any[] | undefined>(),
  error: Annotation<string | undefined>(),
  retryCount: Annotation<number>({
    reducer: (curr, next) => next ?? curr,
    default: () => 0,
  }),
  fragments: Annotation<AnyFragment[]>({
    reducer: (curr, next) => [...(curr || []), ...(next || [])],
    default: () => [],
  }),
  history: Annotation<Array<{ role: 'user' | 'assistant'; content: string }> | undefined>(),
  dashboardPlan: Annotation<any>(),
  connectionId: Annotation<string | undefined>(),
  conversationId: Annotation<string | undefined>(),
  schemaContext: Annotation<string | undefined>(),
  connectionSettings: Annotation<any | undefined>(),
  traceId: Annotation<string | undefined>(),
  requestId: Annotation<string | undefined>(),
});

const routeAfterIntent = (state: typeof GraphStateAnnotation.State) => {
  if (state.intent === 'CHAT') return 'chatNode';
  if (state.intent === 'DATA_QUERY') return 'sqlNode';
  if (state.intent === 'DASHBOARD') return 'dashboardPlanNode';
  return 'chatNode';
};

const routeAfterExecution = (state: typeof GraphStateAnnotation.State) => {
  if (state.error) {
    if (state.retryCount >= 2) return END;
    return 'retryNode';
  }
  if (state.intent === 'DASHBOARD') return 'dashboardPlanNode';
  return 'fragmentBuilderNode';
};

const routeAfterDashboardPlan = (_state: typeof GraphStateAnnotation.State) => {
  return 'fragmentBuilderNode';
};

export const createGraph = () => {
  const builder = new StateGraph(GraphStateAnnotation)
    .addNode('intentNode', withLogging('intentNode', intentNode))
    .addNode('chatNode', withLogging('chatNode', chatNode))
    .addNode('sqlNode', withLogging('sqlNode', sqlGenerationNode))
    .addNode('executeNode', withLogging('executeNode', executeNode))
    .addNode('retryNode', withLogging('retryNode', retryNode))
    .addNode('dashboardPlanNode', withLogging('dashboardPlanNode', dashboardPlanningNode))
    .addNode('fragmentBuilderNode', withLogging('fragmentBuilderNode', fragmentBuilderNode))

    .addEdge(START, 'intentNode')

    .addConditionalEdges('intentNode', routeAfterIntent)
    .addEdge('chatNode', END)
    .addEdge('sqlNode', 'executeNode')

    .addConditionalEdges('executeNode', routeAfterExecution)
    .addEdge('retryNode', 'sqlNode')

    .addConditionalEdges('dashboardPlanNode', routeAfterDashboardPlan)
    .addEdge('fragmentBuilderNode', END);

  return builder.compile();
};
