import { getClickhouseClient } from '../lib/clickhouse';

export async function fetchSchema(connectionSettings?: any) {
  const client = getClickhouseClient(connectionSettings);
  try {
    const tableResult = await client.query({
      query: 'SHOW TABLES',
      format: 'JSONEachRow',
    });
    const tables = (await tableResult.json()) as any[];
    
    let schemaContext = '';
    
    for (const table of tables) {
      const tableName = table.name;
      const schemaResult = await client.query({
        query: `DESCRIBE TABLE ${tableName}`,
        format: 'JSONEachRow',
      });
      const columns = (await schemaResult.json()) as any[];
      
      schemaContext += `Table: ${tableName}\nColumns:\n`;
      columns.forEach(col => {
        schemaContext += `- ${col.name} (${col.type})\n`;
      });
      schemaContext += '\n';
    }
    
    return schemaContext || 'No tables found in database.';
  } catch (err: any) {
    console.error('Schema fetch error:', err);
    return `Error fetching schema: ${err.message}`;
  } finally {
    await client.close();
  }
}
