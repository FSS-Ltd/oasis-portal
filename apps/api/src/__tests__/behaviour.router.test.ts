import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { behaviourRouter } from '../routers/behaviour.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckuserhead00000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckusersup000000000000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckuserparent000000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckuserstudent00000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const clubsUser: SessionUser = {
  id: 'ckuserclubs000000000001',
  role: 'ClubsAdmin',
  tags: [],
  requires2fa: false,
};

const activeStudentId = 'ckstudent000000000000001';
const inactiveStudentId = 'ckstudent000000000000002';

type BehaviourType = 'Merit' | 'Demerit';
type BehaviourVisibility = 'General' | 'Sensitive';

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
}

interface StoredBehaviour {
  id: string;
  studentId: string;
  type: BehaviourType;
  category: string;
  noteEnc: string | null;
  visibility: BehaviourVisibility;
  meritDelta: number;
  recordedById: string;
  createdAt: Date;
}

interface StoredLedgerRow {
  studentId: string;
  account: 'Spend' | 'Saving' | 'Investment' | 'TithePaid' | 'Given' | 'FeeSink';
  delta: number;
  reason: string;
  relatedEntryId?: string;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: { findUnique: ReturnType<typeof vi.fn> };
  behaviourEntry: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  meritLedger: { createMany: ReturnType<typeof vi.fn> };
}

function encrypt(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function makeFakeDb() {
  const students: StoredStudent[] = [
    { id: activeStudentId, active: true, fullNameEnc: 'enc:Jane Learner' },
    { id: inactiveStudentId, active: false, fullNameEnc: 'enc:Former Student' },
  ];
  const behaviour: StoredBehaviour[] = [];
  const ledger: StoredLedgerRow[] = [];

  const db: FakeDb = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    student: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) return Promise.resolve(null);
        return Promise.resolve(student);
      }),
    },
    behaviourEntry: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<StoredBehaviour, 'id' | 'createdAt'>;
        }) => {
          const rowNumber = String(behaviour.length + 1).padStart(2, '0');
          const row: StoredBehaviour = {
            id: `ckbehaviour0000000000${rowNumber}`,
            createdAt: new Date(`2026-04-29T10:${rowNumber}:00.000Z`),
            ...data,
          };
          behaviour.push(row);
          return Promise.resolve(row);
        },
      ),
      findMany: vi.fn(
        ({
          where,
        }: {
          where: { studentId: string; visibility?: BehaviourVisibility };
        }) =>
          Promise.resolve(
            behaviour
              .filter((row) => row.studentId === where.studentId)
              .filter((row) => where.visibility === undefined || row.visibility === where.visibility)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          ),
      ),
    },
    meritLedger: {
      createMany: vi.fn(({ data }: { data: StoredLedgerRow[] }) => {
        ledger.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };

  return { db, students, behaviour, ledger };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ behaviour: behaviourRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('behaviour.log', () => {
  it('allows full-admin and Supervisor to create encrypted behaviour with linked Spend ledger rows', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    const merit = await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Helped a younger student',
      visibility: 'General',
      amount: 4,
    });
    const demerit = await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Disruption',
      note: 'Repeated interruption',
      visibility: 'Sensitive',
      amount: 999,
    });

    expect(merit).toMatchObject({
      id: 'ckbehaviour000000000001',
      studentId: activeStudentId,
      type: 'Merit',
      meritDelta: 4,
      recordedById: supervisorUser.id,
    });
    expect(demerit).toMatchObject({
      id: 'ckbehaviour000000000002',
      type: 'Demerit',
      visibility: 'Sensitive',
      meritDelta: -5,
      recordedById: headUser.id,
    });
    expect(behaviour.map((row) => row.noteEnc)).toEqual([
      'enc:Helped a younger student',
      'enc:Repeated interruption',
    ]);
    expect(ledger).toEqual([
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: 4,
        reason: 'Kindness',
        relatedEntryId: 'ckbehaviour000000000001',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -5,
        reason: 'Disruption',
        relatedEntryId: 'ckbehaviour000000000002',
      },
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'Create',
        entity: 'BehaviourEntry',
        entityId: 'ckbehaviour000000000001',
        meta: {
          studentId: activeStudentId,
          type: 'Merit',
          visibility: 'General',
          meritDelta: 4,
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'MeritLedger',
        meta: {
          studentId: activeStudentId,
          behaviourEntryId: 'ckbehaviour000000000002',
          rowCount: 1,
        },
      },
    });
  });

  it('denies unsupported roles and rejects missing inputs or inactive students', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(parentUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(clubsUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Kindness',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'merit amount is required' });
    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: inactiveStudentId,
        type: 'Demerit',
        category: 'Disruption',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'student is inactive' });
    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: 'ckstudentmissing000000001',
        type: 'Demerit',
        category: 'Disruption',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'student not found' });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'PermissionDenied',
        entity: 'behaviour.log',
        meta: {
          role: 'Parent',
          reason: 'Access denied: behaviour workflow requires full-admin or Supervisor',
        },
      },
    });
  });
});

describe('behaviour.listForStudent', () => {
  it('lets full-admin read General and Sensitive entries and audits sensitive decrypts', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Served at lunch',
      amount: 3,
    });
    await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Safeguarding',
      note: 'Sensitive staff note',
      visibility: 'Sensitive',
    });

    const result = await caller.behaviour.listForStudent({ studentId: activeStudentId });

    expect(result.studentName).toBe('Jane Learner');
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.visibility)).toEqual(['Sensitive', 'General']);
    expect(result.entries[0]).toMatchObject({
      category: 'Safeguarding',
      note: 'Sensitive staff note',
      meritDelta: -5,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'ReadSensitive',
        entity: 'BehaviourEntry',
        meta: {
          studentId: activeStudentId,
          count: 1,
          source: 'behaviour.listForStudent',
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptSensitive',
        entity: 'BehaviourEntry',
        meta: {
          studentId: activeStudentId,
          count: 1,
          source: 'behaviour.listForStudent',
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        entityId: activeStudentId,
        meta: {
          source: 'behaviour.listForStudent',
          fields: ['fullName'],
          noteCount: 2,
        },
      },
    });
  });

  it('lets Supervisor read General entries only and denies explicit Sensitive requests', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Shared resources',
      amount: 2,
    });
    await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Safeguarding',
      note: 'Supervisor can create but not reread',
      visibility: 'Sensitive',
    });

    const result = await makeCaller(supervisorUser, db).behaviour.listForStudent({
      studentId: activeStudentId,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      visibility: 'General',
      note: 'Shared resources',
    });

    await expect(
      makeCaller(supervisorUser, db).behaviour.listForStudent({
        studentId: activeStudentId,
        includeSensitive: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'BehaviourEntry',
        meta: {
          studentId: activeStudentId,
          requested: 'Sensitive',
          role: 'Supervisor',
          reason: 'Access denied: sensitive entries are full-admin only',
        },
      },
    });
  });

  it('denies Parent, Student, and ClubsAdmin reads', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(parentUser, db).behaviour.listForStudent({ studentId: activeStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).behaviour.listForStudent({ studentId: activeStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(clubsUser, db).behaviour.listForStudent({ studentId: activeStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: clubsUser.id,
        action: 'PermissionDenied',
        entity: 'behaviour.listForStudent',
        meta: {
          role: 'ClubsAdmin',
          reason: 'Access denied: behaviour workflow requires full-admin or Supervisor',
        },
      },
    });
  });
});
