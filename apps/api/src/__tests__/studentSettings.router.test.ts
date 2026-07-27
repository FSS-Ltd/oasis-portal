import { createClerkClient } from '@clerk/backend';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import {
  createDefaultStudentCredentialAdapter,
  createStudentSettingsRouter,
  type ChildIconPhotoStorageAdapter,
  type StudentCredentialAdapter,
} from '../routers/studentSettings.js';
import { router } from '../trpc.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(),
}));

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

const supervisorUser: SessionUser = {
  id: 'user_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const unlinkedSupervisorUser: SessionUser = {
  id: 'user_unlinked_supervisor',
  role: 'Supervisor',
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
  emailBidx?: string | null;
  emailEnc?: string | null;
  role?: SessionUser['role'];
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
  dailyUsageLimitMinutes: number | null;
  offLimitWeekdays: number[];
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
  childIconPhotoUrl: string | null;
  childIconPhotoBucket: string | null;
  childIconPhotoPathEnc: string | null;
  childIconPhotoMimeType: string | null;
  childIconPhotoSizeBytes: number | null;
  childIconPhotoUpdatedById: string | null;
  childIconPhotoUpdatedAt: Date | null;
}

interface FakeDb {
  $transaction: ReturnType<typeof vi.fn>;
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
    blindIndex: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  user: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  studentPortalSettings: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  meritLedger: { groupBy: ReturnType<typeof vi.fn> };
  attendance: { groupBy: ReturnType<typeof vi.fn> };
  studentSubject: { findMany: ReturnType<typeof vi.fn> };
  clubSignup: { groupBy: ReturnType<typeof vi.fn> };
  studentPortalUsageMinute: { groupBy: ReturnType<typeof vi.fn> };
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
    dailyUsageLimitMinutes: null,
    offLimitWeekdays: [],
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
    childIconPhotoUrl: null,
    childIconPhotoBucket: null,
    childIconPhotoPathEnc: null,
    childIconPhotoMimeType: null,
    childIconPhotoSizeBytes: null,
    childIconPhotoUpdatedById: null,
    childIconPhotoUpdatedAt: null,
    ...overrides,
  };
}

