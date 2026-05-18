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
const headOfDisciplineUser: SessionUser = {
  id: 'cheadofdiscipline0001',
  role: 'HeadOfDiscipline',
  tags: [],
  requires2fa: false,
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
  kind: 'ParentStaff' | 'SupervisorHead' | 'StaffDirect' | 'Staffroom';
  parentId: string | null;
  supervisorId: string | null;
  adminId: string | null;
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

interface StoredMessageThreadParticipant {
  threadId: string;
  userId: string;
  createdAt: Date;
}

interface FakeThreadFindManyArgs {
  where?: {
    kind?: 'ParentStaff' | 'SupervisorHead' | 'StaffDirect' | 'Staffroom';
    parentId?: string;
    supervisorId?: string;
    adminId?: string;
    participants?: { some: { userId: string } };
  };
}

interface FakeThreadFindUniqueArgs {
  where: { id: string };
  select?: object;
  include?: object;
}

interface FakeThreadCreateArgs {
  data: {
    kind: 'ParentStaff' | 'SupervisorHead' | 'StaffDirect' | 'Staffroom';
    parentId: string | null;
    supervisorId: string | null;
    adminId: string | null;
    subject: string;
    participants?: { create: { userId: string }[] };
  };
  select?: { id: true };
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
    OR?: Array<{ role?: Role; tags?: { has: string } }>;
    role?: { in: Role[] };
  };
  select?: object;
  orderBy?: object;
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

interface FakeThreadParticipantCreateManyArgs {
  data: { threadId: string; userId: string }[];
  skipDuplicates: boolean;
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
    kind: 'ParentStaff',
    parentId: parentUser.id,
    supervisorId: null,
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

function makeRead(
  input: Pick<StoredMessageRead, 'messageId' | 'userId'> & Partial<StoredMessageRead>,
) {
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
  makeUser({ id: headOfDisciplineUser.id, role: headOfDisciplineUser.role }),
  makeUser({ id: parentUser.id, role: parentUser.role, fullNameEnc: encrypt('Jane Parent') }),
  makeUser({
    id: supervisorUser.id,
    role: supervisorUser.role,
    fullNameEnc: encrypt('Sue Supervisor'),
  }),
  makeUser({ id: clubsAdminUser.id, role: clubsAdminUser.role }),
  makeUser({ id: technicalSupportUser.id, role: technicalSupportUser.role }),
  makeUser({ id: studentUser.id, role: studentUser.role }),
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
  initialParticipants?: StoredMessageThreadParticipant[],
) {
  const threads = [...initialThreads];
  const messages = [...initialMessages];
  const users = [...initialUsers];
  const reads = [...initialReads];
  const participants =
    initialParticipants ??
    initialThreads.flatMap((thread) => {
      const userIds =
        thread.kind === 'ParentStaff'
          ? [thread.parentId, thread.adminId]
          : thread.kind === 'SupervisorHead'
            ? [thread.supervisorId, thread.adminId]
            : [];

      return [...new Set(userIds)]
        .filter((userId): userId is string => Boolean(userId))
        .map((userId) => ({
          threadId: thread.id,
          userId,
          createdAt: thread.createdAt,
        }));
    });
  const auditCreate = vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args));

  const messagesForThread = (threadId: string) =>
    messages.filter((message) => message.threadId === threadId);
  const readsForMessage = (messageId: string) =>
    reads.filter((read) => read.messageId === messageId);
  const participantsForThread = (threadId: string) =>
    participants.filter((participant) => participant.threadId === threadId);
  const userFor = (userId: string) => {
    const user = users.find((row) => row.id === userId);
    if (!user) throw new Error(`user not found: ${userId}`);
    return user;
  };
  const threadWithUsers = (thread: StoredThread) => ({
    ...thread,
    parent: thread.parentId ? userFor(thread.parentId) : null,
    supervisor: thread.supervisorId ? userFor(thread.supervisorId) : null,
    admin: thread.adminId ? userFor(thread.adminId) : null,
    participants: participantsForThread(thread.id).map((participant) => ({
      userId: participant.userId,
      user: userFor(participant.userId),
    })),
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
                (!args.where?.role?.in || args.where.role.in.includes(user.role)) &&
                (!args.where?.OR ||
                  args.where.OR.some(
                    (condition) =>
                      (condition.role === undefined || user.role === condition.role) &&
                      (condition.tags === undefined || user.tags.includes(condition.tags.has)),
                  )),
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
                (!args.where?.kind || thread.kind === args.where.kind) &&
                (!args.where?.parentId || thread.parentId === args.where.parentId) &&
                (!args.where?.supervisorId || thread.supervisorId === args.where.supervisorId) &&
                (!args.where?.adminId || thread.adminId === args.where.adminId) &&
                (!args.where?.participants?.some.userId ||
                  participants.some(
                    (participant) =>
                      participant.threadId === thread.id &&
                      participant.userId === args.where?.participants?.some.userId,
                  )),
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
            messages: messagesForThread(thread.id)
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
              .map((message) => ({
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
      findFirst: vi.fn((args: FakeThreadFindManyArgs = {}) =>
        Promise.resolve(
          threads.find(
            (thread) =>
              (!args.where?.kind || thread.kind === args.where.kind) &&
              (!args.where?.participants?.some.userId ||
                participants.some(
                  (participant) =>
                    participant.threadId === thread.id &&
                    participant.userId === args.where?.participants?.some.userId,
                )),
          ) ?? null,
        ),
      ),
      create: vi.fn((args: FakeThreadCreateArgs) => {
        const thread: StoredThread = {
          id: 'cthread000000000000001',
          createdAt: new Date('2026-05-09T10:00:00.000Z'),
          updatedAt: new Date('2026-05-09T10:00:00.000Z'),
          ...args.data,
        };
        threads.push(thread);
        for (const participant of args.data.participants?.create ?? []) {
          participants.push({
            threadId: thread.id,
            userId: participant.userId,
            createdAt: thread.createdAt,
          });
        }
        return Promise.resolve(args.select ? { id: thread.id } : thread);
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
    messageThreadParticipant: {
      createMany: vi.fn((args: FakeThreadParticipantCreateManyArgs) => {
        let count = 0;
        for (const row of args.data) {
          const existing = participants.some(
            (participant) =>
              participant.threadId === row.threadId && participant.userId === row.userId,
          );
          if (existing && args.skipDuplicates) continue;
          participants.push({
            threadId: row.threadId,
            userId: row.userId,
            createdAt: new Date('2026-05-09T10:40:00.000Z'),
          });
          count += 1;
        }
        return Promise.resolve({ count });
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
    participants,
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

function makeCaller(user: SessionUser | null, db = makeFakeDb(), email = makeFakeEmailClient()) {
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
      kind: 'ParentStaff',
      parentId: parentUser.id,
      supervisorId: null,
      adminId: headUser.id,
      subject: 'Attendance question',
    });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Create',
        entity: 'MessageThread',
        entityId: 'cthread000000000000001',
        meta: { source: 'message.openThread', recipientId: headUser.id, kind: 'ParentStaff' },
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

  it('allows a supervisor to open a Head thread', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(
      caller.message.openThread({
        adminId: headUser.id,
        kind: 'SupervisorHead',
        subject: 'Sensitive note follow-up',
      }),
    ).resolves.toMatchObject({
      kind: 'SupervisorHead',
      parentId: null,
      supervisorId: supervisorUser.id,
      adminId: headUser.id,
    });

    expect(db.threads[0]).toMatchObject({
      kind: 'SupervisorHead',
      parentId: null,
      supervisorId: supervisorUser.id,
    });
  });

  it('allows any active staff user to open a private staff direct thread', async () => {
    const { caller, db } = makeCaller(headOfDisciplineUser);

    await expect(
      caller.message.openThread({
        adminId: supervisorUser.id,
        kind: 'StaffDirect',
        subject: 'Behaviour follow-up',
      }),
    ).resolves.toMatchObject({
      kind: 'StaffDirect',
      parentId: null,
      supervisorId: null,
      adminId: null,
      subject: 'Behaviour follow-up',
    });

    expect(db.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          threadId: 'cthread000000000000001',
          userId: headOfDisciplineUser.id,
        }),
        expect.objectContaining({
          threadId: 'cthread000000000000001',
          userId: supervisorUser.id,
        }),
      ]),
    );
  });

  it('blocks parents from opening staff direct threads', async () => {
    const { caller } = makeCaller(parentUser);

    await expect(
      caller.message.openThread({
        adminId: supervisorUser.id,
        kind: 'StaffDirect',
        subject: 'Staff only',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
    expect(emailAudit?.data).toMatchObject({
      action: 'Create',
      entity: 'Email',
      meta: {
        emailStatus: 'Sent',
        source: 'message.send.notification',
        threadId: thread.id,
        toUserId: headUser.id,
      },
    });
  });

  it('allows Head to respond when Head is a participant', async () => {
    const headThread = makeThread({
      id: 'cthread000000000000102',
      parentId: otherParentUser.id,
      adminId: headUser.id,
    });
    const { caller } = makeCaller(headUser, makeFakeDb([headThread]));

    await expect(
      caller.message.send({ threadId: headThread.id, body: 'Thanks for the update.' }),
    ).resolves.toMatchObject({ senderId: headUser.id });
  });

  it('blocks HeadOfDiscipline from a parent thread addressed to Head', async () => {
    const headThread = makeThread({
      id: 'cthread000000000000109',
      parentId: otherParentUser.id,
      adminId: headUser.id,
    });
    const { caller } = makeCaller(headOfDisciplineUser, makeFakeDb([headThread]));

    await expect(
      caller.message.send({ threadId: headThread.id, body: 'I should not see this.' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
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

  it('allows supervisor and Head replies in supervisor threads', async () => {
    const supervisorThread = makeThread({
      id: 'cthread000000000000108',
      kind: 'SupervisorHead',
      parentId: null,
      supervisorId: supervisorUser.id,
      adminId: headUser.id,
    });
    const email = makeFakeEmailClient();
    const db = makeFakeDb([supervisorThread]);

    await expect(
      makeCaller(supervisorUser, db, email).caller.message.send({
        threadId: supervisorThread.id,
        body: 'Please review this.',
      }),
    ).resolves.toMatchObject({ senderId: supervisorUser.id });

    await expect(
      makeCaller(headUser, db, email).caller.message.send({
        threadId: supervisorThread.id,
        body: 'Seen, thank you.',
      }),
    ).resolves.toMatchObject({ senderId: headUser.id });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('does not email staff direct message recipients', async () => {
    const staffDirectThread = makeThread({
      id: 'cthread000000000000110',
      kind: 'StaffDirect',
      parentId: null,
      supervisorId: null,
      adminId: null,
    });
    const participants = [
      { threadId: staffDirectThread.id, userId: headUser.id, createdAt: staffDirectThread.createdAt },
      {
        threadId: staffDirectThread.id,
        userId: supervisorUser.id,
        createdAt: staffDirectThread.createdAt,
      },
    ];
    const email = makeFakeEmailClient();
    const { caller } = makeCaller(
      headUser,
      makeFakeDb([staffDirectThread], [], defaultUsers, [], participants),
      email,
    );

    await expect(
      caller.message.send({ threadId: staffDirectThread.id, body: 'Staff-only note.' }),
    ).resolves.toMatchObject({ senderId: headUser.id });
    expect(email.send).not.toHaveBeenCalled();
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
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
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
    ]);
  });

  it('denies non-parent users', async () => {
    const { caller } = makeCaller(headUser);

    await expect(caller.message.listRecipients()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns Head and tagged recipients for supervisors', async () => {
    const { caller } = makeCaller(supervisorUser);

    await expect(caller.message.listRecipients({ kind: 'SupervisorHead' })).resolves.toEqual([
      expect.objectContaining({ id: headUser.id, role: 'Head' }),
      expect.objectContaining({ id: principalUser.id, role: 'Principal' }),
    ]);
  });

  it('returns active staff recipients for staff direct messages and hides parents', async () => {
    const { caller } = makeCaller(headUser);

    await expect(caller.message.listRecipients({ kind: 'StaffDirect' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: principalUser.id, role: 'Principal' }),
        expect.objectContaining({ id: headOfDisciplineUser.id, role: 'HeadOfDiscipline' }),
        expect.objectContaining({ id: supervisorUser.id, role: 'Supervisor' }),
        expect.objectContaining({ id: technicalSupportUser.id, role: 'TechnicalSupport' }),
      ]),
    );
    const recipients = await caller.message.listRecipients({ kind: 'StaffDirect' });
    expect(recipients).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: parentUser.id }),
        expect.objectContaining({ id: studentUser.id }),
        expect.objectContaining({ id: headUser.id }),
      ]),
    );
  });

  it('blocks parents from listing staff direct recipients', async () => {
    const { caller } = makeCaller(parentUser);

    await expect(caller.message.listRecipients({ kind: 'StaffDirect' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
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

  it('scopes full-admin users to participant threads only', async () => {
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

    await expect(makeCaller(headUser, db).caller.message.listThreads()).resolves.toMatchObject([
      { id: headAssigned.id },
    ]);
    await expect(makeCaller(principalUser, db).caller.message.listThreads()).resolves.toHaveLength(
      1,
    );
    await expect(
      makeCaller(headOfDisciplineUser, db).caller.message.listThreads(),
    ).resolves.toHaveLength(0);
  });
});

describe('message.openStaffroom', () => {
  it('creates a staffroom for active staff and blocks parents', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);

    await expect(caller.message.openStaffroom()).resolves.toEqual({
      id: 'cthread000000000000001',
    });
    expect(db.threads[0]).toMatchObject({
      kind: 'Staffroom',
      parentId: null,
      supervisorId: null,
      adminId: null,
      subject: 'Staffroom',
    });
    expect(db.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: headUser.id }),
        expect.objectContaining({ userId: headOfDisciplineUser.id }),
        expect.objectContaining({ userId: supervisorUser.id }),
        expect.objectContaining({ userId: technicalSupportUser.id }),
      ]),
    );

    await expect(makeCaller(parentUser, db).caller.message.openStaffroom()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('keeps staffroom unread counts participant-scoped without email fanout', async () => {
    const db = makeFakeDb();
    const email = makeFakeEmailClient();
    const headCaller = makeCaller(headUser, db, email).caller;

    const staffroom = await headCaller.message.openStaffroom();
    await headCaller.message.send({ threadId: staffroom.id, body: 'Team update.' });

    await expect(makeCaller(supervisorUser, db, email).caller.message.listThreads()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: staffroom.id,
          kind: 'Staffroom',
          unreadCount: 1,
        }),
      ]),
    );
    expect(email.send).not.toHaveBeenCalled();
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
    const { caller } = makeCaller(
      parentUser,
      makeFakeDb([thread], [parentMessage], defaultUsers, [read]),
    );

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

    await expect(
      makeCaller(studentUser, makeFakeDb([thread])).caller.message.listInThread({
        threadId: thread.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(technicalSupportUser, makeFakeDb([thread])).caller.message.listInThread({
        threadId: thread.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('hides parent threads from supervisor readers', async () => {
    const thread = makeThread({ id: 'cthread000000000000305' });

    await expect(
      makeCaller(supervisorUser, makeFakeDb([thread])).caller.message.listInThread({
        threadId: thread.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
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
