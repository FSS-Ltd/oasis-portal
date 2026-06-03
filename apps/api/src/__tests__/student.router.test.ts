import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { studentRouter } from '../routers/student.js';
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
const studentUser: SessionUser = {
  id: 'ckuserstudent00000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const studentId = 'ckstudent000000000000001';
const subjectId = 'cksubject000000000000001';

interface StoredSubject {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface StoredAssignment {
  id: string;
  studentId: string;
  subjectId: string;
  currentPaceNumber: number;
}

interface StoredStudent {
  id: string;
  userId: string | null;
  fullNameEnc: string;
  nameBidx: string;
  dobEnc: string;
  addressEnc: string | null;
  yearGroup: string;
  enrolmentDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStudentPortalSettings {
  studentId: string;
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
  hourlyUsageLimitMinutes: number | null;
  dailyUsageLimitMinutes: number | null;
  weeklyUsageLimitMinutes: number | null;
}

interface StoredStudentPortalUsageMinute {
  studentId: string;
  minuteStartedAt: Date;
  sessionKey: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface StudentRow extends StoredStudent {
  subjects: Array<StoredAssignment & { subject: StoredSubject }>;
}

type StudentSelect = Partial<Record<keyof StoredStudent, boolean>>;

interface StoredYearGroupBand {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
  active: boolean;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
    blindIndex: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentPortalSettings: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentPortalUsageMinute: {
    count: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  subject: { findUnique: ReturnType<typeof vi.fn> };
  studentSubject: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  staffShift: { findMany: ReturnType<typeof vi.fn> };
}

function encrypt(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function blindIndex(value: string): string {
  return `bidx:${value.trim().toLowerCase()}`;
}

function makeRow(
  student: StoredStudent,
  assignments: StoredAssignment[],
  subjects: StoredSubject[],
): StudentRow {
  return {
    ...student,
    subjects: assignments
      .filter((assignment) => assignment.studentId === student.id)
      .map((assignment) => {
        const subject = subjects.find((candidate) => candidate.id === assignment.subjectId);
        if (!subject) throw new Error('test subject missing');
        return { ...assignment, subject };
      }),
  };
}

function selectedStudent(student: StoredStudent, select: StudentSelect): Partial<StoredStudent> {
  const row: Partial<StoredStudent> = {};
  if (select.id) row.id = student.id;
  if (select.userId) row.userId = student.userId;
  if (select.fullNameEnc) row.fullNameEnc = student.fullNameEnc;
  if (select.nameBidx) row.nameBidx = student.nameBidx;
  if (select.dobEnc) row.dobEnc = student.dobEnc;
  if (select.addressEnc) row.addressEnc = student.addressEnc;
  if (select.yearGroup) row.yearGroup = student.yearGroup;
  if (select.enrolmentDate) row.enrolmentDate = student.enrolmentDate;
  if (select.active) row.active = student.active;
  if (select.createdAt) row.createdAt = student.createdAt;
  if (select.updatedAt) row.updatedAt = student.updatedAt;
  return row;
}

function makePortalSettings(
  input: Partial<StoredStudentPortalSettings> & Pick<StoredStudentPortalSettings, 'studentId'>,
): StoredStudentPortalSettings {
  return {
    parentAccountLocked: false,
    parentLockReasonEnc: null,
    headAcademicLocked: false,
    headAcademicLockReasonEnc: null,
    parentMeritShopBlocked: false,
    hourlyUsageLimitMinutes: null,
    dailyUsageLimitMinutes: null,
    weeklyUsageLimitMinutes: null,
    ...input,
  };
}

function makeUsageMinute(
  input: Partial<StoredStudentPortalUsageMinute> &
    Pick<StoredStudentPortalUsageMinute, 'minuteStartedAt'>,
): StoredStudentPortalUsageMinute {
  return {
    studentId,
    sessionKey: null,
    firstSeenAt: input.minuteStartedAt,
    lastSeenAt: input.minuteStartedAt,
    ...input,
  };
}

function makeFakeDb(
  input: {
    portalSettings?: Array<
      Partial<StoredStudentPortalSettings> & Pick<StoredStudentPortalSettings, 'studentId'>
    >;
    usageMinutes?: Array<
      Partial<StoredStudentPortalUsageMinute> &
        Pick<StoredStudentPortalUsageMinute, 'minuteStartedAt'>
    >;
  } = {},
) {
  const students: StoredStudent[] = [];
  const portalSettings = (input.portalSettings ?? []).map(makePortalSettings);
  const usageMinutes = (input.usageMinutes ?? []).map(makeUsageMinute);
  const subjects: StoredSubject[] = [
    { id: subjectId, code: 'MATH', name: 'Mathematics', active: true },
  ];
  const bands: StoredYearGroupBand[] = [
    {
      id: 'band_upper',
      name: 'Upper Primary',
      standardYears: ['Year 5', 'Year 6'],
      colour: '#5B90C5',
      active: true,
    },
  ];
  const assignments: StoredAssignment[] = [];

  const db: FakeDb = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
      blindIndex: vi.fn(blindIndex),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    student: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<StoredStudent, 'id' | 'userId' | 'active' | 'createdAt' | 'updatedAt'>;
        }) => {
          const now = new Date('2026-04-27T10:00:00.000Z');
          const student: StoredStudent = {
            id: studentId,
            userId: null,
            active: true,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          students.push(student);
          return Promise.resolve(student);
        },
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<StoredStudent> }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Record not found', {
              code: 'P2025',
              clientVersion: 'test',
            }),
          );
        }
        Object.assign(student, data, { updatedAt: new Date('2026-04-27T11:00:00.000Z') });
        return Promise.resolve(student);
      }),
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            active?: boolean;
            id?: { in: string[] };
            nameBidx?: string;
            yearGroup?: { in: string[] };
          };
        }) =>
          Promise.resolve(
            students
              .filter((student) => where?.active === undefined || student.active === where.active)
              .filter((student) => where?.id?.in === undefined || where.id.in.includes(student.id))
              .filter(
                (student) => where?.nameBidx === undefined || student.nameBidx === where.nameBidx,
              )
              .filter(
                (student) =>
                  where?.yearGroup?.in === undefined ||
                  where.yearGroup.in.includes(student.yearGroup),
              )
              .map((student) => makeRow(student, assignments, subjects)),
          ),
      ),
      findUnique: vi.fn(
        ({
          where,
          select,
        }: {
          where: { id?: string; userId?: string };
          select?: StudentSelect;
        }) => {
          const student = students.find(
            (candidate) =>
              (where.id !== undefined && candidate.id === where.id) ||
              (where.userId !== undefined && candidate.userId === where.userId),
          );
          if (!student) return Promise.resolve(null);
          if (select) return Promise.resolve(selectedStudent(student, select));
          return Promise.resolve(makeRow(student, assignments, subjects));
        },
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn(({ where }: { where: { studentId: string } }) =>
        Promise.resolve(
          portalSettings.find((settings) => settings.studentId === where.studentId) ?? null,
        ),
      ),
    },
    studentPortalUsageMinute: {
      count: vi.fn(
        ({ where }: { where: { studentId: string; minuteStartedAt: { gte: Date; lt: Date } } }) =>
          Promise.resolve(
            usageMinutes.filter(
              (minute) =>
                minute.studentId === where.studentId &&
                minute.minuteStartedAt >= where.minuteStartedAt.gte &&
                minute.minuteStartedAt < where.minuteStartedAt.lt,
            ).length,
          ),
      ),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { studentId_minuteStartedAt: { studentId: string; minuteStartedAt: Date } };
          create: StoredStudentPortalUsageMinute;
          update: Partial<Pick<StoredStudentPortalUsageMinute, 'lastSeenAt' | 'sessionKey'>>;
        }) => {
          const existing = usageMinutes.find(
            (minute) =>
              minute.studentId === where.studentId_minuteStartedAt.studentId &&
              minute.minuteStartedAt.getTime() ===
                where.studentId_minuteStartedAt.minuteStartedAt.getTime(),
          );
          if (existing) {
            Object.assign(existing, update);
            return Promise.resolve(existing);
          }
          usageMinutes.push(create);
          return Promise.resolve(create);
        },
      ),
    },
    subject: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(subjects.find((subject) => subject.id === where.id) ?? null),
      ),
    },
    studentSubject: {
      create: vi.fn(({ data }: { data: Omit<StoredAssignment, 'id'> }) => {
        const existing = assignments.find(
          (assignment) =>
            assignment.studentId === data.studentId && assignment.subjectId === data.subjectId,
        );
        if (existing) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          );
        }
        const assignment: StoredAssignment = { id: 'ckassignment000000000001', ...data };
        assignments.push(assignment);
        return Promise.resolve(assignment);
      }),
      delete: vi.fn(
        ({
          where,
        }: {
          where: { studentId_subjectId: { studentId: string; subjectId: string } };
        }) => {
          const index = assignments.findIndex(
            (candidate) =>
              candidate.studentId === where.studentId_subjectId.studentId &&
              candidate.subjectId === where.studentId_subjectId.subjectId,
          );
          if (index === -1) {
            return Promise.reject(
              new Prisma.PrismaClientKnownRequestError('Record not found', {
                code: 'P2025',
                clientVersion: 'test',
              }),
            );
          }
          const [assignment] = assignments.splice(index, 1);
          return Promise.resolve(assignment);
        },
      ),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { studentId_subjectId: { studentId: string; subjectId: string } };
          data: { currentPaceNumber: number };
        }) => {
          const assignment = assignments.find(
            (candidate) =>
              candidate.studentId === where.studentId_subjectId.studentId &&
              candidate.subjectId === where.studentId_subjectId.subjectId,
          );
          if (!assignment) {
            return Promise.reject(
              new Prisma.PrismaClientKnownRequestError('Record not found', {
                code: 'P2025',
                clientVersion: 'test',
              }),
            );
          }
          assignment.currentPaceNumber = data.currentPaceNumber;
          return Promise.resolve(assignment);
        },
      ),
      findUnique: vi.fn(
        ({ where }: { where: { studentId_subjectId: { studentId: string; subjectId: string } } }) =>
          Promise.resolve(
            assignments.find(
              (assignment) =>
                assignment.studentId === where.studentId_subjectId.studentId &&
                assignment.subjectId === where.studentId_subjectId.subjectId,
            ) ?? null,
          ),
      ),
    },
    staffShift: {
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            yearGroupBand: bands[0],
          },
        ]),
      ),
    },
  };

  return { db, students, subjects, assignments, portalSettings, usageMinutes };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ student: studentRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

