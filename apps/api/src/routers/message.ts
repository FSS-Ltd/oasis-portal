import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canRespondToParentMessages,
  canUseStaffMessaging,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  buildMessageNotificationEmail,
  createResendEmailClient,
  MESSAGE_NOTIFICATION_EMAIL_SUBJECT,
  type EmailClient,
} from '../lib/email.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

export interface MessageRouterDeps {
  emailClient?: EmailClient;
}

interface ThreadAccessRow {
  id: string;
  kind: MessageThreadKind;
  parentId: string | null;
  supervisorId: string | null;
  adminId: string | null;
  participants: { userId: string }[];
}

type MessageThreadKind = 'ParentStaff' | 'SupervisorHead' | 'StaffDirect' | 'Staffroom';

const STAFF_MESSAGE_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'TechnicalSupport',
  'ClubsAdmin',
  'Supervisor',
] as const;

const userDisplaySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  fullNameEnc: true,
  emailEnc: true,
  active: true,
  tags: true,
});

const threadSummaryInclude = Prisma.validator<Prisma.MessageThreadInclude>()({
  _count: { select: { messages: true } },
  parent: { select: userDisplaySelect },
  supervisor: { select: userDisplaySelect },
  admin: { select: userDisplaySelect },
  participants: {
    orderBy: { createdAt: 'asc' },
    select: { userId: true, user: { select: userDisplaySelect } },
  },
  messages: {
    orderBy: { createdAt: 'desc' },
    select: {
      senderId: true,
      createdAt: true,
      reads: { select: { userId: true, readAt: true } },
    },
  },
});

const threadMessageInclude = Prisma.validator<Prisma.MessageThreadInclude>()({
  parent: { select: userDisplaySelect },
  supervisor: { select: userDisplaySelect },
  admin: { select: userDisplaySelect },
  participants: {
    orderBy: { createdAt: 'asc' },
    select: { userId: true, user: { select: userDisplaySelect } },
  },
  messages: {
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: userDisplaySelect },
      reads: { select: { userId: true, readAt: true } },
    },
  },
});

const threadNotificationSelect = Prisma.validator<Prisma.MessageThreadSelect>()({
  id: true,
  kind: true,
  parentId: true,
  supervisorId: true,
  adminId: true,
  subject: true,
  parent: { select: userDisplaySelect },
  supervisor: { select: userDisplaySelect },
  admin: { select: userDisplaySelect },
  participants: {
    orderBy: { createdAt: 'asc' },
    select: { userId: true, user: { select: userDisplaySelect } },
  },
});

type UserDisplayRow = Prisma.UserGetPayload<{ select: typeof userDisplaySelect }>;
type ThreadSummaryRow = Prisma.MessageThreadGetPayload<{ include: typeof threadSummaryInclude }>;
type ThreadWithMessages = Prisma.MessageThreadGetPayload<{ include: typeof threadMessageInclude }>;
type ThreadForNotification = Prisma.MessageThreadGetPayload<{
  select: typeof threadNotificationSelect;
}>;

const openThreadInput = z.object({
  adminId: z.string().cuid().optional(),
  kind: z.enum(['ParentStaff', 'SupervisorHead', 'StaffDirect']).default('ParentStaff'),
  subject: z.string().trim().min(1),
});

const listRecipientsInput = z
  .object({
    kind: z.enum(['ParentStaff', 'SupervisorHead', 'StaffDirect']).default('ParentStaff'),
  })
  .optional();

const sendInput = z.object({
  threadId: z.string().cuid(),
  body: z.string().trim().min(1),
});

const threadInput = z.object({
  threadId: z.string().cuid(),
});

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireParent(user: SessionUser): void {
  if (user.role === 'Parent') return;
  throw toForbidden(new AccessDeniedError('parent messaging requires Parent'));
}

function requireSupervisorMessageAuthor(user: SessionUser): void {
  if (canUseStaffMessaging(user)) return;
  throw toForbidden(new AccessDeniedError('supervisor messaging requires staff access'));
}

