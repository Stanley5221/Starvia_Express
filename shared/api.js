import axios from 'axios';

function normalizeApiBase(url) {
  if (!url) return '/api/v1';
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

/** Read env without import.meta (Expo/Hermes web cannot parse it). */
function env(key) {
  // __viteEnv is injected as a static object by vite.config.js define — dynamic access works
  if (typeof __viteEnv !== 'undefined' && __viteEnv[key]) return __viteEnv[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return undefined;
}

const baseURL = normalizeApiBase(
  env('EXPO_PUBLIC_API_URL') || env('VITE_API_URL')
) || '/api/v1';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token =
    window.localStorage.getItem('fw_admin_token') ||
    window.localStorage.getItem('fw_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('fw_token');
        window.localStorage.removeItem('fw_user');
        window.localStorage.removeItem('fw_admin_token');
        window.localStorage.removeItem('fw_admin_user');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
