import api from './client';
import { Hackathon, ProblemStatement } from '../types';

export const hackathonsApi = {
  list: () => api.get<Hackathon[]>('/hackathons'),
  create: (data: Partial<Hackathon>) => api.post<Hackathon>('/hackathons', data),
  get: (id: number) => api.get<Hackathon>(`/hackathons/${id}`),
};

export const problemStatementsApi = {
  upload: (hackathonId: number, data: FormData) =>
    api.post<ProblemStatement>(`/hackathons/${hackathonId}/problem-statements`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
