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

export interface PlatformStats {
  users: number;
  users_by_role: Record<string, number>;
  hackathons: number;
  teams: number;
  submissions: number;
  evaluations: number;
}

export interface RolePermissions {
  superadmin: Record<string, boolean>;
  admin: Record<string, boolean>;
  organizer: Record<string, boolean>;
  judge: Record<string, boolean>;
  participant: Record<string, boolean>;
}

export interface GlobalSettings {
  registration_open: boolean;
  role_permissions: RolePermissions;
}

export interface GlobalSettingsUpdate {
  registration_open?: boolean;
  role_permissions?: RolePermissions;
}

export const adminApi = {
  listUsers: () => api.get<User[]>('/auth/admin/users'),
  updateRole: (id: number, role: UserRole) => api.put<User>(`/auth/users/${id}/role`, { role }),
  createUser: (payload: CreateUserPayload) => api.post<User>('/auth/admin/users', payload),
  resetPassword: (id: number, password: string) =>
    api.put<User>(`/auth/admin/users/${id}/password`, { password }),
  stats: () => api.get<PlatformStats>('/auth/admin/stats'),
  getSettings: () => api.get<GlobalSettings>('/auth/admin/settings'),
  updateSettings: (payload: GlobalSettingsUpdate) => api.put<GlobalSettings>('/auth/admin/settings', payload),
};
