import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { meritLedgerRouter } from '../routers/meritLedger.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckwallethead0000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckwalletparent0000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckwalletstudentuser00001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const otherStudentUser: SessionUser = {
  id: 'ckwalletstudentuser00002',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckwalletsupervisor000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'ckwalletstudent00000000001';
const otherStudentId = 'ckwalletstudent00000000002';

type BehaviourType = 'Merit' | 'Demerit' | 'General';
type AuditAction =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'DecryptSensitive'
  | 'DecryptPii'
  | 'ReadSensitive'
  | 'Login'
  | 'Login2FA'
  | 'PermissionDenied';

interface StoredStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
  relatedEntryId?: string;
}

interface StoredBehaviourEntry {
  studentId: string;
  type: BehaviourType;
  meritDelta: number;
  createdAt: Date;
  deletedAt: Date | null;
}

interface FakeStudentFindUniqueArgs {
  where: { id: string };
  select?: { id?: true; active?: true; userId?: true };
}

interface FakeGuardianFindUniqueArgs {
  where: { userId_studentId: { userId: string; studentId: string } };
  select?: { studentId?: true };
}

interface FakeLedgerAggregateArgs {
  where: { studentId: string; account: MeritAccount };
  _sum: { delta: true };
}

interface FakeLedgerCreateManyArgs {
  data: StoredLedgerRow[];
}

interface FakeBehaviourFindManyArgs {
  where: {
    studentId: string;
    createdAt: { gte: Date; lt: Date };
    deletedAt: null;
  };
  select: { type: true; meritDelta: true };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string;
    meta?: unknown;
  };
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
  return {
    active: true,
    userId: null,
    ...input,
  };
}

function makeLedgerRow(input: StoredLedgerRow): StoredLedgerRow {
  return input;
}

function makeBehaviourEntry(input: StoredBehaviourEntry): StoredBehaviourEntry {
  return input;
}

