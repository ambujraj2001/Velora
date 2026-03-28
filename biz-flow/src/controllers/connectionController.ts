import { supabase } from '../config/db';
import crypto from 'crypto';
import dotenv from 'dotenv';
import type { ConnectionType } from '../types';
import { requireSessionUser } from '../utils/auth';
import { getClickhouseClient } from '../lib/clickhouse';
import { indexConnection } from '../services/connectionEmbeddingService';
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

    const { name, type, host, port, database, username, password, description } = req.body;
    const normalizedType = String(type || '').toLowerCase() as ConnectionType;
    if (!CONNECTION_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        error: `Unsupported connection type. Use one of: ${CONNECTION_TYPES.join(', ')}`,
      });
    }
    const encPassword = encrypt(password);

    logger.info('connection_creating', { name, type: normalizedType });

    // --- Proactive Connectivity Check (Phase 1) ---
    if (normalizedType !== 'csv') {
      try {
        const client = getClickhouseClient({ host, port, database, username, password });
        const pinged = await client.ping();
        if (!pinged.success) throw new Error('Could not ping database.');
        await client.close();
      } catch (err: any) {
        logger.error('connection_validation_failed', { error: err.message });
        return res.status(400).json({ error: `Connection failed: ${err.message}` });
      }
    }

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
        description: (description || '').trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger indexing (async with schema fetch for SQL)
    (async () => {
      try {
        let schemaContext = '';
        if (normalizedType !== 'csv') {
          const { decrypt } = require('../utils/crypto');
          const settings = {
            host,
            port,
            database,
            username,
            password: decrypt(encPassword),
          };
          const { fetchSchema } = require('../services/schemaService');
          schemaContext = await fetchSchema(settings);
        }
        await indexConnection(data, logger, [], schemaContext);
      } catch (e: any) {
        logger.error('async_sql_indexing_failed', { error: e.message, connectionId: data.id });
      }
    })();

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
      .select('id, user_id, name, type, host, port, database, username, description, created_at')
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
async function loadConnection(userId: string, connId: string) {
  const { data: conn } = await supabase
    .from('velora_connections')
    .select('*')
    .eq('id', connId)
    .eq('user_id', userId)
    .single();
  return conn;
}

export const getConnectionTables = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const conn = await loadConnection(user.userId, id);
    if (!conn) return res.status(404).json({ error: 'Connection not found.' });

    if (conn.type === 'csv') {
      return res.json([{
        name: 'data',
        database: 'duckdb'
      }]);
    }

    const { decrypt } = require('../utils/crypto');
    const settings = {
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: decrypt(conn.password),
    };

    logger.info('db_query', { tool: 'clickhouse', query: 'SHOW TABLES', connectionId: id });

    const client = getClickhouseClient(settings);
    try {
      const result = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
      const rows = (await result.json()) as Array<{ name: string }>;
      const tables = rows.map((r) => ({
        name: r.name,
        database: conn.database || 'default',
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
    const conn = await loadConnection(user.userId, id);
    if (!conn) return res.status(404).json({ error: 'Connection not found.' });

    if (conn.type === 'csv') {
      if (table !== 'data') return res.status(404).json({ error: 'Table not found for CSV.' });
      
      const schema = (conn.schema_json as any);
      const columns = (schema?.columns || []).map((c: any) => ({
        name: c.name,
        type: c.type,
        default_type: '',
        comment: ''
      }));
      return res.json(columns);
    }

    const { decrypt } = require('../utils/crypto');
    const settings = {
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: decrypt(conn.password),
    };

    logger.info('db_query', { tool: 'clickhouse', query: 'DESCRIBE TABLE', table, connectionId: id });

    const client = getClickhouseClient(settings);
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
