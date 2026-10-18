import axios from 'axios';
let csrfToken = null;
export const setCsrfToken = value => { csrfToken = value || null; };
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use(config => {
  if (csrfToken && !['get','head','options'].includes((config.method || 'get').toLowerCase())) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});
api.interceptors.response.use(res => {
  if (res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
  return res;
}, err => {
  if (err.response?.status === 403 && err.response?.data?.code === 'CSRF_INVALID') {
    setCsrfToken(null); window.dispatchEvent(new Event('fintrack:session-changed'));
  }
  if (err.response?.status === 401 && !/\/auth\/(login|register|me)$/.test(err.config?.url || '')) window.dispatchEvent(new Event('fintrack:unauthorized'));
  return Promise.reject(err);
});
export default api;
