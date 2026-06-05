import { describe, expect, it, vi } from 'vitest';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { leaderboardRouter } from '../routers/leaderboard.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'leaderboard-head',
  role: 'Head',
  tags: [],
  requires2fa: false,
};

const leaderboardAdminUser: SessionUser = {
  id: 'leaderboard-admin',
  role: 'Supervisor',
  tags: ['leaderboard-admin'],
  requires2fa: false,
};

const supervisorUser: SessionUser = {
  id: 'leaderboard-supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const pastorUser: SessionUser = {
  id: 'leaderboard-pastor',
  role: 'Pastor',
  tags: [],
  requires2fa: false,
};

const technicalSupportUser: SessionUser = {
  id: 'leaderboard-tech-support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};

const parentUser: SessionUser = {
  id: 'leaderboard-parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const studentUser: SessionUser = {
  id: 'leaderboard-student-user',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

interface StoredStudent {
  id: string;
  userId?: string | null;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  enrolmentDate: Date;
}

interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
}

interface StoredInvestmentAccount {
  studentId: string;
  units: number;
}

interface StoredBehaviourEntry {
  studentId: string;
  type: 'Merit' | 'Demerit' | 'General';
  meritDelta: number;
  deletedAt: Date | null;
  noteEnc?: string | null;
  headCommentEnc?: string | null;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredCharityPot {
  id: string;
  goalMerits: number;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
}

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

interface FakeStudentFindManyArgs {
  where: { id: { in: string[] }; active: true };
  select: { id: true; fullNameEnc: true; yearGroup: true; enrolmentDate: true };
}

interface FakeStudentFindUniqueArgs {
  where: { userId?: string; id?: string };
  select: { id: true; active: true };
}

interface FakeGuardianFindManyArgs {
  where: {
    userId: string;
    student?: { active: true };
  };
  select: { studentId: true };
}

interface FakeLedgerGroupByArgs {
  by: ['studentId'];
  where: { account: MeritAccount; studentId?: { in: string[] } };
  _sum: { delta: true };
}

interface FakeLedgerAggregateArgs {
  where: { account: MeritAccount; delta?: { gt: number } };
  _sum: { delta: true };
}

interface FakeInvestmentAccountFindManyArgs {
  where: { student: { active: true } };
  select: {
    studentId: true;
    units: true;
    student: { select: { fullNameEnc: true; yearGroup: true; enrolmentDate: true } };
  };
}

interface FakeInvestmentNavFindFirstArgs {
  orderBy: { date: 'desc' };
  select: { nav: true };
}

interface FakeBehaviourGroupByArgs {
  by: ['studentId'];
  where: { type: 'Demerit'; deletedAt: null };
  _sum: { meritDelta: true };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    meta?: unknown;
  };
}

interface FakeCharityPotFindFirstArgs {
  orderBy: { updatedAt: 'desc' };
  select: {
    id: true;
    goalMerits: true;
    updatedAt: true;
    updatedById: true;
  };
}

interface FakeCharityPotUpsertArgs {
  where: { id: string };
  create: { id: string; goalMerits: number; updatedById: string };
  update: { goalMerits: number; updatedById: string };
  select: {
    id: true;
    goalMerits: true;
    updatedAt: true;
    updatedById: true;
  };
}

function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
  return {
    active: true,
    fullNameEnc: input.id,
    yearGroup: 'Year 8',
    enrolmentDate: new Date('2025-01-01T00:00:00.000Z'),
    ...input,
  };
}

