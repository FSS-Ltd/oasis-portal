import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { clubRouter } from '../routers/club.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'chead000000000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const clubsAdminUser: SessionUser = {
  id: 'cclubsadmin0000000001',
  role: 'ClubsAdmin',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'cparent000000000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const otherParentUser: SessionUser = {
  id: 'cparent000000000000002',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'csupervisor00000000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const technicalSupportUser: SessionUser = {
  id: 'csupport0000000000001',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'cstudentuser0000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

type ClubSignupStatus = 'Active' | 'Withdrawn';

interface StoredClub {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  capacity: number | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStudent {
  id: string;
  fullNameEnc: string;
  yearGroup: string;
  active: boolean;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredSignup {
  id: string;
  clubId: string;
  studentId: string;
  signedUpByUserId: string;
  status: ClubSignupStatus;
  createdAt: Date;
  withdrawnAt: Date | null;
}

interface FakeClubFindManyArgs {
  where?: { active?: boolean };
  include?: FakeClubInclude;
}

interface FakeClubFindUniqueArgs {
  where: { id: string };
  include?: FakeClubInclude;
  select?: { id?: true };
}

interface FakeClubInclude {
  signups?: {
    where?: { status?: ClubSignupStatus };
    select?: { studentId?: true };
    include?: { student?: { select: { id: true; fullNameEnc: true; yearGroup: true } } };
    orderBy?: { createdAt: 'desc' };
  };
}

interface FakeClubCreateArgs {
  data: {
    name: string;
    description: string | null;
    schedule: string | null;
    capacity: number | null;
    active: boolean;
    createdById: string;
  };
  include: FakeClubInclude;
}

interface FakeClubUpdateArgs {
  where: { id: string };
  data: Partial<Pick<StoredClub, 'name' | 'description' | 'schedule' | 'capacity' | 'active'>>;
  include: FakeClubInclude;
}

interface FakeSignupCreateArgs {
  data: {
    clubId: string;
    studentId: string;
    signedUpByUserId: string;
    status: ClubSignupStatus;
  };
}

interface FakeSignupFindFirstArgs {
  where: {
    clubId: string;
    studentId: string;
    status: ClubSignupStatus;
  };
}

interface FakeSignupUpdateArgs {
  where: { id: string };
  data: Pick<StoredSignup, 'status' | 'withdrawnAt'>;
}

interface FakeStudentFindUniqueArgs {
  where: { id: string };
}

interface FakeGuardianFindManyArgs {
  where: { userId: string; student?: { active?: boolean } };
}

interface FakeGuardianFindUniqueArgs {
  where: { userId_studentId: { userId: string; studentId: string } };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string;
    action: 'Create' | 'Update' | 'DecryptPii';
    entity: 'Club' | 'ClubSignup' | 'Student';
    entityId?: string | null;
    meta?: Record<string, unknown>;
  };
}

interface FakeDb {
  $enc: {
    decrypt: (value: string | null | undefined) => string | null;
  };
  $transaction: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  club: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  clubSignup: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  student: { findUnique: ReturnType<typeof vi.fn> };
  guardian: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  clubs: StoredClub[];
  students: StoredStudent[];
  guardians: StoredGuardian[];
  signups: StoredSignup[];
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeClub(input: Partial<StoredClub> & Pick<StoredClub, 'id' | 'name'>): StoredClub {
  return {
    description: null,
    schedule: null,
    capacity: null,
    active: true,
    createdById: headUser.id,
    createdAt: new Date('2026-05-11T08:00:00.000Z'),
    updatedAt: new Date('2026-05-11T08:00:00.000Z'),
    ...input,
  };
}

function makeStudent(
  input: Partial<StoredStudent> & Pick<StoredStudent, 'id' | 'fullNameEnc'>,
): StoredStudent {
  return {
    yearGroup: 'Year 7',
    active: true,
    ...input,
  };
}

function makeSignup(input: Partial<StoredSignup> & Pick<StoredSignup, 'id' | 'clubId' | 'studentId'>) {
  return {
    signedUpByUserId: parentUser.id,
    status: 'Active',
    createdAt: new Date('2026-05-11T09:00:00.000Z'),
    withdrawnAt: null,
    ...input,
  } satisfies StoredSignup;
}

const defaultClubId = 'cclub000000000000000001';
const inactiveClubId = 'cclub000000000000000002';
const linkedStudentId = 'cstudent000000000000001';
const otherStudentId = 'cstudent000000000000002';

function makeFakeDb(input: {
  clubs?: StoredClub[];
  students?: StoredStudent[];
  guardians?: StoredGuardian[];
  signups?: StoredSignup[];
} = {}): FakeDb {
  const clubs = input.clubs ?? [
    makeClub({ id: defaultClubId, name: 'Choir', capacity: 2 }),
    makeClub({ id: inactiveClubId, name: 'Chess', active: false }),
  ];
  const students = input.students ?? [
    makeStudent({ id: linkedStudentId, fullNameEnc: encrypt('Linked Learner') }),
    makeStudent({ id: otherStudentId, fullNameEnc: encrypt('Other Learner'), yearGroup: 'Year 8' }),
  ];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
  const signups = input.signups ?? [];

  const db = {
    $enc: { decrypt },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    club: {
      findMany: vi.fn((args: FakeClubFindManyArgs = {}) =>
        Promise.resolve(
          clubs
            .filter((club) => args.where?.active === undefined || club.active === args.where.active)
            .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
            .map((club) => withIncludedSignups(club, args.include, signups, students)),
        ),
      ),
      findUnique: vi.fn((args: FakeClubFindUniqueArgs) => {
        const club = clubs.find((candidate) => candidate.id === args.where.id);
        if (!club) return Promise.resolve(null);
        if (args.select?.id) return Promise.resolve({ id: club.id });
        return Promise.resolve(withIncludedSignups(club, args.include, signups, students));
      }),
      create: vi.fn((args: FakeClubCreateArgs) => {
        const club: StoredClub = {
          id: `cclubcreated000000000${String(clubs.length + 1).padStart(3, '0')}`,
          createdAt: new Date('2026-05-11T10:00:00.000Z'),
          updatedAt: new Date('2026-05-11T10:00:00.000Z'),
          ...args.data,
        };
        clubs.push(club);
        return Promise.resolve(withIncludedSignups(club, args.include, signups, students));
      }),
      update: vi.fn((args: FakeClubUpdateArgs) => {
        const index = clubs.findIndex((club) => club.id === args.where.id);
        if (index === -1) throw new Error('club not found');
        const current = clubs[index];
        if (!current) throw new Error('club not found');
        const updated: StoredClub = {
          ...current,
          ...args.data,
          updatedAt: new Date('2026-05-11T11:00:00.000Z'),
        };
        clubs[index] = updated;
        return Promise.resolve(withIncludedSignups(updated, args.include, signups, students));
      }),
    },
    clubSignup: {
      create: vi.fn((args: FakeSignupCreateArgs) => {
        const activeDuplicate = signups.some(
          (signup) =>
            signup.clubId === args.data.clubId &&
            signup.studentId === args.data.studentId &&
            signup.status === 'Active',
        );
        if (activeDuplicate) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        const signup: StoredSignup = {
          id: `csignup000000000000${String(signups.length + 1).padStart(5, '0')}`,
          createdAt: new Date('2026-05-11T12:00:00.000Z'),
          withdrawnAt: null,
          ...args.data,
        };
        signups.push(signup);
        return Promise.resolve(signup);
      }),
      findFirst: vi.fn((args: FakeSignupFindFirstArgs) =>
        Promise.resolve(
          signups.find(
            (signup) =>
              signup.clubId === args.where.clubId &&
              signup.studentId === args.where.studentId &&
              signup.status === args.where.status,
          ) ?? null,
        ),
      ),
      update: vi.fn((args: FakeSignupUpdateArgs) => {
        const signup = signups.find((candidate) => candidate.id === args.where.id);
        if (!signup) throw new Error('signup not found');
        signup.status = args.data.status;
        signup.withdrawnAt = args.data.withdrawnAt;
        return Promise.resolve(signup);
      }),
    },
    student: {
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) =>
        Promise.resolve(students.find((student) => student.id === args.where.id) ?? null),
      ),
    },
    guardian: {
      findMany: vi.fn((args: FakeGuardianFindManyArgs) =>
        Promise.resolve(
          guardians
            .filter((guardian) => guardian.userId === args.where.userId)
            .filter((guardian) => {
              const student = students.find((candidate) => candidate.id === guardian.studentId);
              return args.where.student?.active === undefined || student?.active === args.where.student.active;
            })
            .map((guardian) => ({ studentId: guardian.studentId })),
        ),
      ),
      findUnique: vi.fn((args: FakeGuardianFindUniqueArgs) => {
        const guardian = guardians.find(
          (candidate) =>
            candidate.userId === args.where.userId_studentId.userId &&
            candidate.studentId === args.where.userId_studentId.studentId,
        );
        if (!guardian) return Promise.resolve(null);
        const student = students.find((candidate) => candidate.id === guardian.studentId);
        if (!student) return Promise.resolve(null);
        return Promise.resolve({ student: { id: student.id, active: student.active } });
      }),
    },
    clubs,
    students,
    guardians,
    signups,
  } satisfies FakeDb;

  db.$transaction.mockImplementation(async <T>(fn: (tx: FakeDb) => Promise<T>) => fn(db));

  return db;
}

function withIncludedSignups(
  club: StoredClub,
  include: FakeClubInclude | undefined,
  signups: StoredSignup[],
  students: StoredStudent[],
) {
  if (!include?.signups) return club;
  const status = include.signups.where?.status;
  const clubSignups = signups
    .filter((signup) => signup.clubId === club.id && (!status || signup.status === status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((signup) => ({
      ...signup,
      student: students.find((student) => student.id === signup.studentId),
    }));

  return { ...club, signups: clubSignups };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ club: clubRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function auditEntities(db: FakeDb): Array<{ action: string; entity: string; entityId: string | null }> {
  return db.auditLog.create.mock.calls.map(([args]) => {
    const audit = args as FakeAuditCreateArgs;
    return {
      action: audit.data.action,
      entity: audit.data.entity,
      entityId: audit.data.entityId ?? null,
    };
  });
}

describe('club management', () => {
  it('allows full-admin and ClubsAdmin users to create, update, and deactivate clubs', async () => {
    const { caller: headCaller, db } = makeCaller(headUser);
    const created = await headCaller.club.create({
      name: '  Coding Club  ',
      description: '  Tuesdays  ',
      schedule: '  15:30  ',
      capacity: 12,
    });

    expect(created).toMatchObject({
      name: 'Coding Club',
      description: 'Tuesdays',
      schedule: '15:30',
      capacity: 12,
      active: true,
      activeSignupCount: 0,
    });

    const clubsAdminCaller = makeCaller(clubsAdminUser, db).caller;
    await expect(
      clubsAdminCaller.club.update({
        id: created.id,
        name: 'STEM Club',
        description: null,
        schedule: null,
        capacity: null,
      }),
    ).resolves.toMatchObject({
      name: 'STEM Club',
      description: null,
      schedule: null,
      capacity: null,
    });

    await expect(
      clubsAdminCaller.club.update({ id: created.id, active: false }),
    ).resolves.toMatchObject({ active: false });

    expect(auditEntities(db)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'Create', entity: 'Club', entityId: created.id }),
        expect.objectContaining({ action: 'Update', entity: 'Club', entityId: created.id }),
      ]),
    );
  });

  it.each([parentUser, supervisorUser, studentUser, technicalSupportUser])(
    'blocks %s from managing clubs',
    async (user) => {
      const { caller } = makeCaller(user);

      await expect(caller.club.create({ name: 'Choir' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );

  it('prevents lowering capacity below the active signup count', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({ id: 'csignup000000000000001', clubId: defaultClubId, studentId: linkedStudentId }),
        makeSignup({ id: 'csignup000000000000002', clubId: defaultClubId, studentId: otherStudentId }),
      ],
    });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.club.update({ id: defaultClubId, capacity: 1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'capacity cannot be below active signup count',
    });
  });
});

