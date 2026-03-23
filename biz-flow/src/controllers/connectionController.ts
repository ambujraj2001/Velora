import { supabase } from '../config/db';
import crypto from 'crypto';
import dotenv from 'dotenv';
import type { ConnectionType } from '../types';
import { requireSessionUser } from '../utils/auth';
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
    try {
        const user = requireSessionUser(req, res);
        if (!user) return;

        const { name, type, host, port, database, username, password } = req.body;
        const normalizedType = String(type || '').toLowerCase() as ConnectionType;
        if (!CONNECTION_TYPES.includes(normalizedType)) {
            return res.status(400).json({
                error: `Unsupported connection type. Use one of: ${CONNECTION_TYPES.join(', ')}`,
            });
        }
        // 1. Encrypt password
        const encPassword = encrypt(password);

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
                password: encPassword
            })
            .select()
            .single();

        if (error) throw error;
        
        // Return without password
        const { password: _, ...rest } = data;
        res.json(rest);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export const getConnections = async (req: any, res: any) => {
    try {
        const user = requireSessionUser(req, res);
        if (!user) return;

        const { data, error } = await supabase
            .from('velora_connections')
            .select('id, user_id, name, type, host, port, database, username, created_at')
            .eq('user_id', user.userId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
         res.status(500).json({ error: err.message });
    }
}

export const deleteConnection = async (req: any, res: any) => {
     try {
         const user = requireSessionUser(req, res);
         if (!user) return;

         const { id } = req.params;
         const { error } = await supabase
            .from('velora_connections')
            .delete()
            .eq('user_id', user.userId)
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
     } catch (err: any) {
         res.status(500).json({ error: err.message });
     }
}
