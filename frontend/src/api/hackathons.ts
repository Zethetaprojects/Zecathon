import api from './client';
import { Hackathon, ProblemStatement } from '../types';

export const hackathonsApi = {
  list: () => api.get<Hackathon[]>('/hackathons'),
  create: (data: Partial<Hackathon>) => api.post<Hackathon>('/hackathons', data),
  get: (id: number) => api.get<Hackathon>(`/hackathons/${id}`),
  update: (id: number, data: Partial<Hackathon>) => api.put<Hackathon>(`/hackathons/${id}`, data),
  delete: (id: number) => api.delete(`/hackathons/${id}`),
};

export const problemStatementsApi = {
  upload: (hackathonId: number, data: FormData) =>
    api.post<ProblemStatement>(`/hackathons/${hackathonId}/problem-statements`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