describe('club.list', () => {
  it('returns all clubs for club managers and active clubs with own signup state for parents', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({ id: 'csignup000000000000001', clubId: defaultClubId, studentId: linkedStudentId }),
        makeSignup({ id: 'csignup000000000000002', clubId: defaultClubId, studentId: otherStudentId }),
        makeSignup({
          id: 'csignup000000000000003',
          clubId: inactiveClubId,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(makeCaller(headUser, db).caller.club.list()).resolves.toHaveLength(2);
    await expect(makeCaller(clubsAdminUser, db).caller.club.list()).resolves.toHaveLength(2);
    await expect(makeCaller(parentUser, db).caller.club.list()).resolves.toEqual([
      expect.objectContaining({
        id: defaultClubId,
        active: true,
        activeSignupCount: 2,
        signedUpStudentIds: [linkedStudentId],
      }),
    ]);
  });

  it.each([supervisorUser, studentUser, technicalSupportUser])(
    'blocks %s from listing clubs',
    async (user) => {
      await expect(makeCaller(user).caller.club.list()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );
});

describe('club.signUp', () => {
  it('allows a parent to sign up their linked active child and audits the signup', async () => {
    const { caller, db } = makeCaller(parentUser);

    const signup = await caller.club.signUp({ clubId: defaultClubId, studentId: linkedStudentId });

    expect(signup).toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      signedUpByUserId: parentUser.id,
      status: 'Active',
    });
    expect(auditEntities(db)).toEqual([
      expect.objectContaining({ action: 'Create', entity: 'ClubSignup', entityId: signup.id }),
    ]);
  });

  it('blocks parent signup for an unrelated child', async () => {
    const { caller } = makeCaller(parentUser);

    await expect(
      caller.club.signUp({ clubId: defaultClubId, studentId: otherStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows full-admin users to sign up any active student', async () => {
    const { caller } = makeCaller(headUser);

    await expect(
      caller.club.signUp({ clubId: defaultClubId, studentId: otherStudentId }),
    ).resolves.toMatchObject({
      studentId: otherStudentId,
      signedUpByUserId: headUser.id,
      status: 'Active',
    });
  });

  it('allows re-sign after a withdrawn historical signup', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
          status: 'Withdrawn',
          withdrawnAt: new Date('2026-05-11T13:00:00.000Z'),
        }),
      ],
    });

    await expect(
      makeCaller(parentUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      status: 'Active',
    });
    expect(db.signups).toHaveLength(2);
    expect(db.signups.map((signup) => signup.status)).toEqual(['Withdrawn', 'Active']);
  });

  it('blocks ClubsAdmin users from signing students up', async () => {
    const { caller } = makeCaller(clubsAdminUser);

    await expect(
      caller.club.signUp({ clubId: defaultClubId, studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects duplicate active signups and full clubs', async () => {
    const duplicateDb = makeFakeDb({
      signups: [
        makeSignup({ id: 'csignup000000000000001', clubId: defaultClubId, studentId: linkedStudentId }),
      ],
    });
    await expect(
      makeCaller(parentUser, duplicateDb).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student is already signed up for this club',
    });

    const fullDb = makeFakeDb({
      clubs: [makeClub({ id: defaultClubId, name: 'Choir', capacity: 1 })],
      signups: [
        makeSignup({ id: 'csignup000000000000002', clubId: defaultClubId, studentId: otherStudentId }),
      ],
    });
    await expect(
      makeCaller(parentUser, fullDb).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'club is at capacity',
    });
  });
});

