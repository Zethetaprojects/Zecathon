import api from './client';
import { User, UserRole } from '../types';

export const authApi = {
  register: (data: { username: string; email: string; password: string; role?: UserRole }) =>
    api.post<User>('/auth/register', data),
  login: (data: { username: string; password: string }) => {
    const form = new URLSearchParams();
    form.append('username', data.username);
    form.append('password', data.password);
    return api.post<{ access_token: string; token_type: string }>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  me: () => api.get<User>('/auth/me'),
};