function makeFakeDb(
  input: {
    students?: StoredStudent[];
    ledger?: StoredLedgerRow[];
    investmentAccounts?: StoredInvestmentAccount[];
    latestNav?: number | null;
    behaviourEntries?: StoredBehaviourEntry[];
    guardians?: StoredGuardian[];
    charityPot?: StoredCharityPot | null;
  } = {},
) {
  const students = input.students ?? [];
  const ledger = input.ledger ?? [];
  const investmentAccounts = input.investmentAccounts ?? [];
  const latestNav = input.latestNav ?? null;
  const behaviourEntries = input.behaviourEntries ?? [];
  const guardians = input.guardians ?? [];
  let charityPot = input.charityPot ?? null;

  const db = {
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    $enc: {
      decrypt: vi.fn((value: string | null | undefined) => value ?? null),
    },
    student: {
      findMany: vi.fn((args: FakeStudentFindManyArgs) =>
        Promise.resolve(
          students
            .filter((student) => args.where.id.in.includes(student.id))
            .filter((student) => student.active === args.where.active)
            .map((student) => ({
              id: student.id,
              fullNameEnc: student.fullNameEnc,
              yearGroup: student.yearGroup,
              enrolmentDate: student.enrolmentDate,
            })),
        ),
      ),
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) => {
        const student = args.where.userId
          ? students.find((row) => row.userId === args.where.userId)
          : students.find((row) => row.id === args.where.id);
        if (!student) return Promise.resolve(null);
        return Promise.resolve({ id: student.id, active: student.active });
      }),
    },
    studentPortalSettings: {
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
    guardian: {
      findMany: vi.fn((args: FakeGuardianFindManyArgs) =>
        Promise.resolve(
          guardians
            .filter((guardian) => guardian.userId === args.where.userId)
            .filter((guardian) => {
              if (!args.where.student?.active) return true;
              return students.some(
                (student) => student.id === guardian.studentId && student.active,
              );
            })
            .map((guardian) => ({ studentId: guardian.studentId })),
        ),
      ),
    },
    meritLedger: {
      aggregate: vi.fn((args: FakeLedgerAggregateArgs) => {
        const delta = ledger
          .filter((row) => row.account === args.where.account)
          .filter((row) => (args.where.delta ? row.delta > args.where.delta.gt : true))
          .reduce((total, row) => total + row.delta, 0);
        return Promise.resolve({ _sum: { delta: delta === 0 ? null : delta } });
      }),
      groupBy: vi.fn((args: FakeLedgerGroupByArgs) => {
        const allowedStudentIds = args.where.studentId ? new Set(args.where.studentId.in) : null;
        const totals = new Map<string, number>();

        for (const row of ledger) {
          if (row.account !== args.where.account) continue;
          if (allowedStudentIds && !allowedStudentIds.has(row.studentId)) continue;
          totals.set(row.studentId, (totals.get(row.studentId) ?? 0) + row.delta);
        }

        return Promise.resolve(
          [...totals.entries()].map(([studentId, delta]) => ({
            studentId,
            _sum: { delta },
          })),
        );
      }),
    },
    investmentNav: {
      findFirst: vi.fn((args: FakeInvestmentNavFindFirstArgs) => {
        void args;
        return Promise.resolve(latestNav === null ? null : { nav: latestNav });
      }),
    },
    investmentAccount: {
      findMany: vi.fn((args: FakeInvestmentAccountFindManyArgs) => {
        void args;
        return Promise.resolve(
          investmentAccounts.flatMap((account) => {
            const student = students.find((row) => row.id === account.studentId);
            if (!student?.active) return [];
            return [
              {
                studentId: account.studentId,
                units: account.units,
                student: {
                  fullNameEnc: student.fullNameEnc,
                  yearGroup: student.yearGroup,
                  enrolmentDate: student.enrolmentDate,
                },
              },
            ];
          }),
        );
      }),
    },
    behaviourEntry: {
      groupBy: vi.fn((args: FakeBehaviourGroupByArgs) => {
        const totals = new Map<string, number>();

        for (const entry of behaviourEntries) {
          if (entry.type !== args.where.type || entry.deletedAt !== args.where.deletedAt) continue;
          totals.set(entry.studentId, (totals.get(entry.studentId) ?? 0) + entry.meritDelta);
        }

        return Promise.resolve(
          [...totals.entries()].map(([studentId, meritDelta]) => ({
            studentId,
            _sum: { meritDelta },
          })),
        );
      }),
    },
    charityPot: {
      findFirst: vi.fn((args: FakeCharityPotFindFirstArgs) => {
        void args;
        return Promise.resolve(charityPot);
      }),
      upsert: vi.fn((args: FakeCharityPotUpsertArgs) => {
        charityPot = {
          id: args.where.id,
          goalMerits: args.update.goalMerits,
          updatedById: args.update.updatedById,
          createdAt: charityPot?.createdAt ?? new Date('2026-06-04T00:00:00.000Z'),
          updatedAt: new Date('2026-06-04T12:00:00.000Z'),
        };
        return Promise.resolve({
          id: charityPot.id,
          goalMerits: charityPot.goalMerits,
          updatedAt: charityPot.updatedAt,
          updatedById: charityPot.updatedById,
        });
      }),
    },
  };

  return db;
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_leaderboard_test',
    withRls: <T>(fn: (tx: RlsTx) => Promise<T>): Promise<T> => {
      void fn;
      return Promise.reject(new Error('withRls is not used by leaderboard router tests'));
    },
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ leaderboard: leaderboardRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function auditCreates(db: ReturnType<typeof makeFakeDb>): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args);
}

