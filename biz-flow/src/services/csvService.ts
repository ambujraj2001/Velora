import { Database } from 'duckdb-async';
import { supabase } from '../config/db';
import { indexConnection } from './connectionEmbeddingService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CsvColumn {
  name: string;
  type: string;
}

export interface CsvSchema {
  columns: CsvColumn[];
}

export interface CreateCsvConnectionInput {
  name: string;
  file_url: string;
  description: string;
  user_id: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = ['localhost', '127.0.0.1', 'file://'];

export function validateCsvInput(
  name: string,
  file_url: string,
  description: string,
): string | null {
  if (!name || !name.trim()) return 'name is required';
  if (!file_url || !file_url.trim()) return 'file_url is required';
  if (!description || !description.trim()) return 'description is required';

  if (!file_url.startsWith('https://'))
    return 'file_url must start with https://';

  for (const pattern of BLOCKED_PATTERNS) {
    if (file_url.includes(pattern))
      return `file_url must not contain "${pattern}"`;
  }

  return null; // valid
}

// ─── Schema Inference ─────────────────────────────────────────────────────────

/**
 * Uses DuckDB in-memory to infer the column schema of a remote CSV file.
 * No data is persisted — the DB is discarded after the call.
 */
export async function inferCsvSchema(file_url: string, logger: any): Promise<CsvSchema> {
  logger.info('csv_schema_inference_start', { file_url });
  const db = await (Database as any).create(':memory:');
  const conn = await db.connect();

  try {
    const rows = (await conn.all(
      `DESCRIBE SELECT * FROM read_csv_auto('${file_url}')`,
    )) as Array<{ column_name: string; column_type: string }>;

    const columns: CsvColumn[] = rows.map((r) => ({
      name: r.column_name,
      type: r.column_type,
    }));

    logger.info('csv_schema_inference_complete', { columnCount: columns.length });
    return { columns };
  } catch (err: any) {
    logger.error('csv_schema_inference_error', { error: err.message, file_url });
    throw err;
  } finally {
    await conn.close();
    await db.close();
  }
}

// ─── Supabase Storage ─────────────────────────────────────────────────────────

/**
 * Inserts a CSV connection record (with inferred schema) into velora_connections.
 */
export async function createCsvConnection(
  input: CreateCsvConnectionInput,
  logger: any
): Promise<Record<string, any>> {
  const { name, file_url, description, user_id } = input;

  // 1. Infer schema first — fail fast if CSV is invalid/inaccessible
  const schema = await inferCsvSchema(file_url, logger);

  // 2. Insert into Supabase
  const { data, error } = await supabase
    .from('velora_connections')
    .insert({
      user_id,
      name: name.trim(),
      type: 'csv',
      file_url: file_url.trim(),
      description: description.trim(),
      schema_json: schema,
      // Metadata placeholders for NOT NULL columns in legacy table schema
      host: 'duckdb-in-memory',
      port: 0,
      database: 'memory',
      username: 'na',
      password: 'na',
    })
    .select()
    .single();

  if (error) {
    logger.error('csv_connection_save_error', { error: error.message, name });
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  // 3. Generate and store embeddings (async with sample rows)
  (async () => {
    try {
      const samples = await sampleCsvRows(file_url, 3);
      await indexConnection(data, logger, samples);
    } catch (e: any) {
      logger.error('async_csv_indexing_failed', { error: e.message, connectionId: data.id });
      // Fallback to indexing without samples if sampling fails
      await indexConnection(data, logger);
    }
  })();

  return data;
}

// ─── Test Utility (internal only) ────────────────────────────────────────────

/**
 * Fetches up to 50 rows from a remote CSV.  Only for internal verification —
 * do NOT expose this through a public API endpoint.
 */
export async function sampleCsvRows(
  file_url: string,
  limit = 50,
): Promise<Record<string, any>[]> {
  const db = await Database.create(':memory:');
  const conn = await db.connect();

  try {
    const rows = await conn.all(
      `SELECT * FROM read_csv_auto('${file_url}') LIMIT ${limit}`,
    );
    return rows as Record<string, any>[];
  } finally {
    await conn.close();
    await db.close();
  }
}
