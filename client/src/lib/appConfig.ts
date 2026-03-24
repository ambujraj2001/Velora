import axios from 'axios';


export const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const startGoogleLogin = () => {
  window.location.href = `${API_BASE_URL}/auth/google/start`;
};
