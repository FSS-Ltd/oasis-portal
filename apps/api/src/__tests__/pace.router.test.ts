import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const allStudentsSupervisorUser: SessionUser = {
  id: 'u_all_students_sup',
  role: 'Supervisor',
  tags: ['supervisor-all-students'],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const studentUser: SessionUser = {
  id: 'u_student',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const clubsAdminUser: SessionUser = {
  id: 'u_clubs',
  role: 'ClubsAdmin',
  tags: [],
  requires2fa: false,
};

const STUDENT_ID = 'ckstudent0000000000000001';
const SUBJECT_ID = 'cksubject0000000000000001';
const SUBJECT_2_ID = 'cksubject0000000000000002';
const ASSIGNMENT_ID = 'ckassign000000000000000001';

interface StoredPaceRecord {
  id: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  selfTestScore: number | null;
  paceTestScore: number | null;
  completedAt: Date | null;
  createdAt: Date;
  advancementApproval?: StoredPaceApproval | null;
}

interface StoredPaceProgress {
  id: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  startedAt: Date;
  completedAt: Date | null;
  completedByRecordId: string | null;
  completedByApprovalId: string | null;
  finalTestAttempts: number;
  createdAt: Date;
}

interface StoredPaceApproval {
  id: string;
  paceRecordId: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  notesEnc: string;
  approvedById: string;
  approvedAt: Date;
  approvedBy: { fullNameEnc: string; role: string };
}

interface BehaviourEntryCreateData {
  studentId: string;
  type: 'Merit';
  category: string;
  noteEnc: string | null;
  visibility: 'General';
  meritDelta: number;
  recordedById: string;
  paceRecordId?: string;
}

interface StoredBehaviourEntry extends BehaviourEntryCreateData {
  id: string;
  deletedAt: Date | null;
  deletedById: string | null;
}

interface StoredLedgerRow {
  studentId: string;
  account: string;
  delta: number;
  reason: string;
  relatedEntryId?: string;
}

interface FakeDb {
  auditLog: { create: ReturnType<typeof vi.fn> };
  $enc: { decrypt: ReturnType<typeof vi.fn>; encrypt: ReturnType<typeof vi.fn> };
  paceAdvancementApproval: {
    create: ReturnType<typeof vi.fn>;
  };
  behaviourEntry: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  meritLedger: { createMany: ReturnType<typeof vi.fn> };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  subject: { findUnique: ReturnType<typeof vi.fn> };
  studentSubject: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pacePolicy: { findUnique: ReturnType<typeof vi.fn> };
  paceRecord: {
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  paceProgress: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  staffShift: { findMany: ReturnType<typeof vi.fn> };
  yearGroupBand: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const defaultAssignments = [
  {
    id: ASSIGNMENT_ID,
    studentId: STUDENT_ID,
    subjectId: SUBJECT_ID,
    currentPaceNumber: 1001,
    subject: { id: SUBJECT_ID, code: 'ENG', name: 'English', active: true },
  },
  {
    id: 'ckassign000000000000000002',
    studentId: STUDENT_ID,
    subjectId: SUBJECT_2_ID,
    currentPaceNumber: 1007,
    subject: { id: SUBJECT_2_ID, code: 'MATH', name: 'Maths', active: true },
  },
];

const defaultBands = [
  {
    id: 'band_lower',
    name: 'Lower Primary',
    standardYears: ['Year 5', 'Year 6'],
    colour: '#5B90C5',
    active: true,
  },
  {
    id: 'band_secondary',
    name: 'Secondary',
    standardYears: ['Year 7', 'Year 8'],
    colour: '#7D1C2C',
    active: true,
  },
];

const defaultStudent = {
  id: STUDENT_ID,
  userId: studentUser.id,
  active: true,
  fullNameEnc: 'enc:Jane Learner',
  yearGroup: 'Year 6',
  subjects: defaultAssignments,
};

function makeFakeDb(overrides: Partial<FakeDb> = {}): FakeDb {
  const records: StoredPaceRecord[] = [];
  const progressRows: StoredPaceProgress[] = [];
  const approvals: StoredPaceApproval[] = [];
  const behaviourEntries: StoredBehaviourEntry[] = [];
  const ledgerRows: StoredLedgerRow[] = [];

  const createPaceRecord = vi.fn(({ data }: { data: Record<string, unknown> }) => {
    const record: StoredPaceRecord = {
      id: `pace_${String(records.length + 1)}`,
      studentId: data.studentId as string,
      subjectId: data.subjectId as string,
      paceNumber: data.paceNumber as number,
      selfTestScore:
        data.selfTestScore !== null && data.selfTestScore !== undefined
          ? (data.selfTestScore as number)
          : null,
      paceTestScore:
        data.paceTestScore !== null && data.paceTestScore !== undefined
          ? (data.paceTestScore as number)
          : null,
      completedAt: data.completedAt instanceof Date ? data.completedAt : new Date(),
      createdAt: new Date(),
      advancementApproval: null,
    };
    records.push(record);
    return Promise.resolve(record);
  });
  const findPaceRecord = (id: string): StoredPaceRecord | null =>
    records.find((record) => record.id === id) ?? null;
  const findUniquePaceRecord = vi.fn(({ where }: { where: { id: string } }) => {
    const record = findPaceRecord(where.id);
    if (!record) return Promise.resolve(null);
    return Promise.resolve({
      ...record,
      student: {
        id: record.studentId,
        active: defaultStudent.active,
        yearGroup: defaultStudent.yearGroup,
      },
      subject: { id: record.subjectId, active: true },
    });
  });
  const findManyPaceRecords = vi.fn(
    ({
      where,
    }: {
      where?: {
        studentId?: string;
        subjectId?: string | { in: string[] };
        paceNumber?: number;
        OR?: readonly unknown[];
      };
    } = {}) =>
      Promise.resolve(
        records.filter((record) => {
          if (where?.studentId && record.studentId !== where.studentId) return false;
          if (typeof where?.subjectId === 'string' && record.subjectId !== where.subjectId) {
            return false;
          }
          if (
            typeof where?.subjectId === 'object' &&
            !where.subjectId.in.includes(record.subjectId)
          ) {
            return false;
          }
          if (where?.paceNumber !== undefined && record.paceNumber !== where.paceNumber) {
            return false;
          }
          return true;
        }),
      ),
  );
  const findFirstPaceRecord = vi.fn(
    ({
      where,
    }: {
      where?: {
        id?: { not: string };
        studentId?: string;
        subjectId?: string;
        paceNumber?: number;
        completedAt?: { gte: Date; lt: Date };
        selfTestScore?: { not: null };
        paceTestScore?: { not: null };
      };
    } = {}) => {
      const record =
        records.find((item) => {
          if (where?.id?.not && item.id === where.id.not) return false;
          if (where?.studentId && item.studentId !== where.studentId) return false;
          if (where?.subjectId && item.subjectId !== where.subjectId) return false;
          if (where?.paceNumber !== undefined && item.paceNumber !== where.paceNumber) {
            return false;
          }
          if (where?.completedAt) {
            if (!item.completedAt) return false;
            if (
              item.completedAt < where.completedAt.gte ||
              item.completedAt >= where.completedAt.lt
            ) {
              return false;
            }
          }
          if (where?.selfTestScore && item.selfTestScore === null) return false;
          if (where?.paceTestScore && item.paceTestScore === null) return false;
          return true;
        }) ?? null;
      if (record) return Promise.resolve({ id: record.id });
      if (
        where?.completedAt === undefined &&
        where?.selfTestScore &&
        where.studentId === STUDENT_ID &&
        where.subjectId === SUBJECT_ID &&
        where.paceNumber === 1001
      ) {
        return Promise.resolve({ id: 'pace_self_prerequisite' });
      }
      return Promise.resolve(null);
    },
  );
  const countPaceRecords = vi.fn(
    ({
      where,
    }: {
      where?: {
        studentId?: string;
        completedAt?: { gte: Date; lt: Date };
      };
    } = {}) =>
      Promise.resolve(
        records.filter((record) => {
          if (where?.studentId && record.studentId !== where.studentId) return false;
          if (where?.completedAt) {
            if (!record.completedAt) return false;
            if (
              record.completedAt < where.completedAt.gte ||
              record.completedAt >= where.completedAt.lt
            ) {
              return false;
            }
          }
          return true;
        }).length,
      ),
  );
  const updatePaceRecord = vi.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: {
        selfTestScore: number | null;
        paceTestScore: number | null;
        subjectId?: string;
        paceNumber?: number;
        completedAt: Date;
      };
    }) => {
      const record = findPaceRecord(where.id);
      if (!record) throw new Error('pace record not found');
      record.selfTestScore = data.selfTestScore;
      record.paceTestScore = data.paceTestScore;
      if (data.subjectId !== undefined) record.subjectId = data.subjectId;
      if (data.paceNumber !== undefined) record.paceNumber = data.paceNumber;
      record.completedAt = data.completedAt;
      return Promise.resolve(record);
    },
  );
  const deletePaceRecord = vi.fn(({ where }: { where: { id: string } }) => {
    const index = records.findIndex((record) => record.id === where.id);
    if (index === -1) throw new Error('pace record not found');
    const [record] = records.splice(index, 1);
    return Promise.resolve(record);
  });

  const createPaceApproval = vi.fn(
    ({
      data,
    }: {
      data: {
        approvedById: string;
        notesEnc: string;
        paceNumber: number;
        paceRecordId: string;
        studentId: string;
        subjectId: string;
      };
    }) => {
      const approval: StoredPaceApproval = {
        ...data,
        id: `approval_${String(approvals.length + 1)}`,
        approvedAt: new Date(),
        approvedBy: {
          fullNameEnc:
            data.approvedById === supervisorUser.id ? 'enc:Supervisor User' : 'enc:Head User',
          role: data.approvedById === supervisorUser.id ? 'Supervisor' : 'Head',
        },
      };
      approvals.push(approval);
      const record = findPaceRecord(data.paceRecordId);
      if (record) record.advancementApproval = approval;
      return Promise.resolve(approval);
    },
  );

  const createBehaviourEntry = vi.fn(({ data }: { data: BehaviourEntryCreateData }) => {
    const entry: StoredBehaviourEntry = {
      ...data,
      id: `behaviour_${String(behaviourEntries.length + 1)}`,
      deletedAt: null,
      deletedById: null,
    };
    behaviourEntries.push(entry);
    return Promise.resolve({ id: entry.id });
  });
  const findFirstBehaviourEntry = vi.fn(
    ({ where }: { where: { paceRecordId?: string; type?: 'Merit' } }) => {
      const entry =
        behaviourEntries.find(
          (item) => where.paceRecordId === undefined || item.paceRecordId === where.paceRecordId,
        ) ?? null;
      if (!entry) return Promise.resolve(null);
      return Promise.resolve({
        ...entry,
        ledgerRows: ledgerRows.filter((row) => row.relatedEntryId === entry.id),
      });
    },
  );
  const updateBehaviourEntry = vi.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: {
        category?: string;
        deletedAt?: Date | null;
        deletedById?: string | null;
        meritDelta?: number;
      };
    }) => {
      const entry = behaviourEntries.find((item) => item.id === where.id);
      if (!entry) throw new Error('behaviour entry not found');
      if (data.category !== undefined) entry.category = data.category;
      if (data.meritDelta !== undefined) entry.meritDelta = data.meritDelta;
      if (data.deletedAt !== undefined) entry.deletedAt = data.deletedAt;
      if (data.deletedById !== undefined) entry.deletedById = data.deletedById;
      return Promise.resolve({ id: entry.id });
    },
  );

  const createLedgerRows = vi.fn(({ data }: { data: StoredLedgerRow[] }) => {
    ledgerRows.push(...data);
    return Promise.resolve({ count: data.length });
  });

  const findProgress = (params: {
    studentId: string;
    subjectId: string;
    paceNumber: number;
  }): StoredPaceProgress | null =>
    progressRows.find(
      (row) =>
        row.studentId === params.studentId &&
        row.subjectId === params.subjectId &&
        row.paceNumber === params.paceNumber,
    ) ?? null;

  const findManyProgress = vi.fn(
    ({ where }: { where: { studentId: string; subjectId: { in: string[] } } }) =>
      Promise.resolve(
        progressRows.filter(
          (row) => row.studentId === where.studentId && where.subjectId.in.includes(row.subjectId),
        ),
      ),
  );
  const findUniqueProgress = vi.fn(
    ({
      where,
    }: {
      where: {
        studentId_subjectId_paceNumber: {
          studentId: string;
          subjectId: string;
          paceNumber: number;
        };
      };
    }) => Promise.resolve(findProgress(where.studentId_subjectId_paceNumber)),
  );
  const createProgress = vi.fn(
    ({
      data,
    }: {
      data: {
        studentId: string;
        subjectId: string;
        paceNumber: number;
        startedAt: Date;
      };
    }) => {
      const row: StoredPaceProgress = {
        ...data,
        id: `progress_${String(progressRows.length + 1)}`,
        completedAt: null,
        completedByRecordId: null,
        completedByApprovalId: null,
        finalTestAttempts: 0,
        createdAt: new Date(),
      };
      progressRows.push(row);
      return Promise.resolve(row);
    },
  );
  const updateProgress = vi.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: {
        startedAt?: Date;
        finalTestAttempts?: { increment: number } | number;
        completedAt?: Date | null;
        completedByRecordId?: string | null;
        completedByApprovalId?: string | null;
      };
    }) => {
      const row = progressRows.find((item) => item.id === where.id);
      if (!row) throw new Error('progress row not found');
      if (typeof data.finalTestAttempts === 'number') {
        row.finalTestAttempts = data.finalTestAttempts;
      } else if (data.finalTestAttempts) {
        row.finalTestAttempts += data.finalTestAttempts.increment;
      }
      if (data.startedAt) row.startedAt = data.startedAt;
      if (data.completedAt !== undefined) row.completedAt = data.completedAt;
      if (data.completedByRecordId !== undefined) {
        row.completedByRecordId = data.completedByRecordId;
      }
      if (data.completedByApprovalId !== undefined) {
        row.completedByApprovalId = data.completedByApprovalId;
      }
      return Promise.resolve(row);
    },
  );

  const subjectUpdate = vi.fn().mockResolvedValue({ id: ASSIGNMENT_ID, currentPaceNumber: 1002 });

  const $transaction = vi.fn(
    async (
      fn: (
        tx: FakeDb,
      ) => Promise<
        readonly [StoredPaceRecord, { behaviourEntryId: string; ledgerRowCount: number } | null]
      >,
    ) =>
      fn({
        ...db,
        behaviourEntry: {
          ...db.behaviourEntry,
          create: createBehaviourEntry,
          findFirst: findFirstBehaviourEntry,
          update: updateBehaviourEntry,
        },
        meritLedger: { ...db.meritLedger, createMany: createLedgerRows },
        paceRecord: {
          ...db.paceRecord,
          create: createPaceRecord,
          delete: deletePaceRecord,
          findMany: findManyPaceRecords,
          update: updatePaceRecord,
        },
        paceAdvancementApproval: {
          ...db.paceAdvancementApproval,
          create: createPaceApproval,
        },
        paceProgress: {
          ...db.paceProgress,
          create: createProgress,
          findUnique: findUniqueProgress,
          update: updateProgress,
        },
        studentSubject: { ...db.studentSubject, update: subjectUpdate },
      }),
  );

  const db: FakeDb = {
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    $enc: {
      decrypt: vi.fn((value: string | null | undefined) =>
        value ? value.replace(/^enc:/u, '') : null,
      ),
      encrypt: vi.fn((value: string | null | undefined) => (value ? `enc:${value}` : null)),
    },
    paceAdvancementApproval: {
      create: createPaceApproval,
    },
    behaviourEntry: {
      create: createBehaviourEntry,
      findFirst: findFirstBehaviourEntry,
      update: updateBehaviourEntry,
    },
    meritLedger: {
      createMany: createLedgerRows,
    },
    student: {
      findMany: vi.fn(({ where }: { where?: { yearGroup?: { in: string[] } } } = {}) => {
        const students = [
          defaultStudent,
          {
            id: 'ckstudent0000000000000002',
            active: true,
            fullNameEnc: 'enc:Secondary Learner',
            yearGroup: 'Year 8',
          },
        ];
        return Promise.resolve(
          where?.yearGroup?.in
            ? students.filter((student) => where.yearGroup?.in.includes(student.yearGroup))
            : students,
        );
      }),
      findUnique: vi.fn().mockResolvedValue(defaultStudent),
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
      count: countPaceRecords,
      findFirst: findFirstPaceRecord,
      findUnique: findUniquePaceRecord,
      findMany: findManyPaceRecords,
      create: createPaceRecord,
      update: updatePaceRecord,
      delete: deletePaceRecord,
    },
    paceProgress: {
      findMany: findManyProgress,
      findUnique: findUniqueProgress,
      create: createProgress,
      update: updateProgress,
    },
    staffShift: {
      findMany: vi.fn().mockResolvedValue([{ yearGroupBand: defaultBands[0] }]),
    },
    yearGroupBand: {
      findMany: vi.fn().mockResolvedValue(defaultBands),
    },
    $transaction,
    ...overrides,
  };

  return db;
}

