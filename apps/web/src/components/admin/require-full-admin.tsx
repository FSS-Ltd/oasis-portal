import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { createContext } from '@oasis/api';
import { prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canAnswerChildRegistrationPrompt,
  canExportAttendance,
  canManageCalendar,
  canSubmitInitialRegistration,
  canViewAnyStudentDrillThrough,
  canViewBehaviourReports,
  canUseFullPaceAccess,
  canManageUserAccounts,
  isFullAdmin,
  requireFullAdmin,
  requireStaff,
  requireTag,
  type SessionUser,
} from '@oasis/domain';
import { ensureDevHeadUser } from '@/lib/dev-head-user';

function notFoundOnAccessDenied(error: unknown): never {
  if (error instanceof AccessDeniedError) {
    notFound();
  }

  throw error;
}

async function getSessionUser(
  options: { ensureDevHead?: boolean } = {},
): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (userId && options.ensureDevHead !== false) await ensureDevHeadUser(userId);
  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  return ctx.user;
}

async function getRequiredSessionUser(
  options: { ensureDevHead?: boolean } = {},
): Promise<SessionUser> {
  const user = await getSessionUser(options);
  if (!user) notFound();
  return user;
}

export async function getFullAdminUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();

  try {
    requireFullAdmin(user);
  } catch (error) {
    notFoundOnAccessDenied(error);
  }

  return user;
}

export async function getAdminShellUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();

  if (
    !isFullAdmin(user) &&
    !canViewBehaviourReports(user) &&
    !canViewAnyStudentDrillThrough(user) &&
    !canUseFullPaceAccess(user) &&
    !canManageUserAccounts(user) &&
    !canExportAttendance(user) &&
    !canManageCalendar(user)
  ) {
    notFound();
  }

  return user;
}

export async function assertFullAdmin() {
  await getFullAdminUser();
}

export async function getUserAccountAdminUser(): Promise<SessionUser> {
  const user = await getAdminShellUser();
  if (!canManageUserAccounts(user)) {
    notFound();
  }

  return user;
}

export async function getStaffUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();

  try {
    requireStaff(user);
  } catch (error) {
    notFoundOnAccessDenied(error);
  }

  return user;
}

export async function assertStaffUser() {
  await getStaffUser();
}

export async function assertAuditViewer() {
  const user = await getFullAdminUser();

  try {
    requireTag(user, 'audit-viewer');
  } catch (error) {
    notFoundOnAccessDenied(error);
  }
}

export async function assertBehaviourReportViewer() {
  const user = await getAdminShellUser();
  if (!canViewBehaviourReports(user)) {
    notFound();
  }
}

export async function getStudentDrillThroughAdminUser(): Promise<SessionUser> {
  const user = await getAdminShellUser();
  if (!canViewAnyStudentDrillThrough(user)) {
    notFound();
  }

  return user;
}

export async function getParentUser(): Promise<SessionUser> {
  const user = await getSessionUser({ ensureDevHead: false });
  if (!user || user.role !== 'Parent') {
    notFound();
  }

  return user;
}

export async function getRegistrationUser(): Promise<SessionUser> {
  const user = await getSessionUser({ ensureDevHead: false });
  if (!user) notFound();

  const promptUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { childRegistrationPromptStatus: true },
  });
  if (
    !promptUser ||
    !canSubmitInitialRegistration(user, promptUser.childRegistrationPromptStatus)
  ) {
    notFound();
  }

  return user;
}

export async function linkedChildCount(userId: string): Promise<number> {
  return prisma.guardian.count({ where: { userId, student: { active: true } } });
}

export async function getLinkedChildPortalUser(): Promise<SessionUser> {
  const user = await getSessionUser({ ensureDevHead: false });
  if (!user) notFound();
  if (user.role === 'Parent') return user;
  if (!canAnswerChildRegistrationPrompt(user)) notFound();

  const count = await linkedChildCount(user.id);
  if (count === 0) notFound();

  return user;
}
