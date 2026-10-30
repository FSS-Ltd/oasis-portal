import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import {
  createAccountDeletionRouter,
  type AccountDeletionClerkAdapter,
} from '../routers/accountDeletion.js';
import type { EmailClient, SendEmailInput } from '../lib/email.js';
import { TECHNICAL_SUPPORT_EMAIL } from '../services/account-deletion-alerts.js';
import { router } from '../trpc.js';

const user = (id: string, role: SessionUser['role']): SessionUser => ({
  id,
  role,
  tags: [],
  requires2fa: false,
});

interface UpdateArgs {
  where: { id: string };
  data: {
    active?: boolean;
    deletedAt?: Date;
    deletionRequestedAt?: Date | null;
    deletionRequestedById?: string | null;
  };
}

interface AuditArgs {
  data: { userId: string; entity: string; entityId?: string; meta: unknown };
}

interface SetupOptions {
  actor: SessionUser;
  guardian?: { student: { userId: string | null; dobEnc: string } } | null;
  ownStudentDob?: string | null;
  subject?: {
    id: string;
    clerkId?: string;
    role?: SessionUser['role'];
    deletedAt?: Date | null;
    deletionRequestedAt?: Date | null;
  } | null;
  clerkFails?: boolean;
  admins?: { id: string; emailEnc: string }[];
  devices?: { id: string; tokenEnc: string }[];
}

function setup({
  actor,
  guardian = null,
  ownStudentDob = null,
  subject,
  clerkFails,
  admins = [],
  devices = [],
}: SetupOptions) {
  const target = subject === undefined ? { id: actor.id } : subject;
  const userFindUnique = vi.fn().mockResolvedValue(
    target
      ? {
          clerkId: 'clerk_target',
          role: 'Parent',
          fullNameEnc: 'Dana Delete Demo',
          deletedAt: null,
          deletionRequestedAt: null,
          ...target,
        }
      : null,
  );
  const userUpdate = vi
    .fn<(args: UpdateArgs) => Promise<{ id: string }>>()
    .mockResolvedValue({ id: target?.id ?? 'x' });
  const audit = vi.fn<(args: AuditArgs) => Promise<object>>().mockResolvedValue({});
  const db = {
    user: {
      findUnique: userFindUnique,
      update: userUpdate,
      findMany: vi.fn().mockResolvedValue(admins),
    },
    pushDeviceToken: {
      findMany: vi.fn().mockResolvedValue(devices),
      deleteMany: vi.fn(),
    },
    guardian: { findFirst: vi.fn().mockResolvedValue(guardian) },
    student: {
      findUnique: vi.fn().mockResolvedValue(ownStudentDob ? { dobEnc: ownStudentDob } : null),
    },
    auditLog: { create: audit },
    $enc: { decrypt: (value: string) => value },
  };
  const deleteUser = vi.fn<AccountDeletionClerkAdapter['deleteUser']>(() =>
    clerkFails ? Promise.reject(new Error('clerk down')) : Promise.resolve(),
  );
  const sentEmails: SendEmailInput[] = [];
  const emailClient: EmailClient = {
    send(input) {
      sentEmails.push(input);
      return Promise.resolve({ id: 'email_1' });
    },
  };
  const ctx = makeTestContext({ db, user: actor, rls: { kind: 'db', db } });
  const caller = router({
    accountDeletion: createAccountDeletionRouter({ clerk: { deleteUser }, emailClient }),
  }).createCaller(ctx);
  return { caller, db, userFindUnique, userUpdate, audit, deleteUser, sentEmails };
}