function requireMessageReader(user: SessionUser): void {
  if (user.role === 'Parent' || canUseStaffMessaging(user) || canRespondToParentMessages(user)) {
    return;
  }
  throw toForbidden(
    new AccessDeniedError('messaging requires Parent, staff, or message responder'),
  );
}

function canAccessThread(user: SessionUser, thread: ThreadAccessRow): boolean {
  const isParticipant = thread.participants.some((participant) => participant.userId === user.id);
  if (!isParticipant) return false;
  if (user.role === 'Parent') {
    return thread.kind === 'ParentStaff' && thread.parentId === user.id;
  }
  return canUseStaffMessaging(user) || canRespondToParentMessages(user);
}

function scopedThreadWhere(user: SessionUser): Prisma.MessageThreadWhereInput {
  requireMessageReader(user);

  if (user.role === 'Parent') {
    return { kind: 'ParentStaff', parentId: user.id, participants: { some: { userId: user.id } } };
  }
  return { participants: { some: { userId: user.id } } };
}

function assertThreadAccess<T extends ThreadAccessRow>(user: SessionUser, thread: T | null): T {
  if (!thread || !canAccessThread(user, thread)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'message thread not found' });
  }
  return thread;
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  label: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${label} decrypt failed` });
  }
  return decrypted;
}

function displayUser(ctx: AuthedContext, user: UserDisplayRow) {
  return {
    id: user.id,
    role: user.role,
    fullName: decryptRequired(ctx.db.$enc.decrypt, user.fullNameEnc, 'user name'),
  };
}

function displayRecipient(ctx: AuthedContext, user: UserDisplayRow) {
  return displayUser(ctx, user);
}

function displayParticipants(
  ctx: AuthedContext,
  participants: { user: UserDisplayRow; userId: string }[],
) {
  return participants.map((participant) => displayUser(ctx, participant.user));
}

function mapThreadSummary(ctx: AuthedContext, thread: ThreadSummaryRow) {
  const latestMessage = thread.messages[0] ?? null;
  const unreadCount = thread.messages.filter(
    (message) =>
      message.senderId !== ctx.user.id &&
      !message.reads.some((read) => read.userId === ctx.user.id),
  ).length;

  return {
    id: thread.id,
    kind: thread.kind,
    subject: thread.subject,
    parentId: thread.parentId,
    adminId: thread.adminId,
    currentUserId: ctx.user.id,
    parent: thread.parent ? displayUser(ctx, thread.parent) : null,
    supervisor: thread.supervisor ? displayUser(ctx, thread.supervisor) : null,
    admin: thread.admin ? displayUser(ctx, thread.admin) : null,
    participants: displayParticipants(ctx, thread.participants),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount: thread._count.messages,
    unreadCount,
    latestMessage: latestMessage
      ? {
          senderId: latestMessage.senderId,
          createdAt: latestMessage.createdAt,
          readByCurrentUser: latestMessage.reads.some((read) => read.userId === ctx.user.id),
        }
      : null,
  };
}

function mapThreadMessages(ctx: AuthedContext, thread: ThreadWithMessages) {
  return {
    id: thread.id,
    kind: thread.kind,
    subject: thread.subject,
    parentId: thread.parentId,
    adminId: thread.adminId,
    currentUserId: ctx.user.id,
    parent: thread.parent ? displayUser(ctx, thread.parent) : null,
    supervisor: thread.supervisor ? displayUser(ctx, thread.supervisor) : null,
    admin: thread.admin ? displayUser(ctx, thread.admin) : null,
    participants: displayParticipants(ctx, thread.participants),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: thread.messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      sender: displayUser(ctx, message.sender),
      body: decryptRequired(ctx.db.$enc.decrypt, message.bodyEnc, 'message body'),
      createdAt: message.createdAt,
      readByCurrentUser:
        message.senderId === ctx.user.id ||
        message.reads.some((read) => read.userId === ctx.user.id),
      readByOtherParticipant: message.reads.some((read) => read.userId !== message.senderId),
      readAtForCurrentUser:
        message.reads.find((read) => read.userId === ctx.user.id)?.readAt ?? null,
    })),
  };
}

async function markThreadRead(ctx: AuthedContext, thread: ThreadWithMessages): Promise<number> {
  const unreadMessageIds = thread.messages
    .filter(
      (message) =>
        message.senderId !== ctx.user.id &&
        !message.reads.some((read) => read.userId === ctx.user.id),
    )
    .map((message) => message.id);

  if (unreadMessageIds.length === 0) return 0;

  const result = await ctx.db.messageRead.createMany({
    data: unreadMessageIds.map((messageId) => ({
      messageId,
      userId: ctx.user.id,
    })),
    skipDuplicates: true,
  });

  if (result.count > 0) {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'MessageRead',
        meta: {
          count: result.count,
          source: 'message.listInThread.markRead',
          threadId: thread.id,
        },
      },
    });
  }

  return result.count;
}

async function loadParentMessageAssignee(
  ctx: AuthedContext,
  adminId: string,
): Promise<UserDisplayRow> {
  const admin = await ctx.db.user.findUnique({
    where: { id: adminId },
    select: userDisplaySelect,
  });

  if (!admin || !admin.active || !canRespondToParentMessages(admin)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'admin must be an active parent message responder',
    });
  }

  return admin;
}

async function loadStaffMessageRecipient(
  ctx: AuthedContext,
  userId: string,
): Promise<UserDisplayRow> {
  const user = await ctx.db.user.findUnique({
    where: { id: userId },
    select: userDisplaySelect,
  });

  if (!user || !user.active || !canUseStaffMessaging(user) || user.id === ctx.user.id) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'recipient must be another active staff user',
    });
  }

  return user;
}

function messagePathForRecipient(threadId: string, recipient: UserDisplayRow): string {
  const encodedThreadId = encodeURIComponent(threadId);
  if (recipient.role === 'Parent') return `/parent/messages?threadId=${encodedThreadId}`;
  if (recipient.role === 'Supervisor' || recipient.role === 'ClubsAdmin') {
    return `/supervisor/messages?threadId=${encodedThreadId}`;
  }
  return `/admin/messages?threadId=${encodedThreadId}`;
}

function targetForMessage(thread: ThreadForNotification, senderId: string): UserDisplayRow {
  if (thread.kind === 'StaffDirect') {
    const recipient = thread.participants.find((participant) => participant.userId !== senderId);
    if (!recipient) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'message recipient not found',
      });
    }
    return recipient.user;
  }

  const initiator = thread.kind === 'ParentStaff' ? thread.parent : thread.supervisor;
  if (!initiator) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'message initiator not found' });
  }
  if (!thread.admin) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'message assignee not found' });
  }
  return senderId === initiator.id ? thread.admin : initiator;
}

async function ensureStaffroomThread(ctx: AuthedContext): Promise<{ id: string }> {
  if (!canUseStaffMessaging(ctx.user)) {
    throw toForbidden(new AccessDeniedError('staffroom requires staff access'));
  }

  const activeStaff = await ctx.db.user.findMany({
    where: { active: true, role: { in: [...STAFF_MESSAGE_ROLES] } },
    select: { id: true },
  });

  const existing = await ctx.db.messageThread.findFirst({
    where: { kind: 'Staffroom' },
    select: { id: true },
  });

  if (existing) {
    await ctx.db.messageThreadParticipant.createMany({
      data: activeStaff.map((user) => ({ threadId: existing.id, userId: user.id })),
      skipDuplicates: true,
    });
    return existing;
  }

  const thread = await ctx.db.messageThread.create({
    data: {
      kind: 'Staffroom',
      parentId: null,
      supervisorId: null,
      adminId: null,
      subject: 'Staffroom',
      participants: {
        create: activeStaff.map((user) => ({ userId: user.id })),
      },
    },
    select: { id: true },
  });

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Create',
      entity: 'MessageThread',
      entityId: thread.id,
      meta: { source: 'message.openStaffroom', kind: 'Staffroom' },
    },
  });

  return thread;
}

async function notifyMessageRecipient({
  ctx,
  getEmailClient,
  messageId,
  sender,
  thread,
}: {
  ctx: AuthedContext;
  getEmailClient: () => EmailClient;
  messageId: string;
  sender: UserDisplayRow;
  thread: ThreadForNotification;
}) {
  const recipient = targetForMessage(thread, sender.id);

  try {
    const senderName = decryptRequired(ctx.db.$enc.decrypt, sender.fullNameEnc, 'sender name');
    const recipientName = decryptRequired(
      ctx.db.$enc.decrypt,
      recipient.fullNameEnc,
      'recipient name',
    );
    const recipientEmail = decryptRequired(
      ctx.db.$enc.decrypt,
      recipient.emailEnc,
      'recipient email',
    );
    const email = buildMessageNotificationEmail({
      to: recipientEmail,
      recipientName,
      senderName,
      threadSubject: thread.subject,
      messagePath: messagePathForRecipient(thread.id, recipient),
    });
    const emailClient = getEmailClient();
    const result = await emailClient.send(email);
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'Email',
        entityId: result.id,
        meta: {
          source: 'message.send.notification',
          emailStatus: 'Sent',
          messageId,
          subject: MESSAGE_NOTIFICATION_EMAIL_SUBJECT,
          threadId: thread.id,
          toUserId: recipient.id,
          toRole: recipient.role,
        },
      },
    });
  } catch (err) {
    console.error('Message notification email delivery failed', {
      error: err instanceof Error ? err.message : 'unknown error',
      messageId,
      threadId: thread.id,
      toUserId: recipient.id,
    });

    try {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'Message',
          entityId: messageId,
          meta: {
            source: 'message.send.notification',
            emailStatus: 'Failed',
            threadId: thread.id,
            toUserId: recipient.id,
            toRole: recipient.role,
          },
        },
      });
    } catch (auditErr) {
      console.error('Message notification failure audit failed', {
        error: auditErr instanceof Error ? auditErr.message : 'unknown error',
        messageId,
        threadId: thread.id,
      });
    }
  }
}

export function createMessageRouter(deps: MessageRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    listRecipients: authedProcedure.input(listRecipientsInput).query(async ({ ctx, input }) => {
      const kind = input?.kind ?? 'ParentStaff';
      if (kind === 'ParentStaff') {
        requireParent(ctx.user);
      } else if (kind === 'StaffDirect') {
        if (!canUseStaffMessaging(ctx.user)) {
          throw toForbidden(new AccessDeniedError('staff direct messaging requires staff access'));
        }
      } else {
        requireSupervisorMessageAuthor(ctx.user);
      }

      const users = await ctx.db.user.findMany({
        where:
          kind === 'StaffDirect'
            ? { active: true, role: { in: [...STAFF_MESSAGE_ROLES] } }
            : {
                active: true,
                OR: [{ role: 'Head' }, { tags: { has: 'parent-message-responder' } }],
              },
        select: userDisplaySelect,
        orderBy: { createdAt: 'asc' },
      });

      return users
        .filter(
          (user) =>
            user.id !== ctx.user.id &&
            (kind === 'StaffDirect'
              ? canUseStaffMessaging(user)
              : canRespondToParentMessages(user) &&
                user.role !== 'Parent' &&
                user.role !== 'Student'),
        )
        .map((user) => displayRecipient(ctx, user));
    }),

    listThreads: authedProcedure.query(async ({ ctx }) => {
      const where = scopedThreadWhere(ctx.user);
      const orderBy = { updatedAt: 'desc' as const };
      const threads = await ctx.db.messageThread.findMany({
        where,
        include: threadSummaryInclude,
        orderBy,
      });

      return threads.map((thread) => mapThreadSummary(ctx, thread));
    }),

    openStaffroom: authedProcedure.mutation(async ({ ctx }) => {
      const thread = await ensureStaffroomThread(ctx);
      return thread;
    }),

    openThread: authedProcedure.input(openThreadInput).mutation(async ({ ctx, input }) => {
      if (!input.adminId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'recipient is required' });
      }

      let participantIds: string[];
      let adminId: string | null = input.adminId;
      let parentId: string | null = null;
      let supervisorId: string | null = null;

      if (input.kind === 'ParentStaff') {
        requireParent(ctx.user);
        await loadParentMessageAssignee(ctx, input.adminId);
        parentId = ctx.user.id;
        participantIds = [ctx.user.id, input.adminId];
      } else if (input.kind === 'StaffDirect') {
        if (!canUseStaffMessaging(ctx.user)) {
          throw toForbidden(new AccessDeniedError('staff direct messaging requires staff access'));
        }
        await loadStaffMessageRecipient(ctx, input.adminId);
        adminId = null;
        participantIds = [ctx.user.id, input.adminId];
      } else {
        requireSupervisorMessageAuthor(ctx.user);
        await loadParentMessageAssignee(ctx, input.adminId);
        supervisorId = ctx.user.id;
        participantIds = [ctx.user.id, input.adminId];
      }

      const thread = await ctx.db.messageThread.create({
        data: {
          kind: input.kind,
          parentId,
          supervisorId,
          adminId,
          subject: input.subject,
          participants: {
            create: [...new Set(participantIds)].map((userId) => ({ userId })),
          },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'MessageThread',
          entityId: thread.id,
          meta: { source: 'message.openThread', recipientId: input.adminId, kind: input.kind },
        },
      });

      return {
        id: thread.id,
        kind: thread.kind,
        subject: thread.subject,
        parentId: thread.parentId,
        supervisorId: thread.supervisorId,
        adminId: thread.adminId,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    }),

    send: authedProcedure.input(sendInput).mutation(async ({ ctx, input }) => {
      requireMessageReader(ctx.user);

      const thread = assertThreadAccess(
        ctx.user,
        await ctx.db.messageThread.findUnique({
          where: { id: input.threadId },
          select: threadNotificationSelect,
        }),
      );

      const message = await ctx.db.message.create({
        data: {
          threadId: thread.id,
          senderId: ctx.user.id,
          bodyEnc: ctx.db.$enc.encrypt(input.body),
        },
      });

      const updatedThread = await ctx.db.messageThread.update({
        where: { id: thread.id },
        data: { updatedAt: message.createdAt },
        select: { updatedAt: true },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'Message',
          entityId: message.id,
          meta: { source: 'message.send', threadId: thread.id },
        },
      });

      const sender = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: userDisplaySelect,
      });
      if (!sender) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'sender not found' });
      }
      if (thread.kind === 'ParentStaff') {
        await notifyMessageRecipient({
          ctx,
          getEmailClient,
          messageId: message.id,
          sender,
          thread,
        });
      }

      return {
        id: message.id,
        threadId: message.threadId,
        senderId: message.senderId,
        sender: displayUser(ctx, sender),
        body: input.body,
        createdAt: message.createdAt,
        threadUpdatedAt: updatedThread.updatedAt,
      };
    }),

    listInThread: authedProcedure.input(threadInput).query(async ({ ctx, input }) => {
      requireMessageReader(ctx.user);

      const thread = await ctx.db.messageThread.findUnique({
        where: { id: input.threadId },
        include: threadMessageInclude,
      });
      const accessibleThread = assertThreadAccess(ctx.user, thread);
      const markedReadCount = await markThreadRead(ctx, accessibleThread);

      if (markedReadCount > 0) {
        const updatedThread = await ctx.db.messageThread.findUnique({
          where: { id: input.threadId },
          include: threadMessageInclude,
        });
        return mapThreadMessages(ctx, assertThreadAccess(ctx.user, updatedThread));
      }

      return mapThreadMessages(ctx, accessibleThread);
    }),
  });
}

export const messageRouter = createMessageRouter();
