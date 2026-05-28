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

interface StoredAttachment {
  id: string;
  noticeId: string;
  originalFileNameEnc: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePathEnc: string;
  position: number;
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
  attachments?: unknown;
}

interface FakeNoticeCreateArgs {
  data: {
    title: string;
    bodyEnc: string;
    audience: NoticeAudience;
    postedById: string;
    active: boolean;
    expiresAt: Date | null;
    attachments?: {
      create: {
        originalFileNameEnc: string;
        mimeType: string;
        sizeBytes: number;
        storageBucket: string;
        storagePathEnc: string;
        position: number;
      }[];
    };
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

interface FakeNoticeAttachmentFindUniqueArgs {
  where: { id: string };
  include?: { notice?: true };
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

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const pdfBytes = Buffer.from('%PDF-1.7\n');
const docxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

function attachmentInput(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  storagePath: string,
): {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
} {
  return {
    fileName,
    mimeType,
    sizeBytes,
    storageBucket: 'notice-attachments',
    storagePath,
  };
}

function mockUploadedAttachments(
  objects: Record<string, { bytes: Uint8Array; mimeType: string }>,
): void {
  vi.stubEnv('SUPABASE_URL', 'https://supabase.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url =
        input instanceof Request
          ? new URL(input.url)
          : input instanceof URL
            ? input
            : new URL(input);
      const objectPath = decodeURIComponent(
        url.pathname.replace('/storage/v1/object/notice-attachments/', ''),
      );
      const object = objects[objectPath];

      if (!object) return new Response(null, { status: 404 });

      const body = new ArrayBuffer(object.bytes.byteLength);
      new Uint8Array(body).set(object.bytes);

      return new Response(body, {
        status: 200,
        headers: { 'content-type': object.mimeType },
      });
    }),
  );
}

function makeFakeDb(
  initialNotices: StoredNotice[] = [],
  initialReads: StoredRead[] = [],
  initialUsers: StoredUser[] = defaultUsers,
  initialAttachments: StoredAttachment[] = [],
) {
  const notices = [...initialNotices];
  const reads = [...initialReads];
  const users = [...initialUsers];
  const attachments = [...initialAttachments];

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
    attachments: include.attachments
      ? attachments
          .filter((attachment) => attachment.noticeId === notice.id)
          .sort((a, b) => a.position - b.position)
      : undefined,
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
        data.attachments?.create.forEach((attachment, index) => {
          attachments.push({
            id: `cmattachment000000000000${String(index + 1).padStart(2, '0')}`,
            noticeId: notice.id,
            originalFileNameEnc: attachment.originalFileNameEnc,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            storageBucket: attachment.storageBucket,
            storagePathEnc: attachment.storagePathEnc,
            position: attachment.position,
            createdAt: new Date(),
          });
        });
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
    staffNoticeAttachment: {
      findUnique: vi.fn((args: FakeNoticeAttachmentFindUniqueArgs) => {
        const attachment = attachments.find((row) => row.id === args.where.id);
        if (!attachment) return Promise.resolve(null);
        const notice = notices.find((row) => row.id === attachment.noticeId) ?? null;
        return Promise.resolve({
          ...attachment,
          ...(args.include?.notice ? { notice } : {}),
        });
      }),
    },
    notices,
    reads,
    attachments,
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
          attachmentCount: 0,
          totalAttachmentSizeBytes: 0,
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

  it('allows full-admin users to post notices with encrypted attachments', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const { caller, db } = makeCaller(headUser);
    mockUploadedAttachments({
      'notices/u_head/class-photo.png': { bytes: pngBytes, mimeType: 'image/png' },
      'notices/u_head/parent-form.docx': {
        bytes: docxBytes,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      'notices/u_head/prospectus.pdf': { bytes: pdfBytes, mimeType: 'application/pdf' },
    });

    const input = {
      title: 'Forms',
      body: 'Please read these files.',
      audience: 'Both',
      attachments: [
        attachmentInput(
          'prospectus.pdf',
          'application/pdf',
          pdfBytes.length,
          'notices/u_head/prospectus.pdf',
        ),
        attachmentInput(
          'class-photo.png',
          'image/png',
          pngBytes.length,
          'notices/u_head/class-photo.png',
        ),
        attachmentInput(
          'parent-form.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          docxBytes.length,
          'notices/u_head/parent-form.docx',
        ),
      ],
    } as unknown as Parameters<typeof caller.notice.post>[0];

    await expect(caller.notice.post(input)).resolves.toMatchObject({
      title: 'Forms',
      attachments: [
        {
          fileName: 'prospectus.pdf',
          mimeType: 'application/pdf',
          sizeBytes: pdfBytes.length,
          kind: 'pdf',
          canPreview: true,
        },
        {
          fileName: 'class-photo.png',
          mimeType: 'image/png',
          sizeBytes: pngBytes.length,
          kind: 'image',
          canPreview: true,
        },
        {
          fileName: 'parent-form.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: docxBytes.length,
          kind: 'document',
          canPreview: false,
        },
      ],
    });
    expect(db.attachments).toHaveLength(3);
    expect(db.attachments[0]).toMatchObject({
      originalFileNameEnc: 'enc:prospectus.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      storageBucket: 'notice-attachments',
      storagePathEnc: 'enc:notices/u_head/prospectus.pdf',
      position: 1,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StaffNotice',
        entityId: 'cmnotice00000000000000001',
        meta: {
          source: 'notice.post',
          audience: 'Both',
          expiresAt: null,
          attachmentCount: 3,
          totalAttachmentSizeBytes: pdfBytes.length + pngBytes.length + docxBytes.length,
        },
      },
    });
  });

