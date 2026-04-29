import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { paceRouter } from '../routers/pace.js';
import { router } from '../trpc.js';

interface AuditData {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

function auditCalls(db: FakeDb): AuditData[] {
  return db.auditLog.create.mock.calls.map(
    (args: unknown[]) => (args[0] as { data: AuditData }).data,
  );
}

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const studentUser: SessionUser = {
  id: 'u_student',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const STUDENT_ID = 'ckstudent0000000000000001';
const SUBJECT_ID = 'cksubject0000000000000001';
const ASSIGNMENT_ID = 'ckassign000000000000000001';

interface StoredPaceRecord {
  id: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  selfTestScore: number | null;
  paceTestScore: number | null;
  completedAt: Date;
  createdAt: Date;
}

interface FakeDb {
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: { findUnique: ReturnType<typeof vi.fn> };
  subject: { findUnique: ReturnType<typeof vi.fn> };
  studentSubject: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pacePolicy: { findUnique: ReturnType<typeof vi.fn> };
  paceRecord: {
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

function makeFakeDb(overrides: Partial<FakeDb> = {}): FakeDb {
  const records: StoredPaceRecord[] = [];

  const create = vi.fn(({ data }: { data: Record<string, unknown> }) => {
    const record: StoredPaceRecord = {
      id: `pace_${String(records.length + 1)}`,
      studentId: data.studentId as string,
      subjectId: data.subjectId as string,
      paceNumber: data.paceNumber as number,
      selfTestScore: data.selfTestScore !== null && data.selfTestScore !== undefined ? (data.selfTestScore as number) : null,
      paceTestScore: data.paceTestScore !== null && data.paceTestScore !== undefined ? (data.paceTestScore as number) : null,
      completedAt: data.completedAt instanceof Date ? data.completedAt : new Date(),
      createdAt: new Date(),
    };
    records.push(record);
    return Promise.resolve(record);
  });

  const subjectUpdate = vi.fn().mockResolvedValue({ id: ASSIGNMENT_ID, currentPaceNumber: 1002 });

  const $transaction = vi.fn(
    async (fn: (tx: FakeDb) => Promise<[StoredPaceRecord]>) =>
      fn({
        ...db,
        paceRecord: { ...db.paceRecord, create },
        studentSubject: { ...db.studentSubject, update: subjectUpdate },
      }),
  );

  const db: FakeDb = {
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    student: {
      findUnique: vi.fn().mockResolvedValue({ id: STUDENT_ID, active: true }),
    },
    subject: {
      findUnique: vi.fn().mockResolvedValue({ id: SUBJECT_ID, active: true }),
    },
    studentSubject: {
      findUnique: vi.fn().mockResolvedValue({
        id: ASSIGNMENT_ID,
        currentPaceNumber: 1001,
      }),
      update: subjectUpdate,
    },
    pacePolicy: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    paceRecord: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create,
    },
    $transaction,
    ...overrides,
  };

  return db;
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db?: FakeDb) {
  const fakeDb = db ?? makeFakeDb();
  const appRouter = router({ pace: paceRouter });
  const ctx = makeCtx(user, fakeDb);
  return { caller: appRouter.createCaller(ctx), db: fakeDb };
}

const validInput = {
  studentId: STUDENT_ID,
  subjectId: SUBJECT_ID,
  paceNumber: 1001,
  testType: 'FinalTest' as const,
  score: 90,
};

describe('pace.record RBAC', () => {
  it('allows full-admin (Head) to record', async () => {
    const { caller } = makeCaller(headUser);
    await expect(caller.pace.record(validInput)).resolves.toMatchObject({
      paceNumber: 1001,
      paceTestScore: 90,
    });
  });

  it('allows Supervisor to record', async () => {
    const { caller } = makeCaller(supervisorUser);
    await expect(caller.pace.record(validInput)).resolves.toMatchObject({ paceNumber: 1001 });
  });

  it('rejects Parent as FORBIDDEN', async () => {
    const { caller } = makeCaller(parentUser);
    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects Student as FORBIDDEN', async () => {
    const { caller } = makeCaller(studentUser);
    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects unauthenticated caller as UNAUTHORIZED', async () => {
    const { caller } = makeCaller(null);
    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('pace.record validation', () => {
  it('returns NOT_FOUND for missing student', async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue(null);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns BAD_REQUEST for inactive student', async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue({ id: STUDENT_ID, active: false });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns NOT_FOUND for missing subject', async () => {
    const db = makeFakeDb();
    db.subject.findUnique.mockResolvedValue(null);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns BAD_REQUEST for inactive subject', async () => {
    const db = makeFakeDb();
    db.subject.findUnique.mockResolvedValue({ id: SUBJECT_ID, active: false });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns BAD_REQUEST when student not assigned to subject', async () => {
    const db = makeFakeDb();
    db.studentSubject.findUnique.mockResolvedValue(null);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects score > 100 at input validation layer', async () => {
    const { caller } = makeCaller(headUser);
    await expect(
      caller.pace.record({ ...validInput, score: 101 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects score < 0 at input validation layer', async () => {
    const { caller } = makeCaller(headUser);
    await expect(
      caller.pace.record({ ...validInput, score: -1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('pace.record policy — daily limit', () => {
  it('blocks when daily limit enabled and count reached', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.count.mockResolvedValue(2);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({ action: 'PermissionDenied', entity: 'PaceRecord' }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('counts tests against the completedAt day for backdated records', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.count.mockResolvedValue(2);
    const { caller } = makeCaller(headUser, db);
    const completedAt = new Date('2026-04-20T10:30:00.000Z');

    await expect(
      caller.pace.record({ ...validInput, completedAt }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.paceRecord.count).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        completedAt: {
          gte: new Date('2026-04-20T00:00:00.000Z'),
          lt: new Date('2026-04-21T00:00:00.000Z'),
        },
      },
    });
  });

  it('does not block when daily limit enabled but count below limit', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.count.mockResolvedValue(1);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).resolves.toMatchObject({ paceNumber: 1001 });
  });

  it('does not block when daily limit disabled even if count reached', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.count.mockResolvedValue(99);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).resolves.toMatchObject({ paceNumber: 1001 });
  });
});

describe('pace.record policy — same-pace same-day block', () => {
  it('blocks FinalTest when SelfTest already recorded today for same PACE', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: true,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.findFirst.mockResolvedValue({ id: 'pace_prev' });
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.pace.record({ ...validInput, testType: 'FinalTest' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({ action: 'PermissionDenied', entity: 'PaceRecord' }),
    );
  });

  it('checks same-day self/final blocks against the completedAt day for backdated records', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: true,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.findFirst.mockResolvedValue({ id: 'pace_prev' });
    const { caller } = makeCaller(headUser, db);
    const completedAt = new Date('2026-04-20T15:00:00.000Z');

    await expect(
      caller.pace.record({ ...validInput, testType: 'FinalTest', completedAt }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.paceRecord.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        completedAt: {
          gte: new Date('2026-04-20T00:00:00.000Z'),
          lt: new Date('2026-04-21T00:00:00.000Z'),
        },
        selfTestScore: { not: null },
      },
      select: { id: true },
    });
  });

  it('blocks SelfTest when FinalTest already recorded today for same PACE', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: true,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.findFirst.mockResolvedValue({ id: 'pace_prev' });
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.pace.record({ ...validInput, testType: 'SelfTest' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('does not block when same-day block disabled', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 80,
      updatedAt: new Date(),
    });
    db.paceRecord.findFirst.mockResolvedValue({ id: 'pace_prev' });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.record(validInput)).resolves.toMatchObject({ paceNumber: 1001 });
  });
});

describe('pace.record — passing final test advancement', () => {
  it('advances currentPaceNumber on passing FinalTest for current PACE number', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({
      ...validInput,
      paceNumber: 1001,
      testType: 'FinalTest',
      score: 90,
    });

    expect(result.advanced).toBe(true);
    expect(result.newPaceNumber).toBe(1002);
    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({ action: 'Update', entity: 'StudentSubject', entityId: ASSIGNMENT_ID }),
    );
  });

  it('advances currentPaceNumber when paceNumber is greater than current assignment', async () => {
    const db = makeFakeDb();
    db.studentSubject.findUnique.mockResolvedValue({ id: ASSIGNMENT_ID, currentPaceNumber: 1000 });
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({
      ...validInput,
      paceNumber: 1001,
      testType: 'FinalTest',
      score: 85,
    });

    expect(result.advanced).toBe(true);
  });

  it('does not advance on a failing FinalTest', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({
      ...validInput,
      testType: 'FinalTest',
      score: 79,
    });

    expect(result.advanced).toBe(false);
    expect(result.newPaceNumber).toBeUndefined();
  });

  it('does not advance on a SelfTest even if score is passing', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({
      ...validInput,
      testType: 'SelfTest',
      score: 100,
    });

    expect(result.advanced).toBe(false);
  });

  it('does not advance backward: old PACE number below current assignment', async () => {
    const db = makeFakeDb();
    db.studentSubject.findUnique.mockResolvedValue({ id: ASSIGNMENT_ID, currentPaceNumber: 1005 });
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({
      ...validInput,
      paceNumber: 1001,
      testType: 'FinalTest',
      score: 95,
    });

    expect(result.advanced).toBe(false);
  });

  it('uses custom passThreshold from stored policy', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 90,
      updatedAt: new Date(),
    });
    const { caller } = makeCaller(headUser, db);

    // score 89 — just below custom threshold of 90
    const failing = await caller.pace.record({ ...validInput, testType: 'FinalTest', score: 89 });
    expect(failing.advanced).toBe(false);

    // score 90 — meets custom threshold
    const db2 = makeFakeDb();
    db2.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 90,
      updatedAt: new Date(),
    });
    const { caller: caller2 } = makeCaller(headUser, db2);
    const passing = await caller2.pace.record({ ...validInput, testType: 'FinalTest', score: 90 });
    expect(passing.advanced).toBe(true);
  });
});

describe('pace.record — audit rows', () => {
  it('writes a Create audit row on successful record', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    await caller.pace.record(validInput);

    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({ userId: headUser.id, action: 'Create', entity: 'PaceRecord' }),
    );
  });

  it('writes both Create and Update audit rows when advancement occurs', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    await caller.pace.record({ ...validInput, score: 90 });

    const calls = auditCalls(db);
    expect(calls).toContainEqual(expect.objectContaining({ action: 'Create', entity: 'PaceRecord' }));
    expect(calls).toContainEqual(expect.objectContaining({ action: 'Update', entity: 'StudentSubject' }));
  });

  it('writes SelfTest score to selfTestScore column', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({ ...validInput, testType: 'SelfTest', score: 75 });

    expect(result.selfTestScore).toBe(75);
    expect(result.paceTestScore).toBeNull();
  });

  it('writes FinalTest score to paceTestScore column', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({ ...validInput, testType: 'FinalTest', score: 88 });

    expect(result.paceTestScore).toBe(88);
    expect(result.selfTestScore).toBeNull();
  });
});