function makeFakeDb() {
  const users: StoredUser[] = [
    { id: studentUser.id, clerkId: 'clerk_student', role: 'Student' },
    { id: adultStudentUser.id, clerkId: 'clerk_adult_student', role: 'Student' },
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
    { userId: supervisorUser.id, studentId: childStudentId },
    { userId: otherParentUser.id, studentId: unlinkedStudentId },
  ];
  const settings = new Map<string, StoredSettings>();
  const meritLedgerRows = [
    { studentId: childStudentId, delta: 42 },
    { studentId: childStudentId, delta: -7 },
    { studentId: adultStudentId, delta: 12 },
  ];
  const attendanceRows = [
    { studentId: childStudentId, status: 'Present' },
    { studentId: childStudentId, status: 'Present' },
    { studentId: childStudentId, status: 'Late' },
    { studentId: adultStudentId, status: 'Absent' },
  ];
  const studentSubjectRows = [
    {
      studentId: childStudentId,
      currentPaceNumber: 1005,
      subject: { name: 'Maths' },
    },
    {
      studentId: childStudentId,
      currentPaceNumber: 1003,
      subject: { name: 'English' },
    },
  ];
  const clubSignupRows = [
    { studentId: childStudentId, status: 'Active' },
    { studentId: childStudentId, status: 'Withdrawn' },
    { studentId: adultStudentId, status: 'Active' },
  ];
  const usageMinuteRows = [
    { studentId: childStudentId, minuteStartedAt: new Date() },
    { studentId: childStudentId, minuteStartedAt: new Date() },
    { studentId: adultStudentId, minuteStartedAt: new Date() },
  ];

  function withSettings(student: StoredStudent) {
    return {
      ...student,
      user: users.find((user) => user.id === student.userId) ?? null,
      guardians: guardianLinks
        .filter((link) => link.studentId === student.id)
        .map((link) => ({ userId: link.userId })),
      portalSettings: settings.get(student.id) ?? null,
    };
  }

  function linkedStudentIds(userId: string): string[] {
    return guardianLinks.filter((link) => link.userId === userId).map((link) => link.studentId);
  }

  const db: FakeDb = {
    $transaction: vi.fn(async (callback: (tx: FakeDb) => Promise<unknown>) => callback(db)),
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
      blindIndex: vi.fn(blindIndex),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    user: {
      create: vi.fn(
        ({
          data,
          select,
        }: {
          data: {
            clerkId: string;
            emailBidx?: string | null;
            emailEnc?: string | null;
            role: SessionUser['role'];
          };
          select?: { id?: boolean };
        }) => {
          const existing = users.find((candidate) => candidate.clerkId === data.clerkId);
          if (existing) {
            throw new Error(`Unique constraint failed on User.clerkId: ${data.clerkId}`);
          }
          const user: StoredUser = {
            id: `user_created_${String(users.length + 1)}`,
            clerkId: data.clerkId,
            emailBidx: data.emailBidx ?? null,
            emailEnc: data.emailEnc ?? null,
            role: data.role,
          };
          users.push(user);
          return Promise.resolve(select?.id ? { id: user.id } : user);
        },
      ),
      findUnique: vi.fn(
        ({ where }: { where: { clerkId?: string; emailBidx?: string | null; id?: string } }) => {
          const user =
            users.find(
              (candidate) =>
                (where.id !== undefined && candidate.id === where.id) ||
                (where.clerkId !== undefined && candidate.clerkId === where.clerkId) ||
                (where.emailBidx !== undefined &&
                  where.emailBidx !== null &&
                  candidate.emailBidx === where.emailBidx),
            ) ?? null;
          return Promise.resolve(user);
        },
      ),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
          select,
        }: {
          where: { clerkId: string };
          create: {
            clerkId: string;
            emailBidx?: string | null;
            emailEnc?: string | null;
            role: SessionUser['role'];
          };
          update: {
            emailBidx?: string | null;
            emailEnc?: string | null;
            role?: SessionUser['role'];
          };
          select?: { id?: boolean };
        }) => {
          const existing = users.find((candidate) => candidate.clerkId === where.clerkId);
          if (existing) {
            if (update.role !== undefined) existing.role = update.role;
            if (update.emailBidx !== undefined) existing.emailBidx = update.emailBidx;
            if (update.emailEnc !== undefined) existing.emailEnc = update.emailEnc;
            return Promise.resolve(select?.id ? { id: existing.id } : existing);
          }
          const user: StoredUser = {
            id: `user_created_${String(users.length + 1)}`,
            clerkId: create.clerkId,
            emailBidx: create.emailBidx ?? null,
            emailEnc: create.emailEnc ?? null,
            role: create.role,
          };
          users.push(user);
          return Promise.resolve(select?.id ? { id: user.id } : user);
        },
      ),
    },
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
      update: vi.fn(({ where, data }: { where: { id: string }; data: { userId?: string } }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) return Promise.resolve(null);
        if (data.userId !== undefined) student.userId = data.userId;
        return Promise.resolve(withSettings(student));
      }),
    },
    studentPortalSettings: {
      findUnique: vi.fn(
        ({ where }: { where: { studentId?: string; loginHandleBidx?: string | null } }) => {
          if (where.studentId !== undefined)
            return Promise.resolve(settings.get(where.studentId) ?? null);
          if (where.loginHandleBidx !== undefined && where.loginHandleBidx !== null) {
            return Promise.resolve(
              [...settings.values()].find(
                (setting) => setting.loginHandleBidx === where.loginHandleBidx,
              ) ?? null,
            );
          }
          return Promise.resolve(null);
        },
      ),
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
    meritLedger: {
      groupBy: vi.fn(() => {
        const totals = new Map<string, number>();
        for (const row of meritLedgerRows) {
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
    attendance: {
      groupBy: vi.fn(() => {
        const counts = new Map<
          string,
          { studentId: string; status: string; _count: { _all: number } }
        >();
        for (const row of attendanceRows) {
          const key = `${row.studentId}:${row.status}`;
          const current = counts.get(key) ?? {
            studentId: row.studentId,
            status: row.status,
            _count: { _all: 0 },
          };
          current._count._all += 1;
          counts.set(key, current);
        }
        return Promise.resolve([...counts.values()]);
      }),
    },
    studentSubject: {
      findMany: vi.fn(() => Promise.resolve(studentSubjectRows)),
    },
    clubSignup: {
      groupBy: vi.fn(() => {
        const counts = new Map<string, number>();
        for (const row of clubSignupRows) {
          if (row.status !== 'Active') continue;
          counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1);
        }
        return Promise.resolve(
          [...counts.entries()].map(([studentId, count]) => ({
            studentId,
            _count: { _all: count },
          })),
        );
      }),
    },
    studentPortalUsageMinute: {
      groupBy: vi.fn(() => {
        const counts = new Map<string, number>();
        for (const row of usageMinuteRows) {
          counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1);
        }
        return Promise.resolve(
          [...counts.entries()].map(([studentId, count]) => ({
            studentId,
            _count: { _all: count },
          })),
        );
      }),
    },
  };

  return { db, settings, users };
}

function makeCaller(
  user: SessionUser | null,
  db: FakeDb,
  credentialAdapter: StudentCredentialAdapter = {
    createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
    setPassword: vi.fn(),
  },
  childIconPhotoStorage: ChildIconPhotoStorageAdapter = { assertUploadedPhoto: vi.fn() },
) {
  const appRouter = router({
    studentSettings: createStudentSettingsRouter({ childIconPhotoStorage, credentialAdapter }),
  });
  return appRouter.createCaller(makeTestContext({ db, user, rls: { kind: 'db', db } }));
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
  it('creates default Clerk student accounts with legal checks skipped for provisioned logins', async () => {
    const previousSecret = process.env['CLERK_SECRET_KEY'];
    process.env['CLERK_SECRET_KEY'] = 'sk_test_unit';
    const createUser = vi.fn().mockResolvedValue({ id: 'clerk_student_created' });
    const updateUser = vi.fn();
    const deleteUser = vi.fn().mockResolvedValue({ id: 'clerk_student_created' });
    vi.mocked(createClerkClient).mockReturnValue({
      users: { createUser, deleteUser, updateUser },
    } as unknown as ReturnType<typeof createClerkClient>);

    try {
      const adapter = createDefaultStudentCredentialAdapter();
      if (!adapter.createNoEmailStudentAccount) throw new Error('legacy student adapter missing');

      await expect(
        adapter.createNoEmailStudentAccount({
          fullName: 'Unlinked Learner',
          username: 'unlinkedchild',
          password: 'correct horse battery staple',
        }),
      ).resolves.toEqual({ clerkUserId: 'clerk_student_created' });

      expect(createUser).toHaveBeenCalledWith({
        firstName: 'Unlinked',
        lastName: 'Learner',
        username: 'unlinkedchild',
        password: 'correct horse battery staple',
        publicMetadata: { role: 'Student', tags: [] },
        skipLegalChecks: true,
      });

      await adapter.deleteStudentAccount?.({ clerkUserId: 'clerk_student_created' });
      expect(deleteUser).toHaveBeenCalledWith('clerk_student_created');
    } finally {
      if (previousSecret === undefined) {
        delete process.env['CLERK_SECRET_KEY'];
      } else {
        process.env['CLERK_SECRET_KEY'] = previousSecret;
      }
    }
  });

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
        dailyUsageLimitMinutes: 120,
        offLimitWeekdays: [6, 0],
      }),
    ).resolves.toMatchObject({
      studentId: childStudentId,
      dailyUsageLimitMinutes: 120,
      offLimitWeekdays: [0, 6],
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

  it('allows supervisors with linked children to manage under-18 student settings', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(supervisorUser, db);

    await expect(caller.studentSettings.listLinkedChildren()).resolves.toEqual([
      expect.objectContaining({
        studentId: childStudentId,
        fullName: 'Jamie Learner',
        parentControlAllowed: true,
      }),
    ]);

    await expect(
      caller.studentSettings.setMeritShopBlock({
        studentId: childStudentId,
        blocked: true,
      }),
    ).resolves.toMatchObject({
      studentId: childStudentId,
      parentMeritShopBlocked: true,
    });

    expect(
      auditCalls(db).some(
        (call) =>
          call.data.userId === supervisorUser.id &&
          call.data.action === 'Update' &&
          call.data.entity === 'StudentPortalSettings' &&
          call.data.entityId === childStudentId &&
          call.data.meta?.source === 'studentSettings.setMeritShopBlock',
      ),
    ).toBe(true);
  });

  it('allows linked supervisors to upload a child icon photo', async () => {
    const previousSupabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://storage.example';
    try {
      const { db, settings } = makeFakeDb();
      const assertUploadedPhoto = vi.fn().mockResolvedValue(undefined);
      const caller = makeCaller(
        supervisorUser,
        db,
        {
          createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
          setPassword: vi.fn(),
        },
        { assertUploadedPhoto },
      );

      const prepared = await caller.studentSettings.prepareChildIconPhotoUpload({
        studentId: childStudentId,
        photo: {
          fileName: 'jamie.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1234,
        },
      });

      expect(prepared).toMatchObject({
        fileName: 'jamie.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
        storageBucket: 'child-icon-photos',
      });
      expect(prepared.storagePath).toMatch(
        /^student-icons\/user_supervisor\/student_child\/.+-jamie\.jpg$/u,
      );

      await expect(
        caller.studentSettings.updateChildIconPhoto({
          studentId: childStudentId,
          photo: {
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            sizeBytes: prepared.sizeBytes,
            storageBucket: prepared.storageBucket,
            storagePath: prepared.storagePath,
          },
        }),
      ).resolves.toMatchObject({
        studentId: childStudentId,
        childIconPhotoUrl: prepared.publicUrl,
      });

      expect(assertUploadedPhoto).toHaveBeenCalledWith({
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        sizeBytes: prepared.sizeBytes,
        storageBucket: prepared.storageBucket,
        storagePath: prepared.storagePath,
      });
      expect(settings.get(childStudentId)).toMatchObject({
        childIconPhotoUrl: prepared.publicUrl,
        childIconPhotoBucket: 'child-icon-photos',
        childIconPhotoPathEnc: `enc:${prepared.storagePath}`,
        childIconPhotoMimeType: 'image/jpeg',
        childIconPhotoSizeBytes: 1234,
        childIconPhotoUpdatedById: supervisorUser.id,
      });
      expect(
        auditCalls(db).some(
          (call) =>
            call.data.userId === supervisorUser.id &&
            call.data.action === 'Update' &&
            call.data.entity === 'StudentPortalSettings' &&
            call.data.entityId === childStudentId &&
            call.data.meta?.source === 'studentSettings.updateChildIconPhoto',
        ),
      ).toBe(true);
    } finally {
      if (previousSupabaseUrl === undefined) {
        delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
      } else {
        process.env['NEXT_PUBLIC_SUPABASE_URL'] = previousSupabaseUrl;
      }
    }
  });

  it('blocks supervisors from managing unlinked children', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(unlinkedSupervisorUser, db);

    await expect(caller.studentSettings.listLinkedChildren()).resolves.toEqual([]);
    await expect(
      caller.studentSettings.setParentLock({
        studentId: childStudentId,
        locked: true,
        reason: 'Not linked',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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

  it('creates a no-email student login and links it to the child', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi
      .fn()
      .mockResolvedValue({ clerkUserId: 'clerk_unlinked_created' });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: '  UnlinkedChild  ',
        password: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({
      studentId: unlinkedStudentId,
      accountLinked: true,
      loginHandle: 'unlinkedchild',
    });

    expect(createNoEmailStudentAccount).toHaveBeenCalledWith({
      fullName: 'Unlinked Learner',
      username: 'unlinkedchild',
      password: 'correct horse battery staple',
    });
    expect(settings.get(unlinkedStudentId)).toMatchObject({
      loginHandleEnc: 'enc:unlinkedchild',
      loginHandleBidx: 'bidx:unlinkedchild',
      settingsUpdatedById: otherParentUser.id,
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(
      'correct horse battery staple',
    );
  });

  it('deletes the created Clerk account when local student linking fails', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi
      .fn()
      .mockResolvedValue({ clerkUserId: 'clerk_unlinked_created' });
    const deleteStudentAccount = vi.fn().mockResolvedValue(undefined);
    db.user.upsert.mockRejectedValueOnce(new Error('local link failed'));
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      deleteStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toThrow('local link failed');

    expect(createNoEmailStudentAccount).toHaveBeenCalledWith({
      fullName: 'Unlinked Learner',
      username: 'unlinkedchild',
      password: 'correct horse battery staple',
    });
    expect(deleteStudentAccount).toHaveBeenCalledWith({
      clerkUserId: 'clerk_unlinked_created',
    });
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('links a Clerk webhook-created local user instead of deleting the Clerk account', async () => {
    const { db, settings, users } = makeFakeDb();
    users.push({
      id: 'user_webhook_student',
      clerkId: 'clerk_unlinked_created',
      role: 'Student',
    });
    const createNoEmailStudentAccount = vi
      .fn()
      .mockResolvedValue({ clerkUserId: 'clerk_unlinked_created' });
    const deleteStudentAccount = vi.fn().mockResolvedValue(undefined);
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      deleteStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({
      studentId: unlinkedStudentId,
      accountLinked: true,
      loginHandle: 'unlinkedchild',
    });

    expect(deleteStudentAccount).not.toHaveBeenCalled();
    expect(db.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'user_webhook_student' },
      }),
    );
    expect(settings.get(unlinkedStudentId)).toMatchObject({
      loginHandleEnc: 'enc:unlinkedchild',
      loginHandleBidx: 'bidx:unlinkedchild',
      settingsUpdatedById: otherParentUser.id,
    });
  });

  it('rejects duplicate handles and already-linked student logins', async () => {
    const { db, settings } = makeFakeDb();
    settings.set(
      childStudentId,
      makeSettings(childStudentId, {
        loginHandleEnc: encrypt('jamielogin'),
        loginHandleBidx: blindIndex('jamielogin'),
      }),
    );
    const caller = makeCaller(otherParentUser, db);

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'JamieLogin',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'login handle is already in use',
    });

    await expect(
      makeCaller(parentUser, db).studentSettings.createChildLogin({
        studentId: childStudentId,
        loginHandle: 'jamieother',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student account is already linked to a login user',
    });
  });

  it('rejects dotted child login handles before calling the credential adapter', async () => {
    const { db } = makeFakeDb();
    const createNoEmailStudentAccount = vi.fn().mockResolvedValue({
      clerkUserId: 'clerk_unlinked_created',
    });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'jamie.learner',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createNoEmailStudentAccount).not.toHaveBeenCalled();
  });

  it('maps credential provider duplicate-login failures without linking a local user', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi.fn().mockRejectedValue({
      status: 422,
      errors: [{ code: 'form_identifier_exists', message: 'Identifier already exists.' }],
    });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'login handle is already in use',
    });

    expect(createNoEmailStudentAccount).toHaveBeenCalledWith({
      fullName: 'Unlinked Learner',
      username: 'unlinkedchild',
      password: 'correct horse battery staple',
    });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.student.update).not.toHaveBeenCalled();
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('maps credential provider username configuration failures', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi.fn().mockRejectedValue({
      statusCode: 422,
      errors: [{ message: 'Username is disabled for this instance.' }],
    });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student username login is not enabled; contact an administrator',
    });
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('maps credential provider username format failures returned as bad requests', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi.fn().mockRejectedValue({
      status: 400,
      errors: [
        {
          code: 'form_param_format_invalid',
          longMessage: 'Username is invalid.',
          meta: { paramName: 'username' },
        },
      ],
    });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'login handle was rejected by the sign-in provider',
    });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.student.update).not.toHaveBeenCalled();
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('maps credential provider email-required failures to a Clerk configuration message', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi.fn().mockRejectedValue({
      status: 422,
      errors: [
        {
          code: 'form_param_missing',
          message: 'is missing',
          meta: { paramName: 'email_address' },
        },
      ],
    });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student login requires username sign-in to be enabled in Clerk',
    });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.student.update).not.toHaveBeenCalled();
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('maps credential provider legal consent failures without linking a local user', async () => {
    const { db, settings } = makeFakeDb();
    const createNoEmailStudentAccount = vi.fn().mockRejectedValue({
      status: 422,
      errors: [{ code: 'form_legal_not_accepted', message: 'Legal requirements not accepted.' }],
    });
    const caller = makeCaller(otherParentUser, db, {
      createNoEmailStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.createChildLogin({
        studentId: unlinkedStudentId,
        loginHandle: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student login could not be created because legal consent is required',
    });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.student.update).not.toHaveBeenCalled();
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('allows linked parents to pass password resets through the credential adapter only for under-18 children', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = {
      createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
      setPassword,
    };
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

  it('maps credential provider password policy failures for parent password resets', async () => {
    const { db } = makeFakeDb();
    const credentialAdapter: StudentCredentialAdapter = {
      createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
      setPassword: vi.fn().mockRejectedValue({
        status: 422,
        errors: [{ code: 'form_password_pwned', message: 'Password has been found in a breach.' }],
      }),
    };
    const caller = makeCaller(parentUser, db, credentialAdapter);

    await expect(
      caller.studentSettings.setChildPassword({
        studentId: childStudentId,
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'password does not meet the sign-in requirements',
    });
  });
});

describe('studentSettings admin readiness reporting', () => {
  it('summarises student portal readiness and exception metrics for admin users', async () => {
    const { db, settings } = makeFakeDb();
    settings.set(
      childStudentId,
      makeSettings(childStudentId, {
        dailyUsageLimitMinutes: 2,
        parentMeritShopBlocked: true,
      }),
    );
    settings.set(
      adultStudentId,
      makeSettings(adultStudentId, {
        headAcademicLocked: true,
        headAcademicLockReasonEnc: encrypt('PACE review'),
      }),
    );
    const caller = makeCaller(headUser, db);

    const report = await caller.studentSettings.adminReadinessReport({ status: 'All' });

    expect(report.summary).toEqual({
      activeStudents: 3,
      linkedAccounts: 2,
      readyAccounts: 0,
      exceptionAccounts: 3,
      lockedAccounts: 1,
      shopBlockedAccounts: 1,
      usageLimitedAccounts: 1,
    });
    const childRow = report.rows.find((row) => row.studentId === childStudentId);
    expect(childRow).toMatchObject({
      fullName: 'Jamie Learner',
      guardianCount: 2,
      meritsTotal: 35,
      parentMeritShopBlocked: true,
      activeClubSignupCount: 1,
      paceSubjects: [
        { currentPaceNumber: 1005, subjectName: 'Maths' },
        { currentPaceNumber: 1003, subjectName: 'English' },
      ],
      readinessIssues: ['Merit shop blocked', 'Usage limit reached'],
    });
    expect(childRow?.attendance).toMatchObject({
      attended: 3,
      attendanceRate: 100,
      late: 1,
      present: 2,
      recorded: 3,
    });
    expect(childRow?.usage).toMatchObject({
      dailyUsageLimitMinutes: 2,
      dayMinutes: 2,
      hasLimits: true,
      overLimit: true,
    });

    const adultRow = report.rows.find((row) => row.studentId === adultStudentId);
    expect(adultRow?.lock).toMatchObject({ locked: true, primarySource: 'HeadAcademic' });
    expect(adultRow?.readinessIssues).toEqual(['Academic lock']);

    const unlinkedRow = report.rows.find((row) => row.studentId === unlinkedStudentId);
    expect(unlinkedRow?.readinessIssues).toEqual(['Student account not linked']);
    expect(
      auditCalls(db).some(
        (call) =>
          call.data.userId === headUser.id &&
          call.data.action === 'DecryptPii' &&
          call.data.entity === 'StudentPortalReadinessReport' &&
          call.data.meta?.source === 'studentSettings.adminReadinessReport',
      ),
    ).toBe(true);
  });

  it('denies readiness reporting to non-admin users', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(parentUser, db).studentSettings.adminReadinessReport({ status: 'All' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('studentSettings admin login provisioning', () => {
  it('allows admins to create username-based student logins for unlinked students', async () => {
    const { db, settings, users } = makeFakeDb();
    const createStudentAccount = vi.fn().mockResolvedValue({ clerkUserId: 'clerk_admin_created' });
    const caller = makeCaller(headUser, db, {
      createStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: '  UnlinkedChild  ',
        password: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({
      studentId: unlinkedStudentId,
      accountLinked: true,
      loginHandle: 'unlinkedchild',
    });

    expect(createStudentAccount).toHaveBeenCalledWith({
      fullName: 'Unlinked Learner',
      loginIdentifier: { kind: 'Username', value: 'unlinkedchild' },
      password: 'correct horse battery staple',
    });
    expect(settings.get(unlinkedStudentId)).toMatchObject({
      loginHandleEnc: 'enc:unlinkedchild',
      loginHandleBidx: 'bidx:unlinkedchild',
      settingsUpdatedById: headUser.id,
    });
    expect(users.find((user) => user.clerkId === 'clerk_admin_created')).toMatchObject({
      emailBidx: null,
      emailEnc: null,
      role: 'Student',
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(
      'correct horse battery staple',
    );
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('unlinkedchild');
  });

  it('allows admins to create email-based student logins for unlinked students', async () => {
    const { db, settings, users } = makeFakeDb();
    const createStudentAccount = vi
      .fn()
      .mockResolvedValue({ clerkUserId: 'clerk_admin_email_created' });
    const caller = makeCaller(headUser, db, {
      createStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: ' Student.Login@Example.COM ',
        password: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({
      studentId: unlinkedStudentId,
      accountLinked: true,
      loginHandle: 'student.login@example.com',
    });

    expect(createStudentAccount).toHaveBeenCalledWith({
      fullName: 'Unlinked Learner',
      loginIdentifier: { kind: 'Email', value: 'student.login@example.com' },
      password: 'correct horse battery staple',
    });
    expect(settings.get(unlinkedStudentId)).toMatchObject({
      loginHandleEnc: 'enc:student.login@example.com',
      loginHandleBidx: 'bidx:student.login@example.com',
      settingsUpdatedById: headUser.id,
    });
    expect(users.find((user) => user.clerkId === 'clerk_admin_email_created')).toMatchObject({
      emailBidx: 'bidx:student.login@example.com',
      emailEnc: 'enc:student.login@example.com',
      role: 'Student',
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(
      'correct horse battery staple',
    );
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(
      'student.login@example.com',
    );
  });

  it('denies admin student login creation to non-admin users', async () => {
    const { db } = makeFakeDb();
    const createStudentAccount = vi.fn().mockResolvedValue({ clerkUserId: 'clerk_admin_created' });
    const caller = makeCaller(parentUser, db, {
      createStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createStudentAccount).not.toHaveBeenCalled();
  });

  it('rejects already-linked students before creating admin student logins', async () => {
    const { db } = makeFakeDb();
    const createStudentAccount = vi.fn().mockResolvedValue({ clerkUserId: 'clerk_admin_created' });
    const caller = makeCaller(headUser, db, {
      createStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: childStudentId,
        loginIdentifier: 'jamieother',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student account is already linked to a login user',
    });
    expect(createStudentAccount).not.toHaveBeenCalled();
  });

  it('rejects duplicate admin login identifiers before creating provider accounts', async () => {
    const { db, settings, users } = makeFakeDb();
    settings.set(
      childStudentId,
      makeSettings(childStudentId, {
        loginHandleEnc: encrypt('jamielogin'),
        loginHandleBidx: blindIndex('jamielogin'),
      }),
    );
    users.push({
      id: 'user_email_duplicate',
      clerkId: 'clerk_email_duplicate',
      emailBidx: blindIndex('student.login@example.com'),
      emailEnc: encrypt('student.login@example.com'),
      role: 'Student',
    });
    const createStudentAccount = vi.fn().mockResolvedValue({ clerkUserId: 'clerk_admin_created' });
    const caller = makeCaller(headUser, db, {
      createStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: 'JamieLogin',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'login handle is already in use',
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: 'student.login@example.com',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'email address is already in use',
    });
    expect(createStudentAccount).not.toHaveBeenCalled();
  });

  it('maps provider duplicate failures without linking local admin-created student logins', async () => {
    const { db, settings } = makeFakeDb();
    const createStudentAccount = vi.fn().mockRejectedValue({
      status: 422,
      errors: [{ code: 'form_identifier_exists', message: 'Identifier already exists.' }],
    });
    const caller = makeCaller(headUser, db, {
      createStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'login handle is already in use',
    });

    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.student.update).not.toHaveBeenCalled();
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });

  it('deletes provider accounts when admin-created local student linking fails', async () => {
    const { db, settings } = makeFakeDb();
    const createStudentAccount = vi.fn().mockResolvedValue({ clerkUserId: 'clerk_admin_created' });
    const deleteStudentAccount = vi.fn().mockResolvedValue(undefined);
    db.user.upsert.mockRejectedValueOnce(new Error('local link failed'));
    const caller = makeCaller(headUser, db, {
      createStudentAccount,
      deleteStudentAccount,
      setPassword: vi.fn(),
    });

    await expect(
      caller.studentSettings.adminCreateStudentLogin({
        studentId: unlinkedStudentId,
        loginIdentifier: 'unlinkedchild',
        password: 'correct horse battery staple',
      }),
    ).rejects.toThrow('local link failed');

    expect(deleteStudentAccount).toHaveBeenCalledWith({
      clerkUserId: 'clerk_admin_created',
    });
    expect(settings.get(unlinkedStudentId)).toBeUndefined();
  });
});

describe('studentSettings student and Head procedures', () => {
  it('lets under-18 students set their own password only when parent policy allows it', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = {
      createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
      setPassword,
    };
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

  it('blocks student password changes while the portal account is locked', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = {
      createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
      setPassword,
    };
    const parentCaller = makeCaller(parentUser, db, credentialAdapter);
    await parentCaller.studentSettings.setPasswordControl({
      studentId: childStudentId,
      studentCanManagePassword: true,
    });
    await parentCaller.studentSettings.setParentLock({
      studentId: childStudentId,
      locked: true,
      reason: 'Paused by parent',
    });

    await expect(
      makeCaller(studentUser, db, credentialAdapter).studentSettings.setMyPassword({
        password: 'student password 123',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Student portal is locked by a parent or carer.',
    });
    expect(setPassword).not.toHaveBeenCalled();
    expect(
      auditCalls(db).some(
        (call) =>
          call.data.action === 'PermissionDenied' &&
          call.data.entity === 'studentSettings.setMyPassword' &&
          call.data.entityId === childStudentId,
      ),
    ).toBe(true);
  });

  it('lets adult students control their own password without parent policy', async () => {
    const { db } = makeFakeDb();
    const setPassword = vi.fn().mockResolvedValue(undefined);
    const credentialAdapter: StudentCredentialAdapter = {
      createNoEmailStudentAccount: vi.fn().mockResolvedValue({ clerkUserId: 'clerk_created' }),
      setPassword,
    };
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
