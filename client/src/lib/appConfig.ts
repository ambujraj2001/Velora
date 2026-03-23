import axios from 'axios';

const trimTrailingSlash = (value?: string) => value?.replace(/\/$/, '') ?? '';

export const API_BASE_URL =
  trimTrailingSlash(import.meta.env.VITE_API_BASE_URL) || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const startGoogleLogin = () => {
  window.location.href = `${API_BASE_URL}/auth/google/start`;
};
