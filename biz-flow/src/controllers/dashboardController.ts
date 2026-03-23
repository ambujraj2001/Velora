import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';

export const saveDashboard = async (req: any, res: any) => {
    try {
        const user = requireSessionUser(req, res);
        if (!user) return;

        const { connectionId, name, description, fragments, queries } = req.body;
        const { data, error } = await supabase
            .from('velora_dashboards')
            .insert({
                user_id: user.userId,
                connection_id: connectionId,
                name,
                description,
                fragments,
                queries
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export const getDashboards = async (req: any, res: any) => {
    try {
        const user = requireSessionUser(req, res);
        if (!user) return;

        const { data, error } = await supabase
            .from('velora_dashboards')
            .select('*')
            .eq('user_id', user.userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export const getDashboardById = async (req: any, res: any) => {
    try {
        const user = requireSessionUser(req, res);
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
        res.status(500).json({ error: err.message });
    }
}

export const refreshDashboard = async (req: any, res: any) => {
    try {
        const user = requireSessionUser(req, res);
        if (!user) return;

        const { id } = req.params;
        // 1. Fetch dashboard queries
        // 2. Re-run sql through executeNode / connection
        // 3. Update fragments in db
        
        const { data: db } = await supabase.from('velora_dashboards').select('queries').eq('id', id).eq('user_id', user.userId).single();
        if(!db) throw new Error("Not found");
        
        let newFragments: any[] = [];
        
        // Mocking refresh
        for(let q of db.queries) {
            newFragments.push({
                 id: 'refreshed-id',
                 type: 'md',
                 data: { content: `Refreshed query: ${q.sql}` }
            })
        }

        const { data, error } = await supabase
            .from('velora_dashboards')
            .update({
                fragments: newFragments,
                last_refreshed_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
