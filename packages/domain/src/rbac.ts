/**
 * Role-based access control (ADR-002, ADR-003).
 *
 * - Head, Principal, Pastor, HeadOfDiscipline all have full-admin parity.
 * - ClubsAdmin: clubs module only.
 * - Supervisor: daily operations, general-visibility behaviour only.
 * - Parent: own children only.
 * - Student: self only.
 *
 * Permission tags layered on top: `shopkeeper`, `shopadmin`, `leaderboard-admin`,
 * `attendance-exporter`, `audit-viewer`.
 */

export const ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'ClubsAdmin',
  'Supervisor',
  'Parent',
  'Student',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSION_TAGS = [
  'shopkeeper',
  'shopadmin',
  'leaderboard-admin',
  'attendance-exporter',
  'audit-viewer',
] as const;
export type PermissionTag = (typeof PERMISSION_TAGS)[number];

export interface SessionUser {
  id: string;
  role: Role;
  tags: readonly string[];
  requires2fa: boolean;
}

const FULL_ADMIN_ROLES: ReadonlySet<Role> = new Set([
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
]);

export function isFullAdmin(user: Pick<SessionUser, 'role'>): boolean {
  return FULL_ADMIN_ROLES.has(user.role);
}

export function isStaff(user: Pick<SessionUser, 'role'>): boolean {
  return isFullAdmin(user) || user.role === 'Supervisor';
}

export function hasTag(user: Pick<SessionUser, 'tags'>, tag: PermissionTag): boolean {
  return user.tags.includes(tag);
}

export class AccessDeniedError extends Error {
  constructor(reason: string) {
    super(`Access denied: ${reason}`);
    this.name = 'AccessDeniedError';
  }
}

export function requireFullAdmin(user: SessionUser): void {
  if (!isFullAdmin(user)) {
    throw new AccessDeniedError(`role ${user.role} is not a full admin`);
  }
}

export function requireStaff(user: SessionUser): void {
  if (!isStaff(user)) {
    throw new AccessDeniedError('staff workflow requires full-admin or Supervisor');
  }
}

export function requireRole(user: SessionUser, ...allowed: readonly Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new AccessDeniedError(`role ${user.role} not in [${allowed.join(', ')}]`);
  }
}

export function requireTag(user: SessionUser, tag: PermissionTag): void {
  if (!hasTag(user, tag)) {
    throw new AccessDeniedError(`missing tag "${tag}"`);
  }
}

export function requireClubsAdminOrFullAdmin(user: SessionUser): void {
  if (user.role === 'ClubsAdmin' || isFullAdmin(user)) return;
  throw new AccessDeniedError('requires ClubsAdmin or full admin');
}

/**
 * Sensitive behaviour entries are visible to full-admin roles only.
 * Checked at the tRPC layer; Postgres RLS is the second wall (rls.sql).
 */
export function requireCanViewSensitive(user: SessionUser): void {
  if (!isFullAdmin(user)) {
    throw new AccessDeniedError('sensitive entries are full-admin only');
  }
}

/**
 * Parents can only see their own children's data.
 * Takes a pre-fetched list of student ids this parent is linked to.
 */
export function requireOwnChild(
  user: SessionUser,
  studentId: string,
  parentsChildIds: readonly string[],
): void {
  if (user.role !== 'Parent') {
    throw new AccessDeniedError('requireOwnChild called on non-Parent');
  }
  if (!parentsChildIds.includes(studentId)) {
    throw new AccessDeniedError('parent is not linked to this student');
  }
}

/**
 * Students can only see themselves.
 */
export function requireSelfStudent(
  user: SessionUser,
  studentId: string,
  studentUserId: string | null,
): void {
  if (user.role !== 'Student') {
    throw new AccessDeniedError('requireSelfStudent called on non-Student');
  }
  if (studentUserId !== user.id) {
    throw new AccessDeniedError('student can only access their own record');
  }
  // studentId is pinned for audit-readability — callers should log it.
  void studentId;
}
