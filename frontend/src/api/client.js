// src/api/client.js — Axios instance with JWT interceptor
import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Inject JWT token on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('spiltex_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('spiltex_token');
      localStorage.removeItem('spiltex_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
