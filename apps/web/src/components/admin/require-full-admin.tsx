import { auth, currentUser } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { createContext } from '@oasis/api';
import { prisma } from '@oasis/db';
import { requireFullAdmin, requireStaff, requireTag, type SessionUser } from '@oasis/domain';

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
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
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

export async function getFullAdminUser(): Promise<SessionUser> {
  try {
    const { userId } = await auth();
    if (userId) await ensureDevHeadUser(userId);
    const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
    if (!ctx.user) notFound();
    requireFullAdmin(ctx.user);
    return ctx.user;
  } catch {
    notFound();
  }
}

export async function assertFullAdmin() {
  await getFullAdminUser();
}

export async function getStaffUser(): Promise<SessionUser> {
  try {
    const { userId } = await auth();
    if (userId) await ensureDevHeadUser(userId);
    const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
    if (!ctx.user) notFound();
    requireStaff(ctx.user);
    return ctx.user;
  } catch {
    notFound();
  }
}

export async function assertStaffUser() {
  await getStaffUser();
}

export async function assertAuditViewer() {
  try {
    const user = await getFullAdminUser();
    requireTag(user, 'audit-viewer');
  } catch {
    notFound();
  }
}
