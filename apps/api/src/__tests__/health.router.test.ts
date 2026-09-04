import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { healthRouter } from '../routers/health.js';

const supervisorUser: SessionUser = {
  id: 'u_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

function makeCtx(
  user: SessionUser | null,
  linkedChildCount: number,
  accountAccessState: AppContext['accountAccessState'] = user ? 'active' : 'unavailable',
  staffParentVolunteerAccess = false,
): {
  ctx: AppContext;
  guardianCount: ReturnType<typeof vi.fn>;
  userFindUnique: ReturnType<typeof vi.fn>;
} {
  const guardianCount = vi.fn().mockResolvedValue(linkedChildCount);
  const userFindUnique = vi.fn().mockResolvedValue(
    user
      ? {
          active: true,
          role: user.role,
          staffParentVolunteerAccess,
        }
      : null,
  );
  return {
    ctx: {
      db: {
        guardian: {
          count: guardianCount,
        },
        user: {
          findUnique: userFindUnique,
        },
      } as unknown as AppContext['db'],
      requestId: 'req_health_test',
      user,
      accountAccessState,
      withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
    },
    guardianCount,
    userFindUnique,
  };
}

describe('health.me', () => {
  it('returns active linked child count for signed-in mobile portal switching', async () => {
    const { ctx, guardianCount } = makeCtx(supervisorUser, 2);
    const result = await healthRouter.createCaller(ctx).me();

    expect(result).toEqual({
      accountAccessState: 'active',
      linkedChildCount: 2,
      parentVolunteerAccess: null,
      user: supervisorUser,
    });
    expect(guardianCount).toHaveBeenCalledWith({
      where: { userId: supervisorUser.id, student: { active: true } },
    });
  });

  it('returns staff volunteer scope only for a staff user with enabled access and linked children', async () => {
    const { ctx } = makeCtx(supervisorUser, 2, 'active', true);

    await expect(healthRouter.createCaller(ctx).me()).resolves.toMatchObject({
      parentVolunteerAccess: 'staff',
      user: supervisorUser,
    });
  });

  it('does not query guardian links for anonymous sessions', async () => {
    const { ctx, guardianCount } = makeCtx(null, 0);
    const result = await healthRouter.createCaller(ctx).me();

    expect(result).toEqual({
      accountAccessState: 'unavailable',
      linkedChildCount: 0,
      parentVolunteerAccess: null,
      user: null,
    });
    expect(guardianCount).not.toHaveBeenCalled();
  });

  it('reports a deactivated account without restoring a SessionUser', async () => {
    const { ctx, guardianCount } = makeCtx(null, 0, 'deactivated');

    await expect(healthRouter.createCaller(ctx).me()).resolves.toEqual({
      accountAccessState: 'deactivated',
      linkedChildCount: 0,
      parentVolunteerAccess: null,
      user: null,
    });
    expect(guardianCount).not.toHaveBeenCalled();
  });
});
