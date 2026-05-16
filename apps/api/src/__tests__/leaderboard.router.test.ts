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

interface StoredStudent {
  id: string;
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

interface FakeLedgerGroupByArgs {
  by: ['studentId'];
  where: { account: MeritAccount; studentId?: { in: string[] } };
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
  } = {},
) {
  const students = input.students ?? [];
  const ledger = input.ledger ?? [];
  const investmentAccounts = input.investmentAccounts ?? [];
  const latestNav = input.latestNav ?? null;
  const behaviourEntries = input.behaviourEntries ?? [];

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
    },
    meritLedger: {
      groupBy: vi.fn((args: FakeLedgerGroupByArgs) => {
        const allowedStudentIds = args.where.studentId
          ? new Set(args.where.studentId.in)
          : null;
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

  it('ranks TopInvestors by return percentage from latest NAV and investment cost basis', async () => {
    const db = makeFakeDb({
      students: [
        makeStudent({ id: 'student-gain', fullNameEnc: 'Gain Student' }),
        makeStudent({ id: 'student-loss', fullNameEnc: 'Loss Student' }),
        makeStudent({ id: 'student-inactive', active: false, fullNameEnc: 'Inactive Student' }),
      ],
      latestNav: 11,
      investmentAccounts: [
        { studentId: 'student-gain', units: 10 },
        { studentId: 'student-loss', units: 10 },
        { studentId: 'student-inactive', units: 100 },
      ],
      ledger: [
        { studentId: 'student-gain', account: 'Investment', delta: 100 },
        { studentId: 'student-loss', account: 'Investment', delta: 200 },
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
      studentId: 'student-gain',
      displayName: 'Gain Student',
      score: 10,
    });
    expect(result.rows[1]?.studentId).toBe('student-loss');
    expect(result.rows[1]?.score).toBe(-45);
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
