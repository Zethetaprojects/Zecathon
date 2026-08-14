import api from './client';
import { User } from '../types';

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<User>('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post<{ access_token: string; token_type: string }>('/auth/login', data),
  me: () => api.get<User>('/auth/me'),
};
