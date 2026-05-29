import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { titheRouter } from '../routers/tithe.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'cktithehead0000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'cktitheparent000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'cktithestudentuser00001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'cktithesupervisor00001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'cktithestudent000000001';
const otherStudentId = 'cktithestudent000000002';

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
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredTitheConfig {
  studentId: string;
  percentage: number;
  cadence: string;
  lastRunAt: Date | null;
}

interface StoredTitheRun {
  studentId: string;
  periodStart: Date;
  periodEnd: Date;
  grossMerits: number;
  titheAmount: number;
}

interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
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
  select?: { id?: true; active?: true };
}

interface FakeStudentFindManyArgs {
  where: { active: true };
  select: { id: true };
}

interface FakeGuardianFindUniqueArgs {
  where: { userId_studentId: { userId: string; studentId: string } };
  select?: { studentId?: true };
}

interface FakeTitheConfigFindUniqueArgs {
  where: { studentId: string };
  select?: { studentId?: true; percentage?: true; cadence?: true; lastRunAt?: true };
}

interface FakeTitheConfigFindManyArgs {
  where: { studentId: { in: string[] } };
  select: { studentId: true; percentage: true };
}

interface FakeTitheConfigUpsertArgs {
  where: { studentId: string };
  create: {
    studentId: string;
    percentage: number;
    cadence: string;
    lastRunAt?: Date;
  };
  update: {
    percentage?: number;
    lastRunAt?: Date;
  };
  select?: { studentId?: true; percentage?: true; cadence?: true; lastRunAt?: true };
}

interface FakeBehaviourFindManyArgs {
  where: {
    studentId: { in: string[] };
    createdAt: { gte: Date; lt: Date };
    deletedAt: null;
  };
  select: { studentId: true; type: true; meritDelta: true };
}

interface FakeTitheRunFindUniqueArgs {
  where: { studentId_periodStart: { studentId: string; periodStart: Date } };
  select: { grossMerits: true; titheAmount: true };
}

interface FakeTitheRunCreateArgs {
  data: StoredTitheRun;
}

interface FakeLedgerCreateManyArgs {
  data: StoredLedgerRow[];
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

function instant(value: string): Date {
  return new Date(value);
}

function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
  return { active: true, ...input };
}

function makeBehaviourEntry(input: StoredBehaviourEntry): StoredBehaviourEntry {
  return input;
}

function pickConfig(config: StoredTitheConfig, select?: FakeTitheConfigFindUniqueArgs['select']) {
  if (!select) return { ...config };
  return {
    ...(select.studentId ? { studentId: config.studentId } : {}),
    ...(select.percentage ? { percentage: config.percentage } : {}),
    ...(select.cadence ? { cadence: config.cadence } : {}),
    ...(select.lastRunAt ? { lastRunAt: config.lastRunAt } : {}),
  };
}

