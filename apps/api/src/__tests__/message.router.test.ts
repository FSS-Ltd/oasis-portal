import { describe, expect, it, vi } from 'vitest';
import type { Role, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import type { EmailClient } from '../lib/email.js';
import { createMessageRouter } from '../routers/message.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'chead000000000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const principalUser: SessionUser = {
  id: 'cprincipal000000000001',
  role: 'Principal',
  tags: ['parent-message-responder'],
  requires2fa: false,
};
const untaggedPrincipalUser: SessionUser = {
  ...principalUser,
  id: 'cprincipal000000000002',
  tags: [],
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
const clubsAdminUser: SessionUser = {
  id: 'cclubsadmin0000000001',
  role: 'ClubsAdmin',
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
  id: 'cstudent0000000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

interface StoredUser {
  id: string;
  role: Role;
  active: boolean;
  fullNameEnc: string;
  emailEnc: string;
  tags: string[];
}

interface StoredThread {
  id: string;
  parentId: string;
  adminId: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredMessage {
  id: string;
  threadId: string;
  senderId: string;
  bodyEnc: string;
  createdAt: Date;
}

interface StoredMessageRead {
  messageId: string;
  userId: string;
  readAt: Date;
}

interface FakeThreadFindManyArgs {
  where?: {
    parentId?: string;
    adminId?: string;
  };
}

interface FakeThreadFindUniqueArgs {
  where: { id: string };
  select?: object;
  include?: object;
}

interface FakeThreadCreateArgs {
  data: {
    parentId: string;
    adminId: string;
    subject: string;
  };
}

interface FakeThreadUpdateArgs {
  where: { id: string };
  data: { updatedAt: Date };
  select: { updatedAt: true };
}

interface FakeMessageCreateArgs {
  data: {
    threadId: string;
    senderId: string;
    bodyEnc: string;
  };
}

interface FakeMessageReadCreateManyArgs {
  data: { messageId: string; userId: string }[];
  skipDuplicates: boolean;
}

interface FakeUserFindUniqueArgs {
  where: { id: string };
  select: object;
}

interface FakeUserFindManyArgs {
  where?: {
    active?: boolean;
    role?: { in: Role[] };
  };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string;
    action: 'Create' | 'Update';
    entity: 'MessageThread' | 'Message' | 'Email' | 'MessageRead';
    entityId: string | null;
    meta: Record<string, unknown>;
  };
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeThread(input: Partial<StoredThread> & Pick<StoredThread, 'id'>): StoredThread {
  return {
    parentId: parentUser.id,
    adminId: headUser.id,
    subject: 'Fees question',
    createdAt: new Date('2026-05-09T09:00:00.000Z'),
    updatedAt: new Date('2026-05-09T09:00:00.000Z'),
    ...input,
  };
}

function makeMessage(input: Partial<StoredMessage> & Pick<StoredMessage, 'id' | 'threadId'>) {
  return {
    senderId: parentUser.id,
    bodyEnc: encrypt('Hello'),
    createdAt: new Date('2026-05-09T09:05:00.000Z'),
    ...input,
  } satisfies StoredMessage;
}

function makeRead(input: Pick<StoredMessageRead, 'messageId' | 'userId'> & Partial<StoredMessageRead>) {
  return {
    readAt: new Date('2026-05-09T10:30:00.000Z'),
    ...input,
  } satisfies StoredMessageRead;
}

function makeUser(input: Pick<StoredUser, 'id' | 'role'> & Partial<StoredUser>): StoredUser {
  const label = input.role === 'Parent' ? 'Parent Guardian' : `${input.role} User`;
  return {
    active: true,
    fullNameEnc: encrypt(label),
    emailEnc: encrypt(`${input.id}@example.com`),
    tags: [],
    ...input,
  };
}

const defaultUsers: StoredUser[] = [
  makeUser({ id: headUser.id, role: headUser.role }),
  makeUser({ id: principalUser.id, role: principalUser.role, tags: [...principalUser.tags] }),
  makeUser({ id: untaggedPrincipalUser.id, role: untaggedPrincipalUser.role }),
  makeUser({ id: parentUser.id, role: parentUser.role, fullNameEnc: encrypt('Jane Parent') }),
  makeUser({
    id: otherParentUser.id,
    role: otherParentUser.role,
    fullNameEnc: encrypt('Other Parent'),
  }),
];

function makeFakeDb(
  initialThreads: StoredThread[] = [],
  initialMessages: StoredMessage[] = [],
  initialUsers: StoredUser[] = defaultUsers,
  initialReads: StoredMessageRead[] = [],
) {
  const threads = [...initialThreads];
  const messages = [...initialMessages];
  const users = [...initialUsers];
  const reads = [...initialReads];
  const auditCreate = vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args));

  const messagesForThread = (threadId: string) =>
    messages.filter((message) => message.threadId === threadId);
  const readsForMessage = (messageId: string) =>
    reads.filter((read) => read.messageId === messageId);
  const userFor = (userId: string) => {
    const user = users.find((row) => row.id === userId);
    if (!user) throw new Error(`user not found: ${userId}`);
    return user;
  };
  const threadWithUsers = (thread: StoredThread) => ({
    ...thread,
    parent: userFor(thread.parentId),
    admin: userFor(thread.adminId),
  });

  return {
    $enc: { encrypt, decrypt },
    auditLog: { create: auditCreate },
    user: {
      findUnique: vi.fn((args: FakeUserFindUniqueArgs) =>
        Promise.resolve(users.find((user) => user.id === args.where.id) ?? null),
      ),
      findMany: vi.fn((args: FakeUserFindManyArgs = {}) =>
        Promise.resolve(
          users
            .filter(
              (user) =>
                (args.where?.active === undefined || user.active === args.where.active) &&
                (!args.where?.role?.in || args.where.role.in.includes(user.role)),
            )
            .sort((a, b) => a.id.localeCompare(b.id)),
        ),
      ),
    },
    messageThread: {
      findMany: vi.fn((args: FakeThreadFindManyArgs = {}) =>
        Promise.resolve(
          threads
            .filter(
              (thread) =>
                (!args.where?.parentId || thread.parentId === args.where.parentId) &&
                (!args.where?.adminId || thread.adminId === args.where.adminId),
            )
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map((thread) => {
              const threadMessages = messagesForThread(thread.id).sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
              );
              return {
                ...threadWithUsers(thread),
                _count: { messages: threadMessages.length },
                messages: threadMessages.map((message) => ({
                  senderId: message.senderId,
                  createdAt: message.createdAt,
                  reads: readsForMessage(message.id),
                })),
              };
            }),
        ),
      ),
      findUnique: vi.fn((args: FakeThreadFindUniqueArgs) => {
        const thread = threads.find((row) => row.id === args.where.id);
        if (!thread) return Promise.resolve(null);
        if (args.include) {
          return Promise.resolve({
            ...threadWithUsers(thread),
            messages: messagesForThread(thread.id).sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            ).map((message) => ({
              ...message,
              reads: readsForMessage(message.id),
              sender: userFor(message.senderId),
            })),
          });
        }
        if (args.select) {
          return Promise.resolve({
            ...threadWithUsers(thread),
          });
        }
        return Promise.resolve(thread);
      }),
      create: vi.fn((args: FakeThreadCreateArgs) => {
        const thread: StoredThread = {
          id: 'cthread000000000000001',
          createdAt: new Date('2026-05-09T10:00:00.000Z'),
          updatedAt: new Date('2026-05-09T10:00:00.000Z'),
          ...args.data,
        };
        threads.push(thread);
        return Promise.resolve(thread);
      }),
      update: vi.fn((args: FakeThreadUpdateArgs) => {
        const index = threads.findIndex((thread) => thread.id === args.where.id);
        if (index === -1) throw new Error('thread not found');
        const current = threads[index];
        if (!current) throw new Error('thread not found');
        const updated = { ...current, updatedAt: args.data.updatedAt };
        threads[index] = updated;
        return Promise.resolve({ updatedAt: updated.updatedAt });
      }),
    },
    message: {
      create: vi.fn((args: FakeMessageCreateArgs) => {
        const message: StoredMessage = {
          id: 'cmessage00000000000001',
          createdAt: new Date('2026-05-09T10:05:00.000Z'),
          ...args.data,
        };
        messages.push(message);
        return Promise.resolve(message);
      }),
    },
    messageRead: {
      createMany: vi.fn((args: FakeMessageReadCreateManyArgs) => {
        let count = 0;
        for (const row of args.data) {
          const existing = reads.some(
            (read) => read.messageId === row.messageId && read.userId === row.userId,
          );
          if (existing && args.skipDuplicates) continue;
          reads.push({
            messageId: row.messageId,
            userId: row.userId,
            readAt: new Date('2026-05-09T10:35:00.000Z'),
          });
          count += 1;
        }
        return Promise.resolve({ count });
      }),
    },
    threads,
    messages,
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

function makeFakeEmailClient(result = { id: 'email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function makeCaller(
  user: SessionUser | null,
  db = makeFakeDb(),
  email = makeFakeEmailClient(),
) {
  const appRouter = router({ message: createMessageRouter({ emailClient: email.client }) });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db, email };
}

describe('message.openThread', () => {
  it('allows a parent to open an empty thread with an active full-admin assignee and audits creation', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(
      caller.message.openThread({
        adminId: headUser.id,
        subject: '  Attendance question  ',
      }),
    ).resolves.toMatchObject({
      id: 'cthread000000000000001',
      parentId: parentUser.id,
      adminId: headUser.id,
      subject: 'Attendance question',
    });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Create',
        entity: 'MessageThread',
        entityId: 'cthread000000000000001',
        meta: { source: 'message.openThread', adminId: headUser.id },
      },
    });
  });

  it('denies non-parent users', async () => {
    const { caller } = makeCaller(headUser);

    await expect(
      caller.message.openThread({ adminId: headUser.id, subject: 'Question' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows parent thread assignment to an untagged full-admin user', async () => {
    const { caller } = makeCaller(parentUser);

    await expect(
      caller.message.openThread({ adminId: untaggedPrincipalUser.id, subject: 'Question' }),
    ).resolves.toMatchObject({ adminId: untaggedPrincipalUser.id });
  });
});

describe('message.send', () => {
  it('allows a parent to send into their own thread, encrypts the body, updates the thread, audits, and notifies the assignee', async () => {
    const thread = makeThread({ id: 'cthread000000000000101' });
    const { caller, db, email } = makeCaller(parentUser, makeFakeDb([thread]));

    await expect(
      caller.message.send({
        threadId: thread.id,
        body: '  Please call me back.  ',
      }),
    ).resolves.toMatchObject({
      id: 'cmessage00000000000001',
      threadId: thread.id,
      senderId: parentUser.id,
      body: 'Please call me back.',
      threadUpdatedAt: new Date('2026-05-09T10:05:00.000Z'),
    });

    expect(db.messages[0]?.bodyEnc).toBe('enc:Please call me back.');
    expect(db.threads[0]?.updatedAt).toEqual(new Date('2026-05-09T10:05:00.000Z'));
    const sentEmail = email.send.mock.calls[0]?.[0];
    if (!sentEmail) throw new Error('expected notification email');
    expect(sentEmail.subject).toBe('New Oasis Portal message');
    expect(sentEmail.text).not.toContain('Please call me back.');
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Create',
        entity: 'Message',
        entityId: 'cmessage00000000000001',
        meta: { source: 'message.send', threadId: thread.id },
      },
    });
    const emailAudit = db.auditLog.create.mock.calls
      .map(([args]) => args)
      .find((args) => args.data.entity === 'Email');
    expect(emailAudit?.data).toMatchObject(
      {
        action: 'Create',
        entity: 'Email',
        meta: {
          emailStatus: 'Sent',
          source: 'message.send.notification',
          threadId: thread.id,
          toUserId: headUser.id,
        },
      },
    );
  });

  it('allows Head to respond to any parent thread', async () => {
    const otherParentThread = makeThread({
      id: 'cthread000000000000102',
      parentId: otherParentUser.id,
      adminId: principalUser.id,
    });
    const { caller } = makeCaller(headUser, makeFakeDb([otherParentThread]));

    await expect(
      caller.message.send({ threadId: otherParentThread.id, body: 'Thanks for the update.' }),
    ).resolves.toMatchObject({ senderId: headUser.id });
  });

  it('allows other full-admin users to respond when assigned', async () => {
    const assignedThread = makeThread({
      id: 'cthread000000000000105',
      parentId: parentUser.id,
      adminId: principalUser.id,
    });
    const { caller } = makeCaller(principalUser, makeFakeDb([assignedThread]));

    await expect(
      caller.message.send({ threadId: assignedThread.id, body: 'I can help with this.' }),
    ).resolves.toMatchObject({ senderId: principalUser.id });
  });

  it('allows untagged full-admin users to respond to parent threads', async () => {
    const assignedThread = makeThread({
      id: 'cthread000000000000106',
      parentId: parentUser.id,
      adminId: untaggedPrincipalUser.id,
    });
    const { caller } = makeCaller(untaggedPrincipalUser, makeFakeDb([assignedThread]));

    await expect(
      caller.message.send({ threadId: assignedThread.id, body: 'I can help with this.' }),
    ).resolves.toMatchObject({ senderId: untaggedPrincipalUser.id });
  });

  it('keeps the saved portal message when notification email delivery fails', async () => {
    const thread = makeThread({ id: 'cthread000000000000107' });
    const failingEmail = makeFakeEmailClient();
    failingEmail.send.mockRejectedValueOnce(new Error('resend unavailable'));
    const { caller, db } = makeCaller(parentUser, makeFakeDb([thread]), failingEmail);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        caller.message.send({ threadId: thread.id, body: 'This should still save.' }),
      ).resolves.toMatchObject({
        id: 'cmessage00000000000001',
        body: 'This should still save.',
      });
    } finally {
      errorSpy.mockRestore();
    }

    expect(db.messages).toHaveLength(1);
    const failedNotificationAudit = db.auditLog.create.mock.calls
      .map(([args]) => args)
      .find(
        (args) =>
          args.data.entity === 'Message' &&
          args.data.action === 'Update' &&
          args.data.meta['source'] === 'message.send.notification',
      );
    expect(failedNotificationAudit?.data).toMatchObject({
        action: 'Update',
        entity: 'Message',
        entityId: 'cmessage00000000000001',
        meta: {
          emailStatus: 'Failed',
          source: 'message.send.notification',
          threadId: thread.id,
        },
    });
  });

  it('denies parent and assigned-admin boundary violations', async () => {
    const otherParentThread = makeThread({
      id: 'cthread000000000000103',
      parentId: otherParentUser.id,
      adminId: headUser.id,
    });
    const unassignedThread = makeThread({
      id: 'cthread000000000000104',
      parentId: parentUser.id,
      adminId: headUser.id,
    });

    await expect(
      makeCaller(parentUser, makeFakeDb([otherParentThread])).caller.message.send({
        threadId: otherParentThread.id,
        body: 'Wrong thread',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      makeCaller(principalUser, makeFakeDb([unassignedThread])).caller.message.send({
        threadId: unassignedThread.id,
        body: 'Full admin can respond',
      }),
    ).resolves.toMatchObject({ senderId: principalUser.id });
  });
});

