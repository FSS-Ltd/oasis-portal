import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@oasis/db';

function isLocalDev(): boolean {
  return process.env['NODE_ENV'] !== 'production';
}

export async function ensureDevHeadUser(clerkUserId: string): Promise<boolean> {
  if (!isLocalDev()) return false;

  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
  if (existing) return false;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress.trim().toLowerCase();
  if (!email) return false;

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

  return true;
}
