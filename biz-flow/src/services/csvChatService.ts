import { v4 as uuidv4 } from 'uuid';
import { askCsv } from './csvQueryService';
import { AnyFragment } from '../types';

export interface CsvChatRequest {
  query: string;
  connection: any;
  logger: any;
}

export interface CsvChatResult {
  fragments: AnyFragment[];
  sql: string;
}

/**
 * Generates a business-friendly summary of the query results using the LLM.
 */
async function summarizeCsvResult(params: {
  query: string;
  rows: any[];
  logger: any;
}): Promise<string> {
  if (params.rows.length === 0) return "_No data was found for this query._";

  const systemPrompt = `You are a helpful data analyst. 
  
Review the following query and its result dataset:

User Question:
${params.query}

Result Rows (first 10):
${JSON.stringify(params.rows.slice(0, 10), null, 2)}

Rules:
* Provide a concise, professional, yet business-friendly summary.
* Highlight key insights or trends from the data.
* Be technical but understandable for a business user.
* Format as clean markdown (use bolding for emphasis).
* Do NOT mention internal SQL or database details.
* Keep it under 3 sentences.`;

  const { invokeWithLogging } = require('../lib/llmLogger');
  const response = await invokeWithLogging(
    [['system', systemPrompt]],
    { logger: params.logger, tool: 'csv_result_summarizer' }
  );

  return response.content.toString().trim();
}

/**
 * Handles chat requests for CSV connections by reusing the Phase 2 CSV query flow.
 * Converts the DuckDB results into standard Velora fragments (markdown + table).
 */
export async function handleCsvChatAction(params: CsvChatRequest): Promise<CsvChatResult> {
  const { query, connection, logger } = params;

  try {
    // 1. Reuse existing CSV query service (Infers schema + generates SQL + executes)
    const result = await askCsv({
      query,
      file_url: connection.file_url,
      schema_json: connection.schema_json,
      description: connection.description || ''
    }, logger);

    // 2. Generate insightful summary
    const summary = await summarizeCsvResult({
      query,
      rows: result.rows,
      logger
    });

    // 3. Build fragments in the standard format
    const fragments: AnyFragment[] = [];

    // Markdown summary
    fragments.push({
      id: uuidv4(),
      type: 'md',
      data: { 
        content: `### Query Results\n${summary}`
      }
    });

    // Table view
    if (result.rows && result.rows.length > 0) {
      fragments.push({
        id: uuidv4(),
        type: 'table',
        data: {
          columns: Object.keys(result.rows[0]),
          rows: result.rows
        },
        sql: result.sql
      });
    }

    return {
      fragments,
      sql: result.sql
    };

  } catch (err: any) {
    logger.error('csv_chat_service_error', { error: err.message, query });

    // Return a structured error fragment instead of crashing
    return {
      fragments: [
        {
          id: uuidv4(),
          type: 'error',
          data: { 
            message: `CSV Query Failed: ${err.message || 'Unknown error occurred while processing the CSV.'}` 
          }
        }
      ],
      sql: err.sql || ''
    };
  }
}
