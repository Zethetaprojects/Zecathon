import api from './client';
import { User, UserRole } from '../types';

export const adminApi = {
  listUsers: () => api.get<User[]>('/auth/admin/users'),
  updateRole: (id: number, role: UserRole) => api.put<User>(`/auth/users/${id}/role`, { role }),
};
