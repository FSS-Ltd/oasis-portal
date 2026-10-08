import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { studentNotificationRouter } from '../routers/studentNotification.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'notificationhead0000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};

const primaryStudentUser: SessionUser = {
  id: 'notificationstudentuser1',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const secondaryStudentUser: SessionUser = {
  id: 'notificationstudentuser2',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const primaryStudentId = 'clxprimary000000000000000';
const secondaryStudentId = 'clxsecondary0000000000000';

interface StoredStudent {
  id: string;
  userId: string | null;
  yearGroup: string;
  active: boolean;
  createdAt: Date;
}

interface StoredNotification {
  id: string;
  studentId: string;
  kind: 'MeritAward' | 'ShopPurchase' | 'ClubNotice' | 'SystemAnnouncement';
  title: string;
  bodyEnc: string;
  sourceEntity: string | null;
  sourceId: string | null;
  createdById: string | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentNotification: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  studentPortalSettings: { findUnique: ReturnType<typeof vi.fn> };
  studentPortalUsageMinute: { count: ReturnType<typeof vi.fn> };
  notifications: StoredNotification[];
  students: StoredStudent[];
}

interface FakeStudentFindUniqueArgs {
  where: { userId?: string };
}

interface FakeStudentFindManyArgs {
  where?: { active?: boolean };
}

interface FakeNotificationWhere {
  id?: string;
  studentId?: string;
  readAt?: null;
  kind?: { not: 'ClubNotice' };
}

interface FakeNotificationFindManyArgs {
  where?: FakeNotificationWhere;
  take?: number;
}

interface FakeNotificationCountArgs {
  where?: FakeNotificationWhere;
}

interface FakeNotificationCreateArgs {
  data: Omit<StoredNotification, 'createdAt' | 'id' | 'readAt' | 'updatedAt'>;
}

interface FakeNotificationCreateManyArgs {
  data: Array<Omit<StoredNotification, 'createdAt' | 'id' | 'readAt' | 'updatedAt'>>;
}

interface FakeNotificationUpdateManyArgs {
  where: FakeNotificationWhere;
  data: { readAt: Date };
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  return value?.replace(/^enc:/u, '') ?? null;
}

function makeNotification(
  input: Partial<StoredNotification> & Pick<StoredNotification, 'studentId' | 'title'>,
): StoredNotification {
  return {
    id: `clxnotice${Math.random().toString(36).slice(2, 18).padEnd(16, '0')}`,
    kind: 'SystemAnnouncement',
    bodyEnc: encrypt('Body'),
    sourceEntity: null,
    sourceId: null,
    createdById: headUser.id,
    readAt: null,
    createdAt: new Date('2026-06-04T09:00:00.000Z'),
    updatedAt: new Date('2026-06-04T09:00:00.000Z'),
    ...input,
  };
}

function matchesWhere(notification: StoredNotification, where: FakeNotificationWhere = {}) {
  if (where.id !== undefined && notification.id !== where.id) return false;
  if (where.studentId !== undefined && notification.studentId !== where.studentId) return false;
  if (where.readAt === null && notification.readAt !== null) return false;
  if (where.kind?.not === notification.kind) return false;
  return true;
}

function makeFakeDb(input?: {
  notifications?: StoredNotification[];
  students?: StoredStudent[];
}): FakeDb {
  const students = input?.students ?? [
    {
      id: primaryStudentId,
      userId: primaryStudentUser.id,
      yearGroup: 'Year 6',
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: secondaryStudentId,
      userId: secondaryStudentUser.id,
      yearGroup: 'Year 8',
      active: true,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ];
  const notifications = input?.notifications ?? [];
  const db = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    student: {
      findUnique: vi.fn(({ where }: FakeStudentFindUniqueArgs) =>
        Promise.resolve(students.find((student) => student.userId === where.userId) ?? null),
      ),
      findMany: vi.fn(({ where }: FakeStudentFindManyArgs = {}) =>
        Promise.resolve(
          students
            .filter((student) => where?.active === undefined || student.active === where.active)
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
        ),
      ),
    },
    studentNotification: {
      count: vi.fn(({ where }: FakeNotificationCountArgs = {}) =>
        Promise.resolve(
          notifications.filter((notification) => matchesWhere(notification, where)).length,
        ),
      ),
      create: vi.fn(({ data }: FakeNotificationCreateArgs) => {
        const row = makeNotification(data);
        notifications.push(row);
        return Promise.resolve({ id: row.id });
      }),
      createMany: vi.fn(({ data }: FakeNotificationCreateManyArgs) => {
        for (const item of data) {
          notifications.push(makeNotification(item));
        }
        return Promise.resolve({ count: data.length });
      }),
      findFirst: vi.fn(({ where }: FakeNotificationFindManyArgs = {}) =>
        Promise.resolve(
          notifications.find((notification) => matchesWhere(notification, where)) ?? null,
        ),
      ),
      findMany: vi.fn(({ where, take }: FakeNotificationFindManyArgs = {}) =>
        Promise.resolve(
          notifications
            .filter((notification) => matchesWhere(notification, where))
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .slice(0, take ?? notifications.length),
        ),
      ),
      updateMany: vi.fn(({ where, data }: FakeNotificationUpdateManyArgs) => {
        let count = 0;
        for (const notification of notifications) {
          if (!matchesWhere(notification, where)) continue;
          notification.readAt = data.readAt;
          notification.updatedAt = data.readAt;
          count += 1;
        }
        return Promise.resolve({ count });
      }),
    },
    studentPortalSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    studentPortalUsageMinute: {
      count: vi.fn().mockResolvedValue(0),
    },
    notifications,
    students,
  } satisfies FakeDb;

  return db;
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    accountAccessState: user ? 'active' : 'unavailable',
    requestId: 'req_student_notification_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ studentNotification: studentNotificationRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('studentNotification router', () => {
  it('excludes hidden club notices from the student list and unread count', async () => {
    const db = makeFakeDb({
      notifications: [
        makeNotification({ studentId: primaryStudentId, kind: 'ClubNotice', title: 'Club update' }),
        makeNotification({ studentId: primaryStudentId, title: 'General update' }),
      ],
    });
    const caller = makeCaller(primaryStudentUser, db);

    await expect(caller.studentNotification.list()).resolves.toMatchObject([
      { title: 'General update' },
    ]);
    await expect(caller.studentNotification.unreadCount()).resolves.toEqual({ count: 1 });
  });

  it('targets primary announcements and only lists notifications for the signed-in student', async () => {
    const db = makeFakeDb();
    const adminCaller = makeCaller(headUser, db);

    await expect(
      adminCaller.studentNotification.announce({
        audience: 'Primary',
        title: 'Primary update',
        body: 'Bring your workbook tomorrow.',
      }),
    ).resolves.toEqual({ recipientCount: 1 });

    await expect(
      makeCaller(primaryStudentUser, db).studentNotification.list(),
    ).resolves.toMatchObject([
      {
        kind: 'SystemAnnouncement',
        title: 'Primary update',
        body: 'Bring your workbook tomorrow.',
        read: false,
      },
    ]);
    await expect(makeCaller(secondaryStudentUser, db).studentNotification.list()).resolves.toEqual(
      [],
    );
  });

  it('marks only the signed-in student notification as read', async () => {
    const ownNotification = makeNotification({
      id: 'clxnoticeown0000000000000',
      studentId: primaryStudentId,
      title: 'Own update',
    });
    const otherNotification = makeNotification({
      id: 'clxnoticeother00000000000',
      studentId: secondaryStudentId,
      title: 'Other update',
    });
    const db = makeFakeDb({ notifications: [ownNotification, otherNotification] });

    await expect(
      makeCaller(primaryStudentUser, db).studentNotification.markRead({
        notificationId: ownNotification.id,
      }),
    ).resolves.toEqual({ id: ownNotification.id, read: true });

    expect(ownNotification.readAt).toBeInstanceOf(Date);
    expect(otherNotification.readAt).toBeNull();
    await expect(
      makeCaller(primaryStudentUser, db).studentNotification.unreadCount(),
    ).resolves.toEqual({
      count: 0,
    });
  });

  it('does not expose an announcement send path to students', async () => {
    const db = makeFakeDb();

    await expect(
      makeCaller(primaryStudentUser, db).studentNotification.announce({
        audience: 'All',
        title: 'Student send attempt',
        body: 'This should not send.',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.notifications).toHaveLength(0);
  });
});
