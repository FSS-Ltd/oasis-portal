import { resolveParentVolunteerAccess } from '@oasis/domain';
import { publicProcedure, router } from '../trpc.js';

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, at: new Date().toISOString() })),
  me: publicProcedure.query(async ({ ctx }) => {
    const [linkedChildCount, parentVolunteerUser] = ctx.user
      ? await Promise.all([
          ctx.db.guardian.count({
            where: { userId: ctx.user.id, student: { active: true } },
          }),
          ctx.db.user.findUnique({
            where: { id: ctx.user.id },
            select: { active: true, role: true, staffParentVolunteerAccess: true },
          }),
        ])
      : [0, null];
    const parentVolunteerAccess = parentVolunteerUser
      ? resolveParentVolunteerAccess({
          active: parentVolunteerUser.active,
          activeGuardianCount: linkedChildCount,
          role: parentVolunteerUser.role,
          staffParentVolunteerAccess: parentVolunteerUser.staffParentVolunteerAccess,
        })
      : null;

    return {
      accountAccessState: ctx.accountAccessState,
      linkedChildCount,
      parentVolunteerAccess,
      user: ctx.user,
    };
  }),
});
