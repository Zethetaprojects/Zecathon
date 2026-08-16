import api from './client';
import { Hackathon, ProblemStatement, PublicStats } from '../types';

export const hackathonsApi = {
  list: () => api.get<Hackathon[]>('/hackathons'),
  publicList: () => api.get<Hackathon[]>('/hackathons/public'),
  publicStats: () => api.get<PublicStats>('/hackathons/public/stats'),
  create: (data: Partial<Hackathon>) => api.post<Hackathon>('/hackathons', data),
  get: (id: number) => api.get<Hackathon>(`/hackathons/${id}`),
  update: (id: number, data: Partial<Hackathon>) => api.put<Hackathon>(`/hackathons/${id}`, data),
  delete: (id: number) => api.delete(`/hackathons/${id}`),
  uploadBanner: (id: number, data: FormData) =>
    api.post<Hackathon>(`/hackathons/${id}/banner`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const problemStatementsApi = {
  upload: (hackathonId: number, data: FormData) =>
    api.post<ProblemStatement>(`/hackathons/${hackathonId}/problem-statements`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
