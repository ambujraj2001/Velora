import type { Request, Response } from 'express';
import { supabase } from '../config/db';
import dotenv from 'dotenv';
import { requireSessionUser } from '../utils/auth';
import { encrypt, decrypt } from '../utils/crypto';
import { sendSuccess, sendError } from '../utils/response';
import { getClickhouseClient } from '../lib/clickhouse';
import { indexConnection } from '../services/connectionEmbeddingService';
import { fetchSchema } from '../services/schemaService';
import type { AddConnectionBody } from '../schemas';

dotenv.config();

export const addConnection = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { name, type, host, port, database, username, password, description } =
      req.body as AddConnectionBody;
    const encPassword = encrypt(password);

    logger.info('connection_creating', { name, type });

    try {
      const client = getClickhouseClient({ host, port, database, username, password });
      const pinged = await client.ping();
      if (!pinged.success) throw new Error('Could not ping database.');
      await client.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('connection_validation_failed', { error: msg });
      sendError(res, 'CONNECTION_FAILED', `Connection failed: ${msg}`, 400);
      return;
    }

    const { data, error } = await supabase
      .from('velora_connections')
      .insert({
        user_id: user.userId,
        name,
        type,
        host,
        port,
        database,
        username,
        password: encPassword,
        description: (description ?? '').trim(),
      })
      .select()
      .single();

    if (error) throw error;

    (async () => {
      try {
        const settings = {
          host,
          port,
          database,
          username,
          password: decrypt(encPassword),
        };
        const schemaContext = await fetchSchema(settings);
        await indexConnection(data, logger, [], schemaContext);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('async_sql_indexing_failed', { error: msg, connectionId: data.id });
      }
    })();

    const { password: _, ...rest } = data;
    sendSuccess(res, rest);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('connection_create_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const getConnections = async (req: Request, res: Response): Promise<void> => {
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
    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('connections_list_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const deleteConnection = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const id = String(req.params.id);
    logger.info('connection_deleting', { connectionId: id });

    const { error } = await supabase
      .from('velora_connections')
      .delete()
      .eq('user_id', user.userId)
      .eq('id', id);

    if (error) throw error;
    sendSuccess(res, { success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('connection_delete_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

async function loadConnection(userId: string, connId: string) {
  const { data: conn } = await supabase
    .from('velora_connections')
    .select('*')
    .eq('id', connId)
    .eq('user_id', userId)
    .single();
  return conn;
}

export const getConnectionTables = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const id = String(req.params.id);
    const conn = await loadConnection(user.userId, id);
    if (!conn) {
      sendError(res, 'NOT_FOUND', 'Connection not found.', 404);
      return;
    }

    if (conn.type === 'csv') {
      sendSuccess(res, [
        {
          name: 'data',
          database: 'duckdb',
        },
      ]);
      return;
    }

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
      sendSuccess(res, tables);
    } finally {
      await client.close();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('connection_tables_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const getConnectionTableColumns = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const id = String(req.params.id);
    const table = String(req.params.table);
    const conn = await loadConnection(user.userId, id);
    if (!conn) {
      sendError(res, 'NOT_FOUND', 'Connection not found.', 404);
      return;
    }

    if (conn.type === 'csv') {
      if (table !== 'data') {
        sendError(res, 'NOT_FOUND', 'Table not found for CSV.', 404);
        return;
      }

      const schema = conn.schema_json as { columns?: Array<{ name: string; type: string }> };
      const columns = (schema?.columns || []).map((c) => ({
        name: c.name,
        type: c.type,
        default_type: '',
        comment: '',
      }));
      sendSuccess(res, columns);
      return;
    }

    const settings = {
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: decrypt(conn.password),
    };

    logger.info('db_query', {
      tool: 'clickhouse',
      query: 'DESCRIBE TABLE',
      table,
      connectionId: id,
    });

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
      sendSuccess(res, columns);
    } finally {
      await client.close();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('connection_columns_error', { error: msg, table: req.params.table });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};
