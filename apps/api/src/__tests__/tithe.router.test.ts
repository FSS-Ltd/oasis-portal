import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { titheRouter } from '../routers/tithe.js';
import { router } from '../trpc.js';

const studentUser: SessionUser = {
  id: 'cktithestudentuser00001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'cktitheparent000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'cktithestudent000000001';

type AuditAction = 'Create' | 'Update' | 'PermissionDenied';
type BehaviourType = 'Merit' | 'Demerit' | 'General';

interface StoredStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

interface StoredTitheConfig {
  studentId: string;
  percentage: number;
  cadence: string;
  mode: string;
  fixedAmount: number | null;
  weeklyDay: number;
  monthlyDate: number;
  lastRunAt: Date | null;
}

interface StoredTitheRun {
  studentId: string;
  cadence: string;
  periodStart: Date;
  periodEnd: Date;
  grossMerits: number;
  minimumAmount: number;
  titheAmount: number;
}

interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
  createdAt?: Date;
}

interface StoredBehaviourEntry {
  studentId: string;
  type: BehaviourType;
  meritDelta: number;
  createdAt: Date;
  deletedAt: Date | null;
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

function instant(value: string): Date {
  return new Date(value);
}

function defaultConfig(studentId = linkedStudentId): StoredTitheConfig {
  return {
    studentId,
    percentage: 10,
    cadence: 'Weekly',
    mode: 'Percentage',
    fixedAmount: null,
    weeklyDay: 5,
    monthlyDate: 1,
    lastRunAt: null,
  };
}

function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function makeFakeDb(
  input: {
    students?: StoredStudent[];
    configs?: StoredTitheConfig[];
    runs?: StoredTitheRun[];
    ledger?: StoredLedgerRow[];
    behaviour?: StoredBehaviourEntry[];
  } = {},
) {
  const students = input.students ?? [
    { id: linkedStudentId, active: true, userId: studentUser.id },
  ];
  const configs = input.configs ?? [];
  const runs = input.runs ?? [];
  const ledger = input.ledger ?? [];
  const behaviour = input.behaviour ?? [];

  const db = {
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    student: {
      findUnique: vi.fn(
        (args: { where: { id?: string; userId?: string }; select?: Record<string, true> }) =>
          Promise.resolve(
            students.find((student) =>
              args.where.id ? student.id === args.where.id : student.userId === args.where.userId,
            ) ?? null,
          ),
      ),
    },
    titheConfig: {
      findUnique: vi.fn((args: { where: { studentId: string } }) =>
        Promise.resolve(configs.find((row) => row.studentId === args.where.studentId) ?? null),
      ),
      upsert: vi.fn(
        (args: {
          where: { studentId: string };
          create: StoredTitheConfig;
          update: Partial<StoredTitheConfig>;
        }) => {
          const existing = configs.find((row) => row.studentId === args.where.studentId);
          if (existing) {
            Object.assign(existing, args.update);
            return Promise.resolve(existing);
          }
          configs.push(args.create);
          return Promise.resolve(args.create);
        },
      ),
    },
    titheRun: {
      findUnique: vi.fn(
        (args: { where: { studentId_cadence_periodStart: { studentId: string; cadence: string; periodStart: Date } } }) =>
          Promise.resolve(
            runs.find(
              (run) =>
                run.studentId === args.where.studentId_cadence_periodStart.studentId &&
                run.cadence === args.where.studentId_cadence_periodStart.cadence &&
                sameDate(run.periodStart, args.where.studentId_cadence_periodStart.periodStart),
            ) ?? null,
          ),
      ),
      create: vi.fn((args: { data: StoredTitheRun }) => {
        runs.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
    behaviourEntry: {
      findMany: vi.fn(
        (args: {
          where: { studentId: string; createdAt: { gte: Date; lt: Date }; deletedAt: null };
          select: { type: true; meritDelta: true };
        }) =>
          Promise.resolve(
            behaviour
              .filter((entry) => entry.studentId === args.where.studentId)
              .filter((entry) => entry.deletedAt === null)
              .filter(
                (entry) =>
                  entry.createdAt >= args.where.createdAt.gte &&
                  entry.createdAt < args.where.createdAt.lt,
              )
              .map((entry) => ({ type: entry.type, meritDelta: entry.meritDelta })),
          ),
      ),
    },
    meritLedger: {
      findMany: vi.fn(
        (args: {
          where: {
            studentId: string;
            account?: MeritAccount | { in: MeritAccount[] };
            delta?: { lt: number };
            reason?: string;
            createdAt?: { gte: Date; lt: Date };
          };
          select?: Record<string, true>;
        }) =>
          Promise.resolve(
            ledger.filter((row) => {
              const createdAt = row.createdAt ?? instant('2026-05-20T12:00:00.000Z');
              const account = args.where.account;
              const accountMatch =
                account === undefined
                  ? true
                  : typeof account === 'string'
                    ? row.account === account
                    : account.in.includes(row.account);
              return (
                row.studentId === args.where.studentId &&
                accountMatch &&
                (args.where.delta ? row.delta < args.where.delta.lt : true) &&
                (args.where.reason ? row.reason === args.where.reason : true) &&
                (args.where.createdAt
                  ? createdAt >= args.where.createdAt.gte && createdAt < args.where.createdAt.lt
                  : true)
              );
            }),
          ),
      ),
      aggregate: vi.fn((args: { where: { studentId: string; account: MeritAccount } }) =>
        Promise.resolve({
          _sum: {
            delta: ledger
              .filter(
                (row) => row.studentId === args.where.studentId && row.account === args.where.account,
              )
              .reduce((sum, row) => sum + row.delta, 0),
          },
        }),
      ),
      createMany: vi.fn((args: { data: StoredLedgerRow[] }) => {
        ledger.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    configs,
    runs,
    ledger,
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
      return Promise.reject(new Error('withRls is not used by tithe router tests'));
    },
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ tithe: titheRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-22T12:30:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tithe.getStatus', () => {
  it('calculates period earnings from merits and realized investment gains', async () => {
    const { caller } = makeCaller(
      studentUser,
      makeFakeDb({
        configs: [{ ...defaultConfig(), percentage: 12 }],
        behaviour: [
          {
            studentId: linkedStudentId,
            type: 'Merit',
            meritDelta: 80,
            createdAt: instant('2026-05-20T09:00:00.000Z'),
            deletedAt: null,
          },
          {
            studentId: linkedStudentId,
            type: 'Demerit',
            meritDelta: -10,
            createdAt: instant('2026-05-20T10:00:00.000Z'),
            deletedAt: null,
          },
        ],
        ledger: [
          {
            studentId: linkedStudentId,
            account: 'InvestmentReturn',
            delta: -20,
            reason: 'investment:sell',
            createdAt: instant('2026-05-20T12:00:00.000Z'),
          },
          {
            studentId: linkedStudentId,
            account: 'Spend',
            delta: 200,
            reason: 'seed',
          },
        ],
      }),
    );

    await expect(caller.tithe.getStatus()).resolves.toMatchObject({
      studentId: linkedStudentId,
      config: { cadence: 'Weekly', mode: 'Percentage', percentage: 12 },
      grossMerits: 100,
      minimumAmount: 10,
      selectedAmount: 12,
      paid: false,
      shopBlocked: true,
    });
  });
});

describe('tithe.updatePreference', () => {
  it('allows students to save weekly or monthly manual tithe preferences', async () => {
    const { caller, db } = makeCaller(studentUser);

    await expect(
      caller.tithe.updatePreference({
        cadence: 'Monthly',
        mode: 'FixedAmount',
        fixedAmount: 10,
        monthlyDate: 31,
      }),
    ).resolves.toMatchObject({
      config: {
        cadence: 'Monthly',
        mode: 'FixedAmount',
        fixedAmount: 10,
        monthlyDate: 31,
      },
    });
    expect(db.configs[0]).toMatchObject({
      studentId: linkedStudentId,
      cadence: 'Monthly',
      mode: 'FixedAmount',
      fixedAmount: 10,
      monthlyDate: 31,
    });
  });

  it('blocks parents from changing a student tithe preference', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(
      caller.tithe.updatePreference({
        cadence: 'Weekly',
        mode: 'Percentage',
        percentage: 10,
        weeklyDay: 5,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.titheConfig.upsert).not.toHaveBeenCalled();
  });
});

describe('tithe.payDue', () => {
  it('creates a tithe run and balanced ledger rows for the current due period', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        configs: [{ ...defaultConfig(), percentage: 12 }],
        behaviour: [
          {
            studentId: linkedStudentId,
            type: 'Merit',
            meritDelta: 100,
            createdAt: instant('2026-05-20T09:00:00.000Z'),
            deletedAt: null,
          },
        ],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'seed' }],
      }),
    );

    await expect(caller.tithe.payDue()).resolves.toMatchObject({
      paid: true,
      titheAmount: 12,
    });
    expect(db.runs).toHaveLength(1);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Spend',
      delta: -12,
      reason: 'tithe:weekly:2026-05-14',
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'TithePaid',
      delta: 12,
      reason: 'tithe:weekly:2026-05-14',
    });
  });

  it('rejects payment when Spend balance cannot cover the selected amount', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        configs: [{ ...defaultConfig(), percentage: 20 }],
        behaviour: [
          {
            studentId: linkedStudentId,
            type: 'Merit',
            meritDelta: 100,
            createdAt: instant('2026-05-20T09:00:00.000Z'),
            deletedAt: null,
          },
        ],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'seed' }],
      }),
    );

    await expect(caller.tithe.payDue()).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.titheRun.create).not.toHaveBeenCalled();
  });
});