describe('message.listRecipients', () => {
  it('returns active full-admin recipients for parents', async () => {
    const inactiveTagged = makeUser({
      id: 'cpastor000000000000001',
      role: 'Pastor',
      active: false,
      tags: ['parent-message-responder'],
    });
    const { caller } = makeCaller(
      parentUser,
      makeFakeDb([], [], [...defaultUsers, inactiveTagged]),
    );

    await expect(caller.message.listRecipients()).resolves.toEqual([
      expect.objectContaining({ id: headUser.id, role: 'Head' }),
      expect.objectContaining({ id: principalUser.id, role: 'Principal' }),
      expect.objectContaining({ id: untaggedPrincipalUser.id, role: 'Principal' }),
    ]);
  });

  it('denies non-parent users', async () => {
    const { caller } = makeCaller(headUser);

    await expect(caller.message.listRecipients()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('message.listThreads', () => {
  it('scopes parent threads and returns summaries without decrypting message bodies', async () => {
    const parentThread = makeThread({
      id: 'cthread000000000000201',
      parentId: parentUser.id,
      updatedAt: new Date('2026-05-09T11:00:00.000Z'),
    });
    const otherThread = makeThread({
      id: 'cthread000000000000202',
      parentId: otherParentUser.id,
      updatedAt: new Date('2026-05-09T12:00:00.000Z'),
    });
    const message = makeMessage({
      id: 'cmessage00000000000201',
      threadId: parentThread.id,
      senderId: headUser.id,
      createdAt: new Date('2026-05-09T11:05:00.000Z'),
    });
    const db = makeFakeDb([parentThread, otherThread], [message]);
    const decryptSpy = vi.spyOn(db.$enc, 'decrypt');
    const { caller } = makeCaller(parentUser, db);

    await expect(caller.message.listThreads()).resolves.toMatchObject([
      {
        id: parentThread.id,
        subject: parentThread.subject,
        parentId: parentUser.id,
        adminId: headUser.id,
        createdAt: parentThread.createdAt,
        updatedAt: parentThread.updatedAt,
        messageCount: 1,
        unreadCount: 1,
        latestMessage: {
          senderId: headUser.id,
          createdAt: message.createdAt,
          readByCurrentUser: false,
        },
      },
    ]);
    expect(decryptSpy).not.toHaveBeenCalledWith(message.bodyEnc);
  });

  it('lets full-admin users see all threads', async () => {
    const headAssigned = makeThread({
      id: 'cthread000000000000203',
      adminId: headUser.id,
      updatedAt: new Date('2026-05-09T11:00:00.000Z'),
    });
    const principalAssigned = makeThread({
      id: 'cthread000000000000204',
      adminId: principalUser.id,
      updatedAt: new Date('2026-05-09T12:00:00.000Z'),
    });
    const db = makeFakeDb([headAssigned, principalAssigned]);

    await expect(makeCaller(headUser, db).caller.message.listThreads()).resolves.toHaveLength(2);
    await expect(makeCaller(principalUser, db).caller.message.listThreads()).resolves.toHaveLength(
      2,
    );
  });
});

describe('message.listInThread', () => {
  it('returns decrypted messages in ascending order for an accessible thread', async () => {
    const thread = makeThread({ id: 'cthread000000000000301' });
    const earlier = makeMessage({
      id: 'cmessage00000000000301',
      threadId: thread.id,
      senderId: parentUser.id,
      bodyEnc: encrypt('First'),
      createdAt: new Date('2026-05-09T09:05:00.000Z'),
    });
    const later = makeMessage({
      id: 'cmessage00000000000302',
      threadId: thread.id,
      senderId: headUser.id,
      bodyEnc: encrypt('Second'),
      createdAt: new Date('2026-05-09T09:10:00.000Z'),
    });
    const db = makeFakeDb([thread], [later, earlier]);
    const { caller } = makeCaller(parentUser, db);

    await expect(caller.message.listInThread({ threadId: thread.id })).resolves.toMatchObject({
      id: thread.id,
      parentId: parentUser.id,
      adminId: headUser.id,
      messages: [
        { id: earlier.id, body: 'First', readByCurrentUser: true },
        { id: later.id, body: 'Second', readByCurrentUser: true },
      ],
    });
    expect(db.reads).toHaveLength(1);
    expect(db.reads[0]?.messageId).toBe(later.id);
    expect(db.reads[0]?.userId).toBe(parentUser.id);
    const readAudit = db.auditLog.create.mock.calls
      .map(([args]) => args)
      .find((args) => args.data.entity === 'MessageRead');
    expect(readAudit?.data).toMatchObject({
        action: 'Create',
        entity: 'MessageRead',
        meta: {
          count: 1,
          source: 'message.listInThread.markRead',
          threadId: thread.id,
        },
    });
  });

  it('returns read receipts for messages sent by the current user', async () => {
    const thread = makeThread({ id: 'cthread000000000000304' });
    const parentMessage = makeMessage({
      id: 'cmessage00000000000304',
      threadId: thread.id,
      senderId: parentUser.id,
      bodyEnc: encrypt('Can you confirm?'),
    });
    const read = makeRead({ messageId: parentMessage.id, userId: headUser.id });
    const { caller } = makeCaller(parentUser, makeFakeDb([thread], [parentMessage], defaultUsers, [read]));

    await expect(caller.message.listInThread({ threadId: thread.id })).resolves.toMatchObject({
      messages: [
        {
          id: parentMessage.id,
          readByCurrentUser: true,
          readByOtherParticipant: true,
        },
      ],
    });
  });

  it('denies unsupported roles', async () => {
    const thread = makeThread({ id: 'cthread000000000000302' });
    const deniedUsers = [supervisorUser, clubsAdminUser, technicalSupportUser, studentUser];

    for (const user of deniedUsers) {
      await expect(
        makeCaller(user, makeFakeDb([thread])).caller.message.listInThread({
          threadId: thread.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('hides another parent account thread from parent readers', async () => {
    const otherParentThread = makeThread({
      id: 'cthread000000000000303',
      parentId: otherParentUser.id,
      adminId: headUser.id,
    });

    await expect(
      makeCaller(parentUser, makeFakeDb([otherParentThread])).caller.message.listInThread({
        threadId: otherParentThread.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
