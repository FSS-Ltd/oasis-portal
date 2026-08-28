import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { listParentNotifications } from '../services/parent-notifications.js';
import { roleProcedure, router } from '../trpc.js';

const markReadInput = z.object({
  notificationId: z.string().cuid(),
});

function parentUserId(ctx: AppContext): string {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'authentication required' });
  }
  return ctx.user.id;
}

export const parentNotificationRouter = router({
  list: roleProcedure('Parent').query(async ({ ctx }) => {
    const userId = parentUserId(ctx);
    return ctx.withRls((tx) => listParentNotifications(ctx, tx, userId));
  }),

  unreadCount: roleProcedure('Parent').query(async ({ ctx }) => {
    const userId = parentUserId(ctx);
    return ctx.withRls(async (tx) => ({
      count: await tx.parentNotification.count({
        where: { userId, readAt: null },
      }),
    }));
  }),

  markRead: roleProcedure('Parent')
    .input(markReadInput)
    .mutation(async ({ ctx, input }) => {
      const userId = parentUserId(ctx);

      return ctx.withRls(async (tx) => {
        const updated = await tx.parentNotification.updateMany({
          where: { id: input.notificationId, userId, readAt: null },
          data: { readAt: new Date() },
        });

        if (updated.count === 0) {
          const existing = await tx.parentNotification.findFirst({
            where: { id: input.notificationId, userId },
            select: { id: true, readAt: true },
          });
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'notification not found' });
          }
        }

        await tx.auditLog.create({
          data: {
            userId,
            action: 'Update',
            entity: 'ParentNotification',
            entityId: input.notificationId,
            meta: { source: 'parentNotification.markRead' },
          },
        });

        return { id: input.notificationId, read: true };
      });
    }),
});