describe('accountDeletion.request', () => {
  it('lets a parent request deletion of their own account and audits it', async () => {
    const { caller, userUpdate, audit } = setup({ actor: user('p1', 'Parent') });
    await caller.accountDeletion.request({});
    const data = userUpdate.mock.calls[0]?.[0].data;
    expect(userUpdate.mock.calls[0]?.[0].where).toEqual({ id: 'p1' });
    expect(data?.deletionRequestedAt).toBeInstanceOf(Date);
    expect(data?.deletionRequestedById).toBe('p1');
    expect(audit.mock.calls[0]?.[0].data).toMatchObject({
      userId: 'p1',
      entity: 'User',
      entityId: 'p1',
      meta: { source: 'accountDeletion.request' },
    });
  });

  it('alerts Head and Technical Support by push and email, skipping synthetic addresses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { caller, db, sentEmails } = setup({
        actor: user('p1', 'Parent'),
        admins: [
          { id: 'h1', emailEnc: 'Head@School.org' },
          { id: 't1', emailEnc: 'oasis-review-staff@appreview.demo.oasisportal.space' },
        ],
        devices: [{ id: 'd1', tokenEnc: 'ExponentPushToken[abc]' }],
      });
      await caller.accountDeletion.request({});

      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { in: ['Head', 'TechnicalSupport'] }, active: true, deletedAt: null },
        }),
      );
      expect(db.pushDeviceToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { in: ['h1', 't1'] } }) as unknown,
        }),
      );
      const init = fetchMock.mock.calls[0]?.[1] as { body: string };
      expect(JSON.parse(init.body)).toEqual([
        expect.objectContaining({
          to: 'ExponentPushToken[abc]',
          data: { area: 'account-deletion', userId: 'p1' },
        }),
      ]);
      expect(sentEmails.map((email) => email.to)).toEqual([
        TECHNICAL_SUPPORT_EMAIL,
        'head@school.org',
      ]);
      expect(sentEmails[0]?.text).toContain('Dana Delete Demo (Parent)');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('still saves the request when the alert cannot be sent', async () => {
    const { caller, db, userUpdate } = setup({ actor: user('p1', 'Parent') });
    db.user.findMany.mockRejectedValue(new Error('db down'));
    await expect(caller.accountDeletion.request({})).resolves.toEqual({ id: 'p1' });
    expect(userUpdate).toHaveBeenCalledOnce();
  });

  it('rejects a second pending request', async () => {
    const { caller, userUpdate } = setup({
      actor: user('p1', 'Parent'),
      subject: { id: 'p1', deletionRequestedAt: new Date() },
    });
    await expect(caller.accountDeletion.request({})).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('lets a linked parent request deletion of an under-18 student account', async () => {
    const { caller, userUpdate } = setup({
      actor: user('p1', 'Parent'),
      guardian: { student: { userId: 'su1', dobEnc: '2012-01-01' } },
      subject: { id: 'su1', role: 'Student' },
    });
    await caller.accountDeletion.request({ studentId: 'st1' });
    expect(userUpdate.mock.calls[0]?.[0].where).toEqual({ id: 'su1' });
    expect(userUpdate.mock.calls[0]?.[0].data.deletionRequestedById).toBe('p1');
  });

  it('rejects a parent who is not linked to the student', async () => {
    const { caller, userUpdate } = setup({ actor: user('p2', 'Parent'), guardian: null });
    await expect(caller.accountDeletion.request({ studentId: 'st1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('refuses parent requests for a student who is 18 or older', async () => {
    const { caller } = setup({
      actor: user('p1', 'Parent'),
      guardian: { student: { userId: 'su1', dobEnc: '2000-01-01' } },
    });
    await expect(caller.accountDeletion.request({ studentId: 'st1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('refuses a child request for a student without a login', async () => {
    const { caller } = setup({
      actor: user('p1', 'Parent'),
      guardian: { student: { userId: null, dobEnc: '2012-01-01' } },
    });
    await expect(caller.accountDeletion.request({ studentId: 'st1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses an under-18 student requesting for themselves', async () => {
    const { caller, userUpdate } = setup({
      actor: user('su1', 'Student'),
      ownStudentDob: '2012-01-01',
    });
    await expect(caller.accountDeletion.request({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('lets a student aged 18 or over request for themselves', async () => {
    const { caller, userUpdate } = setup({
      actor: user('su1', 'Student'),
      ownStudentDob: '2000-01-01',
    });
    await caller.accountDeletion.request({});
    expect(userUpdate).toHaveBeenCalledOnce();
  });

  it('does not let a student request on behalf of another student', async () => {
    const { caller } = setup({ actor: user('s1', 'Student') });
    await expect(caller.accountDeletion.request({ studentId: 'st1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('accountDeletion.cancel', () => {
  it('clears a pending request and audits it', async () => {
    const { caller, userUpdate, audit } = setup({
      actor: user('p1', 'Parent'),
      subject: { id: 'p1', deletionRequestedAt: new Date() },
    });
    await caller.accountDeletion.cancel({});
    expect(userUpdate.mock.calls[0]?.[0].data).toEqual({
      deletionRequestedAt: null,
      deletionRequestedById: null,
    });
    expect(audit.mock.calls[0]?.[0].data.meta).toEqual({ source: 'accountDeletion.cancel' });
  });

  it('reports not found when nothing is pending', async () => {
    const { caller } = setup({ actor: user('p1', 'Parent') });
    await expect(caller.accountDeletion.cancel({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('accountDeletion admin queue', () => {
  it('denies non-admins', async () => {
    const { caller, userUpdate } = setup({ actor: user('p1', 'Parent') });
    await expect(caller.accountDeletion.approve({ userId: 'x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.accountDeletion.decline({ userId: 'x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.accountDeletion.queue()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('lists pending requests with decrypted names and audits the read', async () => {
    const { caller, db, audit } = setup({ actor: user('h1', 'Head') });
    db.user.findMany.mockResolvedValue([
      {
        id: 'p1',
        role: 'Parent',
        fullNameEnc: 'Pat Parent',
        deletionRequestedAt: new Date('2026-10-01'),
        deletionRequestedById: 'p1',
      },
    ]);
    const rows = await caller.accountDeletion.queue();
    expect(rows).toEqual([
      {
        userId: 'p1',
        fullName: 'Pat Parent',
        role: 'Parent',
        requestedAt: new Date('2026-10-01'),
        requestedBySelf: true,
      },
    ]);
    expect(audit.mock.calls[0]?.[0].data.meta).toEqual({
      count: 1,
      source: 'accountDeletion.queue',
    });
  });

  it('approves a pending request, deactivates the account, then deletes the Clerk user', async () => {
    const { caller, userUpdate, deleteUser } = setup({
      actor: user('h1', 'Head'),
      subject: { id: 'p1', deletionRequestedAt: new Date() },
    });
    await expect(caller.accountDeletion.approve({ userId: 'p1' })).resolves.toEqual({
      id: 'p1',
      clerkUserDeleted: true,
    });
    const data = userUpdate.mock.calls.at(-1)?.[0].data;
    expect(data?.active).toBe(false);
    expect(data?.deletedAt).toBeInstanceOf(Date);
    expect(deleteUser).toHaveBeenCalledWith('clerk_target');
  });

  it('keeps the account deleted and reports when the Clerk deletion fails', async () => {
    const { caller } = setup({
      actor: user('h1', 'Head'),
      subject: { id: 'p1', deletionRequestedAt: new Date() },
      clerkFails: true,
    });
    await expect(caller.accountDeletion.approve({ userId: 'p1' })).resolves.toEqual({
      id: 'p1',
      clerkUserDeleted: false,
    });
  });

  it('refuses to approve an account with no pending request', async () => {
    const { caller, userUpdate, deleteUser } = setup({
      actor: user('h1', 'Head'),
      subject: { id: 'p1' },
    });
    await expect(caller.accountDeletion.approve({ userId: 'p1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(userUpdate).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('declines a request by clearing it and auditing', async () => {
    const { caller, userUpdate, audit, deleteUser } = setup({
      actor: user('h1', 'Head'),
      subject: { id: 'p1', deletionRequestedAt: new Date() },
    });
    await caller.accountDeletion.decline({ userId: 'p1' });
    expect(userUpdate.mock.calls[0]?.[0].data).toEqual({
      deletionRequestedAt: null,
      deletionRequestedById: null,
    });
    expect(audit.mock.calls[0]?.[0].data.meta).toEqual({ source: 'accountDeletion.decline' });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
