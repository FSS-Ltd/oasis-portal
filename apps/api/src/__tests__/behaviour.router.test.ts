import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import type { EmailClient } from '../lib/email.js';
import { createBehaviourRouter } from '../routers/behaviour.js';
import { router } from '../trpc.js';
import {
  decryptTestValue as decrypt,
  encryptTestValue as encrypt,
} from './helpers/test-encryption.js';

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
const primarySupervisorUser: SessionUser = {
  id: 'ckusersupprimary0000001',
  role: 'Supervisor',
  tags: ['supervisor-primary-students'],
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
const clubsLeadUser: SessionUser = {
  id: 'ckuserclubslead00000001',
  role: 'ClubsLead',
  tags: [],
  requires2fa: false,
};

const activeStudentId = 'ckstudent000000000000001';
const secondaryStudentId = 'ckstudent000000000000003';
const inactiveStudentId = 'ckstudent000000000000002';
const assignedClubId = 'ckclubassigned000000001';

type BehaviourType = 'Merit' | 'Demerit' | 'General';
type BehaviourVisibility = 'General' | 'Sensitive';

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  ageBandId: string | null;
}

interface StoredUser {
  id: string;
  active: boolean;
  emailEnc: string;
  fullNameEnc: string;
  role: SessionUser['role'];
  parentEmailNotificationsEnabled?: boolean;
  parentEmailNotificationOptOuts?: ('Message' | 'Behaviour' | 'Notice' | 'Club' | 'Report')[];
}

interface StoredGuardian {
  id: string;
  createdAt: Date;
  studentId: string;
  userId: string;
}

