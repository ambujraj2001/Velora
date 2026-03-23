import type { Request, Response } from 'express';
import { clearSessionCookie, exchangeGoogleCode, getGoogleAuthUrl, getSessionUser, setSessionCookie } from '../utils/auth';

export const startGoogleLogin = (_req: Request, res: Response) => {
  res.redirect(getGoogleAuthUrl());
};

export const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      return res.status(400).send('Missing Google authorization code.');
    }

    const { sessionToken } = await exchangeGoogleCode(code);
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
