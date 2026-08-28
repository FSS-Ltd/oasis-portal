import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { parentNotificationRouter } from '../routers/parentNotification.js';
import { router } from '../trpc.js';

const parentUser: SessionUser = {
  id: 'cparentnotify00000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const otherParentUser: SessionUser = {
  id: 'cparentnotify00000002',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

interface StoredParentNotification {
  id: string;
  userId: string;
  kind: 'InvoiceIssued';
  title: string;
  bodyEnc: string;
  href: string | null;
  sourceEntity: string | null;
  sourceId: string | null;
  createdById: string | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeNotificationWhere {
  id?: string;
  userId?: string;
  readAt?: null;
}

interface FakeNotificationFindManyArgs {
  where?: FakeNotificationWhere;
  take?: number;
}

interface FakeDb {
  $enc: { decrypt: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
  parentNotification: {
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  notifications: StoredParentNotification[];
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  return value?.replace(/^enc:/u, '') ?? null;
}

function makeNotification(input: Partial<StoredParentNotification>): StoredParentNotification {
  return {
    id: 'cparentnotice00000000001',
    userId: parentUser.id,
    kind: 'InvoiceIssued',
    title: 'New invoice issued',
    bodyEnc: encrypt('Invoice INV-2026-001 is ready in Oasis Portal.'),
    href: '/parent/fees?invoiceId=cinvoice00000000001',
    sourceEntity: 'SchoolFeeInvoice',
    sourceId: 'cinvoice00000000001',
    createdById: 'cfinance000000000001',
    readAt: null,
    createdAt: new Date('2026-08-28T08:00:00.000Z'),
    updatedAt: new Date('2026-08-28T08:00:00.000Z'),
    ...input,
  };
}

function matchesWhere(notification: StoredParentNotification, where: FakeNotificationWhere = {}) {
  if (where.id !== undefined && notification.id !== where.id) return false;
  if (where.userId !== undefined && notification.userId !== where.userId) return false;
  if (where.readAt === null && notification.readAt !== null) return false;
  return true;
}

function makeFakeDb(notifications: StoredParentNotification[]): FakeDb {
  const db = {
    $enc: { decrypt: vi.fn(decrypt) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    parentNotification: {
      count: vi.fn(({ where }: { where?: FakeNotificationWhere } = {}) =>
        Promise.resolve(
          notifications.filter((notification) => matchesWhere(notification, where)).length,
        ),
      ),
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
      updateMany: vi.fn(
        ({
          where,
          data,
        }: {
          where: FakeNotificationWhere;
          data: { readAt: Date };
        }) => {
          let count = 0;
          for (const notification of notifications) {
            if (!matchesWhere(notification, where)) continue;
            notification.readAt = data.readAt;
            notification.updatedAt = data.readAt;
            count += 1;
          }
          return Promise.resolve({ count });
        },
      ),
    },
    notifications,
  } satisfies FakeDb;

  return db;
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_parent_notification_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ parentNotification: parentNotificationRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('parentNotification router', () => {
  it('lists only notifications for the signed-in parent', async () => {
    const ownNotification = makeNotification({ id: 'cparentnotice00000000001' });
    const otherNotification = makeNotification({
      id: 'cparentnotice00000000002',
      userId: otherParentUser.id,
      bodyEnc: encrypt('Invoice INV-2026-002 is ready in Oasis Portal.'),
    });
    const db = makeFakeDb([ownNotification, otherNotification]);

    await expect(makeCaller(parentUser, db).parentNotification.list()).resolves.toMatchObject([
      {
        id: ownNotification.id,
        kind: 'InvoiceIssued',
        title: 'New invoice issued',
        body: 'Invoice INV-2026-001 is ready in Oasis Portal.',
        href: '/parent/fees?invoiceId=cinvoice00000000001',
        read: false,
      },
    ]);
  });

  it('marks only the signed-in parent notification as read', async () => {
    const ownNotification = makeNotification({ id: 'cparentnotice00000000001' });
    const otherNotification = makeNotification({
      id: 'cparentnotice00000000002',
      userId: otherParentUser.id,
    });
    const db = makeFakeDb([ownNotification, otherNotification]);

    await expect(
      makeCaller(parentUser, db).parentNotification.markRead({
        notificationId: ownNotification.id,
      }),
    ).resolves.toEqual({ id: ownNotification.id, read: true });

    expect(ownNotification.readAt).toBeInstanceOf(Date);
    expect(otherNotification.readAt).toBeNull();
    await expect(makeCaller(parentUser, db).parentNotification.unreadCount()).resolves.toEqual({
      count: 0,
    });
  });

  it('does not expose parent notifications to non-parent roles', async () => {
    const staffUser: SessionUser = {
      id: 'cstaffnotify000000001',
      role: 'Supervisor',
      tags: [],
      requires2fa: false,
    };
    const db = makeFakeDb([makeNotification({})]);

    await expect(makeCaller(staffUser, db).parentNotification.list()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
