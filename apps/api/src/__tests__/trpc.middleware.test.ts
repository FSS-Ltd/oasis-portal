import { describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { AccessDeniedError, type SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import {
  auditedProcedure,
  authedProcedure,
  fullAdminProcedure,
  router,
  userAccountAdminProcedure,
} from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const technicalSupportUser: SessionUser = {
  id: 'u_support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

interface FakeAuditCreate {
  create: ReturnType<typeof vi.fn>;
}

function makeCtx(user: SessionUser | null): { ctx: AppContext; auditLog: FakeAuditCreate } {
  const auditLog: FakeAuditCreate = { create: vi.fn().mockResolvedValue(undefined) };
  const ctx = {
    db: { auditLog } as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
  return { ctx, auditLog };
}

describe('authedProcedure', () => {
  it('rejects when ctx.user is null', async () => {
    const appRouter = router({
      whoami: authedProcedure.query(({ ctx }) => ctx.user),
    });
    const { ctx } = makeCtx(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.whoami()).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.whoami()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('passes through when ctx.user is set', async () => {
    const appRouter = router({
      whoami: authedProcedure.query(({ ctx }) => ctx.user),
    });
    const { ctx } = makeCtx(headUser);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.whoami()).resolves.toEqual(headUser);
  });
});

describe('fullAdminProcedure', () => {
  it('allows full-admin roles', async () => {
    const appRouter = router({
      adminOnly: fullAdminProcedure.query(() => 'ok'),
    });
    const { ctx } = makeCtx(headUser);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.adminOnly()).resolves.toBe('ok');
  });

  it('rejects non-admin roles as FORBIDDEN', async () => {
    const appRouter = router({
      adminOnly: fullAdminProcedure.query(() => 'ok'),
    });
    const { ctx } = makeCtx(supervisorUser);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('userAccountAdminProcedure', () => {
  it('allows Technical Support only', async () => {
    const appRouter = router({
      accountAdminOnly: userAccountAdminProcedure.query(() => 'ok'),
    });

    await expect(
      appRouter.createCaller(makeCtx(technicalSupportUser).ctx).accountAdminOnly(),
    ).resolves.toBe('ok');
    await expect(
      appRouter.createCaller(makeCtx(headUser).ctx).accountAdminOnly(),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects non-account-admin roles as FORBIDDEN', async () => {
    const appRouter = router({
      accountAdminOnly: userAccountAdminProcedure.query(() => 'ok'),
    });
    const { ctx } = makeCtx(supervisorUser);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accountAdminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('auditedProcedure', () => {
  it('writes an Update audit row on successful mutation', async () => {
    const appRouter = router({
      doThing: auditedProcedure.mutation(() => ({ ok: true })),
    });
    const { ctx, auditLog } = makeCtx(headUser);
    const caller = appRouter.createCaller(ctx);
    await caller.doThing();
    expect(auditLog.create).toHaveBeenCalledTimes(1);
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'doThing',
        meta: { type: 'mutation' },
      },
    });
  });

  it('does not write an audit row for queries', async () => {
    const appRouter = router({
      readThing: auditedProcedure.query(() => 'ok'),
    });
    const { ctx, auditLog } = makeCtx(headUser);
    const caller = appRouter.createCaller(ctx);
    await caller.readThing();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('writes PermissionDenied and rethrows FORBIDDEN on AccessDeniedError', async () => {
    const appRouter = router({
      blocked: auditedProcedure.mutation(() => {
        throw new AccessDeniedError('not allowed');
      }),
    });
    const { ctx, auditLog } = makeCtx(headUser);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.blocked()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(auditLog.create).toHaveBeenCalledTimes(1);
    const call = auditLog.create.mock.calls[0]?.[0] as
      | {
          data: {
            userId: string;
            action: string;
            entity: string;
            meta: { type: string; reason: string };
          };
        }
      | undefined;
    expect(call).toBeDefined();
    expect(call?.data.userId).toBe(headUser.id);
    expect(call?.data.action).toBe('PermissionDenied');
    expect(call?.data.entity).toBe('blocked');
    expect(call?.data.meta.type).toBe('mutation');
    expect(call?.data.meta.reason).toContain('not allowed');
  });
});
