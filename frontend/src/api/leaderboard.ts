import api from './client';
import { LeaderboardEntry } from '../types';

export const leaderboardApi = {
  /** Without a round, the latest round that has scores. */
  get: (hackathonId: number, round?: number) =>
    api.get<LeaderboardEntry[]>(`/leaderboard/${hackathonId}`, { params: round ? { round } : undefined }),
  getPublic: (hackathonId: number, round?: number) =>
    api.get<LeaderboardEntry[]>(`/leaderboard/public/${hackathonId}`, { params: round ? { round } : undefined }),
};
