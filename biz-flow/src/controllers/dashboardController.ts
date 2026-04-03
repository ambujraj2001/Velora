import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';
import { mistral } from '../config/llm';
import { requireSessionUser } from '../utils/auth';
import { decrypt } from '../utils/crypto';
import { sendSuccess, sendError } from '../utils/response';
import { getClickhouseClient } from '../lib/clickhouse';
import { highchartsConfigPrompt } from '../prompts';
import type { SaveDashboardBody } from '../schemas';

const getUserOrReturn = (req: Request, res: Response) => {
  const user = requireSessionUser(req, res);
  if (!user) return null;
  return user;
};

export const saveDashboard = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { connectionId, name, description, fragments, queries } = req.body as SaveDashboardBody;

    logger.info('dashboard_saving', { name });

    const { data, error } = await supabase
      .from('velora_dashboards')
      .insert({
        user_id: user.userId,
        connection_id: connectionId,
        name,
        description,
        fragments,
        queries,
      })
      .select()
      .single();

    if (error) throw error;

    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('dashboard_save_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const getDashboards = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { data, error } = await supabase
      .from('velora_dashboards')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('dashboards_list_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const getDashboardById = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { id } = req.params;

    const { data, error } = await supabase
      .from('velora_dashboards')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.userId)
      .single();

    if (error) throw error;

    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('dashboard_fetch_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const refreshDashboard = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { id } = req.params;
    logger.info('dashboard_refreshing', { dashboardId: id });

    const { data: dashboard, error: dashErr } = await supabase
      .from('velora_dashboards')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.userId)
      .single();

    if (dashErr || !dashboard) {
      sendError(res, 'NOT_FOUND', 'Dashboard not found', 404);
      return;
    }

    const queries = dashboard.queries as Array<{
      name?: string;
      sql: string;
      type?: string;
    }> | null;
    if (!queries || queries.length === 0) {
      sendSuccess(res, dashboard);
      return;
    }

    const { data: connection, error: connErr } = await supabase
      .from('velora_connections')
      .select('*')
      .eq('id', dashboard.connection_id)
      .single();

    if (connErr || !connection) {
      sendError(res, 'NOT_FOUND', 'Connection not found', 404);
      return;
    }

    const client = getClickhouseClient({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: decrypt(connection.password),
    });

    const newFragments: Array<Record<string, unknown>> = [];

    try {
      for (const query of queries) {
        logger.info('db_query', { tool: 'clickhouse', dashboardId: id, queryName: query.name });

        const resultSet = await client.query({
          query: query.sql,
          format: 'JSONEachRow',
        });

        const rows = (await resultSet.json()) as Record<string, unknown>[];

        logger.info('db_query_result', { queryName: query.name, rowCount: rows.length });

        if (rows.length === 0) continue;

        const isChart =
          query.type === 'chart' || (rows.length > 0 && rows.length <= 30);

        if (isChart) {
          const contextPrompt = dashboard.description
            ? `Context: Original intent was "${dashboard.description}".`
            : undefined;

          const chartMessages = highchartsConfigPrompt({
            chartType: query.type || 'bar',
            title: query.name || 'Analytics',
            dataJson: JSON.stringify(rows.slice(0, 10)),
            contextPrompt,
          });
          const chartResponse = await mistral.invoke(chartMessages);

          const configStr = chartResponse.content
            .toString()
            .trim()
            .replace(/```json|```/g, '')
            .trim();

          newFragments.push({
            id: uuidv4(),
            type: 'chart',
            name: query.name,
            sql: query.sql,
            data: {
              highchartOptions: JSON.parse(configStr),
            },
          });
        } else {
          newFragments.push({
            id: uuidv4(),
            type: 'table',
            name: query.name,
            sql: query.sql,
            data: {
              columns: Object.keys(rows[0] as object),
              rows,
            },
          });
        }
      }
    } finally {
      await client.close();
    }

    if (newFragments.length === 0) {
      sendSuccess(res, dashboard);
      return;
    }

    const { data, error } = await supabase
      .from('velora_dashboards')
      .update({
        fragments: newFragments,
        last_refreshed_at: new Date(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info('dashboard_refreshed', { dashboardId: id, fragmentCount: newFragments.length });
    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('dashboard_refresh_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const deleteDashboard = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { id } = req.params;
    logger.info('dashboard_deleting', { dashboardId: id });

    const { error } = await supabase
      .from('velora_dashboards')
      .delete()
      .eq('id', id)
      .eq('user_id', user.userId);

    if (error) throw error;

    sendSuccess(res, { success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('dashboard_delete_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};
