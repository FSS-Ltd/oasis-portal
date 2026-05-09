import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@oasis/db';
import { AccessDeniedError, isFullAdmin, type SessionUser } from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

interface ThreadAccessRow {
  id: string;
  parentId: string;
  adminId: string;
}

interface MessageRow {
  id: string;
  threadId: string;
  senderId: string;
  bodyEnc: string;
  createdAt: Date;
}

interface ThreadWithMessages extends ThreadAccessRow {
  subject: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageRow[];
}

interface ThreadSummaryRow extends ThreadAccessRow {
  subject: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { messages: number };
  messages: Pick<MessageRow, 'senderId' | 'createdAt'>[];
}

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
  if (user.role === 'Parent' || isFullAdmin(user)) return;
  throw toForbidden(new AccessDeniedError('parent messaging requires Parent or full-admin'));
}

function canAccessThread(user: SessionUser, thread: ThreadAccessRow): boolean {
  if (user.role === 'Parent') return thread.parentId === user.id;
  if (user.role === 'Head') return true;
  if (isFullAdmin(user)) return thread.adminId === user.id;
  return false;
}

function scopedThreadWhere(user: SessionUser): Prisma.MessageThreadWhereInput | null {
  requireMessageReader(user);

  if (user.role === 'Parent') return { parentId: user.id };
  if (user.role === 'Head') return null;
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
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'message body decrypt failed' });
  }
  return decrypted;
}

function mapThreadSummary(thread: ThreadSummaryRow) {
  const latestMessage = thread.messages[0] ?? null;

  return {
    id: thread.id,
    subject: thread.subject,
    parentId: thread.parentId,
    adminId: thread.adminId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount: thread._count.messages,
    latestMessage: latestMessage
      ? {
          senderId: latestMessage.senderId,
          createdAt: latestMessage.createdAt,
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
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: thread.messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      body: decryptRequired(ctx.db.$enc.decrypt, message.bodyEnc),
      createdAt: message.createdAt,
    })),
  };
}

async function assertAdminAssignee(ctx: AuthedContext, adminId: string): Promise<void> {
  const admin = await ctx.db.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true, active: true },
  });

  if (!admin || !admin.active || !isFullAdmin(admin)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'admin must be an active full-admin user',
    });
  }
}

export const messageRouter = router({
  listThreads: authedProcedure.query(async ({ ctx }) => {
    const where = scopedThreadWhere(ctx.user);
    const include = {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { senderId: true, createdAt: true },
      },
    };
    const orderBy = { updatedAt: 'desc' as const };
    const threads = where
      ? await ctx.db.messageThread.findMany({ where, include, orderBy })
      : await ctx.db.messageThread.findMany({ include, orderBy });

    return threads.map((thread) => mapThreadSummary(thread));
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
        select: { id: true, parentId: true, adminId: true },
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

    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      body: input.body,
      createdAt: message.createdAt,
      threadUpdatedAt: updatedThread.updatedAt,
    };
  }),

  listInThread: authedProcedure.input(threadInput).query(async ({ ctx, input }) => {
    requireMessageReader(ctx.user);

    const thread = await ctx.db.messageThread.findUnique({
      where: { id: input.threadId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const accessibleThread = assertThreadAccess(ctx.user, thread);

    return mapThreadMessages(ctx, accessibleThread);
  }),
});
