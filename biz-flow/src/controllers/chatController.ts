import { createGraph } from '../graph';
import { supabase } from '../config/db';
import { GraphState } from '../types';
import { requireSessionUser } from '../utils/auth';
import logger, { clearLogs } from '../lib/logger';

export const handleChat = async (req: any, res: any) => {
    try {
        clearLogs();
        logger.info('--- New Chat Request ---', { body: req.body });
        
        const user = requireSessionUser(req, res);
        if (!user) return;

        const { userInput, conversationId, connectionId } = req.body;
        
        // --- Dynamic Connection Fetching ---
        let connSettings = undefined;
        let finalConnId = connectionId;

        const connQuery = supabase.from('velora_connections').select('*');
        if (finalConnId) {
            connQuery.eq('id', finalConnId);
        } else {
            connQuery.eq('user_id', user.userId).order('created_at', { ascending: false }).limit(1);
        }

        const { data: conn } = await connQuery.maybeSingle();

        if (conn) {
            finalConnId = conn.id;
            const { decrypt } = require('../utils/crypto');
            try {
                connSettings = {
                    host: conn.host,
                    port: conn.port,
                    database: conn.database,
                    username: conn.username,
                    password: decrypt(conn.password)
                };
                logger.info('Using dynamic connection', { connId: finalConnId, type: conn.type });
            } catch (decErr) {
                logger.error('Failed to decrypt connection password', { error: decErr });
            }
        } else {
            logger.warn('No connection found for user, falling back to defaults');
        }

        const { fetchSchema } = require('../services/schemaService');
        const schemaContext = await fetchSchema(connSettings);
        logger.info('Fetched dynamic schema', { schemaLength: schemaContext.length });

        
        // Fetch history if conversationId exists
        let history: any[] = [];
        if (conversationId) {
            const { data: msgs } = await supabase
                .from('velora_messages')
                .select('role, content')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(10);
            if (msgs) history = msgs;
        }

        const builder = createGraph();
        
        const initialState = {
            userInput,
            intent: 'CHAT' as const,
            sql: undefined,
            rows: undefined,
            error: undefined,
            retryCount: 0,
            fragments: [],
            dashboardPlan: undefined,
            connectionId: finalConnId,
            connectionSettings: connSettings,
            conversationId,
            schemaContext,
            history
        } satisfies GraphState;


        const result = await builder.invoke(initialState);
        logger.info('Graph execution result', { resultKeys: Object.keys(result || {}) });
        
        // Save to Supabase
        let convId = conversationId;
        if (!convId) {
            logger.info('Creating new conversation in Supabase', { userId: user.userId });
            const { data: conv, error: convError } = await supabase.from('velora_conversations').insert({
                user_id: user.userId,
                title: userInput.substring(0, 50) + '...' // Default
            }).select().single();

            if (convError) {
                logger.error('Supabase conversation creation error', { error: convError });
            }
            if (conv) {
                convId = conv.id;
                
                // AI Title generation
                const { mistral } = require('../config/llm');
                mistral.invoke([
                    ["system", "Generate a short, 3-5 word title for a chat conversation based on this starting query. No quotes, just the words."],
                    ["user", userInput]
                ]).then(async (res: any) => {
                    await supabase.from('velora_conversations').update({ title: res.content.toString() }).eq('id', convId);
                }).catch((e: any) => logger.error('Title gen failed', { e }));
            }
        }


        if (convId) {
            logger.info('Inserting messages into Supabase', { convId });
            const { error: msgError } = await supabase.from('velora_messages').insert([
                {
                    conversation_id: convId,
                    role: 'user',
                    content: userInput,
                    fragments: []
                },
                {
                    conversation_id: convId,
                    role: 'assistant',
                    content: "", // No hardcoded text
                    fragments: result.fragments || [],
                    sql: result.sql,
                    connection_id: finalConnId
                }

            ]);
            if (msgError) {
                logger.error('Supabase message insertion error', { error: msgError });
            }
        } else {
            logger.warn('No convId obtained, skipping message insertion');
        }

        logger.info('Chat response payload', { convId, fragmentsCount: result.fragments?.length });
        res.status(200).json({
            conversationId: convId,
            connectionId: finalConnId,
            fragments: result.fragments || []
        });


    } catch (err: any) {
        logger.error('Chat controller error', { error: err.message, stack: err.stack });
        res.status(500).json({ error: err.message });
    }
}

