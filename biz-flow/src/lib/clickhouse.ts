import { createClient } from '@clickhouse/client';

export const getClickhouseClient = (settings?: {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}) => {
  return createClient({
    url: settings?.host
      ? `https://${settings.host}:${settings.port || 8443}`
      : process.env.CLICKHOUSE_URL,
    username: settings?.username || process.env.CLICKHOUSE_USER || 'default',
    password: settings?.password || process.env.CLICKHOUSE_PASSWORD,
    database: settings?.database || process.env.CLICKHOUSE_DATABASE || 'default',
  });
};
