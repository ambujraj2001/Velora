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

export const startGoogleLogin = () => {
  window.location.href = `${API_BASE_URL}/auth/google/start`;
};
