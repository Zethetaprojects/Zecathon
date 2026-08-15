import api from './client';

export const reportsApi = {
  list: () => api.get('/reports'),
  detail: (id: number) => api.get(`/reports/${id}`),
};
