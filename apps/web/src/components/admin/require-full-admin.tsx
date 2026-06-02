import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { createContext } from '@oasis/api';
import { prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canExportAttendance,
  canManageInvoices,
  canManagePermissionSlips,
  canManageShop,
  canManageCalendar,
  canManageClubs,
  canRespondToParentMessages,
  canSellInShop,
  canSubmitInitialRegistration,
  canViewAnyStudentDrillThrough,
  canViewBehaviourReports,
  canUseLinkedChildClubSignup,
  canUseStaffMessaging,
  canUseFullPaceAccess,
  canUseClubsLeadPortal,
  canUseAdminOperations,
  canViewAuditLog,
  canManageUserAccounts,
  requireAdminOperations,
  requireClubsAdminOrFullAdmin,
  requireFullAdmin,
  requireStaff,
  type SessionUser,
} from '@oasis/domain';
import { ensureDevHeadUser } from '@/lib/dev-head-user';
import {
  isTwoFactorEnforcementEnabled,
  twoFactorSatisfiedFromClerkAuth,
} from '@/lib/clerk-two-factor';

function notFoundOnAccessDenied(error: unknown): never {
  if (error instanceof AccessDeniedError) {
    notFound();
  }

  throw error;
}

async function getSessionUser(
  options: { ensureDevHead?: boolean } = {},
): Promise<SessionUser | null> {
  const clerkAuth = await auth();
  const { userId } = clerkAuth;
  if (userId && options.ensureDevHead !== false) await ensureDevHeadUser(userId);
  const ctx = await createContext({
    headers: new Headers(),
    clerkUserId: userId,
    enforceTwoFactor: isTwoFactorEnforcementEnabled(),
    twoFactorSatisfied: twoFactorSatisfiedFromClerkAuth(clerkAuth),
  });
  return ctx.user;
}

async function getRequiredSessionUser(
  options: { ensureDevHead?: boolean } = {},
): Promise<SessionUser> {
  const user = await getSessionUser(options);
  if (!user) notFound();
  if (user.requires2fa) redirect('/2fa');
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

export async function getAdminOperationsUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();

  try {
    requireAdminOperations(user);
  } catch (error) {
    notFoundOnAccessDenied(error);
  }

  return user;
}

export async function getAdminShellUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();

  if (
    !canUseAdminOperations(user) &&
    !canViewBehaviourReports(user) &&
    !canViewAnyStudentDrillThrough(user) &&
    !canUseFullPaceAccess(user) &&
    !canManageUserAccounts(user) &&
    !canExportAttendance(user) &&
    !canManageCalendar(user) &&
    !canManagePermissionSlips(user) &&
    !canViewAuditLog(user) &&
    !canRespondToParentMessages(user) &&
    !canUseStaffMessaging(user) &&
    !canManageClubs(user) &&
    !canManageInvoices(user) &&
    !canManageShop(user) &&
    !canSellInShop(user)
  ) {
    notFound();
  }

  return user;
}

export async function getShopWorkflowUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();
  if (!canManageShop(user) && !canSellInShop(user)) {
    notFound();
  }

  return user;
}

export async function getInvoiceManagerUser(): Promise<SessionUser> {
  const user = await getAdminShellUser();
  if (!canManageInvoices(user)) {
    notFound();
  }

  return user;
}

export async function getPermissionSlipManagerUser(): Promise<SessionUser> {
  const user = await getAdminShellUser();
  if (!canManagePermissionSlips(user)) {
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

export async function getParentMessageResponderUser(): Promise<SessionUser> {
  const user = await getAdminShellUser();
  if (!canRespondToParentMessages(user) && !canUseStaffMessaging(user)) {
    notFound();
  }

  return user;
}

export async function getClubManagerUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();

  try {
    requireClubsAdminOrFullAdmin(user);
  } catch (error) {
    notFoundOnAccessDenied(error);
  }

  return user;
}

export async function getClubsLeadUser(): Promise<SessionUser> {
  const user = await getRequiredSessionUser();
  if (!canUseClubsLeadPortal(user)) {
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
  const user = await getAdminShellUser();
  if (!canViewAuditLog(user)) {
    notFound();
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
  if (!canUseLinkedChildClubSignup(user)) notFound();

  const [children, clubRotaSelections] = await Promise.all([
    linkedChildCount(user.id),
    prisma.clubRotaParticipant.count({ where: { userId: user.id, club: { active: true } } }),
  ]);
  if (children === 0 && clubRotaSelections === 0) notFound();

  return user;
}
