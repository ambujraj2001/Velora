import axios from 'axios';
import { generateTraceId } from '../utils/traceId';

export const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const traceId = generateTraceId();
  config.headers.set('x-trace-id', traceId);

  if (import.meta.env.DEV) {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url} traceId=${traceId}`);
  }

  return config;
});

/** Unwrap biz-flow envelope `{ success, data, meta }` so existing `res.data` usage stays valid. */
api.interceptors.response.use(
  (response) => {
    const payload = response.data;
    if (
      payload &&
      typeof payload === 'object' &&
      'success' in payload &&
      payload.success === true &&
      Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      response.data = (payload as { data: unknown }).data;
    }
    return response;
  },
  (error) => {
    const res = error.response;
    const body = res?.data;
    if (
      body &&
      typeof body === 'object' &&
      body.success === false &&
      body.error &&
      typeof body.error === 'object'
    ) {
      const errObj = body.error as { code?: string; message?: string; details?: unknown };
      res.data = {
        error: errObj.message ?? 'Request failed',
        code: errObj.code,
        details: errObj.details,
        meta: (body as { meta?: unknown }).meta,
      };
    }
    return Promise.reject(error);
  },
);

export const startGoogleLogin = () => {
  window.location.href = `${API_BASE_URL}/auth/google/start`;
};
