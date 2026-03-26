import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { highchartsConfigPrompt } from '../prompts';

const getUserOrReturn = (req: any, res: any) => {
  const user = requireSessionUser(req, res);
  if (!user) return null;
  return user;
};

export const saveDashboard = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const {
      connectionId,
      name,
      description,
      fragments,
      queries,
    } = req.body;

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

    res.json(data);
  } catch (err: any) {
    logger.error('dashboard_save_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const getDashboards = async (req: any, res: any) => {
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

    res.json(data);
  } catch (err: any) {
    logger.error('dashboards_list_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const getDashboardById = async (req: any, res: any) => {
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

    res.json(data);
  } catch (err: any) {
    logger.error('dashboard_fetch_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const refreshDashboard = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { id } = req.params;
    logger.info('dashboard_refreshing', { dashboardId: id });

    const { data: dashboard } = await supabase
      .from('velora_dashboards')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.userId)
      .single();

    if (!dashboard) throw new Error('Dashboard not found');

    if (!dashboard.queries || dashboard.queries.length === 0) {
      return res.json(dashboard);
    }

    const { data: connection } = await supabase
      .from('velora_connections')
      .select('*')
      .eq('id', dashboard.connection_id)
      .single();

    if (!connection) throw new Error('Connection not found');

    const { decrypt } = require('../utils/crypto');
    const { getClickhouseClient } = require('../lib/clickhouse');
    const { mistral } = require('../config/llm');
    const { v4: uuidv4 } = require('uuid');

    const client = getClickhouseClient({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: decrypt(connection.password),
    });

    const newFragments: any[] = [];

    try {
      for (const query of dashboard.queries) {
        logger.info('db_query', { tool: 'clickhouse', dashboardId: id, queryName: query.name });

        const resultSet = await client.query({
          query: query.sql,
          format: 'JSONEachRow',
        });

        const rows = (await resultSet.json()) as any[];

        logger.info('db_query_result', { queryName: query.name, rowCount: rows.length });

        if (rows.length === 0) continue;

        const isChart =
          query.type === 'chart' ||
          (rows.length > 0 && rows.length <= 30);

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
              columns: Object.keys(rows[0]),
              rows,
            },
          });
        }
      }
    } finally {
      await client.close();
    }

    if (newFragments.length === 0) {
      return res.json(dashboard);
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
    res.json(data);
  } catch (err: any) {
    logger.error('dashboard_refresh_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export const deleteDashboard = async (req: any, res: any) => {
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

    res.json({ success: true });
  } catch (err: any) {
    logger.error('dashboard_delete_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};
