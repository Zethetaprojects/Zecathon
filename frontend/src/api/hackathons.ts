import api from './client';
import { Hackathon, ProblemStatement, PublicStats, Rubric } from '../types';

export const hackathonsApi = {
  list: () => api.get<Hackathon[]>('/hackathons'),
  publicList: () => api.get<Hackathon[]>('/hackathons/public'),
  publicStats: () => api.get<PublicStats>('/hackathons/public/stats'),
  create: (data: Partial<Hackathon>) => api.post<Hackathon>('/hackathons', data),
  get: (id: number) => api.get<Hackathon>(`/hackathons/${id}`),
  update: (id: number, data: Partial<Omit<Hackathon, 'rubric'>> & { rubric?: Partial<Rubric> | null }) =>
    api.put<Hackathon>(`/hackathons/${id}`, data),
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
  /** Only allowed before any team has submitted to the statement (409 otherwise). */
  update: (id: number, data: FormData) =>
    api.put<ProblemStatement>(`/problem-statements/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => api.delete(`/problem-statements/${id}`),
};
