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
): { ctx: AppContext; guardianCount: ReturnType<typeof vi.fn> } {
  const guardianCount = vi.fn().mockResolvedValue(linkedChildCount);
  return {
    ctx: {
      db: {
        guardian: {
          count: guardianCount,
        },
      } as unknown as AppContext['db'],
      requestId: 'req_health_test',
      user,
      withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
    },
    guardianCount,
  };
}

describe('health.me', () => {
  it('returns active linked child count for signed-in mobile portal switching', async () => {
    const { ctx, guardianCount } = makeCtx(supervisorUser, 2);
    const result = await healthRouter.createCaller(ctx).me();

    expect(result).toEqual({
      linkedChildCount: 2,
      user: supervisorUser,
    });
    expect(guardianCount).toHaveBeenCalledWith({
      where: { userId: supervisorUser.id, student: { active: true } },
    });
  });

  it('does not query guardian links for anonymous sessions', async () => {
    const { ctx, guardianCount } = makeCtx(null, 0);
    const result = await healthRouter.createCaller(ctx).me();

    expect(result).toEqual({ linkedChildCount: 0, user: null });
    expect(guardianCount).not.toHaveBeenCalled();
  });
});