  it('rejects invalid attachment uploads', async () => {
    const caller = makeCaller(headUser).caller;
    const validImage = attachmentInput(
      'photo.png',
      'image/png',
      pngBytes.length,
      'notices/u_head/photo.png',
    );
    const oversizedImage = attachmentInput(
      'large.png',
      'image/png',
      5_242_881,
      'notices/u_head/large.png',
    );
    const oversizedDocument = attachmentInput(
      'large.pdf',
      'application/pdf',
      10_485_761,
      'notices/u_head/large.pdf',
    );

    await expect(
      caller.notice.post({
        title: 'Too many',
        body: 'Body',
        attachments: Array.from({ length: 6 }, () => validImage),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.notice.post({
        title: 'Large image',
        body: 'Body',
        attachments: [oversizedImage],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.notice.post({
        title: 'Large document',
        body: 'Body',
        attachments: [oversizedDocument],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.notice.post({
        title: 'Unsupported',
        body: 'Body',
        attachments: [attachmentInput('notes.txt', 'text/plain', 5, 'notices/u_head/notes.txt')],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.notice.post({
        title: 'Mismatched',
        body: 'Body',
        attachments: [
          attachmentInput(
            'photo.png',
            'application/pdf',
            pngBytes.length,
            'notices/u_head/photo.png',
          ),
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.notice.post({
        title: 'Invalid storage path',
        body: 'Body',
        attachments: [attachmentInput('photo.png', 'image/png', pngBytes.length, '../photo.png')],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects uploaded files whose content does not match their attachment type', async () => {
    const caller = makeCaller(headUser).caller;
    const invalidPngBytes = Buffer.from('not a png');
    mockUploadedAttachments({
      'notices/u_head/photo.png': { bytes: invalidPngBytes, mimeType: 'image/png' },
    });

    await expect(
      caller.notice.post({
        title: 'Spoofed',
        body: 'Body',
        attachments: [
          attachmentInput(
            'photo.png',
            'image/png',
            invalidPngBytes.length,
            'notices/u_head/photo.png',
          ),
        ],
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

  it('allows ClubsAdmin callers to read staff notices', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({
      id: 'cmnotice00000000000000020',
      title: 'Club staff update',
      audience: 'Supervisors',
    });

    await expect(
      makeCaller(clubsAdminUser, makeFakeDb([notice])).caller.notice.listForStaff(),
    ).resolves.toEqual([
      expect.objectContaining({
        id: notice.id,
        title: 'Club staff update',
        audience: 'Supervisors',
      }),
    ]);
  });

  it.each([parentUser, studentUser, technicalSupportUser])('denies %s callers', async (user) => {
    await expect(makeCaller(user).caller.notice.listForStaff()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
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

describe('notice.prepareAttachments', () => {
  it('creates signed-upload metadata for full-admin notice attachments', async () => {
    const { caller } = makeCaller(headUser);

    const result = await caller.notice.prepareAttachments({
      attachments: [
        { fileName: 'Prospectus 2026.pdf', mimeType: 'application/pdf', sizeBytes: 9000 },
      ],
    });

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      fileName: 'Prospectus 2026.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9000,
      storageBucket: 'notice-attachments',
    });
    expect(result.attachments[0]?.storagePath).toMatch(
      /^notices\/u_head\/.+-Prospectus-2026\.pdf$/u,
    );
  });
});

describe('notice.downloadAttachment', () => {
  it('allows recipients to download attachments for active notices in their audience', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const notice = makeNotice({
      id: 'cmnotice00000000000000021',
      title: 'Parent file',
      audience: 'Parents',
    });
    const attachment: StoredAttachment = {
      id: 'cmattachment00000000000021',
      noticeId: notice.id,
      originalFileNameEnc: encrypt('prospectus.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      storageBucket: 'notice-attachments',
      storagePathEnc: encrypt('notices/u_head/prospectus.pdf'),
      position: 1,
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    };
    const { caller } = makeCaller(parentUser, makeFakeDb([notice], [], defaultUsers, [attachment]));
    const noticeApi = caller.notice as unknown as {
      downloadAttachment(input: { attachmentId: string }): Promise<{
        attachmentId: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        storageBucket: string;
        storagePath: string;
        kind: 'image' | 'pdf' | 'document';
        canPreview: boolean;
      }>;
    };

    await expect(
      noticeApi.downloadAttachment({ attachmentId: attachment.id }),
    ).resolves.toMatchObject({
      attachmentId: attachment.id,
      fileName: 'prospectus.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      storageBucket: 'notice-attachments',
      storagePath: 'notices/u_head/prospectus.pdf',
      kind: 'pdf',
      canPreview: true,
    });
  });

  it('does not leak attachments across audiences or unavailable notices', async () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    const parentNotice = makeNotice({
      id: 'cmnotice00000000000000022',
      title: 'Parent file',
      audience: 'Parents',
    });
    const expiredNotice = makeNotice({
      id: 'cmnotice00000000000000023',
      title: 'Expired file',
      audience: 'Both',
      expiresAt: new Date('2026-05-08T11:00:00.000Z'),
    });
    const parentAttachment: StoredAttachment = {
      id: 'cmattachment00000000000022',
      noticeId: parentNotice.id,
      originalFileNameEnc: encrypt('parent.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      storageBucket: 'notice-attachments',
      storagePathEnc: encrypt('notices/u_head/parent.pdf'),
      position: 1,
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    };
    const expiredAttachment: StoredAttachment = {
      id: 'cmattachment00000000000023',
      noticeId: expiredNotice.id,
      originalFileNameEnc: encrypt('expired.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      storageBucket: 'notice-attachments',
      storagePathEnc: encrypt('notices/u_head/expired.pdf'),
      position: 1,
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    };
    const db = makeFakeDb([parentNotice, expiredNotice], [], defaultUsers, [
      parentAttachment,
      expiredAttachment,
    ]);
    const supervisorNoticeApi = makeCaller(supervisorUser, db).caller.notice as unknown as {
      downloadAttachment(input: { attachmentId: string }): Promise<unknown>;
    };
    const parentNoticeApi = makeCaller(parentUser, db).caller.notice as unknown as {
      downloadAttachment(input: { attachmentId: string }): Promise<unknown>;
    };

    await expect(
      supervisorNoticeApi.downloadAttachment({ attachmentId: parentAttachment.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      parentNoticeApi.downloadAttachment({ attachmentId: expiredAttachment.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      parentNoticeApi.downloadAttachment({ attachmentId: 'cmattachment00000000000999' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
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
    db.staffNoticeRead.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrentRead);
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
    await expect(
      makeCaller(clubsAdminUser, db).caller.notice.markRead({ noticeId: supervisorNotice.id }),
    ).resolves.toMatchObject({ noticeId: supervisorNotice.id });
  });
});
