import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { investmentRouter } from '../routers/investment.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckinvesthead000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckinvestparent00000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckinveststudentuser0001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const otherStudentUser: SessionUser = {
  id: 'ckinveststudentuser0002',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckinvestsupervisor0001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'ckinveststudent00000001';
const otherStudentId = 'ckinveststudent00000002';

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
}

interface StoredInvestmentAccount {
  studentId: string;
  units: number;
}

interface StoredInvestmentNav {
  date: Date;
  nav: number;
  dailyReturn: number;
}

interface StoredInvestmentTransaction {
  id: string;
  studentId: string;
  type: 'Buy' | 'Sell';
  units: number;
  nav: number;
  feeMerits: number;
  createdAt: Date;
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

interface FakeNavFindManyArgs {
  orderBy: { date: 'desc' };
  take: number;
  select: { date: true; nav: true; dailyReturn: true };
}

interface FakeNavFindUniqueArgs {
  where: { date: Date };
  select: { date: true; nav: true; dailyReturn: true };
}

interface FakeNavCreateArgs {
  data: { date: Date; nav: Prisma.Decimal; dailyReturn: Prisma.Decimal };
  select: { date: true; nav: true; dailyReturn: true };
}

interface FakeInvestmentAccountFindUniqueArgs {
  where: { studentId: string };
  select: { units: true };
}

interface FakeInvestmentAccountUpsertArgs {
  where: { studentId: string };
  create: { studentId: string; units: Prisma.Decimal };
  update: { units: { increment: Prisma.Decimal } };
  select: { units: true };
}

interface FakeInvestmentAccountUpdateArgs {
  where: { studentId: string };
  data: { units: Prisma.Decimal };
  select: { units: true };
}

interface FakeInvestmentTransactionCreateArgs {
  data: {
    studentId: string;
    type: 'Buy' | 'Sell';
    units: Prisma.Decimal;
    nav: Prisma.Decimal;
    feeMerits: number;
  };
  select: { id: true };
}

interface FakeInvestmentTransactionFindManyArgs {
  where: { studentId: string };
  orderBy: { createdAt: 'desc' };
  take: number;
  select: {
    id: true;
    type: true;
    units: true;
    nav: true;
    feeMerits: true;
    createdAt: true;
  };
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

function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function decimalNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
  return {
    active: true,
    userId: null,
    ...input,
  };
}

function mapNav(row: StoredInvestmentNav) {
  return { date: row.date, nav: decimal(row.nav), dailyReturn: decimal(row.dailyReturn) };
}

function mapAccount(row: StoredInvestmentAccount) {
  return { units: decimal(row.units) };
}

function makeFakeDb(
  input: {
    students?: StoredStudent[];
    guardians?: StoredGuardian[];
    ledger?: StoredLedgerRow[];
    navs?: StoredInvestmentNav[];
    accounts?: StoredInvestmentAccount[];
    transactions?: StoredInvestmentTransaction[];
  } = {},
) {
  const students = input.students ?? [
    makeStudent({ id: linkedStudentId, userId: studentUser.id }),
    makeStudent({ id: otherStudentId, userId: otherStudentUser.id }),
  ];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
  const ledger = input.ledger ?? [];
  const navs = input.navs ?? [];
  const accounts = input.accounts ?? [];
  const transactions = input.transactions ?? [];
  let nextTransaction = transactions.length + 1;

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
    investmentNav: {
      findFirst: vi.fn(() => {
        const row = [...navs].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        return Promise.resolve(row ? mapNav(row) : null);
      }),
      findUnique: vi.fn((args: FakeNavFindUniqueArgs) => {
        const row = navs.find((nav) => sameDate(nav.date, args.where.date));
        return Promise.resolve(row ? mapNav(row) : null);
      }),
      create: vi.fn((args: FakeNavCreateArgs) => {
        const row = {
          date: args.data.date,
          nav: decimalNumber(args.data.nav),
          dailyReturn: decimalNumber(args.data.dailyReturn),
        };
        navs.push(row);
        return Promise.resolve(mapNav(row));
      }),
      findMany: vi.fn((args: FakeNavFindManyArgs) =>
        Promise.resolve(
          [...navs]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, args.take)
            .map(mapNav),
        ),
      ),
    },
    investmentAccount: {
      findUnique: vi.fn((args: FakeInvestmentAccountFindUniqueArgs) => {
        const account = accounts.find((row) => row.studentId === args.where.studentId);
        return Promise.resolve(account ? mapAccount(account) : null);
      }),
      upsert: vi.fn((args: FakeInvestmentAccountUpsertArgs) => {
        const existing = accounts.find((row) => row.studentId === args.where.studentId);
        if (existing) {
          existing.units += decimalNumber(args.update.units.increment);
          return Promise.resolve(mapAccount(existing));
        }

        const created = {
          studentId: args.create.studentId,
          units: decimalNumber(args.create.units),
        };
        accounts.push(created);
        return Promise.resolve(mapAccount(created));
      }),
      update: vi.fn((args: FakeInvestmentAccountUpdateArgs) => {
        const existing = accounts.find((row) => row.studentId === args.where.studentId);
        if (!existing) throw new Error('missing investment account');
        existing.units = decimalNumber(args.data.units);
        return Promise.resolve(mapAccount(existing));
      }),
    },
    investmentTransaction: {
      create: vi.fn((args: FakeInvestmentTransactionCreateArgs) => {
        const row: StoredInvestmentTransaction = {
          id: `ckinvesttxn${String(nextTransaction++).padStart(12, '0')}`,
          studentId: args.data.studentId,
          type: args.data.type,
          units: decimalNumber(args.data.units),
          nav: decimalNumber(args.data.nav),
          feeMerits: args.data.feeMerits,
          createdAt: new Date(),
        };
        transactions.push(row);
        return Promise.resolve({ id: row.id });
      }),
      findMany: vi.fn((args: FakeInvestmentTransactionFindManyArgs) =>
        Promise.resolve(
          transactions
            .filter((row) => row.studentId === args.where.studentId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, args.take)
            .map((row) => ({
              id: row.id,
              type: row.type,
              units: decimal(row.units),
              nav: decimal(row.nav),
              feeMerits: row.feeMerits,
              createdAt: row.createdAt,
            })),
        ),
      ),
    },
    students,
    guardians,
    ledger,
    navs,
    accounts,
    transactions,
  };

  db.$transaction.mockImplementation(async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db));

  return db;
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: <T>(fn: (tx: RlsTx) => Promise<T>): Promise<T> => {
      void fn;
      return Promise.reject(new Error('withRls is not used by investment router tests'));
    },
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ investment: investmentRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function auditCreates(db: ReturnType<typeof makeFakeDb>): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  process.env['INVESTMENT_NAV_SEED'] = 'oasis-v1';
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env['INVESTMENT_NAV_SEED'];
});

