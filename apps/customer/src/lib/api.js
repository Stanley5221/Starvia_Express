import axios from 'axios';
import * as storage from './storage';

// __DEV__ is false in EAS preview/production builds, true in `expo start`
const BASE = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000')
  : 'https://starvia-express.onrender.com';

function normalizeBase(url) {
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

const BASE_URL = normalizeBase(BASE);

const api = axios.create({ baseURL: BASE_URL, timeout: 40000 });

api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItemAsync('cust_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Attach visible debug info to the error message so it shows on screen
    if (!err.response) {
      const url = (err.config?.baseURL || '') + (err.config?.url || '');
      err.message = `${err.message} | code:${err.code || '?'} | url:${url}`;
    }
    return Promise.reject(err);
  }
);

export default api;