function makeCtx(
  user: SessionUser | null,
  db: FakeDb,
): AppContext & { rlsTransactionCalls: () => number } {
  let rlsTransactionCount = 0;
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => {
      rlsTransactionCount += 1;
      return fn(db as unknown as RlsTx);
    },
    rlsTransactionCalls: () => rlsTransactionCount,
  } satisfies AppContext & { rlsTransactionCalls: () => number };
}

function makeCaller(user: SessionUser | null, db?: FakeDb) {
  const fakeDb = db ?? makeFakeDb();
  const appRouter = router({ pace: paceRouter });
  const ctx = makeCtx(user, fakeDb);
  return { caller: appRouter.createCaller(ctx), ctx, db: fakeDb };
}

const validInput = {
  studentId: STUDENT_ID,
  subjectId: SUBJECT_ID,
  paceNumber: 1001,
  testType: 'FinalTest' as const,
  score: 90,
};

describe('pace.forStudent RBAC', () => {
  it('allows full-admin (Head) to read PACE progress', async () => {
    const { caller } = makeCaller(headUser);
    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).resolves.toMatchObject({
      studentId: STUDENT_ID,
    });
  });

  it('allows Supervisor to read PACE progress', async () => {
    const { caller } = makeCaller(supervisorUser);
    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).resolves.toMatchObject({
      studentId: STUDENT_ID,
    });
  });

  it('rejects ordinary Supervisors without a rota assignment', async () => {
    const db = makeFakeDb();
    db.staffShift.findMany.mockResolvedValue([]);
    const { caller } = makeCaller(supervisorUser, db);

    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects Parent as FORBIDDEN', async () => {
    const { caller } = makeCaller(parentUser);
    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows a linked Student to read their own PACE progress', async () => {
    const { caller } = makeCaller(studentUser);
    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).resolves.toMatchObject({
      studentId: STUDENT_ID,
      studentName: 'Jane Learner',
    });
  });

  it('rejects Student reads for another student', async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue({
      ...defaultStudent,
      id: 'ckstudent0000000000000002',
      userId: 'u_other_student',
      fullNameEnc: 'enc:Other Learner',
    });
    const { caller } = makeCaller(studentUser, db);

    await expect(
      caller.pace.forStudent({ studentId: 'ckstudent0000000000000002' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows ClubsAdmin users to read assigned-band PACE workflow', async () => {
    const { caller } = makeCaller(clubsAdminUser);
    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).resolves.toMatchObject({
      studentId: STUDENT_ID,
    });
  });

  it('rejects unauthenticated caller as UNAUTHORIZED', async () => {
    const { caller } = makeCaller(null);
    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('pace.forStudent validation', () => {
  it('accepts non-CUID student ids and lets the database resolve them', async () => {
    const legacyStudentId = 'student_1';
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue({
      id: legacyStudentId,
      active: true,
      fullNameEnc: 'enc:Legacy Learner',
      yearGroup: 'Year 6',
      subjects: [],
    });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.forStudent({ studentId: legacyStudentId })).resolves.toMatchObject({
      studentId: legacyStudentId,
    });
    expect(db.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: legacyStudentId } }),
    );
  });

  it('returns NOT_FOUND for missing student', async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue(null);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns BAD_REQUEST for inactive student', async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue({ id: STUDENT_ID, active: false, subjects: [] });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

describe('pace.roster access scope', () => {
  it('returns all active children for full-admin users', async () => {
    const { caller, db } = makeCaller(headUser);

    const result = await caller.pace.roster();

    expect(result.fullAccess).toBe(true);
    expect(result.canEditDate).toBe(true);
    expect(result.assignedBands).toEqual([]);
    expect(result.students).toHaveLength(2);
    expect(result.students[0]).toMatchObject({
      studentId: STUDENT_ID,
      studentName: 'Jane Learner',
      yearGroup: 'Year 6',
      yearGroupLabel: 'Level 6',
    });
    expect(result.students[0]?.band?.id).toBe('band_lower');
    expect(result.students[1]).toMatchObject({
      studentName: 'Secondary Learner',
      yearGroup: 'Year 8',
      yearGroupLabel: 'Level 8',
    });
    expect(result.students[1]?.band?.id).toBe('band_secondary');
    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });

  it('returns assigned-band children for ordinary Supervisors', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    const result = await caller.pace.roster();

    expect(result.fullAccess).toBe(false);
    expect(result.canEditDate).toBe(true);
    expect(result.assignedBands).toEqual([
      expect.objectContaining({ id: 'band_lower', name: 'Lower Primary' }),
    ]);
    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toMatchObject({
      studentId: STUDENT_ID,
      yearGroup: 'Year 6',
    });
    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, yearGroup: { in: ['Year 5', 'Y5', 'Year 6', 'Y6'] } },
      }),
    );
  });

  it('returns no roster children when an ordinary Supervisor has no shift today', async () => {
    const db = makeFakeDb();
    db.staffShift.findMany.mockResolvedValue([]);
    const { caller } = makeCaller(supervisorUser, db);

    const result = await caller.pace.roster();

    expect(result.fullAccess).toBe(false);
    expect(result.canEditDate).toBe(true);
    expect(result.assignedBands).toEqual([]);
    expect(result.students).toHaveLength(0);
    expect(db.student.findMany).not.toHaveBeenCalled();
  });

  it('returns all active children for tagged all-student Supervisors', async () => {
    const { caller, db } = makeCaller(allStudentsSupervisorUser);

    const result = await caller.pace.roster();

    expect(result.fullAccess).toBe(true);
    expect(result.canEditDate).toBe(true);
    expect(result.assignedBands).toEqual([]);
    expect(result.students).toHaveLength(2);
    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
    expect(db.staffShift.findMany).not.toHaveBeenCalled();
  });
});