describe('leaderboard.get', () => {
  it('ranks TopTithers by TithePaid total with deterministic ties and active students only', async () => {
    const db = makeFakeDb({
      students: [
        makeStudent({
          id: 'student-newer',
          fullNameEnc: 'Ben Newer',
          yearGroup: 'Year 9',
          enrolmentDate: new Date('2025-01-01T00:00:00.000Z'),
        }),
        makeStudent({
          id: 'student-older',
          fullNameEnc: 'Abigail Older',
          yearGroup: 'Year 8',
          enrolmentDate: new Date('2024-09-01T00:00:00.000Z'),
        }),
        makeStudent({ id: 'student-third', fullNameEnc: 'Cara Third' }),
        makeStudent({ id: 'student-inactive', active: false, fullNameEnc: 'Inactive Student' }),
      ],
      ledger: [
        { studentId: 'student-newer', account: 'TithePaid', delta: 50 },
        { studentId: 'student-older', account: 'TithePaid', delta: 50 },
        { studentId: 'student-third', account: 'TithePaid', delta: 20 },
        { studentId: 'student-inactive', account: 'TithePaid', delta: 999 },
      ],
    });

    await expect(
      makeCaller(supervisorUser, db).caller.leaderboard.get({ kind: 'TopTithers', limit: 2 }),
    ).resolves.toMatchObject({
      kind: 'TopTithers',
      rows: [
        {
          rank: 1,
          studentId: 'student-older',
          displayName: 'Abigail Older',
          yearGroup: 'Year 8',
          score: 50,
        },
        {
          rank: 2,
          studentId: 'student-newer',
          displayName: 'Ben Newer',
          yearGroup: 'Year 9',
          score: 50,
        },
      ],
    });
    expect(db.$enc.decrypt).toHaveBeenCalledTimes(2);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 2, kind: 'TopTithers', source: 'leaderboard.get' },
      }),
    );
  });

  it('ranks TopSavers by positive Saving balance', async () => {
    const db = makeFakeDb({
      students: [
        makeStudent({ id: 'student-saving', fullNameEnc: 'Saving Student' }),
        makeStudent({ id: 'student-zero', fullNameEnc: 'Zero Student' }),
      ],
      ledger: [
        { studentId: 'student-saving', account: 'Saving', delta: 40 },
        { studentId: 'student-saving', account: 'Saving', delta: -10 },
        { studentId: 'student-zero', account: 'Saving', delta: 0 },
      ],
    });

    await expect(
      makeCaller(supervisorUser, db).caller.leaderboard.get({ kind: 'TopSavers', limit: 10 }),
    ).resolves.toMatchObject({
      kind: 'TopSavers',
      rows: [{ rank: 1, studentId: 'student-saving', score: 30 }],
    });
  });

  it('ranks TopInvestors by current invested value from latest NAV', async () => {
    const db = makeFakeDb({
      students: [
        makeStudent({ id: 'student-higher-value', fullNameEnc: 'Higher Value Student' }),
        makeStudent({ id: 'student-higher-return', fullNameEnc: 'Higher Return Student' }),
        makeStudent({ id: 'student-inactive', active: false, fullNameEnc: 'Inactive Student' }),
      ],
      latestNav: 10,
      investmentAccounts: [
        { studentId: 'student-higher-value', units: 20 },
        { studentId: 'student-higher-return', units: 10 },
        { studentId: 'student-inactive', units: 100 },
      ],
      ledger: [
        { studentId: 'student-higher-value', account: 'Investment', delta: 200 },
        { studentId: 'student-higher-return', account: 'Investment', delta: 10 },
        { studentId: 'student-inactive', account: 'Investment', delta: 1 },
      ],
    });

    const result = await makeCaller(supervisorUser, db).caller.leaderboard.get({
      kind: 'TopInvestors',
      limit: 10,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      rank: 1,
      studentId: 'student-higher-value',
      displayName: 'Higher Value Student',
      score: 200,
    });
    expect(result.rows[1]?.studentId).toBe('student-higher-return');
    expect(result.rows[1]?.score).toBe(100);
  });

  it('adds only linked guardian children as viewerRows when they rank outside the top ten', async () => {
    const students = Array.from({ length: 12 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        fullNameEnc: `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      guardians: [{ userId: parentUser.id, studentId: 'student-12' }],
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'TithePaid',
        delta: 120 - index,
      })),
    });

    const result = await makeCaller(parentUser, db).caller.leaderboard.get({
      kind: 'TopTithers',
      limit: 10,
    });

    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((row) => row.studentId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `student-${String(index + 1).padStart(2, '0')}`),
    );
    expect(result.rows.map((row) => row.studentId)).not.toContain('student-11');
    expect(result.rows.map((row) => row.studentId)).not.toContain('student-12');
    expect(result.viewerRows).toEqual([
      {
        rank: 12,
        studentId: 'student-12',
        displayName: 'Student 12',
        yearGroup: 'Year 8',
        score: 109,
      },
    ]);
  });

  it('caps parent public leaderboard rows at the top ten even when a larger limit is requested', async () => {
    const students = Array.from({ length: 25 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        fullNameEnc: `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      guardians: [{ userId: parentUser.id, studentId: 'student-25' }],
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'TithePaid',
        delta: 125 - index,
      })),
    });

    const result = await makeCaller(parentUser, db).caller.leaderboard.get({
      kind: 'TopTithers',
      limit: 50,
    });

    expect(result.scope).toBe('public');
    expect(result.rows).toHaveLength(10);
    expect(result.rows.at(-1)?.studentId).toBe('student-10');
    expect(result.viewerRows).toEqual([
      expect.objectContaining({ rank: 25, studentId: 'student-25' }),
    ]);
  });

  it('returns linked guardian children as viewerRows when they rank inside the top ten', async () => {
    const students = Array.from({ length: 10 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        fullNameEnc: index === 5 ? 'Joshua Johnson' : `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      guardians: [{ userId: parentUser.id, studentId: 'student-06' }],
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'TithePaid',
        delta: 100 - index,
      })),
    });

    const result = await makeCaller(parentUser, db).caller.leaderboard.get({
      kind: 'TopTithers',
      limit: 10,
    });

    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((row) => row.studentId)).toContain('student-06');
    expect(result.viewerRows).toEqual([
      {
        rank: 6,
        studentId: 'student-06',
        displayName: 'Joshua Johnson',
        yearGroup: 'Year 8',
        score: 95,
      },
    ]);
  });

  it('adds only the signed-in student as a viewerRow when they rank outside the top ten', async () => {
    const students = Array.from({ length: 12 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        userId: index === 11 ? studentUser.id : null,
        fullNameEnc: `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'Saving',
        delta: 120 - index,
      })),
    });

    const result = await makeCaller(studentUser, db).caller.leaderboard.get({
      kind: 'TopSavers',
      limit: 10,
    });

    expect(result.rows).toHaveLength(10);
    expect(result.viewerRows).toEqual([
      {
        rank: 12,
        studentId: 'student-12',
        displayName: 'Student 12',
        yearGroup: 'Year 8',
        score: 109,
      },
    ]);
  });

  it('does not include outside-top-ten viewerRows for staff users', async () => {
    const students = Array.from({ length: 12 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        fullNameEnc: `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'Saving',
        delta: 120 - index,
      })),
    });

    const result = await makeCaller(supervisorUser, db).caller.leaderboard.get({
      kind: 'TopSavers',
      limit: 10,
    });

    expect(result.rows).toHaveLength(10);
    expect(result.viewerRows).toEqual([]);
  });

  it('paginates the full leaderboard for TechnicalSupport users', async () => {
    const students = Array.from({ length: 25 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        fullNameEnc: `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'Saving',
        delta: 125 - index,
      })),
    });

    const result = await makeCaller(technicalSupportUser, db).caller.leaderboard.get({
      kind: 'TopSavers',
      page: 2,
      pageSize: 20,
      scope: 'full',
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: 20,
      scope: 'full',
      totalRows: 25,
      viewerRows: [],
    });
    expect(result.rows.map((row) => row.studentId)).toEqual([
      'student-21',
      'student-22',
      'student-23',
      'student-24',
      'student-25',
    ]);
    expect(result.rows[0]?.rank).toBe(21);
  });

  it('denies full leaderboard scope for supervisors without reading extra pages', async () => {
    const db = makeFakeDb({
      students: [makeStudent({ id: 'student-01', fullNameEnc: 'Student 1' })],
      ledger: [{ studentId: 'student-01', account: 'Saving', delta: 10 }],
    });

    await expect(
      makeCaller(supervisorUser, db).caller.leaderboard.get({
        kind: 'TopSavers',
        scope: 'full',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const deniedAudit = auditCreates(db).find(
      (audit) =>
        audit.data.action === 'PermissionDenied' && audit.data.entity === 'leaderboard.get',
    );
    expect(deniedAudit?.data.meta).toMatchObject({ role: 'Supervisor', scope: 'full' });
    expect(db.meritLedger.groupBy).not.toHaveBeenCalled();
  });

  it('suppresses linked-child viewerRows when a staff portal opts out', async () => {
    const students = Array.from({ length: 12 }, (_, index) =>
      makeStudent({
        id: `student-${String(index + 1).padStart(2, '0')}`,
        fullNameEnc: `Student ${String(index + 1)}`,
      }),
    );
    const db = makeFakeDb({
      students,
      guardians: [{ userId: supervisorUser.id, studentId: 'student-12' }],
      ledger: students.map((student, index) => ({
        studentId: student.id,
        account: 'Saving',
        delta: 120 - index,
      })),
    });

    const result = await makeCaller(supervisorUser, db).caller.leaderboard.get({
      includeViewerRows: false,
      kind: 'TopSavers',
      limit: 10,
    });

    expect(result.rows).toHaveLength(10);
    expect(result.viewerRows).toEqual([]);
  });

  it('allows full-admin users to view HighestDemerits without returning sensitive notes', async () => {
    const db = makeFakeDb({
      students: [
        makeStudent({ id: 'student-a', fullNameEnc: 'Student A' }),
        makeStudent({ id: 'student-b', fullNameEnc: 'Student B' }),
      ],
      behaviourEntries: [
        {
          studentId: 'student-a',
          type: 'Demerit',
          meritDelta: -5,
          deletedAt: null,
        },
        {
          studentId: 'student-a',
          type: 'Demerit',
          meritDelta: -10,
          deletedAt: null,
          noteEnc: 'sensitive note',
          headCommentEnc: 'sensitive head comment',
        },
        {
          studentId: 'student-b',
          type: 'Demerit',
          meritDelta: -20,
          deletedAt: null,
        },
        {
          studentId: 'student-b',
          type: 'Demerit',
          meritDelta: -100,
          deletedAt: new Date('2026-05-01T00:00:00.000Z'),
        },
        {
          studentId: 'student-b',
          type: 'Merit',
          meritDelta: 100,
          deletedAt: null,
        },
      ],
    });

    await expect(
      makeCaller(headUser, db).caller.leaderboard.get({ kind: 'HighestDemerits', limit: 10 }),
    ).resolves.toMatchObject({
      kind: 'HighestDemerits',
      rows: [
        { rank: 1, studentId: 'student-b', score: 20 },
        { rank: 2, studentId: 'student-a', score: 15 },
      ],
    });

    const groupByArgs = db.behaviourEntry.groupBy.mock.calls[0]?.[0];
    expect(groupByArgs).toMatchObject({
      by: ['studentId'],
      where: { type: 'Demerit', deletedAt: null },
      _sum: { meritDelta: true },
    });
    expect(JSON.stringify(groupByArgs)).not.toContain('noteEnc');
    expect(JSON.stringify(groupByArgs)).not.toContain('headCommentEnc');
  });

  it('allows leaderboard-admin users to view HighestDemerits', async () => {
    const db = makeFakeDb();

    await expect(
      makeCaller(leaderboardAdminUser, db).caller.leaderboard.get({
        kind: 'HighestDemerits',
        limit: 10,
      }),
    ).resolves.toMatchObject({ kind: 'HighestDemerits', rows: [] });
  });

  it('denies HighestDemerits for untagged users before reading behaviour data', async () => {
    const db = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).caller.leaderboard.get({
        kind: 'HighestDemerits',
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.behaviourEntry.groupBy).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'leaderboard.get',
        meta: expect.objectContaining({ kind: 'HighestDemerits' }) as unknown,
      }),
    );
  });

  it('defaults to TopTithers and returns deterministic empty rows', async () => {
    const db = makeFakeDb();

    await expect(makeCaller(supervisorUser, db).caller.leaderboard.get({})).resolves.toMatchObject({
      kind: 'TopTithers',
      rows: [],
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 0, kind: 'TopTithers', source: 'leaderboard.get' },
      }),
    );
  });
});

