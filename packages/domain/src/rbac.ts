/**
 * Role-based access control (ADR-002, ADR-003).
 *
 * - Head, Principal, Pastor, HeadOfDiscipline all have full-admin parity.
 * - TechnicalSupport: account administration for Parent / TechnicalSupport shells.
 * - ClubsAdmin: clubs module only.
 * - Supervisor: daily operations, general-visibility behaviour only.
 * - Parent: own children only.
 * - Student: self only.
 *
 * Permission tags layered on top: `shopkeeper`, `shopadmin`, `leaderboard-admin`,
 * `attendance-exporter`, `attendance-recorder`, `audit-viewer`,
 * `sensitive-note-viewer`, `behaviour-viewer`, `student-drillthrough-viewer`,
 * `pace-full-access`.
 */

export const ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'TechnicalSupport',
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
  'attendance-recorder',
  'audit-viewer',
  'sensitive-note-viewer',
  'behaviour-viewer',
  'student-drillthrough-viewer',
  'pace-full-access',
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

export const TECHNICAL_SUPPORT_MANAGEABLE_ROLES = [
  'Parent',
  'TechnicalSupport',
] as const satisfies readonly Role[];
const TECHNICAL_SUPPORT_MANAGEABLE_ROLE_SET: ReadonlySet<Role> = new Set(
  TECHNICAL_SUPPORT_MANAGEABLE_ROLES,
);

export function isFullAdmin(user: Pick<SessionUser, 'role'>): boolean {
  return FULL_ADMIN_ROLES.has(user.role);
}

export function isHead(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'Head';
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

export function requireHead(user: SessionUser): void {
  if (!isHead(user)) {
    throw new AccessDeniedError(`role ${user.role} is not Head`);
  }
}

export function canManageUserAccounts(user: Pick<SessionUser, 'role'>): boolean {
  return isFullAdmin(user) || user.role === 'TechnicalSupport';
}

export function requireUserAccountAdmin(user: SessionUser): void {
  if (!canManageUserAccounts(user)) {
    throw new AccessDeniedError(`role ${user.role} cannot manage user accounts`);
  }
}

export function canManageUserAccountRole(
  actor: Pick<SessionUser, 'role'>,
  targetRole: Role,
): boolean {
  if (isFullAdmin(actor)) return true;
  return actor.role === 'TechnicalSupport' && TECHNICAL_SUPPORT_MANAGEABLE_ROLE_SET.has(targetRole);
}

export function requireCanManageUserAccountRole(actor: SessionUser, targetRole: Role): void {
  if (!canManageUserAccountRole(actor, targetRole)) {
    throw new AccessDeniedError(`role ${actor.role} cannot manage ${targetRole} accounts`);
  }
}

export function requireStaff(user: SessionUser): void {
  if (!isStaff(user)) {
    throw new AccessDeniedError('supervisor workflow requires full-admin or Supervisor');
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

export function canRecordStudentAttendance(user: SessionUser): boolean {
  return user.role === 'Head' || hasTag(user, 'attendance-recorder');
}

export function canViewSensitiveChildNotes(user: SessionUser): boolean {
  return user.role === 'Head' || hasTag(user, 'sensitive-note-viewer');
}

export function canViewBehaviourReports(user: SessionUser): boolean {
  return (
    user.role === 'Head' || user.role === 'HeadOfDiscipline' || hasTag(user, 'behaviour-viewer')
  );
}

export function canViewAnyStudentDrillThrough(user: SessionUser): boolean {
  return isFullAdmin(user) || (isStaff(user) && hasTag(user, 'student-drillthrough-viewer'));
}

export function canUseFullPaceAccess(user: SessionUser): boolean {
  return isFullAdmin(user) || hasTag(user, 'pace-full-access');
}

export function canViewStudentDrillThrough(user: SessionUser): boolean {
  return canViewAnyStudentDrillThrough(user) || user.role === 'Parent';
}

export function canViewSensitiveStudentDrillThrough(user: SessionUser): boolean {
  return user.role === 'Head';
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
