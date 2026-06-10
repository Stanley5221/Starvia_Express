import axios from 'axios';
import * as storage from './storage';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

function normalizeBase(url) {
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

const BASE_URL = normalizeBase(BASE);
console.log('[API] EXPO_PUBLIC_API_URL =', BASE);
console.log('[API] baseURL =', BASE_URL);

const api = axios.create({ baseURL: BASE_URL, timeout: 40000 });

api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItemAsync('cust_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.warn('[API] storage read error:', e?.message);
  }
  const fullUrl = (config.baseURL || '') + (config.url || '');
  console.log('[API] -->', config.method?.toUpperCase(), fullUrl);
  return config;
});

api.interceptors.response.use(
  (res) => {
    console.log('[API] <--', res.status, res.config?.url);
    return res;
  },
  (err) => {
    console.error('[API] ERROR', err?.message);
    console.error('[API] code:', err?.code);
    console.error('[API] url:', err?.config?.url);
    console.error('[API] baseURL:', err?.config?.baseURL);
    console.error('[API] response status:', err?.response?.status);
    console.error('[API] response data:', JSON.stringify(err?.response?.data));
    return Promise.reject(err);
  }
);

export default api;
