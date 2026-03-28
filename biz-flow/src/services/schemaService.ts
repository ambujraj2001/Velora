import { getClickhouseClient } from '../lib/clickhouse';
import { log } from '../lib/logger';

export async function fetchSchema(connectionSettings?: any) {
  const client = getClickhouseClient(connectionSettings);
  try {
    log('info', 'db_query', { tool: 'clickhouse', query: 'SHOW TABLES (robust fetch)' });

    // Connectivity test
    const ping = await client.ping();
    if (!ping.success) throw new Error('Database ping failed');

    const tableResult = await client.query({
      query: 'SHOW TABLES',
      format: 'JSONEachRow',
      clickhouse_settings: {
        max_execution_time: 30, // 30 seconds limit for this specific query
      },
    });
    
    let tables = (await tableResult.json()) as any[];

    if (!tables.length) {
      log('warn', 'no_tables_found_in_specified_db_attempting_global_discovery', { database: connectionSettings.database });
      // FALLBACK: Look into ANY non-system database to find some tables
      const globalResult = await client.query({
        query: "SELECT database, name FROM system.tables WHERE database NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA')",
        format: 'JSONEachRow',
      });
      const globalTables = (await globalResult.json()) as any[];
      
      if (!globalTables.length) {
        return `The ClickHouse instance is reachable but no tables were found in any accessible database.`;
      }
      
      // Map global tables to a format the loop can handle
      tables = globalTables.map(t => ({ name: `\`${t.database}\`.\`${t.name}\`` }));
    }

    let schemaContext = '';
    for (const table of tables) {
      const tableName = table.name;
      try {
        const schemaResult = await client.query({
          query: `DESCRIBE TABLE \`${tableName}\``,
          format: 'JSONEachRow',
        });
        const columns = (await schemaResult.json()) as any[];

        schemaContext += `Table: ${tableName}\nColumns:\n`;
        columns.forEach((col) => {
          schemaContext += `- ${col.name} (${col.type})\n`;
        });
        schemaContext += '\n';
      } catch (e: any) {
        log('warn', 'table_describe_failed', { table: tableName, error: e.message });
        schemaContext += `Table: ${tableName} (Schema fetch failed: ${e.message})\n\n`;
      }
    }

    log('info', 'schema_fetch_complete', { tableCount: tables.length });
    return schemaContext || 'No tables found in database.';
  } catch (err: any) {
    log('error', 'schema_fetch_error', { error: err.message });
    return `Error fetching schema: ${err.message}`;
  } finally {
    await client.close();
  }
}
