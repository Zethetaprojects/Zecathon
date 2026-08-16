import api from './client';
import { User, UserRole } from '../types';

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface ResetPasswordPayload {
  password: string;
}

export const adminApi = {
  listUsers: () => api.get<User[]>('/auth/admin/users'),
  updateRole: (id: number, role: UserRole) => api.put<User>(`/auth/users/${id}/role`, { role }),
  createUser: (payload: CreateUserPayload) => api.post<User>('/auth/admin/users', payload),
  resetPassword: (id: number, password: string) =>
    api.put<User>(`/auth/admin/users/${id}/password`, { password }),
};
