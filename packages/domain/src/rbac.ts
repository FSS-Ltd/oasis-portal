/**
 * Role-based access control (ADR-002, ADR-003).
 *
 * - Head, Principal, Pastor, HeadOfDiscipline all have full-admin parity.
 * - TechnicalSupport: User Access account-shell support for Parent / TechnicalSupport shells.
 * - ClubsAdmin: clubs module plus daily supervisor operations.
 * - Supervisor: daily operations; Sensitive behaviour is limited to their own demerits and General marks.
 * - Parent: own children only.
 * - Student: self only.
 *
 * Permission tags layered on top: `shopkeeper`, `shopadmin`, `leaderboard-admin`,
 * `attendance-exporter`, `attendance-recorder`, `audit-viewer`,
 * `sensitive-note-viewer`, `behaviour-viewer`, `student-drillthrough-viewer`,
 * `pace-full-access`, `calendar-manager`, `parent-message-responder`.
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

export const CHILD_REGISTRATION_PROMPT_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'TechnicalSupport',
  'Supervisor',
] as const satisfies readonly Role[];
const CHILD_REGISTRATION_PROMPT_ROLE_SET: ReadonlySet<Role> = new Set(
  CHILD_REGISTRATION_PROMPT_ROLES,
);

export const ADULT_USER_ACCOUNT_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'TechnicalSupport',
  'ClubsAdmin',
  'Supervisor',
  'Parent',
] as const satisfies readonly Role[];

export const CHILD_REGISTRATION_PROMPT_STATUSES = [
  'Unanswered',
  'NoChildren',
  'HasChildren',
] as const;
export type ChildRegistrationPromptStatus = (typeof CHILD_REGISTRATION_PROMPT_STATUSES)[number];

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
  'calendar-manager',
  'parent-message-responder',
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

export function isStaff(user: Pick<SessionUser, 'role'>): boolean {
  return isFullAdmin(user) || user.role === 'ClubsAdmin' || user.role === 'Supervisor';
}

export function canManageClubs(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'ClubsAdmin' || isFullAdmin(user);
}

export function canAnswerChildRegistrationPrompt(user: Pick<SessionUser, 'role'>): boolean {
  return CHILD_REGISTRATION_PROMPT_ROLE_SET.has(user.role);
}

export function canSubmitInitialRegistration(
  user: Pick<SessionUser, 'role'>,
  promptStatus: ChildRegistrationPromptStatus,
): boolean {
  return (
    user.role === 'Parent' ||
    (canAnswerChildRegistrationPrompt(user) && promptStatus === 'HasChildren')
  );
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

export function canManageUserAccounts(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'TechnicalSupport';
}

export function resolvePostSignInPortal(
  user: SessionUser | null,
): 'full-admin' | 'account-admin' | 'clubs-admin' | 'supervisor' | 'parent' | 'not-ready' {
  if (!user) return 'not-ready';

  if (isFullAdmin(user)) return 'full-admin';
  if (canManageUserAccounts(user)) return 'account-admin';
  if (canManageClubs(user)) return 'clubs-admin';
  if (user.role === 'Supervisor') return 'supervisor';
  if (user.role === 'Parent') return 'parent';

  return 'not-ready';
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
  return isFullAdmin(user) || hasTag(user, 'attendance-recorder');
}

export function canExportAttendance(user: SessionUser): boolean {
  return isFullAdmin(user) || hasTag(user, 'attendance-exporter');
}

export function canViewSensitiveChildNotes(user: SessionUser): boolean {
  return isFullAdmin(user) || hasTag(user, 'sensitive-note-viewer');
}

export function canViewBehaviourReports(user: SessionUser): boolean {
  return isFullAdmin(user) || hasTag(user, 'behaviour-viewer');
}

export function canViewSensitiveBehaviour(user: Pick<SessionUser, 'role'>): boolean {
  return isFullAdmin(user);
}

export function canViewSensitiveBehaviourEntry(
  user: Pick<SessionUser, 'id' | 'role'>,
  entry: {
    recordedById: string;
    type: 'Merit' | 'Demerit' | 'General';
    visibility: 'General' | 'Sensitive';
  },
): boolean {
  if (entry.visibility === 'General') return true;
  if (canViewSensitiveBehaviour(user)) return true;
  return (
    (user.role === 'Supervisor' || user.role === 'ClubsAdmin') &&
    (entry.type === 'Demerit' || entry.type === 'General') &&
    entry.recordedById === user.id
  );
}

export function canCreateSensitiveBehaviour(
  user: Pick<SessionUser, 'role'>,
  input: { type: 'Merit' | 'Demerit' | 'General' },
): boolean {
  return (
    canViewSensitiveBehaviour(user) ||
    ((user.role === 'Supervisor' || user.role === 'ClubsAdmin') &&
      (input.type === 'Demerit' || input.type === 'General'))
  );
}

export function canViewAnyStudentDrillThrough(user: SessionUser): boolean {
  return isFullAdmin(user) || (isStaff(user) && hasTag(user, 'student-drillthrough-viewer'));
}

export function canUseFullPaceAccess(user: SessionUser): boolean {
  return isFullAdmin(user) || hasTag(user, 'pace-full-access');
}

export function canManageCalendar(user: SessionUser): boolean {
  return isFullAdmin(user) || (isStaff(user) && hasTag(user, 'calendar-manager'));
}

export function canRespondToParentMessages(user: Pick<SessionUser, 'role' | 'tags'>): boolean {
  return isFullAdmin(user);
}

export function canViewStudentDrillThrough(user: SessionUser): boolean {
  return (
    canViewAnyStudentDrillThrough(user) ||
    user.role === 'Parent' ||
    user.role === 'ClubsAdmin' ||
    canAnswerChildRegistrationPrompt(user)
  );
}

export function canViewSensitiveStudentDrillThrough(user: SessionUser): boolean {
  return isFullAdmin(user);
}

export function requireClubsAdminOrFullAdmin(user: SessionUser): void {
  if (canManageClubs(user)) return;
  throw new AccessDeniedError('requires ClubsAdmin or full admin');
}

/**
 * Sensitive behaviour entries are visible to full admins, or the
 * supervisor who recorded the Sensitive demerit.
 * Checked at the tRPC layer; Postgres RLS is the second wall (rls.sql).
 */
export function requireCanViewSensitive(user: SessionUser): void {
  if (!canViewSensitiveBehaviour(user)) {
    throw new AccessDeniedError('sensitive entries require full-admin access');
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
