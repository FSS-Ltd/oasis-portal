import { TRPCError } from '@trpc/server';
import { canManageUserAccountRole, type SessionUser } from '@oasis/domain';
import type { AppContext } from '../context.js';

interface DeleteUserAccountOptions {
  actor: SessionUser;
  userId: string;
  withRls: AppContext['withRls'];
}

export async function deleteUserAccount({
  actor,
  userId,
  withRls,
}: DeleteUserAccountOptions): Promise<{ id: string }> {
  if (userId === actor.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete your own account.' });
  }

  return withRls(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });
    }
    if (!canManageUserAccountRole(actor, user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete this account.' });
    }

    const deleted = await tx.user.update({
      where: { id: userId, deletedAt: null },
      data: { active: false, deletedAt: new Date() },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: 'Delete',
        entity: 'User',
        entityId: userId,
        meta: { source: 'admin.deleteUserAccount', retainedHistory: true },
      },
    });
    return deleted;
  });
}
