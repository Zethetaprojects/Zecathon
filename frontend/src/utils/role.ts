import { UserRole } from '../types';

export function isOrganizer(role: UserRole | undefined): boolean {
  return role === 'organizer' || role === 'admin';
}

export function isJudge(role: UserRole | undefined): boolean {
  return role === 'judge' || role === 'organizer' || role === 'admin';
}

export function isParticipant(role: UserRole | undefined): boolean {
  return role === 'participant';
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin';
}
