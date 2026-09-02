import { publicProcedure, router } from '../trpc.js';

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, at: new Date().toISOString() })),
  me: publicProcedure.query(async ({ ctx }) => {
    const linkedChildCount = ctx.user
      ? await ctx.db.guardian.count({
          where: { userId: ctx.user.id, student: { active: true } },
        })
      : 0;

    return { accountAccessState: ctx.accountAccessState, linkedChildCount, user: ctx.user };
  }),
});
