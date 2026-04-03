import type { Request, Response } from 'express';
import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { sendSuccess, sendError } from '../utils/response';

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { data, error } = await supabase
      .from('velora_conversations')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('conversations_list_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const { data: conversation } = await supabase
      .from('velora_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.userId)
      .single();
    if (!conversation) {
      sendError(res, 'NOT_FOUND', 'Conversation not found.', 404);
      return;
    }

    const { data, error } = await supabase
      .from('velora_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    sendSuccess(res, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('messages_fetch_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};

export const deleteConversation = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    logger.info('conversation_deleting', { conversationId });

    const { error } = await supabase
      .from('velora_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', user.userId);
    if (error) throw error;
    sendSuccess(res, { success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('conversation_delete_error', { error: msg });
    sendError(res, 'INTERNAL_ERROR', msg);
  }
};
