import { supabase } from '../config/db';
import crypto from 'crypto';
import dotenv from 'dotenv';
import type { ConnectionType } from '../types';
import { requireSessionUser } from '../utils/auth';
import { getClickhouseClient } from '../lib/clickhouse';
dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678123456781234567812345678'; // 32 bytes
const IV_LENGTH = 16;
const CONNECTION_TYPES: ConnectionType[] = ['postgres', 'clickhouse'];

function encrypt(text: string) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export const addConnection = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { name, type, host, port, database, username, password } = req.body;
    const normalizedType = String(type || '').toLowerCase() as ConnectionType;
    if (!CONNECTION_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        error: `Unsupported connection type. Use one of: ${CONNECTION_TYPES.join(', ')}`,
      });
    }
    const encPassword = encrypt(password);

    logger.info('connection_creating', { name, type: normalizedType });

    const { data, error } = await supabase
      .from('velora_connections')
      .insert({
        user_id: user.userId,
        name,
        type: normalizedType,
        host,
        port,
        database,
        username,
        password: encPassword,
      })
      .select()
      .single();

    if (error) throw error;

    const { password: _, ...rest } = data;
    res.json(rest);
  } catch (err: any) {
    logger.error('connection_create_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const getConnections = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { data, error } = await supabase
      .from('velora_connections')
      .select('id, user_id, name, type, host, port, database, username, created_at')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    logger.error('connections_list_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const deleteConnection = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { id } = req.params;
    logger.info('connection_deleting', { connectionId: id });

    const { error } = await supabase
      .from('velora_connections')
      .delete()
      .eq('user_id', user.userId)
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    logger.error('connection_delete_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Helper: load and decrypt a connection by ID for the authed user
async function loadConnectionSettings(userId: string, connId: string) {
  const { data: conn } = await supabase
    .from('velora_connections')
    .select('*')
    .eq('id', connId)
    .eq('user_id', userId)
    .single();
  if (!conn) return null;
  const { decrypt } = require('../utils/crypto');
  return {
    conn,
    settings: {
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: decrypt(conn.password),
    },
  };
}

export const getConnectionTables = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const loaded = await loadConnectionSettings(user.userId, id);
    if (!loaded) return res.status(404).json({ error: 'Connection not found.' });

    logger.info('db_query', { tool: 'clickhouse', query: 'SHOW TABLES', connectionId: id });

    const client = getClickhouseClient(loaded.settings);
    try {
      const result = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
      const rows = (await result.json()) as Array<{ name: string }>;
      const tables = rows.map((r) => ({
        name: r.name,
        database: loaded.conn.database || 'default',
      }));
      res.json(tables);
    } finally {
      await client.close();
    }
  } catch (err: any) {
    logger.error('connection_tables_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const getConnectionTableColumns = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { id, table } = req.params;
    const loaded = await loadConnectionSettings(user.userId, id);
    if (!loaded) return res.status(404).json({ error: 'Connection not found.' });

    logger.info('db_query', { tool: 'clickhouse', query: 'DESCRIBE TABLE', table, connectionId: id });

    const client = getClickhouseClient(loaded.settings);
    try {
      const result = await client.query({
        query: `DESCRIBE TABLE \`${table}\``,
        format: 'JSONEachRow',
      });
      const columns = (await result.json()) as Array<{
        name: string;
        type: string;
        default_type: string;
        comment: string;
      }>;
      res.json(columns);
    } finally {
      await client.close();
    }
  } catch (err: any) {
    logger.error('connection_columns_error', { error: err.message, table: req.params.table });
    res.status(500).json({ error: err.message });
  }
};

