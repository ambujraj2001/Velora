import { getClickhouseClient } from '../lib/clickhouse';
import { fetchSchema } from '../services/schemaService';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Script to test the ClickHouse connection provided by the user.
 * This confirms if the 'Deep Table Discovery' logic works for their cloud instance.
 */
async function testUserConnection() {
  const settings = {
    host: 'vjmzvtxtab.ap-south-1.aws.clickhouse.cloud',
    port: 8443,
    database: 'default',
    username: 'default',
    password: 'quf3_tvWAYU1b',
  };

  console.log('--- Testing ClickHouse Connectivity (Sync) ---');
  const client = getClickhouseClient(settings);
  try {
    const ping = await client.ping();
    console.log('Ping Success:', ping.success);
    if (!ping.success) return;

    console.log('\n--- Testing Deep Schema Discovery (Background Flow) ---');
    const schema = await fetchSchema(settings);
    console.log('DISCOVERED SCHEMA CONTEXT:\n');
    console.log(schema);

    if (schema.includes('flights') || schema.includes('ontime')) {
      console.log('\n✅ SUCCESS: Flight-related tables discovered!');
    } else if (schema.includes('No tables found')) {
      console.log('\n⚠️ WARNING: Database reachable but NO tables found anywhere (Global lookup).');
    } else {
      console.log('\n❓ INFO: Found tables, but none look like "flights".');
    }

  } catch (err: any) {
    console.error('\n❌ ERROR:', err.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

testUserConnection();
