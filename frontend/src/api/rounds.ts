import api from './client';
import { HackathonRound, JudgeScore, RoundStatus } from '../types';

export interface RoundSettings {
  name?: string | null;
  instructions?: string | null;
  submission_deadline?: string | null;
  judge_weight?: number;
  published?: boolean;
}

export const roundsApi = {
  list: (hackathonId: number) => api.get<HackathonRound[]>(`/hackathons/${hackathonId}/rounds`),
  publicList: (hackathonId: number) => api.get<HackathonRound[]>(`/hackathons/public/${hackathonId}/rounds`),
  myStatus: (hackathonId: number) => api.get<RoundStatus>(`/hackathons/${hackathonId}/rounds/my-status`),
  add: (hackathonId: number, data: RoundSettings) => api.post<HackathonRound>(`/hackathons/${hackathonId}/rounds`, data),
  update: (hackathonId: number, number: number, data: RoundSettings) =>
    api.put<HackathonRound>(`/hackathons/${hackathonId}/rounds/${number}`, data),
  remove: (hackathonId: number, number: number) => api.delete(`/hackathons/${hackathonId}/rounds/${number}`),
  setShortlist: (hackathonId: number, number: number, teamIds: number[]) =>
    api.put<HackathonRound>(`/hackathons/${hackathonId}/rounds/${number}/shortlist`, { team_ids: teamIds }),
};

export const judgeApi = {
  list: (submissionId: number) => api.get<JudgeScore[]>(`/submissions/${submissionId}/judge-scores`),
  set: (submissionId: number, score: number, comment?: string) =>
    api.put<JudgeScore>(`/submissions/${submissionId}/judge-score`, { score, comment: comment || null }),
  remove: (submissionId: number) => api.delete(`/submissions/${submissionId}/judge-score`),
};
