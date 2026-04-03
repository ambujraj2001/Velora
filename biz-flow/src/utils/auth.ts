import crypto from 'crypto';
import type { Request, Response } from 'express';
import { v5 as uuidv5 } from 'uuid';
import { sendError } from './response';

export type SessionUser = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  userId: string;
};

type SessionPayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  iat: number;
};

const SESSION_COOKIE_NAME = 'velora_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace-me-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const USER_NAMESPACE = 'cbe54cc7-0ac5-4cb3-8e64-6a6b5ac8f9f9';

const base64UrlEncode = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const base64UrlDecode = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const normalized = padded + '='.repeat((4 - (padded.length % 4 || 4)) % 4);
  return Buffer.from(normalized, 'base64').toString('utf8');
};

const parseCookies = (header?: string) =>
  (header || '').split(';').reduce<Record<string, string>>((acc, cookie) => {
    const [rawKey, ...rawValue] = cookie.trim().split('=');
    if (!rawKey) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});

const sign = (payload: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');

export const buildSessionToken = (payload: SessionPayload) => {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const verifySessionToken = (token?: string): SessionPayload | null => {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!parsed.sub || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getSessionUser = (req: Request): SessionUser | null => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  const session = verifySessionToken(sessionToken);
  if (!session) {
    return null;
  }

  return {
    ...session,
    userId: uuidv5(session.sub, USER_NAMESPACE),
  };
};

export const requireSessionUser = (req: Request, res: Response): SessionUser | null => {
  const user = getSessionUser(req);
  if (!user) {
    sendError(res, 'UNAUTHORIZED', 'Unauthorized', 401);
    return null;
  }
  return user;
};

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'none' as const,
  secure: true,
  path: '/',
  maxAge: SESSION_TTL_MS,
});

export const setSessionCookie = (res: Response, token: string) => {
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
};

export const getGoogleAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'offline',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const exchangeGoogleCode = async (code: string) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth env vars are not configured.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange Google authorization code.');
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new Error('Google access token missing.');
  }

  const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch Google profile.');
  }

  const profile = (await userResponse.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error('Google profile is incomplete.');
  }

  return {
    profile,
    sessionToken: buildSessionToken({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      iat: Date.now(),
    }),
  };
};

export const authRedirects = {
  appUrl: APP_URL,
  callbackUrl: GOOGLE_OAUTH_REDIRECT_URI,
};