function makeFakeDb(
  input: {
    students?: StoredStudent[];
    guardians?: StoredGuardian[];
    configs?: StoredTitheConfig[];
    runs?: StoredTitheRun[];
    ledger?: StoredLedgerRow[];
    behaviour?: StoredBehaviourEntry[];
  } = {},
) {
  const students = input.students ?? [
    makeStudent({ id: linkedStudentId }),
    makeStudent({ id: otherStudentId }),
  ];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
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
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) =>
        Promise.resolve(students.find((student) => student.id === args.where.id) ?? null),
      ),
      findMany: vi.fn((args: FakeStudentFindManyArgs) =>
        Promise.resolve(
          students
            .filter((student) => student.active === args.where.active)
            .map((student) => ({ id: student.id })),
        ),
      ),
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
    titheConfig: {
      findUnique: vi.fn((args: FakeTitheConfigFindUniqueArgs) => {
        const config = configs.find((row) => row.studentId === args.where.studentId);
        return Promise.resolve(config ? pickConfig(config, args.select) : null);
      }),
      findMany: vi.fn((args: FakeTitheConfigFindManyArgs) =>
        Promise.resolve(
          configs
            .filter((row) => args.where.studentId.in.includes(row.studentId))
            .map((row) => ({ studentId: row.studentId, percentage: row.percentage })),
        ),
      ),
      upsert: vi.fn((args: FakeTitheConfigUpsertArgs) => {
        const existing = configs.find((row) => row.studentId === args.where.studentId);
        const config = existing ?? {
          studentId: args.create.studentId,
          percentage: args.create.percentage,
          cadence: args.create.cadence,
          lastRunAt: args.create.lastRunAt ?? null,
        };

        if (existing) {
          existing.percentage = args.update.percentage ?? existing.percentage;
          existing.lastRunAt = args.update.lastRunAt ?? existing.lastRunAt;
        } else {
          configs.push(config);
        }

        return Promise.resolve(pickConfig(config, args.select));
      }),
    },
    behaviourEntry: {
      findMany: vi.fn((args: FakeBehaviourFindManyArgs) =>
        Promise.resolve(
          behaviour
            .filter((entry) => args.where.studentId.in.includes(entry.studentId))
            .filter((entry) => entry.deletedAt === args.where.deletedAt)
            .filter(
              (entry) =>
                entry.createdAt >= args.where.createdAt.gte &&
                entry.createdAt < args.where.createdAt.lt,
            )
            .map((entry) => ({
              studentId: entry.studentId,
              type: entry.type,
              meritDelta: entry.meritDelta,
            })),
        ),
      ),
    },
    titheRun: {
      findUnique: vi.fn((args: FakeTitheRunFindUniqueArgs) =>
        Promise.resolve(
          runs.find(
            (run) =>
              run.studentId === args.where.studentId_periodStart.studentId &&
              sameDate(run.periodStart, args.where.studentId_periodStart.periodStart),
          ) ?? null,
        ),
      ),
      create: vi.fn((args: FakeTitheRunCreateArgs) => {
        runs.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
    meritLedger: {
      createMany: vi.fn((args: FakeLedgerCreateManyArgs) => {
        ledger.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    students,
    guardians,
    configs,
    runs,
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

describe('tithe.getConfig', () => {
  it('defaults to a 10 percent weekly config when no row exists', async () => {
    const { caller } = makeCaller(headUser);

    await expect(caller.tithe.getConfig({ studentId: linkedStudentId })).resolves.toEqual({
      studentId: linkedStudentId,
      percentage: 10,
      cadence: 'Weekly',
      lastRunAt: null,
    });
  });

  it('allows linked parents to read and blocks unlinked parents', async () => {
    await expect(
      makeCaller(parentUser).caller.tithe.getConfig({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({ studentId: linkedStudentId });

    const { caller, db } = makeCaller(parentUser);
    await expect(caller.tithe.getConfig({ studentId: otherStudentId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'tithe.getConfig',
        entityId: otherStudentId,
      }),
    );
  });

  it('blocks students and supervisors from reading tithe config', async () => {
    await expect(
      makeCaller(studentUser).caller.tithe.getConfig({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(supervisorUser).caller.tithe.getConfig({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects inactive or missing students as not found', async () => {
    await expect(
      makeCaller(
        headUser,
        makeFakeDb({ students: [makeStudent({ id: linkedStudentId, active: false })] }),
      ).caller.tithe.getConfig({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      makeCaller(headUser).caller.tithe.getConfig({ studentId: 'cktithemissing0000001' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('tithe.setPercentage', () => {
  it('allows full-admin and linked parents to set 10, 15, or 20 percent configs', async () => {
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        configs: [
          {
            studentId: linkedStudentId,
            percentage: 10,
            cadence: 'Weekly',
            lastRunAt: null,
          },
        ],
      }),
    );

    await expect(
      caller.tithe.setPercentage({ studentId: linkedStudentId, percentage: 15 }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      percentage: 15,
      cadence: 'Weekly',
    });
    expect(db.configs[0]?.percentage).toBe(15);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual({
      userId: headUser.id,
      action: 'Update',
      entity: 'TitheConfig',
      entityId: linkedStudentId,
      meta: {
        source: 'tithe.setPercentage',
        previousPercentage: 10,
        percentage: 15,
      },
    });

    await expect(
      makeCaller(parentUser).caller.tithe.setPercentage({
        studentId: linkedStudentId,
        percentage: 20,
      }),
    ).resolves.toMatchObject({ percentage: 20 });
  });

  it('rejects invalid percentages at the API boundary', async () => {
    await expect(
      makeCaller(headUser).caller.tithe.setPercentage({
        studentId: linkedStudentId,
        percentage: 12 as 10,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('blocks students from changing tithe config', async () => {
    const { caller, db } = makeCaller(studentUser);

    await expect(
      caller.tithe.setPercentage({ studentId: linkedStudentId, percentage: 10 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.titheConfig.upsert).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'tithe.setPercentage',
        entityId: linkedStudentId,
      }),
    );
  });
});

describe('tithe.runWeek', () => {
  it('runs a Friday 1pm London tithe week, ignores demerits, and creates balanced ledger rows', async () => {
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        configs: [
          {
            studentId: linkedStudentId,
            percentage: 10,
            cadence: 'Weekly',
            lastRunAt: null,
          },
        ],
        behaviour: [
          makeBehaviourEntry({
            studentId: linkedStudentId,
            type: 'Merit',
            meritDelta: 30,
            createdAt: day('2026-05-11'),
            deletedAt: null,
          }),
          makeBehaviourEntry({
            studentId: linkedStudentId,
            type: 'Merit',
            meritDelta: 20,
            createdAt: day('2026-05-12'),
            deletedAt: null,
          }),
          makeBehaviourEntry({
            studentId: linkedStudentId,
            type: 'Demerit',
            meritDelta: -5,
            createdAt: day('2026-05-13'),
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
            studentId: otherStudentId,
            type: 'Merit',
            meritDelta: 9,
            createdAt: day('2026-05-11'),
            deletedAt: null,
          }),
        ],
      }),
    );

    await expect(caller.tithe.runWeek({ weekStart: day('2026-05-15') })).resolves.toMatchObject({
      period: {
        start: instant('2026-05-08T12:00:00.000Z'),
        end: instant('2026-05-15T12:00:00.000Z'),
      },
      created: 2,
      skipped: 0,
      ledgerRowsCreated: 2,
      grossMerits: 158,
      titheAmount: 14,
      runs: [
        {
          studentId: linkedStudentId,
          status: 'Created',
          grossMerits: 149,
          titheAmount: 14,
          ledgerRowsCreated: 2,
        },
        {
          studentId: otherStudentId,
          status: 'Created',
          grossMerits: 9,
          titheAmount: 0,
          ledgerRowsCreated: 0,
        },
      ],
    });

    expect(db.ledger).toEqual([
      {
        studentId: linkedStudentId,
        account: 'Spend',
        delta: -14,
        reason: 'tithe:2026-05-08:10pct',
      },
      {
        studentId: linkedStudentId,
        account: 'TithePaid',
        delta: 14,
        reason: 'tithe:2026-05-08:10pct',
      },
    ]);
    expect(db.ledger.reduce((total, row) => total + row.delta, 0)).toBe(0);
    expect(db.runs).toHaveLength(2);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'TitheRun',
        meta: expect.objectContaining({
          source: 'tithe.runWeek',
          periodStart: '2026-05-08T12:00:00.000Z',
          periodEnd: '2026-05-15T12:00:00.000Z',
          created: 2,
          skipped: 0,
          grossMerits: 158,
          titheAmount: 14,
        }) as unknown,
      }),
    );
  });

  it('is idempotent for the same student and week', async () => {
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        behaviour: [
          makeBehaviourEntry({
            studentId: linkedStudentId,
            type: 'Merit',
            meritDelta: 100,
            createdAt: day('2026-05-11'),
            deletedAt: null,
          }),
        ],
      }),
    );

    await expect(caller.tithe.runWeek({ weekStart: day('2026-05-11') })).resolves.toMatchObject({
      created: 2,
      skipped: 0,
      titheAmount: 10,
    });
    await expect(caller.tithe.runWeek({ weekStart: day('2026-05-12') })).resolves.toMatchObject({
      created: 0,
      skipped: 2,
      titheAmount: 0,
      runs: [
        {
          studentId: linkedStudentId,
          status: 'AlreadyRun',
          grossMerits: 100,
          titheAmount: 10,
          ledgerRowsCreated: 0,
        },
        {
          studentId: otherStudentId,
          status: 'AlreadyRun',
          grossMerits: 0,
          titheAmount: 0,
          ledgerRowsCreated: 0,
        },
      ],
    });

    expect(db.runs).toHaveLength(2);
    expect(db.ledger).toHaveLength(2);
  });

  it('requires full-admin access and audits denials', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(caller.tithe.runWeek({ weekStart: day('2026-05-11') })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.titheRun.create).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'tithe.runWeek',
      }),
    );
  });

  it('audits an empty active-student run', async () => {
    const { caller, db } = makeCaller(headUser, makeFakeDb({ students: [] }));

    await expect(caller.tithe.runWeek({ weekStart: day('2026-05-11') })).resolves.toMatchObject({
      created: 0,
      skipped: 0,
      ledgerRowsCreated: 0,
      grossMerits: 0,
      titheAmount: 0,
      runs: [],
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'TitheRun',
        meta: expect.objectContaining({
          source: 'tithe.runWeek',
          students: 0,
          created: 0,
          skipped: 0,
        }) as unknown,
      }),
    );
  });
});
