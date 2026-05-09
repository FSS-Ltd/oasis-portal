import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { noticeRouter } from '../routers/notice.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = {
  id: 'u_supervisor',
  role: 'Supervisor',
  tags: [],
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
const technicalSupportUser: SessionUser = {
  id: 'u_support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};

type NoticeAudience = 'Supervisors' | 'Parents' | 'Both';

interface StoredNotice {
  id: string;
  title: string;
  bodyEnc: string;
  audience: NoticeAudience;
  postedById: string;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

interface StoredRead {
  noticeId: string;
  userId: string;
  readAt: Date;
}

interface StoredUser {
  id: string;
  role: 'Head' | 'Supervisor' | 'Parent';
  fullNameEnc: string;
  active: boolean;
}

interface FakeNoticeInclude {
  reads: { where?: { userId: string } };
}

interface FakeNoticeCreateArgs {
  data: {
    title: string;
    bodyEnc: string;
    audience: NoticeAudience;
    postedById: string;
    active: boolean;
    expiresAt: Date | null;
  };
  include: FakeNoticeInclude;
}

interface FakeNoticeFindManyArgs {
  where: {
    audience?: { in: NoticeAudience[] };
  };
  include: FakeNoticeInclude;
}

interface FakeNoticeFindUniqueArgs {
  where: { id: string };
}

interface FakeNoticeReadFindUniqueArgs {
  where: { noticeId_userId: { noticeId: string; userId: string } };
}

interface FakeNoticeReadCreateArgs {
  data: { noticeId: string; userId: string };
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeNotice(
  input: Partial<StoredNotice> & Pick<StoredNotice, 'id' | 'title'>,
): StoredNotice {
  return {
    bodyEnc: encrypt(`${input.title} body`),
    audience: 'Supervisors',
    postedById: headUser.id,
    active: true,
    expiresAt: null,
    createdAt: new Date('2026-05-08T10:00:00.000Z'),
    ...input,
  };
}

const defaultUsers: StoredUser[] = [
  { id: headUser.id, role: 'Head', fullNameEnc: encrypt('Head User'), active: true },
  {
    id: supervisorUser.id,
    role: 'Supervisor',
    fullNameEnc: encrypt('Supervisor User'),
    active: true,
  },
  {
    id: 'u_supervisor_unread',
    role: 'Supervisor',
    fullNameEnc: encrypt('Unread Supervisor'),
    active: true,
  },
  { id: parentUser.id, role: 'Parent', fullNameEnc: encrypt('Parent User'), active: true },
];

function makeFakeDb(
  initialNotices: StoredNotice[] = [],
  initialReads: StoredRead[] = [],
  initialUsers: StoredUser[] = defaultUsers,
) {
  const notices = [...initialNotices];
  const reads = [...initialReads];
  const users = [...initialUsers];

  const withIncludedReads = (notice: StoredNotice, include: FakeNoticeInclude) => ({
    ...notice,
    reads: reads
      .filter(
        (read) =>
          read.noticeId === notice.id &&
          (!include.reads.where || read.userId === include.reads.where.userId),
      )
      .map((read) => ({ userId: read.userId, readAt: read.readAt }))
      .slice(0, include.reads.where ? 1 : undefined),
  });

  return {
    $enc: { encrypt, decrypt },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    user: {
      findMany: vi.fn((args: { where: { role: { in: string[] }; active: boolean } }) =>
        Promise.resolve(
          users.filter(
            (user) => user.active === args.where.active && args.where.role.in.includes(user.role),
          ),
        ),
      ),
    },
    staffNotice: {
      create: vi.fn((args: FakeNoticeCreateArgs) => {
        const { data, include } = args;
        const notice: StoredNotice = {
          id: 'cmnotice00000000000000001',
          title: data.title,
          bodyEnc: data.bodyEnc,
          audience: data.audience,
          postedById: data.postedById,
          active: data.active,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        };
        notices.push(notice);
        return Promise.resolve(withIncludedReads(notice, include));
      }),
      findMany: vi.fn((args: FakeNoticeFindManyArgs) =>
        Promise.resolve(
          notices
            .filter(
              (notice) =>
                notice.active &&
                (!notice.expiresAt || notice.expiresAt > new Date()) &&
                (!args.where.audience || args.where.audience.in.includes(notice.audience)),
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((notice) => withIncludedReads(notice, args.include)),
        ),
      ),
      findUnique: vi.fn((args: FakeNoticeFindUniqueArgs) =>
        Promise.resolve(notices.find((notice) => notice.id === args.where.id) ?? null),
      ),
    },
    staffNoticeRead: {
      findUnique: vi.fn((args: FakeNoticeReadFindUniqueArgs) => {
        const read = reads.find(
          (row) =>
            row.noticeId === args.where.noticeId_userId.noticeId &&
            row.userId === args.where.noticeId_userId.userId,
        );
        return Promise.resolve(read ?? null);
      }),
      create: vi.fn((args: FakeNoticeReadCreateArgs) => {
        const read: StoredRead = {
          noticeId: args.data.noticeId,
          userId: args.data.userId,
          readAt: new Date(),
        };
        reads.push(read);
        return Promise.resolve(read);
      }),
    },
    notices,
    reads,
  };
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ notice: noticeRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('notice.post', () => {
  it('allows full-admin users to post encrypted staff notices and audits creation', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const { caller, db } = makeCaller(headUser);
    const expiresAt = new Date('2026-05-09T12:00:00.000Z');

    await expect(
      caller.notice.post({ title: '  Staff update  ', body: '  Bring registers.  ', expiresAt }),
    ).resolves.toMatchObject({
      id: 'cmnotice00000000000000001',
      title: 'Staff update',
      body: 'Bring registers.',
      postedById: headUser.id,
      active: true,
      audience: 'Supervisors',
      expiresAt,
      read: true,
      readAt: null,
      readSummary: null,
    });

    expect(db.staffNotice.create.mock.calls[0]?.[0]?.data).toMatchObject({
      title: 'Staff update',
      bodyEnc: 'enc:Bring registers.',
      postedById: headUser.id,
      active: true,
      audience: 'Supervisors',
      expiresAt,
    });
    expect(db.notices[0]?.bodyEnc).toBe('enc:Bring registers.');
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StaffNotice',
        entityId: 'cmnotice00000000000000001',
        meta: {
          source: 'notice.post',
          audience: 'Supervisors',
          expiresAt: expiresAt.toISOString(),
        },
      },
    });
  });

  it('rejects Supervisor posting and past expiry values', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));

    await expect(
      makeCaller(supervisorUser).caller.notice.post({ title: 'Update', body: 'Body' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(headUser).caller.notice.post({
        title: 'Update',
        body: 'Body',
        expiresAt: new Date('2026-05-08T11:59:59.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('notice.listForAdmin', () => {
  it('lists all active notice audiences for full-admin users', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const supervisorNotice = makeNotice({
      id: 'cmnotice00000000000000012',
      title: 'Supervisor only',
      audience: 'Supervisors',
      createdAt: new Date('2026-05-08T10:00:00.000Z'),
    });
    const parentNotice = makeNotice({
      id: 'cmnotice00000000000000013',
      title: 'Parent only',
      audience: 'Parents',
      createdAt: new Date('2026-05-08T11:00:00.000Z'),
    });
    const bothNotice = makeNotice({
      id: 'cmnotice00000000000000014',
      title: 'Everyone',
      audience: 'Both',
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    });

    await expect(
      makeCaller(
        headUser,
        makeFakeDb([supervisorNotice, parentNotice, bothNotice]),
      ).caller.notice.listForAdmin(),
    ).resolves.toEqual([
      expect.objectContaining({ id: bothNotice.id, audience: 'Both' }),
      expect.objectContaining({ id: parentNotice.id, audience: 'Parents' }),
      expect.objectContaining({ id: supervisorNotice.id, audience: 'Supervisors' }),
    ]);
  });

  it.each([supervisorUser, parentUser, studentUser, clubsAdminUser, technicalSupportUser])(
    'denies %s callers',
    async (user) => {
      await expect(makeCaller(user).caller.notice.listForAdmin()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );

  it('returns author read summaries and does not require authors to mark their notices read', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const authoredNotice = makeNotice({
      id: 'cmnotice00000000000000018',
      title: 'Authored',
      postedById: headUser.id,
      audience: 'Supervisors',
    });
    const otherNotice = makeNotice({
      id: 'cmnotice00000000000000019',
      title: 'Other author',
      postedById: 'u_other_head',
      audience: 'Supervisors',
      createdAt: new Date('2026-05-08T09:00:00.000Z'),
    });
    const readAt = new Date('2026-05-08T11:00:00.000Z');

    await expect(
      makeCaller(
        headUser,
        makeFakeDb(
          [authoredNotice, otherNotice],
          [
            { noticeId: authoredNotice.id, userId: supervisorUser.id, readAt },
            { noticeId: otherNotice.id, userId: headUser.id, readAt },
          ],
        ),
      ).caller.notice.listForAdmin(),
    ).resolves.toEqual([
      expect.objectContaining({
        id: authoredNotice.id,
        read: true,
        readAt: null,
        readSummary: {
          read: 1,
          total: 2,
          recipients: [
            expect.objectContaining({
              userId: supervisorUser.id,
              fullName: 'Supervisor User',
              role: 'Supervisor',
              read: true,
              readAt,
            }),
            expect.objectContaining({
              userId: 'u_supervisor_unread',
              fullName: 'Unread Supervisor',
              role: 'Supervisor',
              read: false,
              readAt: null,
            }),
          ],
        },
      }),
      expect.objectContaining({
        id: otherNotice.id,
        read: true,
        readAt,
        readSummary: null,
      }),
    ]);
  });
});

describe('notice.listForStaff', () => {
  it('lists active non-expired supervisor notices for staff with caller read state', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const activeNotice = makeNotice({
      id: 'cmnotice00000000000000002',
      title: 'Today',
      bodyEnc: encrypt('Visible body'),
      createdAt: new Date('2026-05-08T11:00:00.000Z'),
    });
    const unreadNotice = makeNotice({
      id: 'cmnotice00000000000000003',
      title: 'Tomorrow',
      audience: 'Both',
      bodyEnc: encrypt('Future body'),
      expiresAt: new Date('2026-05-09T12:00:00.000Z'),
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    });
    const parentNotice = makeNotice({
      id: 'cmnotice00000000000000011',
      title: 'Parents',
      audience: 'Parents',
      createdAt: new Date('2026-05-08T12:30:00.000Z'),
    });
    const inactiveNotice = makeNotice({
      id: 'cmnotice00000000000000004',
      title: 'Inactive',
      active: false,
    });
    const expiredNotice = makeNotice({
      id: 'cmnotice00000000000000005',
      title: 'Expired',
      expiresAt: new Date('2026-05-08T11:00:00.000Z'),
    });
    const readAt = new Date('2026-05-08T11:30:00.000Z');
    const { caller } = makeCaller(
      supervisorUser,
      makeFakeDb(
        [activeNotice, unreadNotice, parentNotice, inactiveNotice, expiredNotice],
        [{ noticeId: activeNotice.id, userId: supervisorUser.id, readAt }],
      ),
    );

    await expect(caller.notice.listForStaff()).resolves.toEqual([
      expect.objectContaining({
        id: unreadNotice.id,
        title: 'Tomorrow',
        body: 'Future body',
        read: false,
        readAt: null,
      }),
      expect.objectContaining({
        id: activeNotice.id,
        title: 'Today',
        body: 'Visible body',
        read: true,
        readAt,
      }),
    ]);
  });

  it.each([parentUser, studentUser, clubsAdminUser, technicalSupportUser])(
    'denies %s callers',
    async (user) => {
      await expect(makeCaller(user).caller.notice.listForStaff()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );
});

describe('notice.listForParents', () => {
  it('lists active non-expired parent notices with caller read state', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const parentNotice = makeNotice({
      id: 'cmnotice00000000000000015',
      title: 'Parent update',
      audience: 'Parents',
      bodyEnc: encrypt('Parent body'),
      createdAt: new Date('2026-05-08T11:00:00.000Z'),
    });
    const bothNotice = makeNotice({
      id: 'cmnotice00000000000000016',
      title: 'Shared update',
      audience: 'Both',
      bodyEnc: encrypt('Shared body'),
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    });
    const supervisorNotice = makeNotice({
      id: 'cmnotice00000000000000017',
      title: 'Supervisor update',
      audience: 'Supervisors',
      createdAt: new Date('2026-05-08T12:30:00.000Z'),
    });
    const readAt = new Date('2026-05-08T11:30:00.000Z');

    await expect(
      makeCaller(
        parentUser,
        makeFakeDb(
          [parentNotice, bothNotice, supervisorNotice],
          [{ noticeId: parentNotice.id, userId: parentUser.id, readAt }],
        ),
      ).caller.notice.listForParents(),
    ).resolves.toEqual([
      expect.objectContaining({
        id: bothNotice.id,
        audience: 'Both',
        body: 'Shared body',
        read: false,
      }),
      expect.objectContaining({
        id: parentNotice.id,
        audience: 'Parents',
        body: 'Parent body',
        read: true,
        readAt,
      }),
    ]);
  });

  it.each([supervisorUser, studentUser, clubsAdminUser, technicalSupportUser])(
    'denies %s callers',
    async (user) => {
      await expect(makeCaller(user).caller.notice.listForParents()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );
});

describe('notice.markRead', () => {
  it('creates and audits one read receipt, then returns the existing receipt idempotently', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({
      id: 'cmnotice00000000000000006',
      title: 'Read me',
      expiresAt: new Date('2026-05-09T12:00:00.000Z'),
    });
    const { caller, db } = makeCaller(supervisorUser, makeFakeDb([notice]));

    const firstRead = await caller.notice.markRead({ noticeId: notice.id });
    const secondRead = await caller.notice.markRead({ noticeId: notice.id });

    expect(firstRead).toEqual(secondRead);
    expect(db.staffNoticeRead.create).toHaveBeenCalledTimes(1);
    expect(db.reads).toEqual([
      { noticeId: notice.id, userId: supervisorUser.id, readAt: firstRead.readAt },
    ]);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'Update',
        entity: 'StaffNoticeRead',
        entityId: notice.id,
        meta: { source: 'notice.markRead', noticeId: notice.id },
      },
    });
  });

  it('returns a concurrently-created read receipt when duplicate creation races', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({ id: 'cmnotice00000000000000009', title: 'Concurrent' });
    const db = makeFakeDb([notice]);
    const concurrentRead = {
      noticeId: notice.id,
      userId: supervisorUser.id,
      readAt: new Date('2026-05-08T12:00:01.000Z'),
    };
    db.staffNoticeRead.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentRead);
    db.staffNoticeRead.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const { caller } = makeCaller(supervisorUser, db);

    await expect(caller.notice.markRead({ noticeId: notice.id })).resolves.toEqual({
      noticeId: notice.id,
      readAt: concurrentRead.readAt,
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('scopes read receipts to the caller and rejects unavailable notices', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({
      id: 'cmnotice00000000000000007',
      title: 'Scoped',
      postedById: 'u_other_head',
    });
    const expiredNotice = makeNotice({
      id: 'cmnotice00000000000000008',
      title: 'Expired',
      expiresAt: new Date('2026-05-08T11:00:00.000Z'),
    });
    const existingReadAt = new Date('2026-05-08T10:00:00.000Z');
    const db = makeFakeDb(
      [notice, expiredNotice],
      [{ noticeId: notice.id, userId: headUser.id, readAt: existingReadAt }],
    );

    await expect(
      makeCaller(headUser, db).caller.notice.markRead({ noticeId: notice.id }),
    ).resolves.toEqual({
      noticeId: notice.id,
      readAt: existingReadAt,
    });
    await expect(
      makeCaller(supervisorUser, db).caller.notice.markRead({ noticeId: notice.id }),
    ).resolves.toMatchObject({ noticeId: notice.id });
    expect(db.staffNoticeRead.create).toHaveBeenCalledTimes(1);

    await expect(
      makeCaller(supervisorUser, db).caller.notice.markRead({ noticeId: expiredNotice.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects author read receipts', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({
      id: 'cmnotice00000000000000020',
      title: 'Own notice',
      postedById: headUser.id,
    });

    await expect(
      makeCaller(headUser, makeFakeDb([notice])).caller.notice.markRead({ noticeId: notice.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('allows parent notice reads and rejects cross-audience reads', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const parentNotice = makeNotice({
      id: 'cmnotice00000000000000009',
      title: 'Parents read',
      audience: 'Parents',
    });
    const supervisorNotice = makeNotice({
      id: 'cmnotice00000000000000010',
      title: 'Supervisors read',
      audience: 'Supervisors',
    });
    const db = makeFakeDb([parentNotice, supervisorNotice]);

    await expect(
      makeCaller(parentUser, db).caller.notice.markRead({ noticeId: parentNotice.id }),
    ).resolves.toMatchObject({ noticeId: parentNotice.id });
    await expect(
      makeCaller(parentUser, db).caller.notice.markRead({ noticeId: supervisorNotice.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      makeCaller(supervisorUser, db).caller.notice.markRead({ noticeId: parentNotice.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
