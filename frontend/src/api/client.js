import axios from 'axios';
import { BASE_URL } from '../config';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
});

export const classify = (formData) => api.post('/api/classify/', formData);
export const segment = (formData) => api.post('/api/segment/', formData);
export const analyze = (formData) => api.post('/api/analyze/', formData);
export const ragQuery = (data) => api.post('/api/rag/query/', data);
export const getHistory = (params) => api.get('/api/history/', { params });
export const getAnalysis = (id) => api.get(`/api/history/${id}/`);
export const deleteAnalysis = (id) => api.delete(`/api/history/${id}/`);
export const getStats = () => api.get('/api/stats/');
export const getReport = (id, force = false) => api.get(`/api/report/${id}/`, {
  params: force ? { force: 1 } : undefined,
  responseType: 'blob',
});

export default api;
