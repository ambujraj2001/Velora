import { Database } from 'duckdb-async';
import { invokeWithLogging } from '../lib/llmLogger';

export interface CsvQueryRequest {
  query: string;
  file_url: string;
  schema_json: any;
  description: string;
}

export interface CsvQueryResponse {
  sql: string;
  rows: any[];
}

/**
 * Generates DuckDB-compatible SQL from a natural language query using an LLM.
 */
export async function generateSqlFromCsv(
  params: {
    query: string;
    schema: { columns: { name: string; type: string }[] };
    description: string;
  },
  logger: any
): Promise<string> {
  logger.info('csv_sql_generation_start', { query: params.query });
  const columnsStr = params.schema.columns
    .map((c) => `- ${c.name}: ${c.type}`)
    .join('\n');

  const systemPrompt = `You are a SQL expert for DuckDB.

Given a CSV dataset:

Description:
${params.description}

Columns:
${columnsStr}

User question:
${params.query}

Rules:
* Generate ONLY a SQL query
* Use DuckDB syntax
* Table name is "data"
* Use only provided columns
* Do NOT hallucinate columns
* If aggregation -> no LIMIT
* Else -> LIMIT 100
* Use exact column names (quote if needed)`;

  const response = await invokeWithLogging(
    [['system', systemPrompt]],
    { logger, tool: 'csv_sql_generator' }
  );

  let sql = response.content.toString().trim();
  // Clean up any markdown blocks
  sql = sql
    .replace(/^```sql\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  return sql;
}

/**
 * Executes DuckDB SQL against a remote CSV file.
 */
export async function executeCsvSql(
  file_url: string,
  sql: string,
  logger: any
): Promise<any[]> {
  logger.info('csv_duckdb_initializing');
  const db = await (Database as any).create(':memory:');
  const conn = await db.connect();
  logger.info('csv_duckdb_ready');

  try {
    // Basic safety check: only SELECT
    const upperSql = sql.toUpperCase();
    if (!upperSql.startsWith('SELECT')) {
      logger.error('csv_safety_violation', { sql });
      throw new Error('Only SELECT queries are allowed.');
    }

    // Load CSV into table "data"
    logger.info('csv_remote_load_start', { file_url });
    await conn.run(`CREATE TABLE data AS SELECT * FROM read_csv_auto('${file_url}')`);
    logger.info('csv_remote_load_complete');

    // Execute generated SQL
    logger.info('csv_duckdb_executing', { sql });
    const rows = await conn.all(sql);
    logger.info('csv_duckdb_rows_fetched', { count: rows.length });
    return rows;
  } catch (err: any) {
    logger.error('csv_duckdb_error', { error: err.message, sql });
    throw err;
  } finally {
    await conn.close();
    await db.close();
  }
}

/**
 * Uses the LLM to fix a broken DuckDB SQL query based on an error message.
 */
export async function fixCsvSql(
  params: {
    sql: string;
    error: string;
    schema: { columns: { name: string; type: string }[] };
  },
  logger: any
): Promise<string> {
  const columnsStr = params.schema.columns
    .map((c) => `- ${c.name}: ${c.type}`)
    .join('\n');

  const systemPrompt = `You are fixing a SQL query for DuckDB.

Original SQL:
${params.sql}

Error:
${params.error}

Available columns:
${columnsStr}

Rules:
* Fix the SQL so it executes correctly
* Use only provided columns
* Table name is "data"
* Use DuckDB syntax
* Preserve original intent
* Return ONLY corrected SQL
* No explanation
* Use exact column names (quote if needed)`;

  const response = await invokeWithLogging(
    [['system', systemPrompt]],
    { logger, tool: 'csv_sql_fixer' }
  );

  let sql = response.content.toString().trim();
  // Clean up any markdown blocks
  sql = sql
    .replace(/^```sql\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  return sql;
}

/**
 * Orchestrates SQL generation and execution for CSV connections with self-healing retry.
 */
export async function askCsv(
  params: CsvQueryRequest,
  logger: any
): Promise<CsvQueryResponse> {
  // Step 1: Initial Generation
  const initialSql = await generateSqlFromCsv(
    {
      query: params.query,
      schema: params.schema_json,
      description: params.description,
    },
    logger
  );

  let currentSql = initialSql;

  try {
    // Step 2: First Attempt
    const rows = await executeCsvSql(params.file_url, currentSql, logger);
    return { sql: currentSql, rows };
  } catch (err: any) {
    // Step 3: Self-Healing Logic (One Retry)
    logger.warn('csv_query_first_attempt_failed', { sql: currentSql, error: err.message });

    try {
      logger.info('csv_healing_started', { originalSql: currentSql, error: err.message });
      
      // Step 4: Fix SQL
      const fixedSql = await fixCsvSql(
        {
          sql: currentSql,
          error: err.message,
          schema: params.schema_json,
        },
        logger
      );

      currentSql = fixedSql;
      logger.info('csv_healing_retry_executing', { fixedSql: currentSql });

      // Step 5: Final Attempt
      const rows = await executeCsvSql(params.file_url, currentSql, logger);
      
      logger.info('csv_query_healed_successfully');
      return { sql: currentSql, rows };

    } catch (retryErr: any) {
      // Final Failure
      logger.error('csv_healing_failed', { 
        originalSql: initialSql, 
        fixedSql: currentSql, 
        error: retryErr.message 
      });
      
      throw {
        error: "CSV_QUERY_FAILED",
        message: `Execution failed after healing attempt: ${retryErr.message}`,
        sql: currentSql
      };
    }
  }
}