describe('leaderboard.charityPot', () => {
  it('returns a default goal-only charity pot when no goal has been set', async () => {
    const db = makeFakeDb();

    await expect(makeCaller(parentUser, db).caller.leaderboard.charityPot.get()).resolves.toEqual({
      goalMerits: 0,
      currentMerits: 0,
      progressPct: 0,
      goalReached: false,
      updatedAt: null,
      updatedById: null,
    });
  });

  it('uses Given ledger rows for charity pot progress', async () => {
    const db = makeFakeDb({
      charityPot: {
        id: 'default',
        goalMerits: 100,
        updatedById: headUser.id,
        createdAt: new Date('2026-06-04T00:00:00.000Z'),
        updatedAt: new Date('2026-06-04T12:00:00.000Z'),
      },
      ledger: [
        { studentId: 's1', account: 'Given', delta: 30 },
        { studentId: 's2', account: 'Given', delta: 20 },
        { studentId: 's2', account: 'Spend', delta: -20 },
      ],
    });

    await expect(makeCaller(parentUser, db).caller.leaderboard.charityPot.get()).resolves.toEqual({
      goalMerits: 100,
      currentMerits: 50,
      progressPct: 50,
      goalReached: false,
      updatedAt: new Date('2026-06-04T12:00:00.000Z'),
      updatedById: headUser.id,
    });
  });

  it('allows Pastor/full-admin roles to update the charity pot goal', async () => {
    const db = makeFakeDb();

    await expect(
      makeCaller(pastorUser, db).caller.leaderboard.charityPot.updateGoal({ goalMerits: 500 }),
    ).resolves.toMatchObject({
      goalMerits: 500,
      currentMerits: 0,
      progressPct: 0,
      goalReached: false,
      updatedById: pastorUser.id,
    });
  });

  it('denies charity pot goal updates for non-admin parents', async () => {
    const db = makeFakeDb();

    await expect(
      makeCaller(parentUser, db).caller.leaderboard.charityPot.updateGoal({ goalMerits: 500 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.charityPot.upsert).not.toHaveBeenCalled();
  });
});