interface StoredBehaviour {
  id: string;
  clubId?: string | null;
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

interface StoredDemeritStageOverride {
  id: string;
  studentId: string;
  day: string;
  stage: number;
  noteEnc: string | null;
  setById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredLedgerRow {
  studentId: string;
  account:
    | 'Spend'
    | 'Saving'
    | 'Investment'
    | 'InvestmentReturn'
    | 'TithePaid'
    | 'Given'
    | 'FeeSink'
    | 'ShopReserved';
  delta: number;
  reason: string;
  relatedEntryId?: string;
}

interface StoredClubSignup {
  clubActive: boolean;
  clubId: string;
  status: 'Active' | 'Withdrawn';
  studentId: string;
}

interface StoredClubLeadAssignment {
  clubId: string;
  userId: string;
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
  studentNotification: { createMany: ReturnType<typeof vi.fn> };
  student: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  guardian: { findMany: ReturnType<typeof vi.fn> };
  clubSignup: { findFirst: ReturnType<typeof vi.fn> };
  behaviourEntry: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  demeritStageOverride: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  meritLedger: { createMany: ReturnType<typeof vi.fn> };
  yearGroupBand: { findMany: ReturnType<typeof vi.fn> };
  staffShift: { findMany: ReturnType<typeof vi.fn> };
}

function matchesStudentId(where: string | { in: string[] }, studentId: string): boolean {
  if (typeof where === 'string') return where === studentId;
  return where.in.includes(studentId);
}

function makeStoredUser(input: Pick<StoredUser, 'id' | 'role'> & Partial<StoredUser>): StoredUser {
  return {
    active: true,
    emailEnc: encrypt(`${input.id}@example.com`),
    fullNameEnc: encrypt(`${input.role} User`),
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
    id: allStudentsSupervisorUser.id,
    fullNameEnc: 'enc:All Students Supervisor User',
    role: allStudentsSupervisorUser.role,
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
    id: clubsLeadUser.id,
    fullNameEnc: 'enc:Clubs Lead User',
    role: clubsLeadUser.role,
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
    clubLeadAssignments?: StoredClubLeadAssignment[];
    clubSignups?: StoredClubSignup[];
    guardians?: StoredGuardian[];
    supervisorHasShift?: boolean;
    users?: StoredUser[];
  } = {},
) {
  const supervisorHasShift = options.supervisorHasShift ?? true;
  const students: StoredStudent[] = [
    {
      id: activeStudentId,
      active: true,
      fullNameEnc: 'enc:Jane Learner',
      yearGroup: 'Year 6',
      ageBandId: 'band_upper',
    },
    {
      id: inactiveStudentId,
      active: false,
      fullNameEnc: 'enc:Former Student',
      yearGroup: 'Year 6',
      ageBandId: 'band_upper',
    },
    {
      id: secondaryStudentId,
      active: true,
      fullNameEnc: 'enc:Secondary Student',
      yearGroup: 'Year 8',
      ageBandId: null,
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
  const clubSignups = [...(options.clubSignups ?? [])];
  const clubLeadAssignments = [...(options.clubLeadAssignments ?? [])];
  const behaviour: StoredBehaviour[] = [];
  const demeritStageOverrides: StoredDemeritStageOverride[] = [];
  const ledger: StoredLedgerRow[] = [];

  const db: FakeDb = {
    $transaction: vi.fn(<T>(fn: (tx: FakeDb) => Promise<T>) => fn(db)),
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    studentNotification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    student: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            active?: boolean;
            clubSignups?: {
              some: {
                club: {
                  active?: boolean;
                  id?: string;
                  leadAssignments: { some: { userId: string } };
                };
                status?: 'Active' | 'Withdrawn';
              };
            };
            id?: { in: string[] };
            ageBandId?: { in: string[] };
            yearGroup?: { in: string[] };
          };
        } = {}) =>
          Promise.resolve(
            students.filter((student) => {
              if (where?.active !== undefined && student.active !== where.active) return false;
              if (where?.id?.in !== undefined && !where.id.in.includes(student.id)) return false;
              if (
                where?.ageBandId?.in !== undefined &&
                (student.ageBandId === null || !where.ageBandId.in.includes(student.ageBandId))
              ) {
                return false;
              }
              if (
                where?.yearGroup?.in !== undefined &&
                !where.yearGroup.in.includes(student.yearGroup)
              ) {
                return false;
              }
              if (where?.clubSignups) {
                const signupWhere = where.clubSignups.some;
                const hasAssignedClubSignup = clubSignups.some((signup) => {
                  const hasLeadAssignment = clubLeadAssignments.some(
                    (assignment) =>
                      assignment.clubId === signup.clubId &&
                      assignment.userId === signupWhere.club.leadAssignments.some.userId,
                  );

                  return (
                    signup.studentId === student.id &&
                    (signupWhere.status === undefined || signup.status === signupWhere.status) &&
                    (signupWhere.club.id === undefined || signup.clubId === signupWhere.club.id) &&
                    (signupWhere.club.active === undefined ||
                      signup.clubActive === signupWhere.club.active) &&
                    hasLeadAssignment
                  );
                });
                if (!hasAssignedClubSignup) return false;
              }
              return true;
            }),
          ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) return Promise.resolve(null);
        return Promise.resolve(student);
      }),
    },
    user: {
      findUnique: vi.fn(
        ({ where, select }: { where: { id: string }; select?: { fullNameEnc?: boolean } }) => {
          const user = users.find((candidate) => candidate.id === where.id);
          if (!user) return Promise.resolve(null);
          if (select?.fullNameEnc) return Promise.resolve({ fullNameEnc: user.fullNameEnc });
          return Promise.resolve(user);
        },
      ),
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
    clubSignup: {
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: {
            club?: {
              active?: boolean;
              id?: string;
              leadAssignments?: { some: { userId: string } };
            };
            status?: 'Active' | 'Withdrawn';
            student?: { active?: boolean };
            studentId?: string;
          };
        }) => {
          const signup =
            clubSignups.find((candidate) => {
              const student = students.find((row) => row.id === candidate.studentId);
              const hasLeadAssignment =
                where.club?.leadAssignments === undefined ||
                clubLeadAssignments.some(
                  (assignment) =>
                    assignment.clubId === candidate.clubId &&
                    assignment.userId === where.club?.leadAssignments?.some.userId,
                );

              return (
                (where.studentId === undefined || candidate.studentId === where.studentId) &&
                (where.status === undefined || candidate.status === where.status) &&
                (where.student?.active === undefined || student?.active === where.student.active) &&
                (where.club?.id === undefined || candidate.clubId === where.club.id) &&
                (where.club?.active === undefined || candidate.clubActive === where.club.active) &&
                hasLeadAssignment
              );
            }) ?? null;
          return Promise.resolve(signup ? { clubId: signup.clubId } : null);
        },
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
            student?: {
              active?: boolean;
              clubSignups?: {
                some: {
                  club: {
                    active?: boolean;
                    id?: string;
                    leadAssignments: { some: { userId: string } };
                  };
                  status?: 'Active' | 'Withdrawn';
                };
              };
              id?: { in: string[] };
              yearGroup?: { in: string[] };
            };
            clubId?: string | null;
            studentId?: string | { in: string[] };
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
            .filter(
              (row) =>
                where.studentId === undefined || matchesStudentId(where.studentId, row.studentId),
            )
            .filter((row) => where.clubId === undefined || row.clubId === where.clubId)
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
              if (where.student.active !== undefined && student.active !== where.student.active) {
                return false;
              }
              if (where.student.clubSignups) {
                const signupWhere = where.student.clubSignups.some;
                const hasAssignedClubSignup = clubSignups.some((signup) => {
                  const hasLeadAssignment = clubLeadAssignments.some(
                    (assignment) =>
                      assignment.clubId === signup.clubId &&
                      assignment.userId === signupWhere.club.leadAssignments.some.userId,
                  );

                  return (
                    signup.studentId === student.id &&
                    (signupWhere.status === undefined || signup.status === signupWhere.status) &&
                    (signupWhere.club.id === undefined || signup.clubId === signupWhere.club.id) &&
                    (signupWhere.club.active === undefined ||
                      signup.clubActive === signupWhere.club.active) &&
                    hasLeadAssignment
                  );
                });
                if (!hasAssignedClubSignup) return false;
              }
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
    demeritStageOverride: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            day?: string;
            studentId?: { in: string[] };
          };
        }) =>
          Promise.resolve(
            demeritStageOverrides.filter(
              (override) =>
                (where.day === undefined || override.day === where.day) &&
                (where.studentId === undefined || where.studentId.in.includes(override.studentId)),
            ),
          ),
      ),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { studentId_day: { studentId: string; day: string } };
          create: Omit<StoredDemeritStageOverride, 'id' | 'createdAt' | 'updatedAt'>;
          update: Pick<StoredDemeritStageOverride, 'noteEnc' | 'setById' | 'stage'>;
        }) => {
          const existing = demeritStageOverrides.find(
            (override) =>
              override.studentId === where.studentId_day.studentId &&
              override.day === where.studentId_day.day,
          );
          if (existing) {
            Object.assign(existing, update, {
              updatedAt: new Date('2026-04-29T11:00:00.000Z'),
            });
            return Promise.resolve(existing);
          }
          const rowNumber = String(demeritStageOverrides.length + 1).padStart(2, '0');
          const row: StoredDemeritStageOverride = {
            id: `ckdemeritstage000000${rowNumber}`,
            createdAt: new Date('2026-04-29T10:00:00.000Z'),
            updatedAt: new Date('2026-04-29T10:00:00.000Z'),
            ...create,
          };
          demeritStageOverrides.push(row);
          return Promise.resolve(row);
        },
      ),
    },
    meritLedger: {
      createMany: vi.fn(({ data }: { data: StoredLedgerRow[] }) => {
        ledger.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    yearGroupBand: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: { active?: boolean; name?: { in: string[] } };
        } = {}) =>
          Promise.resolve(
            bands
              .filter((band) => where?.active === undefined || band.active === where.active)
              .filter((band) => where?.name?.in === undefined || where.name.in.includes(band.name)),
          ),
      ),
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

  return {
    db,
    students,
    behaviour,
    demeritStageOverrides,
    ledger,
    guardians,
    users,
    clubSignups,
    clubLeadAssignments,
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    accountAccessState: user ? 'active' : 'unavailable',
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
      meritDelta: -1,
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
        delta: -1,
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

  it('uses selected demerit deductions', async () => {
    const { db, ledger } = makeFakeDb();

    const demerit = await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Disruption',
      visibility: 'General',
      amount: 3,
    });

    expect(demerit).toMatchObject({
      type: 'Demerit',
      meritDelta: -3,
    });
    const honesty = await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Honesty',
      visibility: 'General',
      amount: 1,
    });
    expect(honesty).toMatchObject({
      type: 'Demerit',
      meritDelta: -1,
    });
    expect(ledger).toEqual([
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -3,
        reason: 'Disruption',
        relatedEntryId: 'ckbehaviour000000000001',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -1,
        reason: 'Honesty',
        relatedEntryId: 'ckbehaviour000000000002',
      },
    ]);
  });

  it('defaults legacy demerit deductions when amount is omitted', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).behaviour.log({
        studentId: activeStudentId,
        type: 'Demerit',
        category: 'Honesty',
      }),
    ).resolves.toMatchObject({
      meritDelta: -2,
    });
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
    expect(firstEmail?.text).toContain('Recorded by: Supervisor User');
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

  it('does not email a guardian who opted out of behaviour notifications', async () => {
    const optedOutGuardian = makeStoredUser({
      id: 'ckuserbehaviouroptout001',
      emailEnc: 'enc:behaviour.optout@example.com',
      fullNameEnc: 'enc:Behaviour Opt Out',
      parentEmailNotificationOptOuts: ['Behaviour'],
      role: 'Parent',
    });
    const { db, behaviour } = makeFakeDb({
      guardians: [makeGuardian(optedOutGuardian.id)],
      users: [optedOutGuardian],
    });
    const email = makeFakeEmailClient();

    await makeCaller(supervisorUser, db, email.client).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Kindness',
      visibility: 'General',
      amount: 2,
    });

    expect(behaviour).toHaveLength(1);
    expect(email.send).not.toHaveBeenCalled();
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
    expect(sentEmail?.text).toContain('Recorded by: Supervisor User');
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
    expect(sentEmail?.text).toContain('Recorded by: Supervisor User');
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
        { category: 'Conduct', count: 2 },
        { category: 'Honesty', note: 'Dishonest answer' },
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
        { type: 'Demerit', category: 'Conduct', meritDelta: -1 },
        { type: 'Demerit', category: 'Conduct', meritDelta: -1 },
        { type: 'Demerit', category: 'Honesty', meritDelta: -2 },
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
        delta: -1,
        reason: 'Conduct',
        relatedEntryId: 'ckbehaviour000000000003',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -1,
        reason: 'Conduct',
        relatedEntryId: 'ckbehaviour000000000004',
      },
      {
        studentId: activeStudentId,
        account: 'Spend',
        delta: -2,
        reason: 'Honesty',
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

  it('requires a demerit note when the next demerit reaches Stage 3', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const { db, behaviour } = makeFakeDb();
      const caller = makeCaller(headUser, db);

      for (const category of ['Conduct', 'Diligence', 'Respect', 'Property']) {
        await caller.behaviour.log({
          studentId: activeStudentId,
          type: 'Demerit',
          category,
          visibility: 'General',
        });
      }

      await expect(
        caller.behaviour.log({
          studentId: activeStudentId,
          type: 'Demerit',
          category: 'Conduct',
          visibility: 'General',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'demerit note is required for Stage 3 - Privileges',
      });

      await expect(
        caller.behaviour.log({
          studentId: activeStudentId,
          type: 'Demerit',
          category: 'Conduct',
          note: 'Escalated after repeated disruption',
          visibility: 'General',
        }),
      ).resolves.toMatchObject({ category: 'Conduct', type: 'Demerit' });
      expect(behaviour).toHaveLength(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates one Merit, Demerit, or General entry for each selected student', async () => {
    const { db, behaviour, ledger } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    const merit = await caller.behaviour.logForStudents({
      studentIds: [activeStudentId, secondaryStudentId],
      type: 'Merit',
      category: 'Kindness',
      note: 'Shared resources',
      visibility: 'General',
      amount: 2,
    });
    const demerit = await caller.behaviour.logForStudents({
      studentIds: [activeStudentId, secondaryStudentId],
      type: 'Demerit',
      category: 'Conduct',
      visibility: 'General',
    });
    const general = await caller.behaviour.logForStudents({
      studentIds: [activeStudentId, secondaryStudentId],
      type: 'General',
      note: 'Pastoral update',
      visibility: 'General',
    });

    expect(merit).toMatchObject({
      entries: [{ meritDelta: 2 }, { meritDelta: 2 }],
      ledgerRowCount: 2,
    });
    expect(demerit).toMatchObject({
      entries: [{ meritDelta: -1 }, { meritDelta: -1 }],
      ledgerRowCount: 2,
    });
    expect(general).toMatchObject({
      entries: [{ meritDelta: 0 }, { meritDelta: 0 }],
      ledgerRowCount: 0,
    });
    expect(behaviour).toHaveLength(6);
    expect(ledger).toEqual([
      expect.objectContaining({ studentId: activeStudentId, delta: 2, reason: 'Kindness' }),
      expect.objectContaining({ studentId: secondaryStudentId, delta: 2, reason: 'Kindness' }),
      expect.objectContaining({ studentId: activeStudentId, delta: -1, reason: 'Conduct' }),
      expect.objectContaining({ studentId: secondaryStudentId, delta: -1, reason: 'Conduct' }),
    ]);
  });

  it('requires a demerit note when any selected student would move past Stage 2', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const { db } = makeFakeDb();
      const caller = makeCaller(headUser, db);

      for (const category of ['Conduct', 'Diligence', 'Respect', 'Property']) {
        await caller.behaviour.log({
          studentId: activeStudentId,
          type: 'Demerit',
          category,
          visibility: 'General',
        });
      }

      await expect(
        caller.behaviour.logForStudents({
          studentIds: [activeStudentId, secondaryStudentId],
          type: 'Demerit',
          category: 'Conduct',
          visibility: 'General',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'demerit note is required for Stage 3 - Privileges',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates batch Merit or Demerit rows for each selected student', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    const result = await makeCaller(headUser, db).behaviour.logManyForStudents({
      studentIds: [activeStudentId, secondaryStudentId],
      type: 'Merit',
      entries: [
        { category: 'Kindness', amount: 1, count: 2 },
        { category: 'Leadership', amount: 3 },
      ],
    });

    expect(result.entries).toHaveLength(6);
    expect(result.ledgerRowCount).toBe(6);
    expect(behaviour).toHaveLength(6);
    expect(ledger).toHaveLength(6);
    expect(ledger.filter((row) => row.studentId === activeStudentId)).toHaveLength(3);
    expect(ledger.filter((row) => row.studentId === secondaryStudentId)).toHaveLength(3);
  });

  it('requires notes for batch demerits that move a student past Stage 2', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const { db } = makeFakeDb();
      const caller = makeCaller(headUser, db);

      await expect(
        caller.behaviour.logMany({
          studentId: activeStudentId,
          type: 'Demerit',
          entries: [{ category: 'Conduct', count: 5 }],
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'demerit note is required for Stage 3 - Privileges',
      });

      const result = await caller.behaviour.logMany({
        studentId: activeStudentId,
        type: 'Demerit',
        entries: [{ category: 'Conduct', count: 5, note: 'Repeated disruption' }],
      });
      expect(result.entries).toHaveLength(5);
      expect(result.entries.every((entry) => entry.type === 'Demerit')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects multi-student batches that would create more than 50 total rows', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).behaviour.logManyForStudents({
        studentIds: [activeStudentId, secondaryStudentId],
        type: 'Merit',
        entries: [{ category: 'Kindness', amount: 1, count: 26 }],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'batch cannot create more than 50 entries',
    });

    expect(behaviour).toEqual([]);
    expect(ledger).toEqual([]);
  });

  it('rejects duplicate, inactive, and out-of-scope multi-student submissions before writing', async () => {
    const { db, behaviour, ledger } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).behaviour.logForStudents({
        studentIds: [activeStudentId, activeStudentId],
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'studentIds must be unique' });
    await expect(
      makeCaller(headUser, db).behaviour.logForStudents({
        studentIds: [activeStudentId, inactiveStudentId],
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'student is inactive' });
    await expect(
      makeCaller(supervisorUser, db).behaviour.logForStudents({
        studentIds: [activeStudentId, secondaryStudentId],
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

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
            'Access denied: behaviour workflow requires full-admin, ClubsAdmin, Supervisor, or ClubsLead',
        },
      },
    });
  });

  it('allows ClubsLead users to log General behaviour for active students in assigned clubs only', async () => {
    const { db, behaviour, ledger } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: clubsLeadUser.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });
    const caller = makeCaller(clubsLeadUser, db);

    await expect(
      caller.behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Service',
        note: 'Helped set up club',
        visibility: 'General',
        amount: 2,
      }),
    ).resolves.toMatchObject({
      studentId: activeStudentId,
      type: 'Merit',
      visibility: 'General',
      meritDelta: 2,
      recordedById: clubsLeadUser.id,
    });

    await expect(
      caller.behaviour.log({
        studentId: activeStudentId,
        type: 'General',
        note: 'Good club participation',
        visibility: 'General',
      }),
    ).resolves.toMatchObject({
      studentId: activeStudentId,
      type: 'General',
      visibility: 'General',
      meritDelta: 0,
      recordedById: clubsLeadUser.id,
    });

    expect(behaviour).toHaveLength(2);
    expect(ledger).toEqual([
      expect.objectContaining({ studentId: activeStudentId, delta: 2, reason: 'Service' }),
    ]);
  });

  it('blocks ClubsLead users from Sensitive or unassigned-student behaviour writes', async () => {
    const { db, behaviour, ledger } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: clubsLeadUser.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });
    const caller = makeCaller(clubsLeadUser, db);

    await expect(
      caller.behaviour.log({
        studentId: activeStudentId,
        type: 'Demerit',
        category: 'Conduct',
        note: 'Sensitive club note',
        visibility: 'Sensitive',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.behaviour.log({
        studentId: secondaryStudentId,
        type: 'Merit',
        category: 'Service',
        visibility: 'General',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(behaviour).toEqual([]);
    expect(ledger).toEqual([]);
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
      meritDelta: -1,
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

  it('lets full-admin change a Demerit category and writes the fixed ledger correction', async () => {
    const { db, ledger } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      note: 'Original note',
    });

    await expect(
      caller.behaviour.updateEntry({
        id: created.id,
        category: 'Honesty',
        note: 'Updated demerit note',
        visibility: 'General',
      }),
    ).resolves.toMatchObject({ id: created.id, category: 'Honesty', meritDelta: -2 });

    expect(ledger).toEqual([
      expect.objectContaining({ delta: -1, relatedEntryId: created.id }),
      expect.objectContaining({
        delta: -1,
        reason: 'correction:Honesty',
        relatedEntryId: created.id,
      }),
    ]);
  });

  it('lets full-admin correct a Demerit amount', async () => {
    const { db, ledger } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    const created = await caller.behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      note: 'Original note',
    });

    await expect(
      caller.behaviour.updateEntry({
        id: created.id,
        amount: 2,
      }),
    ).resolves.toMatchObject({ id: created.id, meritDelta: -2 });

    expect(ledger).toEqual([
      expect.objectContaining({ delta: -1, relatedEntryId: created.id }),
      expect.objectContaining({
        delta: -1,
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
      expect.objectContaining({ delta: -1, relatedEntryId: created.id }),
      expect.objectContaining({
        delta: 1,
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

describe('behaviour.dailyDemeritStatuses', () => {
  it('returns green zeroes for active in-scope students', async () => {
    const { db } = makeFakeDb();

    const result = await makeCaller(headUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ date: '2026-04-29' });
    expect(result.statuses).toEqual([
      expect.objectContaining({
        studentId: activeStudentId,
        demeritUnits: 0,
        stage: 0,
        stageLabel: 'No demerits',
        badgeTone: 'green',
        requiresHeadReview: false,
      }),
      expect.objectContaining({
        studentId: secondaryStudentId,
        demeritUnits: 0,
        badgeTone: 'green',
      }),
    ]);
    expect(result.statuses.map((status) => status.studentId)).not.toContain(inactiveStudentId);
  });

  it('totals policy units for the selected day only', async () => {
    const { behaviour, db } = makeFakeDb();
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
    });
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Honesty',
    });
    behaviour.push({
      id: 'ckbehaviourprevious000001',
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      noteEnc: null,
      visibility: 'General',
      meritDelta: -15,
      recordedById: headUser.id,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-04-28T10:00:00.000Z'),
    });

    const result = await makeCaller(headUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });

    expect(result.statuses.find((status) => status.studentId === activeStudentId)).toMatchObject({
      demeritUnits: 3,
      stage: 2,
      badgeTone: 'amber',
      requiresHeadReview: false,
    });
  });

  it('flags counts above Stage 3 for Head review without auto-escalating', async () => {
    const { db } = makeFakeDb();
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      amount: 7,
      note: 'Repeated disruption',
    });

    const result = await makeCaller(headUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });

    expect(result.statuses.find((status) => status.studentId === activeStudentId)).toMatchObject({
      demeritUnits: 7,
      stage: 3,
      stageLabel: 'Stage 3 - Privileges',
      requiresHeadReview: true,
    });
  });

  it('uses Head manual escalation above the count-derived stage', async () => {
    const { db, demeritStageOverrides } = makeFakeDb();
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      amount: 1,
    });

    const escalation = await makeCaller(headUser, db).behaviour.escalateDemeritStage({
      studentIds: [activeStudentId],
      date: new Date('2026-04-29T00:00:00.000Z'),
      stage: 4,
      note: 'Parent contact needed',
    });

    expect(escalation.overrides).toEqual([
      expect.objectContaining({
        studentId: activeStudentId,
        stage: 4,
        stageLabel: 'Stage 4 - Parent Contact',
      }),
    ]);
    expect(demeritStageOverrides).toEqual([
      expect.objectContaining({
        studentId: activeStudentId,
        day: '2026-04-29',
        stage: 4,
        noteEnc: 'enc:Parent contact needed',
        setById: headUser.id,
      }),
    ]);

    const result = await makeCaller(headUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });

    expect(result.statuses.find((status) => status.studentId === activeStudentId)).toMatchObject({
      demeritUnits: 1,
      manualStage: 4,
      stage: 4,
      requiresHeadReview: false,
    });
  });

  it('rejects manual demerit stage escalation that does not increase the current stage', async () => {
    const { db } = makeFakeDb();
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      amount: 5,
      note: 'Stage 3 note',
    });

    await expect(
      makeCaller(headUser, db).behaviour.escalateDemeritStage({
        studentIds: [activeStudentId],
        date: new Date('2026-04-29T00:00:00.000Z'),
        stage: 3,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'manual stage must be above Stage 3 - Privileges',
    });
  });

  it('uses the UK calendar day for daily reset boundaries', async () => {
    const { behaviour, db } = makeFakeDb();
    behaviour.push(
      {
        id: 'ckbehaviourlocalday0001',
        studentId: activeStudentId,
        type: 'Demerit',
        category: 'Conduct',
        noteEnc: null,
        visibility: 'General',
        meritDelta: -1,
        recordedById: headUser.id,
        deletedAt: null,
        deletedById: null,
        createdAt: new Date('2026-04-29T23:30:00.000Z'),
      },
      {
        id: 'ckbehaviourpreviousday1',
        studentId: activeStudentId,
        type: 'Demerit',
        category: 'Conduct',
        noteEnc: null,
        visibility: 'General',
        meritDelta: -1,
        recordedById: headUser.id,
        deletedAt: null,
        deletedById: null,
        createdAt: new Date('2026-04-29T22:30:00.000Z'),
      },
    );

    const result = await makeCaller(headUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.statuses.find((status) => status.studentId === activeStudentId)).toMatchObject({
      demeritUnits: 1,
      stage: 1,
    });
  });

  it('respects Supervisor daily scope while Head and HOD see all active students', async () => {
    const { db } = makeFakeDb();
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
    });
    await makeCaller(headUser, db).behaviour.log({
      studentId: secondaryStudentId,
      type: 'Demerit',
      category: 'Diligence',
    });

    const supervisorResult = await makeCaller(supervisorUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(supervisorResult.statuses).toEqual([
      expect.objectContaining({ studentId: activeStudentId, demeritUnits: 1 }),
    ]);

    const headResult = await makeCaller(headUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    const hodResult = await makeCaller(hodUser, db).behaviour.dailyDemeritStatuses({
      date: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(headResult.statuses.map((status) => status.studentId).sort()).toEqual([
      activeStudentId,
      secondaryStudentId,
    ]);
    expect(hodResult.statuses).toEqual(headResult.statuses);
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

  it('allows tagged Supervisors and ClubsAdmin users to log all-student behaviour without a shift', async () => {
    const { db } = makeFakeDb({ supervisorHasShift: false });
    const allStudentsClubsUser: SessionUser = {
      ...clubsUser,
      tags: ['supervisor-all-students'],
    };
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
    await expect(
      makeCaller(allStudentsClubsUser, db).behaviour.log({
        studentId: secondaryStudentId,
        type: 'Merit',
        category: 'Service',
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
      expect.objectContaining({
        studentId: secondaryStudentId,
        type: 'Merit',
        visibility: 'General',
      }),
    ]);
  });

  it('allows primary-tagged Supervisors to log primary behaviour without exposing secondary students', async () => {
    const { db } = makeFakeDb({ supervisorHasShift: false });
    const caller = makeCaller(primarySupervisorUser, db);

    await expect(
      caller.behaviour.log({
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Kindness',
        amount: 1,
      }),
    ).resolves.toMatchObject({
      studentId: activeStudentId,
      type: 'Merit',
      meritDelta: 1,
    });

    await expect(
      caller.behaviour.log({
        studentId: secondaryStudentId,
        type: 'Merit',
        category: 'Service',
        amount: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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

  it('scopes ClubsLead recent entries to General rows for assigned club students', async () => {
    const { db } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: clubsLeadUser.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });

    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Visible',
      note: 'Assigned club row',
      visibility: 'General',
      amount: 1,
    });
    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Hidden sensitive',
      note: 'Sensitive row',
      visibility: 'Sensitive',
    });
    await makeCaller(headUser, db).behaviour.log({
      studentId: secondaryStudentId,
      type: 'Merit',
      category: 'Hidden unassigned',
      note: 'Unassigned row',
      visibility: 'General',
      amount: 1,
    });

    await expect(
      makeCaller(clubsLeadUser, db).behaviour.recentEntries({
        date: new Date('2026-04-29T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      entries: [
        expect.objectContaining({
          studentId: activeStudentId,
          category: 'Visible',
          visibility: 'General',
        }),
      ],
    });
  });

  it('stores clubId on club-scoped behaviour entries', async () => {
    const { db, behaviour } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: clubsLeadUser.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });

    await expect(
      makeCaller(clubsLeadUser, db).behaviour.log({
        clubId: assignedClubId,
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Leadership',
        visibility: 'General',
        amount: 2,
      }),
    ).resolves.toMatchObject({
      clubId: assignedClubId,
      studentId: activeStudentId,
      category: 'Leadership',
    });
    expect(behaviour[0]).toMatchObject({ clubId: assignedClubId });
  });

  it('allows club-lead tagged users to log only for explicitly assigned clubs', async () => {
    const taggedParentLead: SessionUser = {
      ...parentUser,
      tags: ['club-lead'],
    };
    const { db } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: taggedParentLead.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });
    const caller = makeCaller(taggedParentLead, db).behaviour;

    await expect(
      caller.log({
        clubId: assignedClubId,
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Leadership',
        visibility: 'General',
        amount: 2,
      }),
    ).resolves.toMatchObject({
      studentId: activeStudentId,
      category: 'Leadership',
      recordedById: taggedParentLead.id,
    });

    await expect(
      caller.log({
        clubId: 'ckclubunassigned00000001',
        studentId: activeStudentId,
        type: 'Merit',
        category: 'Leadership',
        visibility: 'General',
        amount: 2,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('filters club-scoped recent entries to rows logged for that club', async () => {
    const { db } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: clubsLeadUser.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });

    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Classroom Merit',
      visibility: 'General',
      amount: 10,
    });
    await makeCaller(clubsLeadUser, db).behaviour.log({
      clubId: assignedClubId,
      studentId: activeStudentId,
      type: 'Merit',
      category: 'Club Merit',
      visibility: 'General',
      amount: 3,
    });

    await expect(
      makeCaller(clubsLeadUser, db).behaviour.recentEntries({
        date: new Date('2026-04-29T00:00:00.000Z'),
        clubId: assignedClubId,
      }),
    ).resolves.toMatchObject({
      entries: [
        expect.objectContaining({
          clubId: assignedClubId,
          category: 'Club Merit',
          meritDelta: 3,
        }),
      ],
    });
  });

  it('filters club-scoped daily demerit statuses to rows logged for that club', async () => {
    const { db } = makeFakeDb({
      clubLeadAssignments: [{ clubId: assignedClubId, userId: clubsLeadUser.id }],
      clubSignups: [
        {
          clubActive: true,
          clubId: assignedClubId,
          status: 'Active',
          studentId: activeStudentId,
        },
      ],
    });

    await makeCaller(headUser, db).behaviour.log({
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Honesty',
      visibility: 'General',
    });
    await makeCaller(clubsLeadUser, db).behaviour.log({
      clubId: assignedClubId,
      studentId: activeStudentId,
      type: 'Demerit',
      category: 'Conduct',
      visibility: 'General',
    });

    await expect(
      makeCaller(clubsLeadUser, db).behaviour.dailyDemeritStatuses({
        date: new Date('2026-04-29T00:00:00.000Z'),
        clubId: assignedClubId,
      }),
    ).resolves.toMatchObject({
      statuses: [
        expect.objectContaining({
          studentId: activeStudentId,
          demeritUnits: 1,
        }),
      ],
    });
  });
});
