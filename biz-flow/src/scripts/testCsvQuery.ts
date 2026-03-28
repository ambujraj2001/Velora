/**
 * Internal CSV test utility — NOT a production endpoint.
 *
 * Usage:
 *   npx ts-node src/scripts/testCsvQuery.ts <https://...csv_url>
 *
 * Prints up to 50 rows from the remote CSV file via DuckDB in-memory.
 * No data is written to disk or Supabase.
 */

import { validateCsvInput, inferCsvSchema, sampleCsvRows } from '../services/csvService';

async function main() {
  const file_url = process.argv[2];

  if (!file_url) {
    console.error('Usage: npx ts-node src/scripts/testCsvQuery.ts <file_url>');
    process.exit(1);
  }

  // Reuse the same validation as the API
  const err = validateCsvInput('test', file_url, 'test');
  if (err) {
    console.error(`Validation failed: ${err}`);
    process.exit(1);
  }

  console.log(`\n🔍 Inferring schema for: ${file_url}\n`);

  try {
    // 2. Infer Schema
    const logger = { info: console.log, error: console.error, warn: console.warn };
    const schema = await inferCsvSchema(file_url, logger);
    console.log('\n📊 Inferred Schema:');
    console.table(schema.columns);

    console.log('\n📄 Sample rows (up to 50):');
    const rows = await sampleCsvRows(file_url, 50);
    console.table(rows);

    console.log(`\n✅ Done — ${rows.length} row(s) returned.`);
  } catch (e: any) {
    console.error(`\n❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main();
