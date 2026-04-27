import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { auditRouter } from '../routers/audit.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

interface FakeAuditRow {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
  user: { id: string; fullNameEnc: string; emailEnc: string } | null;
}

interface FakeDb {
  $enc: {
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}

function makeFakeDb(rows: FakeAuditRow[] = []): FakeDb {
  return {
    $enc: {
      decrypt: vi.fn((value: string | null | undefined) =>
        value ? value.replace(/^enc:/u, '') : null,
      ),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue(rows),
    },
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ audit: auditRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('audit.list', () => {
  it('rejects non-full-admin callers as FORBIDDEN', async () => {
    const db = makeFakeDb();
    const caller = makeCaller(supervisorUser, db);

    await expect(caller.audit.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('applies filters and returns stable newest-first cursor pages', async () => {
    const rows: FakeAuditRow[] = [
      {
        id: 'ckaudit00000000000000001',
        userId: 'u_actor',
        action: 'Create',
        entity: 'Student',
        entityId: 's_1',
        meta: { source: 'test' },
        createdAt: new Date('2026-04-27T12:00:00.000Z'),
        user: { id: 'u_actor', fullNameEnc: 'enc:Head User', emailEnc: 'enc:head@example.test' },
      },
      {
        id: 'ckaudit00000000000000002',
        userId: null,
        action: 'Update',
        entity: 'Student',
        entityId: 's_2',
        meta: null,
        createdAt: new Date('2026-04-27T11:00:00.000Z'),
        user: null,
      },
    ];
    const db = makeFakeDb(rows);
    const caller = makeCaller(headUser, db);

    await expect(
      caller.audit.list({
        limit: 1,
        cursor: 'ckauditcursor00000000001',
        action: 'Create',
        entity: 'Student',
        userId: 'u_actor',
        from: new Date('2026-04-27T00:00:00.000Z'),
        to: new Date('2026-04-28T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      rows: [
        {
          id: 'ckaudit00000000000000001',
          action: 'Create',
          entity: 'Student',
          entityId: 's_1',
          meta: { source: 'test' },
          createdAt: new Date('2026-04-27T12:00:00.000Z'),
          actor: { id: 'u_actor', fullName: 'Head User', email: 'head@example.test' },
        },
      ],
      nextCursor: 'ckaudit00000000000000002',
    });

    expect(db.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'Create',
        entity: 'Student',
        userId: 'u_actor',
        createdAt: {
          gte: new Date('2026-04-27T00:00:00.000Z'),
          lte: new Date('2026-04-28T00:00:00.000Z'),
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 2,
      cursor: { id: 'ckauditcursor00000000001' },
      skip: 1,
      include: {
        user: {
          select: {
            id: true,
            fullNameEnc: true,
            emailEnc: true,
          },
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 1, source: 'audit.list' },
      },
    });
  });

  it('does not write a decrypt audit row when there are no actors to display', async () => {
    const db = makeFakeDb([
      {
        id: 'ckaudit00000000000000003',
        userId: null,
        action: 'Login',
        entity: 'Session',
        entityId: null,
        meta: null,
        createdAt: new Date('2026-04-27T10:00:00.000Z'),
        user: null,
      },
    ]);
    const caller = makeCaller(headUser, db);

    await expect(caller.audit.list()).resolves.toMatchObject({
      rows: [{ actor: null }],
      nextCursor: undefined,
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