describe('pace.forStudent read model', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:34:56.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns assigned subjects, current PACE numbers, recent records, today count, and default policy', async () => {
    const db = makeFakeDb();
    db.paceRecord.count.mockResolvedValue(2);
    const recordsBySubject: Record<string, StoredPaceRecord[]> = {
      [SUBJECT_ID]: [
        {
          id: 'pace_self',
          studentId: STUDENT_ID,
          subjectId: SUBJECT_ID,
          paceNumber: 1001,
          selfTestScore: 74,
          paceTestScore: null,
          completedAt: new Date('2026-04-29T10:00:00.000Z'),
          createdAt: new Date('2026-04-29T10:01:00.000Z'),
        },
        {
          id: 'pace_final',
          studentId: STUDENT_ID,
          subjectId: SUBJECT_ID,
          paceNumber: 1000,
          selfTestScore: null,
          paceTestScore: 90,
          completedAt: new Date('2026-04-28T10:00:00.000Z'),
          createdAt: new Date('2026-04-28T10:01:00.000Z'),
        },
      ],
      [SUBJECT_2_ID]: [
        {
          id: 'pace_math',
          studentId: STUDENT_ID,
          subjectId: SUBJECT_2_ID,
          paceNumber: 1006,
          selfTestScore: null,
          paceTestScore: 81,
          completedAt: null,
          createdAt: new Date('2026-04-27T10:01:00.000Z'),
        },
      ],
    };
    db.paceRecord.findMany.mockImplementation(
      ({ where }: { where: { subjectId: { in: string[] } } }) =>
        Promise.resolve(
          Object.values(recordsBySubject)
            .flat()
            .filter((record) => where.subjectId.in.includes(record.subjectId)),
        ),
    );
    db.paceProgress.findMany.mockResolvedValue([
      {
        id: 'progress_eng_current',
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        startedAt: new Date('2026-04-28T10:00:00.000Z'),
        completedAt: null,
        completedByRecordId: null,
        finalTestAttempts: 0,
        createdAt: new Date('2026-04-28T10:00:00.000Z'),
      },
      {
        id: 'progress_eng_done',
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1000,
        startedAt: new Date('2026-04-20T10:00:00.000Z'),
        completedAt: new Date('2026-04-28T10:00:00.000Z'),
        completedByRecordId: 'pace_final',
        finalTestAttempts: 2,
        createdAt: new Date('2026-04-20T10:00:00.000Z'),
      },
      {
        id: 'progress_math_current',
        studentId: STUDENT_ID,
        subjectId: SUBJECT_2_ID,
        paceNumber: 1007,
        startedAt: new Date('2026-04-27T10:00:00.000Z'),
        completedAt: null,
        completedByRecordId: null,
        finalTestAttempts: 1,
        createdAt: new Date('2026-04-27T10:00:00.000Z'),
      },
    ]);
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.forStudent({ studentId: STUDENT_ID });

    expect(result).toMatchObject({
      studentId: STUDENT_ID,
      today: { date: '2026-04-29', testCount: 2 },
      policy: {
        dailyTestLimitEnabled: false,
        maxTestsPerStudentPerDay: 2,
        samePaceSameDayBlockEnabled: true,
        passThreshold: 80,
      },
      warnings: {
        dailyLimitEnabled: false,
        count: 2,
        limit: 2,
        remaining: null,
        atLimit: false,
      },
    });
    expect(result.subjects).toMatchObject([
      {
        subjectId: SUBJECT_ID,
        code: 'ENG',
        name: 'English',
        active: true,
        currentPaceNumber: 1001,
        currentPaceStartedAt: new Date('2026-04-28T10:00:00.000Z'),
        currentPaceDays: 0.6,
        currentFinalTestAttempts: 0,
        completedPaceCount: 1,
        averagePaceCompletionDays: 8,
        selfTestPaceNumbers: [1001],
        latestSelfTest: {
          paceNumber: 1001,
          score: 74,
          completedAt: new Date('2026-04-29T10:00:00.000Z'),
        },
        latestFinalTest: null,
        latestCompletedAt: null,
        status: {
          status: 'Behind',
          detail: 'Testing at Level 1',
          tone: 'amber',
        },
        recentRecords: [
          {
            id: 'pace_self',
            paceNumber: 1001,
            testType: 'SelfTest',
            score: 74,
            passed: false,
            completedAt: new Date('2026-04-29T10:00:00.000Z'),
            createdAt: new Date('2026-04-29T10:01:00.000Z'),
          },
          {
            id: 'pace_final',
            paceNumber: 1000,
            testType: 'FinalTest',
            score: 90,
            passed: true,
            completedAt: new Date('2026-04-28T10:00:00.000Z'),
            createdAt: new Date('2026-04-28T10:01:00.000Z'),
          },
        ],
      },
      {
        subjectId: SUBJECT_2_ID,
        code: 'MATH',
        name: 'Maths',
        active: true,
        currentPaceNumber: 1007,
        currentPaceStartedAt: new Date('2026-04-27T10:00:00.000Z'),
        currentPaceDays: 1.6,
        currentFinalTestAttempts: 1,
        completedPaceCount: 0,
        averagePaceCompletionDays: null,
        selfTestPaceNumbers: [],
        latestFinalTest: null,
        latestCompletedAt: null,
        status: {
          status: 'Behind',
          detail: 'Testing at Level 1',
          tone: 'amber',
        },
        recentRecords: [
          {
            id: 'pace_math',
            paceNumber: 1006,
            testType: 'FinalTest',
            score: 81,
            passed: true,
            completedAt: null,
            createdAt: new Date('2026-04-27T10:01:00.000Z'),
          },
        ],
      },
    ]);
    expect(db.paceRecord.count).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        completedAt: {
          gte: new Date('2026-04-29T00:00:00.000Z'),
          lt: new Date('2026-04-30T00:00:00.000Z'),
        },
      },
    });
    expect(db.paceRecord.findMany).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        subjectId: { in: [SUBJECT_ID, SUBJECT_2_ID] },
        OR: [{ selfTestScore: { not: null } }, { paceTestScore: { not: null } }],
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        subjectId: true,
        paceNumber: true,
        selfTestScore: true,
        paceTestScore: true,
        completedAt: true,
        createdAt: true,
        advancementApproval: {
          select: {
            id: true,
            approvedAt: true,
            approvedById: true,
            notesEnc: true,
            approvedBy: { select: { fullNameEnc: true, role: true } },
          },
        },
      },
    });
    expect(db.paceProgress.findMany).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        subjectId: { in: [SUBJECT_ID, SUBJECT_2_ID] },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        subjectId: true,
        paceNumber: true,
        startedAt: true,
        completedAt: true,
        finalTestAttempts: true,
      },
    });
  });

  it('canonicalises legacy year-group abbreviations before computing status', async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue({
      ...defaultStudent,
      yearGroup: 'Y5',
      subjects: [
        {
          id: ASSIGNMENT_ID,
          studentId: STUDENT_ID,
          subjectId: SUBJECT_ID,
          currentPaceNumber: 1023,
          subject: { id: SUBJECT_ID, code: 'ENG', name: 'English', active: true },
        },
      ],
    });
    const { caller } = makeCaller(supervisorUser, db);

    const result = await caller.pace.forStudent({ studentId: STUDENT_ID });

    expect(result.yearGroup).toBe('Year 5');
    expect(result.yearGroupLabel).toBe('Level 5');
    expect(result.subjects[0]?.status).toMatchObject({
      status: 'Behind',
      detail: 'Testing at Level 2',
      tone: 'amber',
    });
  });

  it('uses stored policy values for warning state', async () => {
    const db = makeFakeDb();
    db.pacePolicy.findUnique.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 3,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 75,
      updatedAt: new Date('2026-04-29T09:00:00.000Z'),
    });
    db.paceRecord.count.mockResolvedValue(3);
    const { caller } = makeCaller(supervisorUser, db);

    await expect(caller.pace.forStudent({ studentId: STUDENT_ID })).resolves.toMatchObject({
      policy: {
        dailyTestLimitEnabled: true,
        maxTestsPerStudentPerDay: 3,
        samePaceSameDayBlockEnabled: false,
        passThreshold: 75,
      },
      warnings: {
        dailyLimitEnabled: true,
        count: 3,
        limit: 3,
        remaining: 0,
        atLimit: true,
      },
    });
  });
});

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

  it('rejects ordinary Supervisors without a rota assignment', async () => {
    const db = makeFakeDb();
    db.staffShift.findMany.mockResolvedValue([]);
    const { caller } = makeCaller(supervisorUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("rejects ordinary Supervisors when the student is outside the selected date's assigned band", async () => {
    const db = makeFakeDb();
    db.student.findUnique.mockResolvedValue({
      ...defaultStudent,
      yearGroup: 'Year 8',
    });
    const { caller } = makeCaller(supervisorUser, db);

    await expect(caller.pace.record(validInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows tagged Supervisors to record for all active students without a rota assignment', async () => {
    const db = makeFakeDb();
    db.staffShift.findMany.mockResolvedValue([]);
    db.student.findUnique.mockResolvedValue({
      ...defaultStudent,
      yearGroup: 'Year 8',
    });
    const { caller } = makeCaller(allStudentsSupervisorUser, db);

    await expect(caller.pace.record(validInput)).resolves.toMatchObject({ paceNumber: 1001 });
    expect(db.staffShift.findMany).not.toHaveBeenCalled();
  });

  it('allows Supervisors to record backdated tests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const { caller } = makeCaller(supervisorUser);
      await expect(
        caller.pace.record({
          ...validInput,
          completedAt: new Date('2026-04-28T10:00:00.000Z'),
        }),
      ).resolves.toMatchObject({ paceNumber: 1001 });
    } finally {
      vi.useRealTimers();
    }
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
    await expect(caller.pace.record({ ...validInput, score: 101 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects score < 0 at input validation layer', async () => {
    const { caller } = makeCaller(headUser);
    await expect(caller.pace.record({ ...validInput, score: -1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

describe('pace.record policy — final test prerequisite', () => {
  it('rejects FinalTest when no matching SelfTest exists for the same subject PACE number', async () => {
    const db = makeFakeDb();
    db.paceRecord.findFirst.mockResolvedValueOnce(null);
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.pace.record({ ...validInput, testType: 'FinalTest' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.paceRecord.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        selfTestScore: { not: null },
      },
      select: { id: true },
    });
    const denialAudit = auditCalls(db).find(
      (call) => call.action === 'PermissionDenied' && call.entity === 'PaceRecord',
    );
    expect(denialAudit?.meta).toMatchObject({ reason: 'missing-self-test-prerequisite' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('allows FinalTest when a matching SelfTest exists for the same subject PACE number', async () => {
    const db = makeFakeDb();
    db.paceRecord.findFirst.mockResolvedValueOnce({ id: 'pace_self' }).mockResolvedValueOnce(null);
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.pace.record({ ...validInput, testType: 'FinalTest' }),
    ).resolves.toMatchObject({
      paceNumber: 1001,
      paceTestScore: 90,
    });
  });

  it('allows SelfTest without a prior SelfTest prerequisite', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.pace.record({ ...validInput, testType: 'SelfTest' }),
    ).resolves.toMatchObject({
      paceNumber: 1001,
      selfTestScore: 90,
    });
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

    await expect(caller.pace.record({ ...validInput, completedAt })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
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

    await expect(caller.pace.record({ ...validInput, testType: 'SelfTest' })).rejects.toMatchObject(
      { code: 'BAD_REQUEST' },
    );
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
    const completedAt = new Date('2026-04-20T10:00:00.000Z');

    const result = await caller.pace.record({
      ...validInput,
      paceNumber: 1001,
      testType: 'FinalTest',
      score: 90,
      completedAt,
    });

    expect(result.advanced).toBe(true);
    expect(result.newPaceNumber).toBe(1002);
    expect(db.paceProgress.create).toHaveBeenCalledWith({
      data: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        startedAt: completedAt,
      },
      select: { id: true, finalTestAttempts: true, completedAt: true },
    });
    expect(db.paceProgress.update).toHaveBeenCalledWith({
      where: { id: 'progress_1' },
      data: {
        finalTestAttempts: { increment: 1 },
        completedAt,
        completedByRecordId: 'pace_1',
      },
    });
    expect(db.paceProgress.create).toHaveBeenCalledWith({
      data: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1002,
        startedAt: completedAt,
      },
      select: { id: true, finalTestAttempts: true, completedAt: true },
    });
    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'StudentSubject',
        entityId: ASSIGNMENT_ID,
      }),
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
    const completedAt = new Date('2026-04-20T10:00:00.000Z');

    const result = await caller.pace.record({
      ...validInput,
      testType: 'FinalTest',
      score: 79,
      completedAt,
    });

    expect(result.advanced).toBe(false);
    expect(result.newPaceNumber).toBeUndefined();
    expect(db.paceProgress.create).toHaveBeenCalledWith({
      data: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        startedAt: completedAt,
      },
      select: { id: true, finalTestAttempts: true, completedAt: true },
    });
    expect(db.paceProgress.update).toHaveBeenCalledWith({
      where: { id: 'progress_1' },
      data: {
        finalTestAttempts: { increment: 1 },
      },
    });
    expect(db.studentSubject.update).not.toHaveBeenCalled();
  });

  it('keeps failed FinalTest records and links the later passing attempt to the same PACE lifecycle', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const failed = await caller.pace.record({
      ...validInput,
      testType: 'FinalTest',
      score: 79,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });
    const passed = await caller.pace.record({
      ...validInput,
      testType: 'FinalTest',
      score: 85,
      completedAt: new Date('2026-04-21T10:00:00.000Z'),
    });

    expect(failed.advanced).toBe(false);
    expect(passed.advanced).toBe(true);
    expect(db.paceRecord.create).toHaveBeenCalledTimes(2);
    expect(db.paceProgress.create).toHaveBeenCalledTimes(2);
    expect(db.paceProgress.create).toHaveBeenNthCalledWith(1, {
      data: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        startedAt: new Date('2026-04-20T10:00:00.000Z'),
      },
      select: { id: true, finalTestAttempts: true, completedAt: true },
    });
    expect(db.paceProgress.create).toHaveBeenNthCalledWith(2, {
      data: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1002,
        startedAt: new Date('2026-04-21T10:00:00.000Z'),
      },
      select: { id: true, finalTestAttempts: true, completedAt: true },
    });
    expect(db.paceProgress.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'progress_1' },
      data: {
        finalTestAttempts: { increment: 1 },
      },
    });
    expect(db.paceProgress.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'progress_1' },
      data: {
        finalTestAttempts: { increment: 1 },
        completedAt: new Date('2026-04-21T10:00:00.000Z'),
        completedByRecordId: 'pace_2',
      },
    });
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

describe('pace.record — automatic PACE merits', () => {
  it.each([
    { testType: 'FinalTest' as const, score: 100, awardedMerits: 10 },
    { testType: 'FinalTest' as const, score: 90, awardedMerits: 5 },
    { testType: 'FinalTest' as const, score: 80, awardedMerits: 1 },
    { testType: 'FinalTest' as const, score: 79, awardedMerits: 0 },
    { testType: 'SelfTest' as const, score: 100, awardedMerits: 3 },
    { testType: 'SelfTest' as const, score: 90, awardedMerits: 2 },
    { testType: 'SelfTest' as const, score: 80, awardedMerits: 1 },
    { testType: 'SelfTest' as const, score: 79, awardedMerits: 0 },
  ])(
    'awards $awardedMerits merits for $testType score $score',
    async ({ testType, score, awardedMerits }) => {
      const db = makeFakeDb();
      const { caller } = makeCaller(headUser, db);

      const result = await caller.pace.record({ ...validInput, testType, score });

      expect(result.awardedMerits).toBe(awardedMerits);
      if (awardedMerits > 0) {
        expect(db.behaviourEntry.create).toHaveBeenCalledWith({
          data: {
            studentId: STUDENT_ID,
            type: 'Merit',
            category:
              testType === 'FinalTest'
                ? `Academic Excellence - PACE Test ${String(score)}`
                : `Academic Excellence - Self-Test ${String(score)}`,
            noteEnc: null,
            visibility: 'General',
            meritDelta: awardedMerits,
            recordedById: headUser.id,
            paceRecordId: 'pace_1',
          },
          select: { id: true },
        });
        expect(db.meritLedger.createMany).toHaveBeenCalledWith({
          data: [
            {
              studentId: STUDENT_ID,
              account: 'Spend',
              delta: awardedMerits,
              reason:
                testType === 'FinalTest'
                  ? `Academic Excellence - PACE Test ${String(score)}`
                  : `Academic Excellence - Self-Test ${String(score)}`,
              relatedEntryId: 'behaviour_1',
            },
          ],
        });
      } else {
        expect(db.behaviourEntry.create).not.toHaveBeenCalled();
        expect(db.meritLedger.createMany).not.toHaveBeenCalled();
      }
    },
  );

  it('audits automatic merit behaviour and ledger rows', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    await caller.pace.record({ ...validInput, testType: 'FinalTest', score: 100 });

    const calls = auditCalls(db);
    const behaviourAudit = calls.find(
      (call) =>
        call.action === 'Create' &&
        call.entity === 'BehaviourEntry' &&
        call.entityId === 'behaviour_1',
    );
    const ledgerAudit = calls.find(
      (call) => call.action === 'Create' && call.entity === 'MeritLedger',
    );

    expect(behaviourAudit?.meta).toMatchObject({
      studentId: STUDENT_ID,
      meritDelta: 10,
      source: 'pace.record',
      paceRecordId: 'pace_1',
    });
    expect(ledgerAudit?.meta).toMatchObject({
      studentId: STUDENT_ID,
      behaviourEntryId: 'behaviour_1',
      paceRecordId: 'pace_1',
      rowCount: 1,
      source: 'pace.record',
    });
  });

  it('writes automatic merit rows through the RLS transaction context', async () => {
    const db = makeFakeDb();
    const { caller, ctx } = makeCaller(headUser, db);

    await caller.pace.record({
      ...validInput,
      completedAt: new Date('2026-04-20T10:30:00.000Z'),
      score: 100,
    });

    expect(ctx.rlsTransactionCalls()).toBe(1);
    expect(db.behaviourEntry.create).toHaveBeenCalledTimes(1);
    expect(db.meritLedger.createMany).toHaveBeenCalledTimes(1);
  });

  it('does not advance currentPaceNumber for SelfTest automatic merit awards', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({
      ...validInput,
      testType: 'SelfTest',
      score: 100,
    });

    expect(result.awardedMerits).toBe(3);
    expect(result.advanced).toBe(false);
    expect(db.studentSubject.update).not.toHaveBeenCalled();
    expect(db.behaviourEntry.create).toHaveBeenCalledTimes(1);
    expect(db.meritLedger.createMany).toHaveBeenCalledTimes(1);
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
    expect(calls).toContainEqual(
      expect.objectContaining({ action: 'Create', entity: 'PaceRecord' }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ action: 'Update', entity: 'StudentSubject' }),
    );
  });

  it('writes SelfTest score to selfTestScore column', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({ ...validInput, testType: 'SelfTest', score: 75.5 });

    expect(result.selfTestScore).toBe(75.5);
    expect(result.paceTestScore).toBeNull();
  });

  it('writes FinalTest score to paceTestScore column', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    const result = await caller.pace.record({ ...validInput, testType: 'FinalTest', score: 88.5 });

    expect(result.paceTestScore).toBe(88.5);
    expect(result.selfTestScore).toBeNull();
  });
});

