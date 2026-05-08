import { afterEach, describe, expect, it, vi } from 'vitest';
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

interface StoredNotice {
  id: string;
  title: string;
  bodyEnc: string;
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

interface FakeNoticeInclude {
  reads: { where: { userId: string } };
}

interface FakeNoticeCreateArgs {
  data: {
    title: string;
    bodyEnc: string;
    postedById: string;
    active: boolean;
    expiresAt: Date | null;
  };
  include: FakeNoticeInclude;
}

interface FakeNoticeFindManyArgs {
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
    postedById: headUser.id,
    active: true,
    expiresAt: null,
    createdAt: new Date('2026-05-08T10:00:00.000Z'),
    ...input,
  };
}

function makeFakeDb(initialNotices: StoredNotice[] = [], initialReads: StoredRead[] = []) {
  const notices = [...initialNotices];
  const reads = [...initialReads];

  const withCallerReads = (notice: StoredNotice, userId: string) => ({
    ...notice,
    reads: reads
      .filter((read) => read.noticeId === notice.id && read.userId === userId)
      .map((read) => ({ readAt: read.readAt }))
      .slice(0, 1),
  });

  return {
    $enc: { encrypt, decrypt },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    staffNotice: {
      create: vi.fn((args: FakeNoticeCreateArgs) => {
        const { data, include } = args;
        const notice: StoredNotice = {
          id: 'cmnotice00000000000000001',
          title: data.title,
          bodyEnc: data.bodyEnc,
          postedById: data.postedById,
          active: data.active,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        };
        notices.push(notice);
        return Promise.resolve(withCallerReads(notice, include.reads.where.userId));
      }),
      findMany: vi.fn((args: FakeNoticeFindManyArgs) =>
        Promise.resolve(
          notices
            .filter(
              (notice) => notice.active && (!notice.expiresAt || notice.expiresAt > new Date()),
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((notice) => withCallerReads(notice, args.include.reads.where.userId)),
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
      expiresAt,
      read: false,
      readAt: null,
    });

    expect(db.staffNotice.create.mock.calls[0]?.[0]?.data).toMatchObject({
      title: 'Staff update',
      bodyEnc: 'enc:Bring registers.',
      postedById: headUser.id,
      active: true,
      expiresAt,
    });
    expect(db.notices[0]?.bodyEnc).toBe('enc:Bring registers.');
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StaffNotice',
        entityId: 'cmnotice00000000000000001',
        meta: { source: 'notice.post', expiresAt: expiresAt.toISOString() },
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

describe('notice.listForStaff', () => {
  it('lists active non-expired notices for staff with caller read state', async () => {
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
      bodyEnc: encrypt('Future body'),
      expiresAt: new Date('2026-05-09T12:00:00.000Z'),
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
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
        [activeNotice, unreadNotice, inactiveNotice, expiredNotice],
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

  it('scopes read receipts to the caller and rejects unavailable notices', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({ id: 'cmnotice00000000000000007', title: 'Scoped' });
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
});
