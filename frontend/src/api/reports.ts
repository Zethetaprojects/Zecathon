import api from './client';
import { SubmissionReport } from '../types';

export const reportsApi = {
  list: () => api.get('/reports'),
  detail: (id: number) => api.get(`/reports/${id}`),
  submission: (id: number) => api.get<SubmissionReport>(`/reports/submission/${id}`),
};
