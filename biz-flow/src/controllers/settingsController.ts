import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';

export const getSettings = async (req: any, res: any) => {
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { data } = await supabase
      .from('velora_settings')
      .select('*')
      .eq('user_id', user.userId)
      .single();

    res.json(data || { query_run_mode: 'ask_every_time' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSettings = async (req: any, res: any) => {
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { query_run_mode } = req.body;

    const { data, error } = await supabase
      .from('velora_settings')
      .upsert(
        { user_id: user.userId, query_run_mode },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getTeam = async (req: any, res: any) => {
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    // Return the current user as the owner
    const { data: me } = await supabase
      .from('velora_users')
      .select('id, email, name, created_at')
      .eq('id', user.userId)
      .single();

    // Also return accepted invites
    const { data: invites } = await supabase
      .from('velora_team_invites')
      .select('*')
      .eq('invited_by', user.userId)
      .order('created_at', { ascending: false });

    const members = [];
    if (me) {
      members.push({ ...me, role: 'Owner', status: 'Active' });
    }

    // Add accepted invitees as members
    if (invites) {
      for (const inv of invites) {
        members.push({
          id: inv.id,
          email: inv.email,
          name: null,
          role: 'Member',
          status: inv.status === 'accepted' ? 'Active' : 'Pending',
          created_at: inv.created_at,
        });
      }
    }

    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const sendInvites = async (req: any, res: any) => {
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Provide an array of emails.' });
    }

    const rows = emails.map((email: string) => ({
      invited_by: user.userId,
      email: email.trim().toLowerCase(),
      status: 'pending',
    }));

    const { data, error } = await supabase
      .from('velora_team_invites')
      .insert(rows)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
