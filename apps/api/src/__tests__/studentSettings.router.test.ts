import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import {
  createStudentSettingsRouter,
  type StudentCredentialAdapter,
} from '../routers/studentSettings.js';
import { router } from '../trpc.js';

const parentUser: SessionUser = {
  id: 'user_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const otherParentUser: SessionUser = {
  id: 'user_other_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const studentUser: SessionUser = {
  id: 'user_student',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const adultStudentUser: SessionUser = {
  id: 'user_adult_student',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const headUser: SessionUser = {
  id: 'user_head',
  role: 'Head',
  tags: [],
  requires2fa: false,
};

const childStudentId = 'student_child';
const adultStudentId = 'student_adult';
const unlinkedStudentId = 'student_unlinked';

interface StoredUser {
  id: string;
  clerkId: string;
}

interface StoredStudent {
  id: string;
  userId: string | null;
  fullNameEnc: string;
  dobEnc: string;
  yearGroup: string;
  active: boolean;
  user: StoredUser | null;
}

interface StoredSettings {
  id: string;
  studentId: string;
  loginHandleEnc: string | null;
  loginHandleBidx: string | null;
  studentCanManagePassword: boolean;
  hourlyUsageLimitMinutes: number | null;
  dailyUsageLimitMinutes: number | null;
  weeklyUsageLimitMinutes: number | null;
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
  settingsUpdatedById: string | null;
  settingsUpdatedAt: Date | null;
  parentLockUpdatedById: string | null;
  parentLockUpdatedAt: Date | null;
  headLockUpdatedById: string | null;
  headLockUpdatedAt: Date | null;
  shopBlockUpdatedById: string | null;
  shopBlockUpdatedAt: Date | null;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
    blindIndex: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentPortalSettings: {
    upsert: ReturnType<typeof vi.fn>;
  };
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

function makeSettings(studentId: string, overrides: Partial<StoredSettings> = {}): StoredSettings {
  return {
    id: `settings_${studentId}`,
    studentId,
    loginHandleEnc: null,
    loginHandleBidx: null,
    studentCanManagePassword: false,
    hourlyUsageLimitMinutes: null,
    dailyUsageLimitMinutes: null,
    weeklyUsageLimitMinutes: null,
    parentAccountLocked: false,
    parentLockReasonEnc: null,
    headAcademicLocked: false,
    headAcademicLockReasonEnc: null,
    parentMeritShopBlocked: false,
    settingsUpdatedById: null,
    settingsUpdatedAt: null,
    parentLockUpdatedById: null,
    parentLockUpdatedAt: null,
    headLockUpdatedById: null,
    headLockUpdatedAt: null,
    shopBlockUpdatedById: null,
    shopBlockUpdatedAt: null,
    ...overrides,
  };
}

function makeFakeDb() {
  const users: StoredUser[] = [
    { id: studentUser.id, clerkId: 'clerk_student' },
    { id: adultStudentUser.id, clerkId: 'clerk_adult_student' },
  ];
  const students: StoredStudent[] = [
    {
      id: childStudentId,
      userId: studentUser.id,
      user: users[0] ?? null,
      fullNameEnc: encrypt('Jamie Learner') ?? '',
      dobEnc: encrypt('2010-06-04') ?? '',
      yearGroup: 'Year 6',
      active: true,
    },
    {
      id: adultStudentId,
      userId: adultStudentUser.id,
      user: users[1] ?? null,
      fullNameEnc: encrypt('Adult Learner') ?? '',
      dobEnc: encrypt('2007-06-03') ?? '',
      yearGroup: 'Year 13',
      active: true,
    },
    {
      id: unlinkedStudentId,
      userId: null,
      user: null,
      fullNameEnc: encrypt('Unlinked Learner') ?? '',
      dobEnc: encrypt('2011-01-01') ?? '',
      yearGroup: 'Year 5',
      active: true,
    },
  ];
  const guardianLinks = [
    { userId: parentUser.id, studentId: childStudentId },
    { userId: parentUser.id, studentId: adultStudentId },
    { userId: otherParentUser.id, studentId: unlinkedStudentId },
  ];
  const settings = new Map<string, StoredSettings>();

  function withSettings(student: StoredStudent) {
    return {
      ...student,
      portalSettings: settings.get(student.id) ?? null,
    };
  }

  function linkedStudentIds(userId: string): string[] {
    return guardianLinks.filter((link) => link.userId === userId).map((link) => link.studentId);
  }

  const db: FakeDb = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
      blindIndex: vi.fn(blindIndex),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    student: {
      findMany: vi.fn(({ where }: { where?: { guardians?: { some?: { userId?: string } } } }) => {
        const ids =
          where?.guardians?.some?.userId === undefined
            ? students.map((student) => student.id)
            : linkedStudentIds(where.guardians.some.userId);
        return Promise.resolve(
          students
            .filter((student) => student.active && ids.includes(student.id))
            .map(withSettings),
        );
      }),
      findFirst: vi.fn(
        ({ where }: { where: { id?: string; guardians?: { some?: { userId?: string } } } }) => {
          const student = students.find(
            (candidate) => candidate.id === where.id && candidate.active,
          );
          if (!student) return Promise.resolve(null);
          if (where.guardians?.some?.userId !== undefined) {
            const allowedIds = linkedStudentIds(where.guardians.some.userId);
            if (!allowedIds.includes(student.id)) return Promise.resolve(null);
          }
          return Promise.resolve(withSettings(student));
        },
      ),
      findUnique: vi.fn(({ where }: { where: { userId?: string } }) => {
        const student = students.find(
          (candidate) => where.userId !== undefined && candidate.userId === where.userId,
        );
        return Promise.resolve(student ? withSettings(student) : null);
      }),
    },
    studentPortalSettings: {
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { studentId: string };
          create: Partial<StoredSettings>;
          update: Partial<StoredSettings>;
        }) => {
          const existing = settings.get(where.studentId);
          if (existing) {
            const next = { ...existing, ...update };
            settings.set(where.studentId, next);
            return Promise.resolve(next);
          }
          const next = makeSettings(where.studentId, create);
          settings.set(where.studentId, next);
          return Promise.resolve(next);
        },
      ),
    },
  };

  return { db, settings };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(
  user: SessionUser | null,
  db: FakeDb,
  credentialAdapter: StudentCredentialAdapter = { setPassword: vi.fn() },
) {
  const appRouter = router({
    studentSettings: createStudentSettingsRouter({ credentialAdapter }),
  });
  return appRouter.createCaller(makeCtx(user, db));
}

