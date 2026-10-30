import { z } from 'zod';
import { authedProcedure, publicProcedure, router } from '../trpc.js';

// Expo push tokens look like ExponentPushToken[xxxx] (older) or ExpoPushToken[xxxx].
const tokenInput = z.object({
  token: z
    .string()
    .max(200)
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'not an Expo push token'),
});

const registerInput = tokenInput.extend({ platform: z.enum(['Ios', 'Android']) });

export const pushNotificationRouter = router({
  /** Whether this device currently gets push for the signed-in user. */
  status: authedProcedure.input(tokenInput).query(async ({ ctx, input }) => {
    const device = await ctx.db.pushDeviceToken.findFirst({
      where: { tokenBidx: ctx.db.$enc.blindIndex(input.token), userId: ctx.user.id },
      select: { id: true },
    });
    return { enabled: device !== null };
  }),

  /** Turns push on for this device. A device moves to whoever registered it last. */
  register: authedProcedure.input(registerInput).mutation(async ({ ctx, input }) => {
    const tokenBidx = ctx.db.$enc.blindIndex(input.token);
    const device = await ctx.db.pushDeviceToken.upsert({
      where: { tokenBidx },
      create: {
        userId: ctx.user.id,
        tokenEnc: ctx.db.$enc.encrypt(input.token),
        tokenBidx,
        platform: input.platform,
      },
      update: { userId: ctx.user.id, platform: input.platform, lastSeenAt: new Date() },
      select: { id: true },
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'PushDeviceToken',
        entityId: device.id,
        meta: { source: 'pushNotification.register', platform: input.platform },
      },
    });
    return { enabled: true };
  }),

  /**
   * Turns push off for this device. Public on purpose: the app calls it after Clerk has
   * signed out, so the next person on a shared phone does not get the last user's alerts.
   * The Expo token is a secret only the device holds, and this can only stop pushes.
   */
  forget: publicProcedure.input(tokenInput).mutation(async ({ ctx, input }) => {
    const removed = await ctx.db.pushDeviceToken.deleteMany({
      where: { tokenBidx: ctx.db.$enc.blindIndex(input.token) },
    });
    if (removed.count > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user?.id ?? null,
          action: 'Delete',
          entity: 'PushDeviceToken',
          meta: { source: 'pushNotification.forget' },
        },
      });
    }
    return { enabled: false };
  }),
});
