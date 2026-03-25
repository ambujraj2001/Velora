import type { Request, Response } from 'express';
import {
  clearSessionCookie,
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getSessionUser,
  setSessionCookie,
} from '../utils/auth';
import { supabase } from '../config/db';
import { v5 as uuidv5 } from 'uuid';

const USER_NAMESPACE = 'cbe54cc7-0ac5-4cb3-8e64-6a6b5ac8f9f9';

export const startGoogleLogin = (_req: Request, res: Response) => {
  res.redirect(getGoogleAuthUrl());
};

export const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      return res.status(400).send('Missing Google authorization code.');
    }

    const { profile, sessionToken } = await exchangeGoogleCode(code);

    // Upsert user into velora_users
    const userId = uuidv5(profile.sub, USER_NAMESPACE);
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
  } catch (err: any) {
    console.error(err);
    res.status(500).send(err?.message || 'Google login failed.');
  }
};

export const getMe = (req: Request, res: Response) => {
  const user = getSessionUser(req);
  res.json({ user });
};

export const logout = (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.redirect(process.env.APP_URL || 'http://localhost:5173');
};
