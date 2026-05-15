import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import type { EmailClient } from '../lib/email.js';
import { createBehaviourRouter } from '../routers/behaviour.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckuserhead00000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const hodUser: SessionUser = {
  id: 'ckuserhod000000000000001',
  role: 'HeadOfDiscipline',
  tags: [],
  requires2fa: false,
};
const principalUser: SessionUser = {
  id: 'ckuserprincipal000000001',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckusersup000000000000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const allStudentsSupervisorUser: SessionUser = {
  id: 'ckusersupall00000000001',
  role: 'Supervisor',
  tags: ['supervisor-all-students'],
  requires2fa: false,
};
const otherSupervisorUser: SessionUser = {
  id: 'ckusersupother000000001',
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
const secondaryStudentId = 'ckstudent000000000000003';
const inactiveStudentId = 'ckstudent000000000000002';

type BehaviourType = 'Merit' | 'Demerit' | 'General';
type BehaviourVisibility = 'General' | 'Sensitive';

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
}

interface StoredUser {
  id: string;
  active: boolean;
  emailEnc: string;
  fullNameEnc: string;
  role: SessionUser['role'];
}

interface StoredGuardian {
  id: string;
  createdAt: Date;
  studentId: string;
  userId: string;
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
  deletedAt: Date | null;
  deletedById: string | null;
  createdAt: Date;
}

interface StoredLedgerRow {
  studentId: string;
  account: 'Spend' | 'Saving' | 'Investment' | 'TithePaid' | 'Given' | 'FeeSink';
  delta: number;
  reason: string;
  relatedEntryId?: string;
}

interface AuditCreateArgs {
  data: {
    action: string;
    entity: string;
    entityId?: string | null;
    meta: Record<string, unknown>;
    userId: string;
  };
}

interface FakeDb {
  $transaction: ReturnType<typeof vi.fn>;
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: { findUnique: ReturnType<typeof vi.fn> };
  guardian: { findMany: ReturnType<typeof vi.fn> };
  behaviourEntry: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  meritLedger: { createMany: ReturnType<typeof vi.fn> };
  staffShift: { findMany: ReturnType<typeof vi.fn> };
}

function encrypt(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function makeStoredUser(input: Pick<StoredUser, 'id' | 'role'> & Partial<StoredUser>): StoredUser {
  return {
    active: true,
    emailEnc: encrypt(`${input.id}@example.com`) ?? '',
    fullNameEnc: encrypt(`${input.role} User`) ?? '',
    ...input,
  };
}

const defaultUsers: StoredUser[] = [
  makeStoredUser({ id: headUser.id, fullNameEnc: 'enc:Head User', role: headUser.role }),
  makeStoredUser({ id: hodUser.id, fullNameEnc: 'enc:HOD User', role: hodUser.role }),
  makeStoredUser({
    id: principalUser.id,
    fullNameEnc: 'enc:Principal User',
    role: principalUser.role,
  }),
  makeStoredUser({
    id: supervisorUser.id,
    fullNameEnc: 'enc:Supervisor User',
    role: supervisorUser.role,
  }),
  makeStoredUser({
    id: otherSupervisorUser.id,
    fullNameEnc: 'enc:Other Supervisor User',
    role: otherSupervisorUser.role,
  }),
  makeStoredUser({
    id: clubsUser.id,
    fullNameEnc: 'enc:Clubs Admin User',
    role: clubsUser.role,
  }),
  makeStoredUser({
    id: parentUser.id,
    emailEnc: 'enc:jane.parent@example.com',
    fullNameEnc: 'enc:Jane Parent',
    role: parentUser.role,
  }),
];

function makeFakeDb(
  options: {
    guardians?: StoredGuardian[];
    supervisorHasShift?: boolean;
    users?: StoredUser[];
  } = {},
) {
  const supervisorHasShift = options.supervisorHasShift ?? true;
  const students: StoredStudent[] = [
    { id: activeStudentId, active: true, fullNameEnc: 'enc:Jane Learner', yearGroup: 'Year 6' },
    {
      id: inactiveStudentId,
      active: false,
      fullNameEnc: 'enc:Former Student',
      yearGroup: 'Year 6',
    },
    {
      id: secondaryStudentId,
      active: true,
      fullNameEnc: 'enc:Secondary Student',
      yearGroup: 'Year 8',
    },
  ];
  const bands = [
    {
      id: 'band_upper',
      name: 'Upper Primary',
      standardYears: ['Year 5', 'Year 6'],
      colour: '#5B90C5',
      active: true,
    },
  ];
  const users = [...defaultUsers, ...(options.users ?? [])];
  const guardians = [...(options.guardians ?? [])];
  const behaviour: StoredBehaviour[] = [];
  const ledger: StoredLedgerRow[] = [];

  const db: FakeDb = {
    $transaction: vi.fn(<T>(fn: (tx: FakeDb) => Promise<T>) => fn(db)),
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
    guardian: {
      findMany: vi.fn(({ where }: { where: { studentId?: string; user?: { active?: boolean } } }) =>
        Promise.resolve(
          guardians
            .filter(
              (guardian) => where.studentId === undefined || guardian.studentId === where.studentId,
            )
            .map((guardian) => ({
              user: users.find((user) => user.id === guardian.userId) ?? null,
            }))
            .filter(
              (guardian): guardian is { user: StoredUser } =>
                guardian.user !== null &&
                (where.user?.active === undefined || guardian.user.active === where.user.active),
            ),
        ),
      ),
    },
    behaviourEntry: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<StoredBehaviour, 'id' | 'createdAt' | 'deletedAt' | 'deletedById'>;
        }) => {
          const rowNumber = String(behaviour.length + 1).padStart(2, '0');
          const row: StoredBehaviour = {
            id: `ckbehaviour0000000000${rowNumber}`,
            createdAt: new Date(`2026-04-29T10:${rowNumber}:00.000Z`),
            deletedAt: null,
            deletedById: null,
            ...data,
          };
          behaviour.push(row);
          return Promise.resolve(row);
        },
      ),
      findUnique: vi.fn(
        ({ where }: { where: { id: string }; include?: { ledgerRows?: unknown } }) => {
          const row = behaviour.find((candidate) => candidate.id === where.id);
          if (!row) return Promise.resolve(null);
          return Promise.resolve({
            ...row,
            ledgerRows: ledger.filter((ledgerRow) => ledgerRow.relatedEntryId === row.id),
          });
        },
      ),
      findMany: vi.fn(
        ({
          include,
          where,
        }: {
          include?: { student?: unknown; recordedBy?: unknown };
          where: {
            createdAt?: { gte: Date; lt: Date };
            OR?: Array<{
              recordedById?: string;
              type?: BehaviourType;
              visibility?: BehaviourVisibility;
            }>;
            student?: { id?: { in: string[] }; yearGroup?: { in: string[] } };
            studentId?: string;
            deletedAt?: null;
            type?: BehaviourType;
            visibility?: BehaviourVisibility;
          };
        }) => {
          const matchesVisibility = (
            row: StoredBehaviour,
            condition: {
              recordedById?: string;
              type?: BehaviourType;
              visibility?: BehaviourVisibility;
            },
          ) =>
            (condition.recordedById === undefined || row.recordedById === condition.recordedById) &&
            (condition.type === undefined || row.type === condition.type) &&
            (condition.visibility === undefined || row.visibility === condition.visibility);
          const rows = behaviour
            .filter((row) => where.studentId === undefined || row.studentId === where.studentId)
            .filter((row) => where.deletedAt === undefined || row.deletedAt === where.deletedAt)
            .filter((row) => where.type === undefined || row.type === where.type)
            .filter((row) => where.visibility === undefined || row.visibility === where.visibility)
            .filter(
              (row) =>
                where.OR === undefined ||
                where.OR.some((condition) => matchesVisibility(row, condition)),
            )
            .filter((row) => {
              if (where.student === undefined) return true;
              const student = students.find((candidate) => candidate.id === row.studentId);
              if (!student) return false;
              return (
                (where.student.id?.in === undefined || where.student.id.in.includes(student.id)) &&
                (where.student.yearGroup?.in === undefined ||
                  where.student.yearGroup.in.includes(student.yearGroup))
              );
            })
            .filter(
              (row) =>
                where.createdAt === undefined ||
                (row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt),
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          if (!include?.student && !include?.recordedBy) return Promise.resolve(rows);
          return Promise.resolve(
            rows.map((row) => ({
              ...row,
              student: students.find((student) => student.id === row.studentId),
              recordedBy: users.find((user) => user.id === row.recordedById) ?? users[0],
            })),
          );
        },
      ),
      update: vi.fn(
        ({
          where,
          data,
          select,
        }: {
          where: { id: string };
          data: Partial<StoredBehaviour>;
          select?: Record<string, boolean>;
        }) => {
          const row = behaviour.find((candidate) => candidate.id === where.id);
          if (!row) return Promise.reject(new Error('Record not found'));
          Object.assign(row, data);
          if (!select) return Promise.resolve(row);
          return Promise.resolve(
            Object.fromEntries(
              Object.keys(select).map((key) => [key, row[key as keyof StoredBehaviour]]),
            ),
          );
        },
      ),
    },
    meritLedger: {
      createMany: vi.fn(({ data }: { data: StoredLedgerRow[] }) => {
        ledger.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    staffShift: {
      findMany: vi.fn(({ where }: { where: { staffUserId: string } }) =>
        Promise.resolve(
          supervisorHasShift &&
            (where.staffUserId === supervisorUser.id || where.staffUserId === clubsUser.id)
            ? [{ yearGroupBand: bands[0] }]
            : [],
        ),
      ),
    },
  };

  return { db, students, behaviour, ledger, guardians, users };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeFakeEmailClient(result = { id: 'email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function makeGuardian(userId: string, input: Partial<StoredGuardian> = {}): StoredGuardian {
  return {
    id: `guardian_${userId}`,
    createdAt: new Date('2026-04-29T08:00:00.000Z'),
    studentId: activeStudentId,
    userId,
    ...input,
  };
}

function auditCreateArgs(db: FakeDb): AuditCreateArgs[] {
  const calls = db.auditLog.create.mock.calls as unknown as Array<[AuditCreateArgs]>;
  return calls.map(([args]) => args);
}

function makeCaller(
  user: SessionUser | null,
  db: FakeDb,
  emailClient: EmailClient = makeFakeEmailClient().client,
) {
  const appRouter = router({ behaviour: createBehaviourRouter({ emailClient }) });
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
      amount: 3,
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
      meritDelta: -3,
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
        delta: -3,
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

  it('defaults a demerit to DEMERIT_COST when no amount is provided', async () => {
    const { db, ledger } = makeFakeDb();

    const demerit = await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Disruption',
      visibility: 'General',
    });

    expect(demerit).toMatchObject({
      type: 'Demerit',
      meritDelta: -5,
    });
    expect(ledger).toEqual([
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -5,
        reason: 'Disruption',
        relatedEntryId: 'ckbehaviour000000000001',
      },
    ]);
  });

  it('emails General merits to every active linked guardian and skips inactive accounts', async () => {
    const inactiveGuardian = makeStoredUser({
      id: 'ckuserinactiveguardian001',
      active: false,
      emailEnc: 'enc:inactive.guardian@example.com',
      fullNameEnc: 'enc:Inactive Guardian',
      role: 'Parent',
    });
    const { db } = makeFakeDb({
      guardians: [
        makeGuardian(parentUser.id),
        makeGuardian(principalUser.id),
        makeGuardian(inactiveGuardian.id),
      ],
      users: [inactiveGuardian],
    });
    const email = makeFakeEmailClient();

    await makeCaller(supervisorUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Helped a younger student',
      visibility: 'General',
      amount: 4,
    });

    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send.mock.calls.map(([payload]) => payload.to)).toEqual([
      'jane.parent@example.com',
      `${principalUser.id}@example.com`,
    ]);
    const firstEmail = email.send.mock.calls[0]?.[0];
    expect(firstEmail?.subject).toBe('Oasis Portal behaviour update');
    expect(firstEmail?.text).toContain('Jane Learner');
    expect(firstEmail?.text).toContain('Type: Merit');
    expect(firstEmail?.text).toContain('Category: Kindness');
    expect(firstEmail?.text).toContain('Note: Helped a younger student');
    const emailAudits = auditCreateArgs(db).filter((args) => args.data.entity === 'Email');
    expect(emailAudits).toHaveLength(2);
    expect(emailAudits.map((args) => args.data.meta['toUserId'])).toEqual([
      parentUser.id,
      principalUser.id,
    ]);
    expect(emailAudits[0]?.data.meta).toMatchObject({
      emailStatus: 'Sent',
      source: 'behaviour.log.notification',
      studentId: activeStudentId,
      type: 'Merit',
    });
  });

  it('emails General demerits to linked guardians', async () => {
    const { db } = makeFakeDb({ guardians: [makeGuardian(parentUser.id)] });
    const email = makeFakeEmailClient();

    await makeCaller(supervisorUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Disruption',
      note: 'Interrupted group work',
      visibility: 'General',
    });

    expect(email.send).toHaveBeenCalledTimes(1);
    const sentEmail = email.send.mock.calls[0]?.[0];
    expect(sentEmail?.text).toContain('Type: Demerit');
    expect(sentEmail?.text).toContain('Category: Disruption');
    expect(sentEmail?.text).toContain('Note: Interrupted group work');
  });

  it('emails parent-visible General marks to linked guardians', async () => {
    const { db, behaviour, ledger } = makeFakeDb({ guardians: [makeGuardian(parentUser.id)] });
    const email = makeFakeEmailClient();

    const result = await makeCaller(supervisorUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'General',
      category: 'Misc',
      note: 'Shared pastoral update',
      visibility: 'General',
    });

    expect(result).toMatchObject({
      studentId: activeStudentId,
      type: 'General',
      category: 'Misc',
      visibility: 'General',
      meritDelta: 0,
    });
    expect(behaviour).toEqual([
      expect.objectContaining({
        type: 'General',
        noteEnc: 'enc:Shared pastoral update',
        visibility: 'General',
        meritDelta: 0,
      }),
    ]);
    expect(ledger).toEqual([]);
    expect(email.send).toHaveBeenCalledTimes(1);
    const sentEmail = email.send.mock.calls[0]?.[0];
    expect(sentEmail?.text).toContain('received a general mark');
    expect(sentEmail?.text).toContain('Type: General');
    expect(sentEmail?.text).toContain('Category: Misc');
    expect(sentEmail?.text).toContain('Note: Shared pastoral update');
  });

  it('does not email linked guardians for Sensitive merit or demerit entries', async () => {
    const { db } = makeFakeDb({ guardians: [makeGuardian(parentUser.id)] });
    const email = makeFakeEmailClient();

    await makeCaller(headUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Pastoral',
      note: 'Sensitive positive note',
      visibility: 'Sensitive',
      amount: 2,
    });
    await makeCaller(headUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Safeguarding',
      note: 'Sensitive staff note',
      visibility: 'Sensitive',
    });

    expect(email.send).not.toHaveBeenCalled();
    expect(auditCreateArgs(db).some((args) => args.data.entity === 'Email')).toBe(false);
  });

  it('defaults General marks to Sensitive with no merit ledger rows or guardian emails', async () => {
    const { db, behaviour, ledger } = makeFakeDb({ guardians: [makeGuardian(parentUser.id)] });
    const email = makeFakeEmailClient();

    const result = await makeCaller(supervisorUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'General',
      note: 'Pastoral context to note',
    });

    expect(result).toMatchObject({
      studentId: activeStudentId,
      type: 'General',
      category: 'Misc',
      visibility: 'Sensitive',
      meritDelta: 0,
      recordedById: supervisorUser.id,
    });
    expect(behaviour).toEqual([
      expect.objectContaining({
        type: 'General',
        category: 'Misc',
        noteEnc: 'enc:Pastoral context to note',
        visibility: 'Sensitive',
        meritDelta: 0,
      }),
    ]);
    expect(ledger).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
    expect(auditCreateArgs(db).some((args) => args.data.entity === 'MeritLedger')).toBe(false);
  });

  it('requires a note and rejects merit values for General marks', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'General',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'general mark note is required' });
    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'General',
        note: 'Has a note',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'general marks have no merit value' });
  });

  it('creates multiple Merit or Demerit entries for one student as one batch', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    const meritResult = await makeCaller(supervisorUser, db).behaviour.logMany({
      studentId: activeStudentId,
      type: 'Merit',
      entries: [
        { category: 'Kindness', note: 'Helped at lunch', amount: 2 },
        { category: 'Leadership', amount: 3 },
      ],
    });
    const demeritResult = await makeCaller(supervisorUser, db).behaviour.logMany({
      studentId: activeStudentId,
      type: 'Demerit',
      entries: [
        { category: 'Conduct', amount: 2, count: 2 },
        { category: 'Punctuality', note: 'Late to line up' },
      ],
    });

    expect(meritResult).toMatchObject({
      entries: [
        { type: 'Merit', category: 'Kindness', meritDelta: 2 },
        { type: 'Merit', category: 'Leadership', meritDelta: 3 },
      ],
      ledgerRowCount: 2,
    });
    expect(demeritResult).toMatchObject({
      entries: [
        { type: 'Demerit', category: 'Conduct', meritDelta: -2 },
        { type: 'Demerit', category: 'Conduct', meritDelta: -2 },
        { type: 'Demerit', category: 'Punctuality', meritDelta: -5 },
      ],
      ledgerRowCount: 3,
    });
    expect(behaviour).toHaveLength(5);
    expect(ledger).toEqual([
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: 2,
        reason: 'Kindness',
        relatedEntryId: 'ckbehaviour000000000001',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: 3,
        reason: 'Leadership',
        relatedEntryId: 'ckbehaviour000000000002',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -2,
        reason: 'Conduct',
        relatedEntryId: 'ckbehaviour000000000003',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -2,
        reason: 'Conduct',
        relatedEntryId: 'ckbehaviour000000000004',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -5,
        reason: 'Punctuality',
        relatedEntryId: 'ckbehaviour000000000005',
      },
    ]);
  });

  it('can repeat a Merit batch row with the same amount', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    const result = await makeCaller(supervisorUser, db).behaviour.logMany({
      studentId: activeStudentId,
      type: 'Merit',
      entries: [{ category: 'Scripture Memory', note: 'Verse practice', amount: 10, count: 10 }],
    });

    expect(result.entries).toHaveLength(10);
    expect(result.ledgerRowCount).toBe(10);
    expect(behaviour).toHaveLength(10);
    expect(behaviour).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'Merit',
          category: 'Scripture Memory',
          noteEnc: 'enc:Verse practice',
          meritDelta: 10,
        }),
      ]),
    );
    expect(ledger).toHaveLength(10);
    expect(ledger.every((row) => row.delta === 10 && row.reason === 'Scripture Memory')).toBe(true);
  });

  it('rejects invalid batch entries before creating any rows', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).behaviour.logMany({
        studentId: activeStudentId,
        type: 'Merit',
        entries: [{ category: 'Kindness', amount: 1 }, { category: 'Leadership' }],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'merit amount is required for entry 2',
    });
    await expect(
      makeCaller(supervisorUser, db).behaviour.logMany({
        studentId: activeStudentId,
        type: 'General' as 'Merit',
        entries: [{ category: 'Misc', note: 'Not allowed', amount: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      makeCaller(supervisorUser, db).behaviour.logMany({
        studentId: activeStudentId,
        type: 'Demerit',
        entries: [{ category: 'Conduct', amount: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(behaviour).toEqual([]);
    expect(ledger).toEqual([]);
  });

  it('rejects batch requests that would create more than 50 entries', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).behaviour.logMany({
        studentId: activeStudentId,
        type: 'Merit',
        entries: [
          { category: 'Kindness', amount: 1, count: 25 },
          { category: 'Leadership', amount: 1, count: 26 },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'batch cannot create more than 50 entries',
    });

    expect(behaviour).toEqual([]);
    expect(ledger).toEqual([]);
  });

  it('keeps saved General behaviour and audits notification failure when email delivery fails', async () => {
    const { db, behaviour, ledger } = makeFakeDb({ guardians: [makeGuardian(parentUser.id)] });
    const email = makeFakeEmailClient();
    email.send.mockRejectedValueOnce(new Error('resend unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        makeCaller(supervisorUser, db, email.client).behaviour.log({
          studentId: activeStudentId,
          type: 'Merit',
          category: 'Kindness',
          note: 'Shared resources',
          visibility: 'General',
          amount: 2,
        }),
      ).resolves.toMatchObject({
        studentId: activeStudentId,
        type: 'Merit',
        meritDelta: 2,
      });
    } finally {
      errorSpy.mockRestore();
    }

    expect(behaviour).toHaveLength(1);
    expect(ledger).toHaveLength(1);
    const failedAudit = auditCreateArgs(db).find(
      (args) =>
        args.data.entity === 'BehaviourEntry' &&
        args.data.action === 'Update' &&
        args.data.meta['source'] === 'behaviour.log.notification',
    );
    expect(failedAudit?.data).toMatchObject({
      action: 'Update',
      entity: 'BehaviourEntry',
      entityId: 'ckbehaviour000000000001',
      meta: {
        emailStatus: 'Failed',
        source: 'behaviour.log.notification',
        studentId: activeStudentId,
        toUserId: parentUser.id,
        type: 'Merit',
      },
    });
  });

  it('saves General behaviour without sending when the student has no linked guardians', async () => {
    const { db, behaviour, ledger } = makeFakeDb();
    const email = makeFakeEmailClient();

    await makeCaller(supervisorUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      visibility: 'General',
      amount: 1,
    });

    expect(behaviour).toHaveLength(1);
    expect(ledger).toHaveLength(1);
    expect(email.send).not.toHaveBeenCalled();
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
          reason:
            'Access denied: behaviour workflow requires full-admin, ClubsAdmin, or Supervisor',
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

  it('lets Supervisor read General entries and denies explicit all-Sensitive requests', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Shared resources',
      amount: 2,
    });
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Safeguarding',
      note: 'Sensitive staff note',
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
          reason: 'Access denied: sensitive entries require full-admin access',
        },
      },
    });
  });

  it('allows Supervisor creating Sensitive demerits and denies Sensitive merits', async () => {
    const { db } = makeFakeDb();
    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Demerit',
        category: 'Safeguarding',
        note: 'Supervisor sensitive demerit',
        visibility: 'Sensitive',
      }),
    ).resolves.toMatchObject({
      type: 'Demerit',
      visibility: 'Sensitive',
      recordedById: supervisorUser.id,
    });

    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Safeguarding',
        note: 'Supervisor cannot create sensitive merit',
        visibility: 'Sensitive',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets staff authors read their own Sensitive General marks but hides them from other staff', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'General',
      category: 'Misc',
      note: 'Sensitive pastoral note',
    });

    const authorResult = await makeCaller(supervisorUser, db).behaviour.listForStudent({
      studentId: activeStudentId,
    });
    expect(authorResult.entries).toEqual([
      expect.objectContaining({
        type: 'General',
        category: 'Misc',
        note: 'Sensitive pastoral note',
        visibility: 'Sensitive',
        meritDelta: 0,
      }),
    ]);

    const otherResult = await makeCaller(otherSupervisorUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(otherResult.entries).toEqual([]);
  });

  it('denies Parent and Student reads', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(parentUser, db).behaviour.listForStudent({ studentId: activeStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).behaviour.listForStudent({ studentId: activeStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('behaviour corrections', () => {
  it('lets full-admin edit a Merit amount and writes a ledger delta correction', async () => {
    const { db, ledger } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Original note',
      amount: 3,
    });

    await expect(
      caller.behaviour.updateEntry({
        id: created.id,
        category: 'Leadership',
        note: 'Updated note',
        visibility: 'General',
        amount: 5,
      }),
    ).resolves.toMatchObject({ id: created.id, category: 'Leadership', meritDelta: 5 });

    expect(ledger).toEqual([
      expect.objectContaining({ delta: 3, relatedEntryId: created.id }),
      expect.objectContaining({
        delta: 2,
        reason: 'correction:Leadership',
        relatedEntryId: created.id,
      }),
    ]);
    const updateAudit = auditCreateArgs(db).find(
      (args) => args.data.action === 'Update' && args.data.entityId === created.id,
    );
    expect(updateAudit?.data).toMatchObject({
      action: 'Update',
      entity: 'BehaviourEntry',
      entityId: created.id,
      userId: headUser.id,
    });
    expect(updateAudit?.data.meta).toMatchObject({
      ledgerCorrectionRows: 1,
      previousMeritDelta: 3,
    });
  });

  it('lets full-admin edit a Demerit deduction and writes a ledger delta correction', async () => {
    const { db, ledger } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      note: 'Original note',
      amount: 5,
    });

    await expect(
      caller.behaviour.updateEntry({
        id: created.id,
        category: 'Conduct',
        note: 'Updated demerit note',
        visibility: 'General',
        amount: 2,
      }),
    ).resolves.toMatchObject({ id: created.id, category: 'Conduct', meritDelta: -2 });

    expect(ledger).toEqual([
      expect.objectContaining({ delta: -5, relatedEntryId: created.id }),
      expect.objectContaining({
        delta: 3,
        reason: 'correction:Conduct',
        relatedEntryId: created.id,
      }),
    ]);
  });

  it('rejects amount edits for General marks', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'General',
      note: 'Pastoral context',
    });

    await expect(
      caller.behaviour.updateEntry({
        id: created.id,
        note: 'Pastoral context',
        amount: 1,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'general marks have no merit value',
    });
  });

  it('soft-deletes a Demerit and writes inverse ledger correction rows', async () => {
    const { db, behaviour, ledger } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      note: 'Original note',
    });

    await expect(caller.behaviour.deleteEntry({ id: created.id })).resolves.toMatchObject({
      id: created.id,
      ledgerCorrectionRows: 1,
    });

    expect(behaviour[0]?.deletedById).toBe(headUser.id);
    expect(ledger).toEqual([
      expect.objectContaining({ delta: -5, relatedEntryId: created.id }),
      expect.objectContaining({
        delta: 5,
        reason: 'correction:delete:Conduct',
        relatedEntryId: created.id,
      }),
    ]);
  });

  it('excludes soft-deleted behaviour entries from recent entries', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      amount: 1,
    });
    await caller.behaviour.deleteEntry({ id: created.id });

    await expect(
      caller.behaviour.recentEntries({ date: new Date('2026-04-29T00:00:00.000Z') }),
    ).resolves.toMatchObject({ entries: [] });
  });

  it('denies correction mutations to non-full-admin users', async () => {
    const { db } = makeFakeDb();
    const created = await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'General',
      note: 'Pastoral context',
    });

    await expect(
      makeCaller(supervisorUser, db).behaviour.updateEntry({
        id: created.id,
        note: 'Changed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(clubsUser, db).behaviour.deleteEntry({ id: created.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('behaviour.recentEntries', () => {
  it('returns assigned-band rows and only own sensitive demerits for Supervisor', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      note: 'Helped a younger student',
      visibility: 'General',
      amount: 4,
    });
    await makeCaller(supervisorUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Supervisor Sensitive',
      note: 'Own private demerit',
      visibility: 'Sensitive',
    });
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      note: 'Private behaviour note',
      visibility: 'Sensitive',
    });

    const supervisorResult = await makeCaller(supervisorUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(supervisorResult.entries).toHaveLength(2);
    expect(supervisorResult.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'Demerit',
          category: 'Supervisor Sensitive',
          note: 'Own private demerit',
          visibility: 'Sensitive',
        }),
        expect.objectContaining({
          type: 'Merit',
          note: 'Helped a younger student',
          recordedByName: 'Supervisor User',
          studentName: 'Jane Learner',
        }),
      ]),
    );
    expect(supervisorResult.entries).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'Conduct' })]),
    );

    const headResult = await makeCaller(headUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(headResult.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'Demerit',
          note: 'Private behaviour note',
          visibility: 'Sensitive',
        }),
        expect.objectContaining({
          type: 'Demerit',
          note: 'Own private demerit',
          visibility: 'Sensitive',
        }),
        expect.objectContaining({
          type: 'Merit',
          note: 'Helped a younger student',
          visibility: 'General',
        }),
      ]),
    );

    const hodResult = await makeCaller(hodUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(hodResult.entries).toEqual(headResult.entries);

    const principalResult = await makeCaller(principalUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(principalResult.entries).toEqual(headResult.entries);
  });

  it('returns no daily activity for Supervisor when no shift is assigned', async () => {
    const { db } = makeFakeDb({ supervisorHasShift: false });
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      amount: 4,
    });

    await expect(
      makeCaller(supervisorUser, db).behaviour.dashboardActivity({
        date: new Date('2026-04-29T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ entries: [] });

    await expect(
      makeCaller(supervisorUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows tagged Supervisors to log and read all-student behaviour without a shift', async () => {
    const { db } = makeFakeDb({ supervisorHasShift: false });
    await makeCaller(headUser, db).behaviour.log({
      studentId: secondaryStudentId,
      type: 'Demerit',
      category: 'Safeguarding',
      note: 'Sensitive head note',
      visibility: 'Sensitive',
    });

    await expect(
      makeCaller(allStudentsSupervisorUser, db).behaviour.log({
        studentId: secondaryStudentId,
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).resolves.toMatchObject({
      studentId: secondaryStudentId,
      type: 'Merit',
      meritDelta: 1,
    });

    const result = await makeCaller(allStudentsSupervisorUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(result.entries).toEqual([
      expect.objectContaining({
        studentId: secondaryStudentId,
        type: 'Merit',
        visibility: 'General',
      }),
    ]);
  });

  it('allows ClubsAdmin users to log and read assigned-band behaviour like supervisors', async () => {
    const { db } = makeFakeDb();

    await makeCaller(clubsUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Service',
      note: 'Helped tidy club equipment',
      visibility: 'General',
      amount: 3,
    });

    const result = await makeCaller(clubsUser, db).behaviour.recentEntries({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        type: 'Merit',
        category: 'Service',
        note: 'Helped tidy club equipment',
        recordedById: clubsUser.id,
        recordedByName: 'Clubs Admin User',
      }),
    ]);
  });
});
