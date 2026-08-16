import { UserRole } from '../types';

export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === 'superadmin';
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function isOrganizer(role: UserRole | undefined): boolean {
  return role === 'organizer' || role === 'admin' || role === 'superadmin';
}

export function isJudge(role: UserRole | undefined): boolean {
  return role === 'judge' || role === 'organizer' || role === 'admin' || role === 'superadmin';
}

export function isParticipant(role: UserRole | undefined): boolean {
  return role === 'participant';
}