describe('pace.updateRecord', () => {
  it('updates an existing PACE score without creating a new PaceRecord', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record({
      ...validInput,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });
    db.paceRecord.create.mockClear();

    const result = await caller.pace.updateRecord({
      recordId: created.id,
      score: 95,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt: new Date('2026-04-19T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      id: created.id,
      paceNumber: 1001,
      paceTestScore: 95,
    });
    expect(db.paceRecord.create).not.toHaveBeenCalled();
    expect(db.paceRecord.update).toHaveBeenCalledWith({
      where: { id: created.id },
      data: {
        selfTestScore: null,
        paceTestScore: 95,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        completedAt: new Date('2026-04-21T00:00:00.000Z'),
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        paceNumber: true,
        selfTestScore: true,
        paceTestScore: true,
        completedAt: true,
        createdAt: true,
      },
    });
  });

  it('updates the subject and PACE number on an existing PACE score', async () => {
    const db = makeFakeDb();
    db.subject.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, active: true }),
    );
    db.studentSubject.findUnique.mockImplementation(
      ({ where }: { where: { studentId_subjectId: { subjectId: string } } }) =>
        Promise.resolve(
          where.studentId_subjectId.subjectId === SUBJECT_2_ID
            ? { id: 'ckassign000000000000000002', currentPaceNumber: 1008 }
            : { id: ASSIGNMENT_ID, currentPaceNumber: 1001 },
        ),
    );
    const { caller } = makeCaller(headUser, db);
    await caller.pace.record({
      ...validInput,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1008,
      testType: 'SelfTest',
      score: 85,
      completedAt: new Date('2026-04-18T10:00:00.000Z'),
    });
    const created = await caller.pace.record({
      ...validInput,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });

    const result = await caller.pace.updateRecord({
      recordId: created.id,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1008,
      score: 92,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt: new Date('2026-04-19T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      id: created.id,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1008,
      paceTestScore: 92,
    });
    expect(db.paceRecord.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: created.id },
        data: expect.objectContaining({
          subjectId: SUBJECT_2_ID,
          paceNumber: 1008,
          paceTestScore: 92,
        }) as Record<string, unknown>,
      }),
    );
  });

  it('rejects subject changes to inactive subjects', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record(validInput);
    db.subject.findUnique.mockResolvedValueOnce({ id: SUBJECT_2_ID, active: false });

    await expect(
      caller.pace.updateRecord({
        recordId: created.id,
        subjectId: SUBJECT_2_ID,
        paceNumber: 1008,
        score: 95,
        completedAt: new Date('2026-04-21T00:00:00.000Z'),
        startedAt: new Date('2026-04-19T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects subject changes when the student is not assigned to the target subject', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record(validInput);
    db.subject.findUnique.mockResolvedValueOnce({ id: SUBJECT_2_ID, active: true });
    db.studentSubject.findUnique
      .mockResolvedValueOnce({ id: ASSIGNMENT_ID, currentPaceNumber: 1001 })
      .mockResolvedValueOnce(null);

    await expect(
      caller.pace.updateRecord({
        recordId: created.id,
        subjectId: SUBJECT_2_ID,
        paceNumber: 1008,
        score: 95,
        completedAt: new Date('2026-04-21T00:00:00.000Z'),
        startedAt: new Date('2026-04-19T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects moving a PACE Test without a matching target Self-Test', async () => {
    const db = makeFakeDb();
    db.subject.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, active: true }),
    );
    db.studentSubject.findUnique.mockImplementation(
      ({ where }: { where: { studentId_subjectId: { subjectId: string } } }) =>
        Promise.resolve(
          where.studentId_subjectId.subjectId === SUBJECT_2_ID
            ? { id: 'ckassign000000000000000002', currentPaceNumber: 1008 }
            : { id: ASSIGNMENT_ID, currentPaceNumber: 1001 },
        ),
    );
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record(validInput);

    await expect(
      caller.pace.updateRecord({
        recordId: created.id,
        subjectId: SUBJECT_2_ID,
        paceNumber: 1008,
        score: 95,
        completedAt: new Date('2026-04-21T00:00:00.000Z'),
        startedAt: new Date('2026-04-19T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('recalculates old and target subject progress when a record moves', async () => {
    const db = makeFakeDb();
    let originalCurrentPaceNumber = 1001;
    db.subject.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, active: true }),
    );
    db.studentSubject.findUnique.mockImplementation(
      ({ where }: { where: { studentId_subjectId: { subjectId: string } } }) =>
        Promise.resolve(
          where.studentId_subjectId.subjectId === SUBJECT_2_ID
            ? { id: 'ckassign000000000000000002', currentPaceNumber: 1008 }
            : { id: ASSIGNMENT_ID, currentPaceNumber: originalCurrentPaceNumber },
        ),
    );
    const { caller } = makeCaller(headUser, db);
    await caller.pace.record({
      ...validInput,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1008,
      testType: 'SelfTest',
      score: 85,
      completedAt: new Date('2026-04-18T10:00:00.000Z'),
    });
    const created = await caller.pace.record({
      ...validInput,
      score: 90,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });
    originalCurrentPaceNumber = 1002;
    db.studentSubject.update.mockClear();

    const result = await caller.pace.updateRecord({
      recordId: created.id,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1008,
      score: 90,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt: new Date('2026-04-19T00:00:00.000Z'),
    });

    expect(result.newPaceNumber).toBe(1009);
    expect(db.studentSubject.update).toHaveBeenCalledWith({
      where: { studentId_subjectId: { studentId: STUDENT_ID, subjectId: SUBJECT_ID } },
      data: { currentPaceNumber: 1001 },
    });
    expect(db.studentSubject.update).toHaveBeenCalledWith({
      where: { studentId_subjectId: { studentId: STUDENT_ID, subjectId: SUBJECT_2_ID } },
      data: { currentPaceNumber: 1009 },
    });
  });

  it('moves the record between daily counts when completion date changes', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record({
      ...validInput,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });

    await caller.pace.updateRecord({
      recordId: created.id,
      score: 95,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt: new Date('2026-04-19T00:00:00.000Z'),
    });

    await expect(
      caller.pace.forStudent({ studentId: STUDENT_ID, date: new Date('2026-04-20T00:00:00.000Z') }),
    ).resolves.toMatchObject({ today: { testCount: 0 } });
    await expect(
      caller.pace.forStudent({ studentId: STUDENT_ID, date: new Date('2026-04-21T00:00:00.000Z') }),
    ).resolves.toMatchObject({ today: { testCount: 1 } });
  });

  it('updates the matching PACE progress started date', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record(validInput);
    const startedAt = new Date('2026-04-18T00:00:00.000Z');

    await caller.pace.updateRecord({
      recordId: created.id,
      score: 92,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt,
    });

    const progressUpdateCalls = db.paceProgress.update.mock.calls as unknown as Array<
      [{ data: { startedAt?: Date }; where: { id: string } }]
    >;
    expect(
      progressUpdateCalls.some(
        ([call]) =>
          call.where.id === 'progress_1' && call.data.startedAt?.getTime() === startedAt.getTime(),
      ),
    ).toBe(true);
  });

  it('writes correction ledger rows when an edited score changes automatic merit value', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record({ ...validInput, score: 100 });
    db.meritLedger.createMany.mockClear();

    const result = await caller.pace.updateRecord({
      recordId: created.id,
      score: 85,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt: new Date('2026-04-18T00:00:00.000Z'),
    });

    expect(result.awardedMerits).toBe(1);
    const behaviourUpdateCalls = db.behaviourEntry.update.mock.calls as unknown as Array<
      [
        {
          data: { deletedAt?: Date | null; deletedById?: string | null; meritDelta?: number };
          select: { id: true };
          where: { id: string };
        },
      ]
    >;
    expect(behaviourUpdateCalls).toContainEqual([
      {
        where: { id: 'behaviour_1' },
        data: expect.objectContaining({
          meritDelta: 1,
          deletedAt: null,
          deletedById: null,
        }) as { deletedAt?: Date | null; deletedById?: string | null; meritDelta?: number },
        select: { id: true },
      },
    ]);
    expect(db.meritLedger.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          delta: -9,
          relatedEntryId: 'behaviour_1',
          reason: 'correction:Academic Excellence - PACE Test 85',
        }),
      ],
    });
  });

  it('recalculates advancement when a passing final test is edited below threshold', async () => {
    const db = makeFakeDb();
    db.studentSubject.findUnique
      .mockResolvedValueOnce({ id: ASSIGNMENT_ID, currentPaceNumber: 1001 })
      .mockResolvedValueOnce({ id: ASSIGNMENT_ID, currentPaceNumber: 1002 });
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record({ ...validInput, score: 90 });

    const result = await caller.pace.updateRecord({
      recordId: created.id,
      score: 70,
      completedAt: new Date('2026-04-21T00:00:00.000Z'),
      startedAt: new Date('2026-04-18T00:00:00.000Z'),
    });

    expect(result.newPaceNumber).toBe(1001);
    expect(db.studentSubject.update).toHaveBeenLastCalledWith({
      where: { studentId_subjectId: { studentId: STUDENT_ID, subjectId: SUBJECT_ID } },
      data: { currentPaceNumber: 1001 },
    });
    const progressUpdateCalls = db.paceProgress.update.mock.calls as unknown as Array<
      [
        {
          data: { completedAt?: Date | null; completedByRecordId?: string | null };
          where: { id: string };
        },
      ]
    >;
    expect(
      progressUpdateCalls.some(
        ([call]) =>
          call.where.id === 'progress_1' &&
          call.data.completedAt === null &&
          call.data.completedByRecordId === null,
      ),
    ).toBe(true);
  });

  it('allows Supervisors to update historical records', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const db = makeFakeDb();
      const { caller: headCaller } = makeCaller(headUser, db);
      const created = await headCaller.pace.record({
        ...validInput,
        completedAt: new Date('2026-04-29T10:00:00.000Z'),
      });
      const { caller } = makeCaller(supervisorUser, db);

      await expect(
        caller.pace.updateRecord({
          recordId: created.id,
          score: 91,
          completedAt: new Date('2026-04-28T00:00:00.000Z'),
          startedAt: new Date('2026-04-28T00:00:00.000Z'),
        }),
      ).resolves.toMatchObject({ id: created.id, paceTestScore: 91 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows tagged Supervisors to update historical records without rota scope', async () => {
    const db = makeFakeDb();
    db.staffShift.findMany.mockResolvedValue([]);
    const { caller: headCaller } = makeCaller(headUser, db);
    const created = await headCaller.pace.record({
      ...validInput,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });
    const { caller } = makeCaller(allStudentsSupervisorUser, db);

    await expect(
      caller.pace.updateRecord({
        recordId: created.id,
        score: 91,
        completedAt: new Date('2026-04-20T00:00:00.000Z'),
        startedAt: new Date('2026-04-18T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ id: created.id, paceTestScore: 91 });
    expect(db.staffShift.findMany).not.toHaveBeenCalled();
  });
});

describe('pace.deleteRecord', () => {
  it('hard deletes a PACE record, reverses automatic merits, and recalculates advancement', async () => {
    const db = makeFakeDb();
    db.studentSubject.findUnique
      .mockResolvedValueOnce({ id: ASSIGNMENT_ID, currentPaceNumber: 1001 })
      .mockResolvedValueOnce({ id: ASSIGNMENT_ID, currentPaceNumber: 1002 });
    const { caller } = makeCaller(headUser, db);
    const created = await caller.pace.record({
      ...validInput,
      score: 100,
      completedAt: new Date('2026-04-20T10:00:00.000Z'),
    });

    const result = await caller.pace.deleteRecord({ recordId: created.id });

    expect(result).toMatchObject({ id: created.id, deleted: true, newPaceNumber: 1001 });
    expect(db.paceRecord.delete).toHaveBeenCalledWith({
      where: { id: created.id },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        paceNumber: true,
        completedAt: true,
        createdAt: true,
      },
    });
    expect(db.behaviourEntry.update).toHaveBeenCalledWith({
      where: { id: 'behaviour_1' },
      data: expect.objectContaining({ deletedById: headUser.id }) as {
        deletedAt: Date;
        deletedById: string;
      },
      select: { id: true },
    });
    expect(db.meritLedger.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          delta: -10,
          relatedEntryId: 'behaviour_1',
        }),
      ],
    });
    expect(db.studentSubject.update).toHaveBeenLastCalledWith({
      where: { studentId_subjectId: { studentId: STUDENT_ID, subjectId: SUBJECT_ID } },
      data: { currentPaceNumber: 1001 },
    });
    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({ action: 'Delete', entity: 'PaceRecord', entityId: created.id }),
    );
  });

  it('rejects deletion for a failed PACE Test that has an advancement approval', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const failed = await caller.pace.record({ ...validInput, score: 79 });
    await caller.pace.approveFailedFinalTestAdvance({
      recordId: failed.id,
      notes: 'Reviewed mastery verbally with the child.',
    });

    await expect(caller.pace.deleteRecord({ recordId: failed.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.paceRecord.delete).not.toHaveBeenCalled();
  });
});

