import api from './client';
import { Team, Submission, Evaluation } from '../types';

export const teamsApi = {
  list: (hackathonId: number) => api.get<Team[]>(`/teams?hackathon_id=${hackathonId}`),
  create: (hackathonId: number, name: string) =>
    api.post<Team>('/teams', { hackathon_id: hackathonId, name }),
  join: (teamId: number) => api.post<Team>(`/teams/${teamId}/join`),
};

export const submissionsApi = {
  create: (data: FormData) =>
    api.post<Submission>('/submissions', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  get: (id: number) => api.get<Submission>(`/submissions/${id}`),
  listByTeam: (teamId: number) => api.get<Submission[]>(`/submissions?team_id=${teamId}`),
  evaluateTech: (id: number) => api.post<Evaluation>(`/evaluate/tech/${id}`),
  evaluateNonTech: (id: number) => api.post<Evaluation>(`/evaluate/non-tech/${id}`),
};
