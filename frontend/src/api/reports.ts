import api from './client';
import { SubmissionReport } from '../types';

export const reportsApi = {
  list: () => api.get('/reports'),
  detail: (id: number) => api.get(`/reports/${id}`),
  submission: (id: number) => api.get<SubmissionReport>(`/reports/submission/${id}`),
  downloadPdf: (id: number) =>
    api.get(`/reports/submission/${id}/pdf`, {
      responseType: 'blob',
    }),
  /** The problem statement (title and full description) as a PDF. */
  problemStatementPdf: (problemStatementId: number) =>
    api.get(`/reports/problem-statement/${problemStatementId}/pdf`, { responseType: 'blob' }),
};