describe('pace.approveFailedFinalTestAdvance', () => {
  it('lets an in-scope Supervisor approve advancement from a failed PACE Test with notes', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(supervisorUser, db);
    const failed = await caller.pace.record({ ...validInput, score: 79 });

    const result = await caller.pace.approveFailedFinalTestAdvance({
      recordId: failed.id,
      notes: 'Child explained corrections and demonstrated readiness.',
    });

    expect(result).toMatchObject({
      paceRecordId: failed.id,
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumber: 1001,
      advanced: true,
      newPaceNumber: 1002,
      notes: 'Child explained corrections and demonstrated readiness.',
    });
    expect(db.$enc.encrypt).toHaveBeenCalledWith(
      'Child explained corrections and demonstrated readiness.',
    );
    expect(db.paceAdvancementApproval.create).toHaveBeenCalledWith({
      data: {
        paceRecordId: failed.id,
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001,
        notesEnc: 'enc:Child explained corrections and demonstrated readiness.',
        approvedById: supervisorUser.id,
      },
      select: {
        id: true,
        paceRecordId: true,
        studentId: true,
        subjectId: true,
        paceNumber: true,
        approvedAt: true,
        approvedById: true,
      },
    });
    expect(db.studentSubject.update).toHaveBeenLastCalledWith({
      where: { studentId_subjectId: { studentId: STUDENT_ID, subjectId: SUBJECT_ID } },
      data: { currentPaceNumber: 1002 },
    });
    expect(auditCalls(db)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'PaceAdvancementApproval',
      }),
    );
  });

  it('blocks parents and students from approving advancement', async () => {
    const db = makeFakeDb();
    const { caller: headCaller } = makeCaller(headUser, db);
    const failed = await headCaller.pace.record({ ...validInput, score: 79 });

    await expect(
      makeCaller(parentUser, db).caller.pace.approveFailedFinalTestAdvance({
        recordId: failed.id,
        notes: 'Parent should not approve.',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).caller.pace.approveFailedFinalTestAdvance({
        recordId: failed.id,
        notes: 'Student should not approve.',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows tagged Supervisors to approve advancement without rota scope', async () => {
    const db = makeFakeDb();
    const { caller: headCaller } = makeCaller(headUser, db);
    const failed = await headCaller.pace.record({ ...validInput, score: 79 });
    db.staffShift.findMany.mockResolvedValue([]);

    await expect(
      makeCaller(allStudentsSupervisorUser, db).caller.pace.approveFailedFinalTestAdvance({
        recordId: failed.id,
        notes: 'Approved after review.',
      }),
    ).resolves.toMatchObject({ paceRecordId: failed.id, advanced: true });
    expect(db.staffShift.findMany).not.toHaveBeenCalled();
  });
});
