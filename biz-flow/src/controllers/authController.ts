import type { Request, Response } from 'express';
import {
  clearSessionCookie,
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getSessionUser,
  setSessionCookie,
} from '../utils/auth';
import { sendSuccess, sendError } from '../utils/response';
import { supabase } from '../config/db';
import { v5 as uuidv5 } from 'uuid';

const USER_NAMESPACE = 'cbe54cc7-0ac5-4cb3-8e64-6a6b5ac8f9f9';

export const startGoogleLogin = (_req: Request, res: Response) => {
  res.redirect(getGoogleAuthUrl());
};

export const handleGoogleCallback = async (req: Request, res: Response) => {
  const { logger } = req.context;
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      sendError(res, 'AUTH_ERROR', 'Missing Google authorization code.', 400);
      return;
    }

    const { profile, sessionToken } = await exchangeGoogleCode(code);

    const userId = uuidv5(profile.sub, USER_NAMESPACE);
    logger.info('auth_google_callback', { userId, email: profile.email });

    await supabase.from('velora_users').upsert(
      {
        id: userId,
        email: profile.email,
        name: profile.name || null,
        picture: profile.picture || null,
      },
      { onConflict: 'id' },
    );

    setSessionCookie(res, sessionToken);
    res.redirect(process.env.APP_URL || 'http://localhost:5173');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('auth_google_callback_error', { error: msg });
    sendError(res, 'AUTH_ERROR', msg || 'Google login failed.');
  }
};

export const getMe = (req: Request, res: Response) => {
  const user = getSessionUser(req);
  sendSuccess(res, { user });
};

export const logout = (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.redirect(process.env.APP_URL || 'http://localhost:5173');
};