async function createStudent(caller: ReturnType<typeof makeCaller>) {
  return caller.student.create({
    fullName: 'Jane Learner',
    dob: new Date('2014-02-03T00:00:00.000Z'),
    yearGroup: 'Year 6',
    enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
    address: '12 Oasis Road',
  });
}

describe('student router CRUD', () => {
  it('create -> list stores encrypted PII and returns decrypted DTOs with one decrypt audit row', async () => {
    const { db, students } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(createStudent(caller)).resolves.toEqual({ id: studentId });

    expect(students[0]).toMatchObject({
      fullNameEnc: 'enc:Jane Learner',
      nameBidx: 'bidx:jane learner',
      dobEnc: 'enc:2014-02-03',
      addressEnc: 'enc:12 Oasis Road',
    });

    const rows = await caller.student.list({ search: ' Jane Learner ' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: studentId,
      fullName: 'Jane Learner',
      dob: '2014-02-03',
      address: '12 Oasis Road',
      yearGroup: 'Year 6',
      active: true,
      subjects: [],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Student',
        entityId: studentId,
        meta: { yearGroup: 'Year 6' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 1, source: 'student.list' },
      },
    });
  });

  it('allows Supervisor reads but denies Supervisor writes', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);

    const supervisorCaller = makeCaller(supervisorUser, db);
    await expect(supervisorCaller.student.list()).resolves.toHaveLength(1);
    await expect(supervisorCaller.student.byId({ id: studentId })).resolves.toMatchObject({
      id: studentId,
      fullName: 'Jane Learner',
    });

    await expect(createStudent(supervisorCaller)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      supervisorCaller.student.update({ id: studentId, yearGroup: 'Year 7' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      supervisorCaller.student.assignSubject({ studentId, subjectId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      supervisorCaller.student.setCurrentPace({ studentId, subjectId, currentPaceNumber: 1002 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps archived students visible to full-admin includeInactive and byId reads', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await createStudent(caller);

    await expect(caller.student.update({ id: studentId, active: false })).resolves.toEqual({
      id: studentId,
    });
    await expect(caller.student.list()).resolves.toEqual([]);
    await expect(caller.student.list({ includeInactive: true })).resolves.toEqual([
      expect.objectContaining({
        id: studentId,
        fullName: 'Jane Learner',
        active: false,
      }),
    ]);
    await expect(caller.student.byId({ id: studentId })).resolves.toMatchObject({
      id: studentId,
      fullName: 'Jane Learner',
      active: false,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'Student',
        entityId: studentId,
        meta: { fields: ['active'] },
      },
    });
  });

  it('defaults the year group from date of birth when Head does not override it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const { db, students } = makeFakeDb();
      const caller = makeCaller(headUser, db);

      await expect(
        caller.student.create({
          fullName: 'Default Year',
          dob: new Date('2014-08-31T00:00:00.000Z'),
          enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
        }),
      ).resolves.toEqual({ id: studentId });

      expect(students[0]?.yearGroup).toBe('Year 7');
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: headUser.id,
          action: 'Create',
          entity: 'Student',
          entityId: studentId,
          meta: { yearGroup: 'Year 7' },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('student.me', () => {
  it('returns the active student profile linked to the signed-in Student user', async () => {
    const { db, students } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;

    const studentCaller = makeCaller(studentUser, db);

    await expect(studentCaller.student.me()).resolves.toEqual({
      id: studentId,
      userId: studentUser.id,
      fullName: 'Jane Learner',
      yearGroup: 'Year 6',
      enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
      active: true,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: studentUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        entityId: studentId,
        meta: { count: 1, source: 'student.me' },
      },
    });
  });

  it('does not let non-Student roles or unlinked Student accounts load a profile', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(supervisorUser, db).student.me()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'student profile not found',
    });
  });

  it('blocks locked Student users from loading their portal profile', async () => {
    const { db, students } = makeFakeDb({
      portalSettings: [{ studentId, headAcademicLocked: true }],
    });
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;

    await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Student portal is locked by Oasis Learning Centre for academic reasons.',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: studentUser.id,
        action: 'PermissionDenied',
        entity: 'student.me',
        entityId: studentId,
        meta: {
          role: 'Student',
          reason: 'AccountLocked',
          lockSource: 'HeadAcademic',
        },
      },
    });
  });
});

