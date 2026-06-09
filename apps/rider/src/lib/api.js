import axios from 'axios';
import * as storage from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

function normalizeBase(url) {
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

const api = axios.create({
  baseURL: normalizeBase(API_URL),
  timeout: 40000,
});

api.interceptors.request.use(async (config) => {
  const token = await storage.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
