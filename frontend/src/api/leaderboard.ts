import api from './client';
import { LeaderboardEntry } from '../types';

export const leaderboardApi = {
  get: (hackathonId: number) => api.get<LeaderboardEntry[]>(`/leaderboard/${hackathonId}`),
};
