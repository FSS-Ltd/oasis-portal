import { auth, currentUser } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { createContext } from '@oasis/api';
import { prisma } from '@oasis/db';
import {
  AccessDeniedError,
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

function isLocalDev(): boolean {
  return process.env['NODE_ENV'] !== 'production';
}

async function ensureDevHeadUser(clerkUserId: string) {
  if (!isLocalDev()) return;

  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
  if (existing) return;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress.trim().toLowerCase();
  if (!email) return;

  const fullName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim() || email;
  const emailBidx = prisma.$enc.blindIndex(email);
  const existingByEmail = await prisma.user.findUnique({
    where: { emailBidx },
    select: { id: true, role: true, tags: true },
  });

  const user = existingByEmail
    ? await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId: clerkUserId,
          role: 'Head',
          tags: [],
          active: true,
        },
        select: { id: true },
      })
    : await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          role: 'Head',
          tags: [],
          fullNameEnc: prisma.$enc.encrypt(fullName),
          emailEnc: prisma.$enc.encrypt(email),
          emailBidx,
        },
        select: { id: true },
      });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'Update',
      entity: 'User',
      entityId: user.id,
      meta: {
        source: 'dev-admin-auto-bootstrap',
        previousRole: existingByEmail?.role ?? null,
        previousTags: existingByEmail?.tags ?? [],
      },
    },
  });
}

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
    !canManageUserAccounts(user)
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
