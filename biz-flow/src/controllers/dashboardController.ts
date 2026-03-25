import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';

// -----------------------------
// Helpers
// -----------------------------

const getUserOrReturn = (req: any, res: any) => {
  const user = requireSessionUser(req, res);
  if (!user) return null;
  return user;
};

const handleError = (res: any, err: any) => {
  res.status(500).json({ error: err.message });
};

// -----------------------------
// Create Dashboard
// -----------------------------

export const saveDashboard = async (req: any, res: any) => {
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
    handleError(res, err);
  }
};

// -----------------------------
// Get All Dashboards
// -----------------------------

export const getDashboards = async (req: any, res: any) => {
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
    handleError(res, err);
  }
};

// -----------------------------
// Get Dashboard By ID
// -----------------------------

export const getDashboardById = async (req: any, res: any) => {
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
    handleError(res, err);
  }
};

// -----------------------------
// Refresh Dashboard
// -----------------------------

export const refreshDashboard = async (req: any, res: any) => {
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { id } = req.params;

    // 1. Load dashboard
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

    // 2. Load connection
    const { data: connection } = await supabase
      .from('velora_connections')
      .select('*')
      .eq('id', dashboard.connection_id)
      .single();

    if (!connection) throw new Error('Connection not found');

    // 3. Lazy imports (kept same)
    const { decrypt } = require('../utils/crypto');
    const { getClickhouseClient } = require('../lib/clickhouse');
    const { mistral } = require('../config/llm');
    const { v4: uuidv4 } = require('uuid');

    // 4. Create DB client
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
        // Execute SQL
        const resultSet = await client.query({
          query: query.sql,
          format: 'JSONEachRow',
        });

        const rows = (await resultSet.json()) as any[];

        if (rows.length === 0) continue;

        // Decide chart vs table
        const isChart =
          query.type === 'chart' ||
          (rows.length > 0 && rows.length <= 30);

        if (isChart) {
          // Build context
          const contextPrompt = dashboard.description
            ? `Context: Original intent was "${dashboard.description}".`
            : '';

          // Generate chart config via LLM
          const chartResponse = await mistral.invoke([
            [
              'system',
              `Generate a Highcharts configuration object for the given data.
${contextPrompt}
The chart sub-title is "${query.name || 'Analytics'}".
Return ONLY the JSON object. 
Ensure it's a valid object that highcharts-react-official can consume.`,
            ],
            [
              'user',
              `Data to visualize: ${JSON.stringify(rows.slice(0, 10))}`,
            ],
          ]);

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
          // Table fallback
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

    // If nothing generated, return original
    if (newFragments.length === 0) {
      return res.json(dashboard);
    }

    // 5. Update dashboard
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

    res.json(data);
  } catch (err: any) {
    handleError(res, err);
  }
};

// -----------------------------
// Delete Dashboard
// -----------------------------

export const deleteDashboard = async (req: any, res: any) => {
  try {
    const user = getUserOrReturn(req, res);
    if (!user) return;

    const { id } = req.params;

    const { error } = await supabase
      .from('velora_dashboards')
      .delete()
      .eq('id', id)
      .eq('user_id', user.userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    handleError(res, err);
  }
};