function makeFakeDb(
  input: {
    students?: StoredStudent[];
    guardians?: StoredGuardian[];
    ledger?: StoredLedgerRow[];
    behaviour?: StoredBehaviourEntry[];
  } = {},
) {
  const students = input.students ?? [
    makeStudent({ id: linkedStudentId, userId: studentUser.id }),
    makeStudent({ id: otherStudentId, userId: otherStudentUser.id }),
  ];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
  const ledger = input.ledger ?? [];
  const behaviour = input.behaviour ?? [];

  const db = {
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    student: {
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) =>
        Promise.resolve(students.find((student) => student.id === args.where.id) ?? null),
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    guardian: {
      findUnique: vi.fn((args: FakeGuardianFindUniqueArgs) =>
        Promise.resolve(
          guardians.find(
            (guardian) =>
              guardian.userId === args.where.userId_studentId.userId &&
              guardian.studentId === args.where.userId_studentId.studentId,
          ) ?? null,
        ),
      ),
    },
    meritLedger: {
      aggregate: vi.fn((args: FakeLedgerAggregateArgs) => {
        const delta = ledger
          .filter((row) => row.studentId === args.where.studentId)
          .filter((row) => row.account === args.where.account)
          .reduce((total, row) => total + row.delta, 0);

        return Promise.resolve({ _sum: { delta: delta === 0 ? null : delta } });
      }),
      createMany: vi.fn((args: FakeLedgerCreateManyArgs) => {
        ledger.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    behaviourEntry: {
      findMany: vi.fn((args: FakeBehaviourFindManyArgs) =>
        Promise.resolve(
          behaviour
            .filter((entry) => entry.studentId === args.where.studentId)
            .filter((entry) => entry.deletedAt === args.where.deletedAt)
            .filter(
              (entry) =>
                entry.createdAt >= args.where.createdAt.gte &&
                entry.createdAt < args.where.createdAt.lt,
            )
            .map((entry) => ({ type: entry.type, meritDelta: entry.meritDelta })),
        ),
      ),
    },
    students,
    guardians,
    ledger,
    behaviour,
  };

  db.$transaction.mockImplementation(async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db));

  return db;
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ meritLedger: meritLedgerRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function auditCreates(db: ReturnType<typeof makeFakeDb>): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('meritLedger.balances', () => {
  it('derives Spend, Saving, and Investment balances from ledger rows', async () => {
    const { caller } = makeCaller(
      headUser,
      makeFakeDb({
        ledger: [
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Spend',
            delta: 12,
            reason: 'merit',
          }),
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Spend',
            delta: -2,
            reason: 'shop',
          }),
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Saving',
            delta: 4,
            reason: 'transfer',
          }),
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'ShopReserved',
            delta: 8,
            reason: 'shop-reservation:hold',
          }),
          makeLedgerRow({
            studentId: otherStudentId,
            account: 'Spend',
            delta: 99,
            reason: 'other',
          }),
        ],
      }),
    );

    await expect(caller.meritLedger.balances({ studentId: linkedStudentId })).resolves.toEqual({
      studentId: linkedStudentId,
      balances: { Spend: 10, Saving: 4, Investment: 0, ShopReserved: 8 },
    });
  });

  it('allows parents to read linked active children and blocks unlinked children', async () => {
    const linked = makeCaller(parentUser);

    await expect(
      linked.caller.meritLedger.balances({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      balances: { Spend: 0, Saving: 0, Investment: 0, ShopReserved: 0 },
    });

    const unlinked = makeCaller(parentUser);
    await expect(
      unlinked.caller.meritLedger.balances({ studentId: otherStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(auditCreates(unlinked.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'meritLedger.balances',
        entityId: otherStudentId,
      }),
    );
  });

  it('allows student self access and rejects missing or inactive students', async () => {
    await expect(
      makeCaller(studentUser).caller.meritLedger.balances({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({ studentId: linkedStudentId });

    await expect(
      makeCaller(studentUser).caller.meritLedger.balances({ studentId: otherStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(headUser).caller.meritLedger.balances({
        studentId: 'ckwalletmissing0000000001',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      makeCaller(
        headUser,
        makeFakeDb({
          students: [makeStudent({ id: linkedStudentId, userId: studentUser.id, active: false })],
        }),
      ).caller.meritLedger.balances({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('denies unsupported roles and audits the permission failure', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.meritLedger.balances({ studentId: linkedStudentId })).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'meritLedger.balances',
        entityId: linkedStudentId,
      }),
    );
  });
});

describe('meritLedger.activity', () => {
  it('returns merit and demerit activity for the current calendar week and month', async () => {
    const db = makeFakeDb({
      behaviour: [
        makeBehaviourEntry({
          studentId: linkedStudentId,
          type: 'Merit',
          meritDelta: 10,
          createdAt: day('2026-05-11'),
          deletedAt: null,
        }),
        makeBehaviourEntry({
          studentId: linkedStudentId,
          type: 'Demerit',
          meritDelta: -5,
          createdAt: day('2026-05-17'),
          deletedAt: null,
        }),
        makeBehaviourEntry({
          studentId: linkedStudentId,
          type: 'Merit',
          meritDelta: 3,
          createdAt: day('2026-05-01'),
          deletedAt: null,
        }),
        makeBehaviourEntry({
          studentId: linkedStudentId,
          type: 'Merit',
          meritDelta: 99,
          createdAt: day('2026-05-10'),
          deletedAt: null,
        }),
        makeBehaviourEntry({
          studentId: linkedStudentId,
          type: 'General',
          meritDelta: 50,
          createdAt: day('2026-05-12'),
          deletedAt: null,
        }),
      ],
    });
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.meritLedger.activity({ studentId: linkedStudentId, range: 'week' }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      range: 'week',
      period: {
        from: day('2026-05-11'),
        to: day('2026-05-18'),
      },
      activity: {
        meritsEarned: 10,
        demeritsCount: 1,
        demeritsMerits: 5,
        net: 5,
      },
    });

    await expect(
      caller.meritLedger.activity({ studentId: linkedStudentId, range: 'month' }),
    ).resolves.toMatchObject({
      period: {
        from: day('2026-05-01'),
        to: day('2026-06-01'),
      },
      activity: {
        meritsEarned: 112,
        demeritsCount: 1,
        demeritsMerits: 5,
        net: 107,
      },
    });
  });
});

describe('meritLedger.transfer', () => {
  it('allows a student to transfer their own Spend merits to Saving', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Spend',
            delta: 10,
            reason: 'merit',
          }),
        ],
      }),
    );

    await expect(
      caller.meritLedger.transfer({
        studentId: linkedStudentId,
        from: 'Spend',
        to: 'Saving',
        amount: 4,
      }),
    ).resolves.toEqual({
      studentId: linkedStudentId,
      balances: { Spend: 6, Saving: 4, Investment: 0, ShopReserved: 0 },
    });

    expect(db.meritLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          studentId: linkedStudentId,
          account: 'Spend',
          delta: -4,
          reason: 'transfer:Spend:to:Saving',
        },
        {
          studentId: linkedStudentId,
          account: 'Saving',
          delta: 4,
          reason: 'transfer:Spend:to:Saving',
        },
      ],
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual({
      userId: studentUser.id,
      action: 'Create',
      entity: 'MeritLedger',
      entityId: linkedStudentId,
      meta: {
        source: 'meritLedger.transfer',
        from: 'Spend',
        to: 'Saving',
        amount: 4,
      },
    });
  });

  it('allows full-admin users to transfer for an active student', async () => {
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        ledger: [
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Saving',
            delta: 8,
            reason: 'existing',
          }),
        ],
      }),
    );

    await expect(
      caller.meritLedger.transfer({
        studentId: linkedStudentId,
        from: 'Saving',
        to: 'Spend',
        amount: 3,
      }),
    ).resolves.toMatchObject({
      balances: { Spend: 3, Saving: 5, Investment: 0, ShopReserved: 0 },
    });
    expect(db.meritLedger.createMany).toHaveBeenCalledTimes(1);
  });

  it('blocks parent transfers for linked children and audits the denial', async () => {
    const { caller, db } = makeCaller(
      parentUser,
      makeFakeDb({
        ledger: [
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Spend',
            delta: 10,
            reason: 'merit',
          }),
        ],
      }),
    );

    await expect(
      caller.meritLedger.transfer({
        studentId: linkedStudentId,
        from: 'Spend',
        to: 'Saving',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'meritLedger.transfer',
        entityId: linkedStudentId,
      }),
    );
  });

  it('rejects insufficient balances before writing ledger rows and audits the attempt', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Spend',
            delta: 2,
            reason: 'merit',
          }),
        ],
      }),
    );

    await expect(
      caller.meritLedger.transfer({
        studentId: linkedStudentId,
        from: 'Spend',
        to: 'Saving',
        amount: 3,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'MeritLedger',
        entityId: linkedStudentId,
        meta: {
          source: 'meritLedger.transfer',
          outcome: 'Rejected',
          reason: 'InsufficientBalance',
          from: 'Spend',
          to: 'Saving',
          amount: 3,
        },
      }),
    );
  });

  it('rejects Investment transfers and leaves unit accounting to the investment API', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [
          makeLedgerRow({
            studentId: linkedStudentId,
            account: 'Spend',
            delta: 10,
            reason: 'merit',
          }),
        ],
      }),
    );

    await expect(
      caller.meritLedger.transfer({
        studentId: linkedStudentId,
        from: 'Spend',
        to: 'Investment',
        amount: 3,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'MeritLedger',
        entityId: linkedStudentId,
        meta: {
          source: 'meritLedger.transfer',
          outcome: 'Rejected',
          reason: 'InvestmentTransfersUnsupported',
          from: 'Spend',
          to: 'Investment',
          amount: 3,
        },
      }),
    );
  });
});