describe('investment.tickNav', () => {
  it('creates a deterministic daily NAV tick and is idempotent for the same UTC day', async () => {
    const { caller, db } = makeCaller(headUser);

    const first = await caller.investment.tickNav();
    const second = await caller.investment.tickNav();

    expect(first.status).toBe('Created');
    expect(second).toEqual({ status: 'AlreadyExists', nav: first.nav });
    expect(db.navs).toHaveLength(1);
    expect(db.investmentNav.create).toHaveBeenCalledTimes(1);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentNav',
        entityId: '2026-05-15',
        meta: expect.objectContaining({
          source: 'investment.tickNav',
          seed: 'oasis-v1',
          status: 'Created',
        }) as unknown,
      }),
    );
  });

  it('requires full-admin access and audits denials', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(caller.investment.tickNav()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.investmentNav.create).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'InvestmentNav',
      }),
    );
  });
});

describe('investment.navHistory', () => {
  it('returns the requested number of stored NAV rows in ascending date order', async () => {
    const { caller } = makeCaller(
      headUser,
      makeFakeDb({
        navs: [
          { date: day('2026-05-13'), nav: 100, dailyReturn: 0 },
          { date: day('2026-05-14'), nav: 101, dailyReturn: 0.01 },
          { date: day('2026-05-15'), nav: 102, dailyReturn: 0.009901 },
        ],
      }),
    );

    await expect(caller.investment.navHistory({ days: 2 })).resolves.toEqual([
      { date: day('2026-05-14'), nav: 101, dailyReturn: 0.01 },
      { date: day('2026-05-15'), nav: 102, dailyReturn: 0.009901 },
    ]);
  });

  it('validates the day limit at the API boundary', async () => {
    await expect(
      makeCaller(headUser).caller.investment.navHistory({ days: 366 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('investment.account', () => {
  it('allows linked parents and students to view units, current value, and transactions', async () => {
    const db = makeFakeDb({
      ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 200, reason: 'buy' }],
      navs: [{ date: day('2026-05-15'), nav: 125, dailyReturn: 0.01 }],
      accounts: [{ studentId: linkedStudentId, units: 1.5 }],
      transactions: [
        {
          id: 'ckinvesttxn000000000001',
          studentId: linkedStudentId,
          type: 'Buy',
          units: 1.5,
          nav: 125,
          feeMerits: 0,
          createdAt: day('2026-05-15'),
        },
      ],
    });

    await expect(
      makeCaller(parentUser, db).caller.investment.account({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      units: 1.5,
      latestNav: { date: day('2026-05-15'), nav: 125, dailyReturn: 0.01 },
      currentValueMerits: 187,
      costBasisMerits: 200,
      transactions: [
        {
          id: 'ckinvesttxn000000000001',
          type: 'Buy',
          units: 1.5,
          nav: 125,
          feeMerits: 0,
          createdAt: day('2026-05-15'),
        },
      ],
    });

    await expect(
      makeCaller(studentUser, db).caller.investment.account({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({ studentId: linkedStudentId, units: 1.5 });
  });

  it('blocks supervisors and unlinked parents from account reads', async () => {
    const supervisor = makeCaller(supervisorUser);
    await expect(
      supervisor.caller.investment.account({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const parent = makeCaller(parentUser);
    await expect(
      parent.caller.investment.account({ studentId: otherStudentId }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(auditCreates(parent.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'investment.account',
        entityId: otherStudentId,
      }),
    );
  });
});

describe('investment.buy', () => {
  it('creates units, balanced ledger rows, a transaction row, and an audit row', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 300, reason: 'merit' }],
        navs: [{ date: day('2026-05-15'), nav: 120, dailyReturn: 0.01 }],
      }),
    );

    await expect(
      caller.investment.buy({ studentId: linkedStudentId, merits: 240 }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      units: 2,
      unitsBought: 2,
      nav: { date: day('2026-05-15'), nav: 120, dailyReturn: 0.01 },
    });

    expect(db.accounts).toEqual([{ studentId: linkedStudentId, units: 2 }]);
    expect(db.transactions).toMatchObject([
      {
        studentId: linkedStudentId,
        type: 'Buy',
        units: 2,
        nav: 120,
        feeMerits: 0,
      },
    ]);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Spend',
      delta: -240,
      reason: 'investment:buy',
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Investment',
      delta: 240,
      reason: 'investment:buy',
    });
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:buy')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentTransaction',
        meta: expect.objectContaining({
          source: 'investment.buy',
          studentId: linkedStudentId,
          merits: 240,
          units: 2,
          nav: 120,
        }) as unknown,
      }),
    );
  });

  it('rejects insufficient Spend and parent write attempts', async () => {
    const insufficient = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'merit' }],
        navs: [{ date: day('2026-05-15'), nav: 100, dailyReturn: 0 }],
      }),
    );

    await expect(
      insufficient.caller.investment.buy({ studentId: linkedStudentId, merits: 11 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(insufficient.db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(insufficient.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'InvestmentTransaction',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          source: 'investment.buy',
          outcome: 'Rejected',
          reason: 'InsufficientSpend',
        }) as unknown,
      }),
    );

    const parent = makeCaller(parentUser);
    await expect(
      parent.caller.investment.buy({ studentId: linkedStudentId, merits: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parent.db.investmentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('investment.sell', () => {
  it('sells units, applies fee, realizes gain through InvestmentReturn, and balances ledger rows', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 200, reason: 'buy' }],
        navs: [{ date: day('2026-05-15'), nav: 120, dailyReturn: 0.01 }],
        accounts: [{ studentId: linkedStudentId, units: 2 }],
      }),
    );

    await expect(
      caller.investment.sell({ studentId: linkedStudentId, units: 1 }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      units: 1,
      unitsSold: 1,
      proceedsMerits: 120,
      feeMerits: 6,
      netMerits: 114,
      costBasisMerits: 100,
      investmentReturnDelta: -20,
    });

    expect(db.accounts).toEqual([{ studentId: linkedStudentId, units: 1 }]);
    expect(db.transactions).toMatchObject([
      {
        studentId: linkedStudentId,
        type: 'Sell',
        units: 1,
        nav: 120,
        feeMerits: 6,
      },
    ]);
    expect(db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Investment', delta: 200, reason: 'buy' },
      {
        studentId: linkedStudentId,
        account: 'Investment',
        delta: -100,
        reason: 'investment:sell',
      },
      {
        studentId: linkedStudentId,
        account: 'Spend',
        delta: 114,
        reason: 'investment:sell',
      },
      {
        studentId: linkedStudentId,
        account: 'FeeSink',
        delta: 6,
        reason: 'investment:sell',
      },
      {
        studentId: linkedStudentId,
        account: 'InvestmentReturn',
        delta: -20,
        reason: 'investment:sell',
      },
    ]);
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:sell')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentTransaction',
        meta: expect.objectContaining({
          source: 'investment.sell',
          proceedsMerits: 120,
          feeMerits: 6,
          netMerits: 114,
          costBasisMerits: 100,
          investmentReturnDelta: -20,
        }) as unknown,
      }),
    );
  });

  it('rejects insufficient units before writing transaction rows', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 100, reason: 'buy' }],
        navs: [{ date: day('2026-05-15'), nav: 100, dailyReturn: 0 }],
        accounts: [{ studentId: linkedStudentId, units: 0.5 }],
      }),
    );

    await expect(
      caller.investment.sell({ studentId: linkedStudentId, units: 1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.investmentTransaction.create).not.toHaveBeenCalled();
    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'InvestmentTransaction',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          source: 'investment.sell',
          outcome: 'Rejected',
          reason: 'InsufficientUnits',
        }) as unknown,
      }),
    );
  });
});
