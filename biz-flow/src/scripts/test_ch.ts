import { createClient } from '@clickhouse/client';

async function test() {
  const client = createClient({
    host: 'https://vjmzvtxtab.ap-south-1.aws.clickhouse.cloud:8443',
    username: 'default',
    password: 'quf3_tvWAYU1b',
    database: 'default',
  });

  try {
    const currentDBRes = await client.query({
      query: 'SELECT currentDatabase()',
      format: 'JSONEachRow',
    });
    const currentDB = await currentDBRes.json();
    console.log('Current DB:', currentDB);

    const resultSet = await client.query({
      query: 'SHOW TABLES',
      format: 'JSONEachRow',
    });
    const tables = await resultSet.json();
    console.log('Tables:', JSON.stringify(tables, null, 2));

    for (const table of tables as any[]) {
      const tableName = table.name;
      const schemaSet = await client.query({
        query: `DESCRIBE TABLE ${tableName}`,
        format: 'JSONEachRow',
      });
      const schema = await schemaSet.json();
      console.log(`Schema for ${tableName}:`, JSON.stringify(schema, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

test();
