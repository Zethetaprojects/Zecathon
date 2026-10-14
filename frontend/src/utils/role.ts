import { UserRole } from '../types';

// Role checks are only for ownership-style rules the permission matrix cannot
// express (e.g. "manages this hackathon"). For "may this user do X", use
// `can(feature)` from useAuth, which follows the superadmin's toggles.

export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === 'superadmin';
}

/** Roles that manage hackathons: organizers (their own) and platform admins (all). */
export function isManagerRole(role: UserRole | undefined): boolean {
  return role === 'organizer' || role === 'admin' || role === 'superadmin';
}
