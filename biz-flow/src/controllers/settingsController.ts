import type { Request, Response } from 'express';
import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { sendSuccess, sendError } from '../utils/response';
import type { UpdateSettingsBody, SendInvitesBody } from '../schemas';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { data } = await supabase
      .from('velora_settings')
      .select('*')
      .eq('user_id', user.userId)
      .single();

    sendSuccess(res, data || { query_run_mode: 'ask_every_time' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('settings_fetch_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { query_run_mode } = req.body as UpdateSettingsBody;

    const { data, error } = await supabase
      .from('velora_settings')
      .upsert(
        { user_id: user.userId, query_run_mode },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('settings_update_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const getTeam = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { data: me } = await supabase
      .from('velora_users')
      .select('id, email, name, created_at')
      .eq('id', user.userId)
      .single();

    const { data: invites } = await supabase
      .from('velora_team_invites')
      .select('*')
      .eq('invited_by', user.userId)
      .order('created_at', { ascending: false });

    const members: Array<Record<string, unknown>> = [];
    if (me) {
      members.push({ ...me, role: 'Owner', status: 'Active' });
    }

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

    sendSuccess(res, members);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('team_fetch_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const sendInvites = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { emails } = req.body as SendInvitesBody;

    logger.info('invites_sending', { count: emails.length });

    const rows = emails.map((email) => ({
      invited_by: user.userId,
      email: email.trim().toLowerCase(),
      status: 'pending',
    }));

    const { data, error } = await supabase.from('velora_team_invites').insert(rows).select();

    if (error) throw error;
    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('invites_send_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};