describe('student portal usage limits', () => {
  async function linkCreatedStudent(db: FakeDb, students: StoredStudent[]) {
    await createStudent(makeCaller(headUser, db));
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;
  }

  it('records heartbeat minutes for students without configured limits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students, usageMinutes } = makeFakeDb();
      await linkCreatedStudent(db, students);

      await expect(
        makeCaller(studentUser, db).student.heartbeat({ sessionKey: 'mobile-session-1' }),
      ).resolves.toMatchObject({
        studentId,
        usage: {
          allowed: true,
          blockedWindow: null,
          hourly: { limitMinutes: null, usedMinutes: 1, remainingMinutes: null },
        },
      });
      expect(usageMinutes).toHaveLength(1);
      expect(usageMinutes[0]).toMatchObject({
        studentId,
        minuteStartedAt: new Date('2026-06-03T10:15:00.000Z'),
        sessionKey: 'mobile-session-1',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows student portal access while usage remains under configured limits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students } = makeFakeDb({
        portalSettings: [
          {
            studentId,
            hourlyUsageLimitMinutes: 3,
            dailyUsageLimitMinutes: 10,
            weeklyUsageLimitMinutes: 30,
          },
        ],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-03T10:10:00.000Z') },
          { minuteStartedAt: new Date('2026-06-03T09:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(db, students);

      await expect(makeCaller(studentUser, db).student.me()).resolves.toMatchObject({
        id: studentId,
        fullName: 'Jane Learner',
      });
      await expect(makeCaller(studentUser, db).student.portalUsage()).resolves.toMatchObject({
        studentId,
        usage: {
          allowed: true,
          hourly: { limitMinutes: 3, usedMinutes: 1, remainingMinutes: 2 },
          daily: { limitMinutes: 10, usedMinutes: 2, remainingMinutes: 8 },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks student portal access when the hourly usage limit is reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students } = makeFakeDb({
        portalSettings: [{ studentId, hourlyUsageLimitMinutes: 2 }],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-03T10:05:00.000Z') },
          { minuteStartedAt: new Date('2026-06-03T10:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(db, students);

      await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Hourly student portal usage limit reached.',
      });
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: studentUser.id,
          action: 'PermissionDenied',
          entity: 'student.me',
          entityId: studentId,
          meta: {
            role: 'Student',
            reason: 'UsageLimit',
            usageWindow: 'Hourly',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks student portal access when daily or weekly usage limits are reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const daily = makeFakeDb({
        portalSettings: [{ studentId, dailyUsageLimitMinutes: 2 }],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-03T08:05:00.000Z') },
          { minuteStartedAt: new Date('2026-06-03T09:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(daily.db, daily.students);
      await expect(makeCaller(studentUser, daily.db).student.me()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Daily student portal usage limit reached.',
      });

      const weekly = makeFakeDb({
        portalSettings: [{ studentId, weeklyUsageLimitMinutes: 2 }],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-01T08:05:00.000Z') },
          { minuteStartedAt: new Date('2026-06-02T09:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(weekly.db, weekly.students);
      await expect(makeCaller(studentUser, weekly.db).student.me()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Weekly student portal usage limit reached.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps account locks ahead of usage-limit denials', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students } = makeFakeDb({
        portalSettings: [{ studentId, headAcademicLocked: true, hourlyUsageLimitMinutes: 1 }],
        usageMinutes: [{ minuteStartedAt: new Date('2026-06-03T10:05:00.000Z') }],
      });
      await linkCreatedStudent(db, students);

      await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Student portal is locked by Oasis Learning Centre for academic reasons.',
      });
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: studentUser.id,
          action: 'PermissionDenied',
          entity: 'student.me',
          entityId: studentId,
          meta: {
            role: 'Student',
            reason: 'AccountLocked',
            lockSource: 'HeadAcademic',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('student subject assignment', () => {
  it('assignSubject creates once, is idempotent, and setCurrentPace updates the assignment', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await createStudent(caller);

    await expect(caller.student.assignSubject({ studentId, subjectId })).resolves.toEqual({
      created: true,
      assignmentId: 'ckassignment000000000001',
      currentPaceNumber: 1001,
    });
    await expect(
      caller.student.assignSubject({ studentId, subjectId, currentPaceNumber: 1007 }),
    ).resolves.toEqual({
      created: false,
      assignmentId: 'ckassignment000000000001',
      currentPaceNumber: 1001,
    });
    await expect(
      caller.student.setCurrentPace({ studentId, subjectId, currentPaceNumber: 1008 }),
    ).resolves.toEqual({
      assignmentId: 'ckassignment000000000001',
      currentPaceNumber: 1008,
    });
    await expect(caller.student.unassignSubject({ studentId, subjectId })).resolves.toEqual({
      assignmentId: 'ckassignment000000000001',
      studentId,
      subjectId,
    });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StudentSubject',
        entityId: 'ckassignment000000000001',
        meta: { studentId, subjectId, currentPaceNumber: 1001 },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'StudentSubject',
        entityId: 'ckassignment000000000001',
        meta: { studentId, subjectId, currentPaceNumber: 1008 },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Delete',
        entity: 'StudentSubject',
        entityId: 'ckassignment000000000001',
        meta: {
          studentId,
          subjectId,
          previousPaceNumber: 1008,
          historicalPaceRecordsPreserved: true,
        },
      },
    });
  });

  it('rejects missing student, missing subject, inactive subject, and missing pace assignment', async () => {
    const { db, subjects } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(caller.student.assignSubject({ studentId, subjectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'student not found',
    });

    await createStudent(caller);
    await expect(
      caller.student.assignSubject({ studentId, subjectId: 'cksubjectmissing0000001' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'subject not found' });

    const existingSubject = subjects[0];
    if (!existingSubject) throw new Error('test subject missing');
    subjects[0] = { ...existingSubject, active: false };
    await expect(caller.student.assignSubject({ studentId, subjectId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'subject is inactive',
    });

    await expect(
      caller.student.setCurrentPace({ studentId, subjectId, currentPaceNumber: 1002 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'student subject not found' });
    await expect(caller.student.unassignSubject({ studentId, subjectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'student subject not found',
    });
  });
});
