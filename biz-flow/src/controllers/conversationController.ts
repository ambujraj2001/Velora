import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';

export const getConversations = async (req: any, res: any) => {
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { data, error } = await supabase
      .from('velora_conversations')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getMessages = async (req: any, res: any) => {
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
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const { data, error } = await supabase
      .from('velora_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
export const deleteConversation = async (req: any, res: any) => {
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const { error } = await supabase
      .from('velora_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', user.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