describe('club.withdraw', () => {
  it('withdraws an active linked-child signup without deleting history', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({ id: 'csignup000000000000001', clubId: defaultClubId, studentId: linkedStudentId }),
      ],
    });
    const { caller } = makeCaller(parentUser, db);

    const result = await caller.club.withdraw({ clubId: defaultClubId, studentId: linkedStudentId });

    expect(result).toMatchObject({
      id: 'csignup000000000000001',
      clubId: defaultClubId,
      studentId: linkedStudentId,
      status: 'Withdrawn',
      withdrawn: true,
    });
    expect(result.withdrawnAt).toBeInstanceOf(Date);
    expect(db.signups).toHaveLength(1);
    expect(db.signups[0]).toMatchObject({ status: 'Withdrawn' });
    expect(auditEntities(db)).toEqual([
      expect.objectContaining({
        action: 'Update',
        entity: 'ClubSignup',
        entityId: 'csignup000000000000001',
      }),
    ]);
  });

  it('is idempotent for authorized callers when there is no active signup', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(
      caller.club.withdraw({ clubId: defaultClubId, studentId: linkedStudentId }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      withdrawn: false,
      withdrawnAt: null,
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('denies withdrawal for unrelated parents', async () => {
    const { caller } = makeCaller(otherParentUser);

    await expect(
      caller.club.withdraw({ clubId: defaultClubId, studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('club.roster', () => {
  it('returns minimal active signup student identity and audits PII decrypt', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({ id: 'csignup000000000000001', clubId: defaultClubId, studentId: linkedStudentId }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
          status: 'Withdrawn',
          withdrawnAt: new Date('2026-05-11T13:00:00.000Z'),
        }),
      ],
    });
    const { caller } = makeCaller(clubsAdminUser, db);

    await expect(caller.club.roster({ clubId: defaultClubId })).resolves.toEqual({
      clubId: defaultClubId,
      signups: [
        expect.objectContaining({
          id: 'csignup000000000000001',
          studentId: linkedStudentId,
          studentName: 'Linked Learner',
          yearGroup: 'Year 7',
        }),
      ],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: clubsAdminUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { source: 'club.roster', clubId: defaultClubId, count: 1 },
      },
    });
  });

  it('allows Head users to read club rosters', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({ id: 'csignup000000000000001', clubId: defaultClubId, studentId: linkedStudentId }),
      ],
    });

    await expect(makeCaller(headUser, db).caller.club.roster({ clubId: defaultClubId })).resolves.toEqual({
      clubId: defaultClubId,
      signups: [
        expect.objectContaining({
          id: 'csignup000000000000001',
          studentId: linkedStudentId,
          studentName: 'Linked Learner',
        }),
      ],
    });
  });

  it.each([parentUser, supervisorUser, studentUser, technicalSupportUser])(
    'blocks %s from roster reads',
    async (user) => {
      await expect(makeCaller(user).caller.club.roster({ clubId: defaultClubId })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );
});
