import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canRespondToParentMessages,
  isFullAdmin,
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
  parentId: string;
  adminId: string;
}

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
  admin: { select: userDisplaySelect },
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
  admin: { select: userDisplaySelect },
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
  parentId: true,
  adminId: true,
  subject: true,
  parent: { select: userDisplaySelect },
  admin: { select: userDisplaySelect },
});

type UserDisplayRow = Prisma.UserGetPayload<{ select: typeof userDisplaySelect }>;
type ThreadSummaryRow = Prisma.MessageThreadGetPayload<{ include: typeof threadSummaryInclude }>;
type ThreadWithMessages = Prisma.MessageThreadGetPayload<{ include: typeof threadMessageInclude }>;
type ThreadForNotification = Prisma.MessageThreadGetPayload<{
  select: typeof threadNotificationSelect;
}>;

const openThreadInput = z.object({
  adminId: z.string().cuid(),
  subject: z.string().trim().min(1),
});

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

function requireMessageReader(user: SessionUser): void {
  if (user.role === 'Parent' || canRespondToParentMessages(user)) return;
  throw toForbidden(new AccessDeniedError('parent messaging requires Parent or message responder'));
}

function canAccessThread(user: SessionUser, thread: ThreadAccessRow): boolean {
  if (user.role === 'Parent') return thread.parentId === user.id;
  if (isFullAdmin(user)) return true;
  if (canRespondToParentMessages(user)) return thread.adminId === user.id;
  return false;
}

function scopedThreadWhere(user: SessionUser): Prisma.MessageThreadWhereInput | null {
  requireMessageReader(user);

  if (user.role === 'Parent') return { parentId: user.id };
  if (isFullAdmin(user)) return null;
  return { adminId: user.id };
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

function mapThreadSummary(ctx: AuthedContext, thread: ThreadSummaryRow) {
  const latestMessage = thread.messages[0] ?? null;
  const unreadCount = thread.messages.filter(
    (message) =>
      message.senderId !== ctx.user.id &&
      !message.reads.some((read) => read.userId === ctx.user.id),
  ).length;

  return {
    id: thread.id,
    subject: thread.subject,
    parentId: thread.parentId,
    adminId: thread.adminId,
    parent: displayUser(ctx, thread.parent),
    admin: displayUser(ctx, thread.admin),
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
    subject: thread.subject,
    parentId: thread.parentId,
    adminId: thread.adminId,
    currentUserId: ctx.user.id,
    parent: displayUser(ctx, thread.parent),
    admin: displayUser(ctx, thread.admin),
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

async function assertAdminAssignee(ctx: AuthedContext, adminId: string): Promise<void> {
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
}

function messagePathForRecipient(threadId: string, recipient: UserDisplayRow): string {
  const encodedThreadId = encodeURIComponent(threadId);
  return recipient.role === 'Parent'
    ? `/parent/messages?threadId=${encodedThreadId}`
    : `/admin/messages?threadId=${encodedThreadId}`;
}

function targetForMessage(thread: ThreadForNotification, senderId: string): UserDisplayRow {
  return senderId === thread.parentId ? thread.admin : thread.parent;
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
    listRecipients: authedProcedure.query(async ({ ctx }) => {
      requireParent(ctx.user);

      const users = await ctx.db.user.findMany({
        where: {
          active: true,
          role: { in: ['Head', 'Principal', 'Pastor', 'HeadOfDiscipline'] },
        },
        select: userDisplaySelect,
        orderBy: { createdAt: 'asc' },
      });

      return users
        .filter((user) => canRespondToParentMessages(user))
        .map((user) => displayRecipient(ctx, user));
    }),

    listThreads: authedProcedure.query(async ({ ctx }) => {
      const where = scopedThreadWhere(ctx.user);
      const orderBy = { updatedAt: 'desc' as const };
      const threads = await ctx.db.messageThread.findMany({
        ...(where ? { where } : {}),
        include: threadSummaryInclude,
        orderBy,
      });

      return threads.map((thread) => mapThreadSummary(ctx, thread));
    }),

    openThread: authedProcedure.input(openThreadInput).mutation(async ({ ctx, input }) => {
      requireParent(ctx.user);
      await assertAdminAssignee(ctx, input.adminId);

      const thread = await ctx.db.messageThread.create({
        data: {
          parentId: ctx.user.id,
          adminId: input.adminId,
          subject: input.subject,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'MessageThread',
          entityId: thread.id,
          meta: { source: 'message.openThread', adminId: input.adminId },
        },
      });

      return {
        id: thread.id,
        subject: thread.subject,
        parentId: thread.parentId,
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
      await notifyMessageRecipient({
        ctx,
        getEmailClient,
        messageId: message.id,
        sender,
        thread,
      });

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