interface AuditCall {
  data: {
    userId?: string;
    action?: string;
    entity?: string;
    entityId?: string | null;
    meta?: { source?: string };
  };
}

function auditCalls(db: FakeDb): AuditCall[] {
  return db.auditLog.create.mock.calls.map(([input]) => input as AuditCall);
}

describe('studentSettings parent procedures', () => {
  it('lists linked children with decrypted settings summaries', async () => {
    const { db, settings } = makeFakeDb();
    settings.set(
      childStudentId,
      makeSettings(childStudentId, {
        loginHandleEnc: encrypt('jamie.login'),
        dailyUsageLimitMinutes: 90,
      }),
    );
    const caller = makeCaller(parentUser, db);

    await expect(caller.studentSettings.listLinkedChildren()).resolves.toEqual([
      expect.objectContaining({
        studentId: childStudentId,
        fullName: 'Jamie Learner',
        loginHandle: 'jamie.login',
        dailyUsageLimitMinutes: 90,
        parentControlAllowed: true,
      }),
      expect.objectContaining({
        studentId: adultStudentId,
        fullName: 'Adult Learner',
        parentControlAllowed: false,
      }),
    ]);
  });

  it('allows parents to update usage limits for linked under-18 children only', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(parentUser, db);

    await expect(
      caller.studentSettings.setUsageLimits({
        studentId: childStudentId,
        hourlyUsageLimitMinutes: 30,
        dailyUsageLimitMinutes: 120,
        weeklyUsageLimitMinutes: null,
      }),
    ).resolves.toMatchObject({
      studentId: childStudentId,
      hourlyUsageLimitMinutes: 30,
      dailyUsageLimitMinutes: 120,
      weeklyUsageLimitMinutes: null,
    });

    await expect(
      caller.studentSettings.setUsageLimits({
        studentId: adultStudentId,
        dailyUsageLimitMinutes: 60,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.studentSettings.setUsageLimits({
        studentId: unlinkedStudentId,
        dailyUsageLimitMinutes: 60,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(
      auditCalls(db).some(
        (call) =>
          call.data.userId === parentUser.id &&
          call.data.action === 'Update' &&
          call.data.entity === 'StudentPortalSettings' &&
          call.data.entityId === childStudentId &&
          call.data.meta?.source === 'studentSettings.setUsageLimits',
      ),
    ).toBe(true);
  });

  it('updates login handles without storing raw handles in audit metadata', async () => {
    const { db, settings } = makeFakeDb();
    const caller = makeCaller(parentUser, db);

    await caller.studentSettings.setLoginHandle({
      studentId: childStudentId,
      loginHandle: '  Jamie.Login  ',
    });

    expect(settings.get(childStudentId)).toMatchObject({
      loginHandleEnc: 'enc:Jamie.Login',
      loginHandleBidx: 'bidx:jamie.login',
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('Jamie.Login');
  });

  it('allows linked parents to pass password resets through the credential adapter only for under-18 children', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = { setPassword };
    const caller = makeCaller(parentUser, db, credentialAdapter);

    await expect(
      caller.studentSettings.setChildPassword({
        studentId: childStudentId,
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      caller.studentSettings.setChildPassword({
        studentId: adultStudentId,
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(setPassword).toHaveBeenCalledWith({
      clerkUserId: 'clerk_student',
      password: 'correct horse battery staple',
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(
      'correct horse battery staple',
    );
  });
});

describe('studentSettings student and Head procedures', () => {
  it('lets under-18 students set their own password only when parent policy allows it', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = { setPassword };
    const studentCaller = makeCaller(studentUser, db, credentialAdapter);

    await expect(
      studentCaller.studentSettings.setMyPassword({ password: 'student password 123' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const parentCaller = makeCaller(parentUser, db, credentialAdapter);
    await parentCaller.studentSettings.setPasswordControl({
      studentId: childStudentId,
      studentCanManagePassword: true,
    });

    await expect(
      studentCaller.studentSettings.setMyPassword({ password: 'student password 123' }),
    ).resolves.toEqual({ ok: true });
    expect(setPassword).toHaveBeenLastCalledWith({
      clerkUserId: 'clerk_student',
      password: 'student password 123',
    });
  });

  it('lets adult students control their own password without parent policy', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = { setPassword };
    const caller = makeCaller(adultStudentUser, db, credentialAdapter);

    await expect(
      caller.studentSettings.setMyPassword({ password: 'adult password 123' }),
    ).resolves.toEqual({ ok: true });
    expect(setPassword).toHaveBeenCalledWith({
      clerkUserId: 'clerk_adult_student',
      password: 'adult password 123',
    });
  });

  it('restricts academic locks to Head users', async () => {
    const { db, settings } = makeFakeDb();
    const parentCaller = makeCaller(parentUser, db);
    await expect(
      parentCaller.studentSettings.setHeadAcademicLock({
        studentId: childStudentId,
        locked: true,
        reason: 'PACE correction needed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const headCaller = makeCaller(headUser, db);
    await expect(
      headCaller.studentSettings.setHeadAcademicLock({
        studentId: childStudentId,
        locked: true,
        reason: 'PACE correction needed',
      }),
    ).resolves.toMatchObject({
      studentId: childStudentId,
      effectiveLock: {
        locked: true,
        primarySource: 'HeadAcademic',
        sources: ['HeadAcademic'],
      },
    });
    expect(settings.get(childStudentId)).toMatchObject({
      headAcademicLocked: true,
      headAcademicLockReasonEnc: 'enc:PACE correction needed',
    });
  });
});
