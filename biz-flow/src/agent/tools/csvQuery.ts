import type { Tool } from './types';
import { handleCsvChatAction } from '../../services/csvChatService';

/**
 * Tool for querying CSV files using DuckDB.
 * Leverages the isolated CSV query/chat flow.
 */
export const csvQueryTool: Tool = {
  name: 'csv_query',
  description: 'Analyzes and queries a remote CSV dataset using natural language. Use only for CSV-type connections.',
  
  async execute(input, context, _previousResults) {
    context.logger.info('tool_call', { tool: 'csv_query' });

    // Ensure we have the necessary connection info
    if (context.connectionSettings?.type !== 'csv') {
      throw new Error('csv_query tool can only be used with CSV connections.');
    }

    // Call the existing CSV chat handler logic
    // It already handles SQL generation, execution, and insightful summarization.
    const result = await handleCsvChatAction({
      query: context.userInput,
      connection: context.connectionSettings, // This needs to be correctly passed into context from chatController
      logger: context.logger
    });

    // Extract raw rows if available for potential post-processing (though optional)
    const tableFragment = result.fragments.find(f => f.type === 'table') as any;
    const rows = tableFragment?.data?.rows || [];

    return {
      fragments: result.fragments,
      sql: result.sql,
      rows: rows
    };
  },
};
