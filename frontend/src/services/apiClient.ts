import axios from 'axios';
import { useAuthStore } from '../state/authStore';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const { tenantId, firebaseToken } = useAuthStore.getState();

  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }

  if (firebaseToken) {
    config.headers['Authorization'] = `Bearer ${firebaseToken}`;
  }

  return config;
});
