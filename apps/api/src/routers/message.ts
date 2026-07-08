import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canRespondToParentMessages,
  canUseLinkedChildGuardianAccess,
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
import { decryptRequiredText } from '../lib/encrypted-text.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';
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

type MessageThreadKind =
  | 'ParentStaff'
  | 'SupervisorHead'
  | 'StaffDirect'
  | 'Staffroom'
  | 'StudentDirect';

interface ThreadAccessFlags {
  hasActiveGuardianChild: boolean;
  hasActiveStudentProfile: boolean;
}

interface ConversationGroup<Thread extends ThreadSummaryRow | ThreadWithMessages> {
  id: string;
  threads: Thread[];
}

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

const messageConversationKindInput = z
  .enum(['ParentStaff', 'SupervisorHead', 'StaffDirect', 'StudentDirect'])
  .default('ParentStaff');

const openConversationInput = z.object({
  recipientId: z.string().cuid(),
  kind: messageConversationKindInput,
});

const listRecipientsInput = z
  .object({
    kind: z
      .enum(['ParentStaff', 'SupervisorHead', 'StaffDirect', 'StudentDirect'])
      .default('ParentStaff'),
    direction: z.enum(['toStaff', 'toParent']).default('toStaff'),
  })
  .optional();

const listConversationsInput = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).optional(),
    kinds: z
      .array(z.enum(['ParentStaff', 'SupervisorHead', 'StaffDirect', 'Staffroom', 'StudentDirect']))
      .min(1)
      .max(5)
      .optional(),
  })
  .optional();

const sendInput = z.object({
  threadId: z.string().cuid(),
  body: z.string().trim().min(1),
});

const sendConversationInput = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().min(1),
});

const threadInput = z.object({
  threadId: z.string().cuid(),
});

const conversationInput = z.object({
  conversationId: z.string().min(1),
});

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

async function hasActiveLinkedChild(ctx: AuthedContext): Promise<boolean> {
  const linkedChildCount = await ctx.db.guardian.count({
    where: { userId: ctx.user.id, student: { active: true } },
  });
  return linkedChildCount > 0;
}

async function loadStudentMessageProfile(
  ctx: AuthedContext,
): Promise<{ id: string; communityMessagingBlocked: boolean }> {
  if (ctx.user.role !== 'Student') {
    throw toForbidden(new AccessDeniedError('student messaging requires a student account'));
  }

  const student = await ctx.db.student.findFirst({
    where: { userId: ctx.user.id, active: true },
    select: {
      id: true,
      portalSettings: { select: { communityMessagingBlocked: true } },
    },
  });

  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }

  return {
    id: student.id,
    communityMessagingBlocked: student.portalSettings?.communityMessagingBlocked ?? false,
  };
}

async function hasActiveStudentProfile(ctx: AuthedContext): Promise<boolean> {
  if (ctx.user.role !== 'Student') return false;
  const studentCount = await ctx.db.student.count({
    where: { userId: ctx.user.id, active: true },
  });
  return studentCount > 0;
}

async function requireParentStaffThreadAuthor(ctx: AuthedContext): Promise<void> {
  if (!canUseLinkedChildGuardianAccess(ctx.user)) {
    throw toForbidden(
      new AccessDeniedError('parent messaging requires linked-child guardian access'),
    );
  }

  if (!(await hasActiveLinkedChild(ctx))) {
    throw toForbidden(new AccessDeniedError('parent messaging requires an active linked child'));
  }
}

async function requireStudentMessageAuthor(ctx: AuthedContext): Promise<void> {
  const student = await loadStudentMessageProfile(ctx);
  if (student.communityMessagingBlocked) {
    throw toForbidden(new AccessDeniedError('student messaging is disabled'));
  }
}

function requireSupervisorMessageAuthor(user: SessionUser): void {
  if (user.role === 'Supervisor') return;
  throw toForbidden(new AccessDeniedError('supervisor messaging requires staff access'));
}

function requireMessageReader(user: SessionUser): void {
  if (
    user.role === 'Parent' ||
    user.role === 'Student' ||
    canUseStaffMessaging(user) ||
    canRespondToParentMessages(user)
  ) {
    return;
  }
  throw toForbidden(
    new AccessDeniedError('messaging requires Parent, Student, staff, or message responder'),
  );
}

function canAccessThread(
  user: SessionUser,
  thread: ThreadAccessRow,
  flags: ThreadAccessFlags,
): boolean {
  const isParticipant = thread.participants.some((participant) => participant.userId === user.id);
  if (!isParticipant) return false;

  if (thread.kind === 'StudentDirect') {
    return canUseStaffMessaging(user) || (user.role === 'Student' && flags.hasActiveStudentProfile);
  }

  if (thread.kind === 'ParentStaff' && thread.parentId === user.id) {
    if (user.role === 'Parent') return true;
    return canUseLinkedChildGuardianAccess(user) && flags.hasActiveGuardianChild;
  }

  if (user.role === 'Parent') {
    return thread.kind === 'ParentStaff' && thread.parentId === user.id;
  }
  if (user.role === 'Student') return false;
  return canUseStaffMessaging(user) || canRespondToParentMessages(user);
}

function scopedThreadWhere(user: SessionUser): Prisma.MessageThreadWhereInput {
  requireMessageReader(user);

  if (user.role === 'Parent') {
    return { kind: 'ParentStaff', parentId: user.id, participants: { some: { userId: user.id } } };
  }
  if (user.role === 'Student') {
    return { kind: 'StudentDirect', participants: { some: { userId: user.id } } };
  }
  return { participants: { some: { userId: user.id } } };
}

async function assertThreadAccess<T extends ThreadAccessRow>(
  ctx: AuthedContext,
  thread: T | null,
): Promise<T> {
  const hasActiveGuardianChild =
    !!thread &&
    thread.kind === 'ParentStaff' &&
    thread.parentId === ctx.user.id &&
    ctx.user.role !== 'Parent' &&
    canUseLinkedChildGuardianAccess(ctx.user)
      ? await hasActiveLinkedChild(ctx)
      : false;
  const activeStudentProfile =
    !!thread && thread.kind === 'StudentDirect' && ctx.user.role === 'Student'
      ? await hasActiveStudentProfile(ctx)
      : false;

  if (
    !thread ||
    !canAccessThread(ctx.user, thread, {
      hasActiveGuardianChild,
      hasActiveStudentProfile: activeStudentProfile,
    })
  ) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'message thread not found' });
  }
  return thread;
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
  label: string,
): string {
  return decryptRequiredText({ decrypt }, value, label);
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

function sortedParticipantIds(participants: { userId: string }[]): string[] {
  return participants.map((participant) => participant.userId).sort((a, b) => a.localeCompare(b));
}

function directConversationId(
  kind: Extract<MessageThreadKind, 'StaffDirect' | 'StudentDirect'>,
  participants: { userId: string }[],
): string | null {
  const participantIds = sortedParticipantIds(participants);
  if (participantIds.length < 2) return null;
  return `${kind}:${participantIds.join(':')}`;
}

function conversationIdForThread(thread: ThreadAccessRow): string {
  if (thread.kind === 'Staffroom') return 'Staffroom';
  if (thread.kind === 'ParentStaff' && thread.parentId && thread.adminId) {
    return `ParentStaff:${thread.parentId}:${thread.adminId}`;
  }
  if (thread.kind === 'SupervisorHead' && thread.supervisorId && thread.adminId) {
    return `SupervisorHead:${thread.supervisorId}:${thread.adminId}`;
  }
  if (thread.kind === 'StaffDirect' || thread.kind === 'StudentDirect') {
    return directConversationId(thread.kind, thread.participants) ?? `${thread.kind}:${thread.id}`;
  }
  return `${thread.kind}:${thread.id}`;
}

function directConversationIdForUsers(
  kind: Extract<MessageThreadKind, 'StaffDirect' | 'StudentDirect'>,
  userIds: string[],
): string {
  return `${kind}:${[...new Set(userIds)].sort((a, b) => a.localeCompare(b)).join(':')}`;
}

function conversationCursor(conversation: {
  id: string;
  latestMessage: { createdAt: Date } | null;
  updatedAt: Date;
}): string {
  const latestAt = conversation.latestMessage?.createdAt ?? conversation.updatedAt;
  return `${latestAt.getTime().toString()}:${conversation.id}`;
}

function groupThreadsByConversation<Thread extends ThreadSummaryRow | ThreadWithMessages>(
  threads: Thread[],
): ConversationGroup<Thread>[] {
  const groups = new Map<string, ConversationGroup<Thread>>();
  for (const thread of threads) {
    const id = conversationIdForThread(thread);
    const existing = groups.get(id);
    if (existing) {
      existing.threads.push(thread);
    } else {
      groups.set(id, { id, threads: [thread] });
    }
  }
  return [...groups.values()];
}

function threadLatestAt(thread: ThreadSummaryRow | ThreadWithMessages): Date {
  return thread.messages[0]?.createdAt ?? thread.updatedAt;
}

function newestThread<Thread extends ThreadSummaryRow | ThreadWithMessages>(
  threads: Thread[],
): Thread {
  const [thread] = [...threads].sort((a, b) => {
    const diff = threadLatestAt(b).getTime() - threadLatestAt(a).getTime();
    return diff || b.id.localeCompare(a.id);
  });
  if (!thread) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'conversation has no threads' });
  }
  return thread;
}

function mapConversationSummary(ctx: AuthedContext, group: ConversationGroup<ThreadSummaryRow>) {
  const baseThread = newestThread(group.threads);
  const messages = group.threads.flatMap((thread) => thread.messages);
  const [latestMessage] = [...messages].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const unreadCount = messages.filter(
    (message) =>
      message.senderId !== ctx.user.id &&
      !message.reads.some((read) => read.userId === ctx.user.id),
  ).length;
  const createdAt = group.threads.reduce(
    (earliest, thread) => (thread.createdAt < earliest ? thread.createdAt : earliest),
    baseThread.createdAt,
  );
  const updatedAt = group.threads.reduce(
    (latest, thread) => (threadLatestAt(thread) > latest ? threadLatestAt(thread) : latest),
    threadLatestAt(baseThread),
  );

  return {
    id: group.id,
    threadIds: group.threads.map((thread) => thread.id),
    kind: baseThread.kind,
    subject: baseThread.subject,
    parentId: baseThread.parentId,
    adminId: baseThread.adminId,
    currentUserId: ctx.user.id,
    parent: baseThread.parent ? displayUser(ctx, baseThread.parent) : null,
    supervisor: baseThread.supervisor ? displayUser(ctx, baseThread.supervisor) : null,
    admin: baseThread.admin ? displayUser(ctx, baseThread.admin) : null,
    participants: displayParticipants(ctx, baseThread.participants),
    createdAt,
    updatedAt,
    messageCount: group.threads.reduce((sum, thread) => sum + thread._count.messages, 0),
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

function mapConversationMessages(ctx: AuthedContext, group: ConversationGroup<ThreadWithMessages>) {
  const baseThread = newestThread(group.threads);
  const messages = group.threads
    .flatMap((thread) => thread.messages)
    .sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      return diff || a.id.localeCompare(b.id);
    });

  return {
    id: group.id,
    threadIds: group.threads.map((thread) => thread.id),
    kind: baseThread.kind,
    subject: baseThread.subject,
    parentId: baseThread.parentId,
    adminId: baseThread.adminId,
    currentUserId: ctx.user.id,
    parent: baseThread.parent ? displayUser(ctx, baseThread.parent) : null,
    supervisor: baseThread.supervisor ? displayUser(ctx, baseThread.supervisor) : null,
    admin: baseThread.admin ? displayUser(ctx, baseThread.admin) : null,
    participants: displayParticipants(ctx, baseThread.participants),
    createdAt: group.threads.reduce(
      (earliest, thread) => (thread.createdAt < earliest ? thread.createdAt : earliest),
      baseThread.createdAt,
    ),
    updatedAt: group.threads.reduce(
      (latest, thread) => (thread.updatedAt > latest ? thread.updatedAt : latest),
      baseThread.updatedAt,
    ),
    messages: messages.map((message) => ({
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

async function loadActiveParentRecipient(
  ctx: AuthedContext,
  parentId: string,
): Promise<UserDisplayRow> {
  const parent = await ctx.db.user.findUnique({
    where: { id: parentId },
    select: userDisplaySelect,
  });

  if (!parent || !parent.active || parent.role !== 'Parent') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'recipient must be an active parent',
    });
  }

  return parent;
}

async function resolveParentStaffThreadParticipants(
  ctx: AuthedContext,
  recipientId: string,
): Promise<{ parentId: string; adminId: string; recipient: UserDisplayRow }> {
  const target = await ctx.db.user.findUnique({
    where: { id: recipientId },
    select: userDisplaySelect,
  });

  if (target?.role === 'Parent') {
    if (!canRespondToParentMessages(ctx.user)) {
      throw toForbidden(
        new AccessDeniedError('starting a thread with a parent requires message responder access'),
      );
    }
    const recipient = await loadActiveParentRecipient(ctx, recipientId);
    return { parentId: recipient.id, adminId: ctx.user.id, recipient };
  }

  await requireParentStaffThreadAuthor(ctx);
  const recipient = await loadParentMessageAssignee(ctx, recipientId);
  return { parentId: ctx.user.id, adminId: recipient.id, recipient };
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

async function loadStudentMessageRecipient(
  ctx: AuthedContext,
  userId: string,
): Promise<UserDisplayRow> {
  const user = await ctx.db.user.findFirst({
    where: {
      id: userId,
      active: true,
      OR: [
        { role: { in: ['Head', 'Pastor'] } },
        { role: 'Student', studentProfile: { is: { active: true } } },
      ],
    },
    select: userDisplaySelect,
  });

  if (!user || user.id === ctx.user.id) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'recipient must be an active student, Head, or Pastor',
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
  if (thread.kind === 'StaffDirect' || thread.kind === 'StudentDirect') {
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
    logOperationalEvent({
      event: 'email.delivery_failed',
      level: 'error',
      message: 'Message notification email delivery failed',
      meta: {
        error: operationalErrorMessage(err),
        messageId,
        threadId: thread.id,
        toUserId: recipient.id,
      },
      requestId: ctx.requestId,
      userId: ctx.user.id,
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
      logOperationalEvent({
        event: 'audit.write_failed',
        level: 'error',
        message: 'Message notification failure audit failed',
        meta: {
          error: operationalErrorMessage(auditErr),
          messageId,
          threadId: thread.id,
        },
        requestId: ctx.requestId,
        userId: ctx.user.id,
      });
    }
  }
}

async function createMessageInThread({
  body,
  ctx,
  getEmailClient,
  thread,
}: {
  body: string;
  ctx: AuthedContext;
  getEmailClient: () => EmailClient;
  thread: ThreadForNotification;
}) {
  const message = await ctx.db.message.create({
    data: {
      threadId: thread.id,
      senderId: ctx.user.id,
      bodyEnc: ctx.db.$enc.encrypt(body),
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
    body,
    createdAt: message.createdAt,
    threadUpdatedAt: updatedThread.updatedAt,
  };
}

async function threadAccessFlagsForList(ctx: AuthedContext): Promise<ThreadAccessFlags> {
  const [hasGuardianChild, hasStudentProfile] = await Promise.all([
    ctx.user.role !== 'Parent' && canUseLinkedChildGuardianAccess(ctx.user)
      ? hasActiveLinkedChild(ctx)
      : Promise.resolve(false),
    ctx.user.role === 'Student' ? hasActiveStudentProfile(ctx) : Promise.resolve(false),
  ]);

  return {
    hasActiveGuardianChild: hasGuardianChild,
    hasActiveStudentProfile: hasStudentProfile,
  };
}

async function loadVisibleThreadSummaries(ctx: AuthedContext): Promise<ThreadSummaryRow[]> {
  const where = scopedThreadWhere(ctx.user);
  const threads = await ctx.db.messageThread.findMany({
    where,
    include: threadSummaryInclude,
    orderBy: { updatedAt: 'desc' },
  });
  const flags = await threadAccessFlagsForList(ctx);

  return threads.filter((thread) => canAccessThread(ctx.user, thread, flags));
}

async function loadVisibleThreadDetails(ctx: AuthedContext): Promise<ThreadWithMessages[]> {
  const where = scopedThreadWhere(ctx.user);
  const threads = await ctx.db.messageThread.findMany({
    where,
    include: threadMessageInclude,
    orderBy: { updatedAt: 'desc' },
  });
  const flags = await threadAccessFlagsForList(ctx);

  return threads.filter((thread) => canAccessThread(ctx.user, thread, flags));
}

function paginateConversations(
  conversations: ReturnType<typeof mapConversationSummary>[],
  limit: number,
  cursor: string | undefined,
) {
  const startIndex = cursor
    ? Math.max(
        conversations.findIndex((conversation) => conversationCursor(conversation) === cursor) + 1,
        0,
      )
    : 0;
  const page = conversations.slice(startIndex, startIndex + limit);
  const last = page[page.length - 1] ?? null;
  const hasMore = startIndex + limit < conversations.length;

  return {
    items: page,
    nextCursor: hasMore && last ? conversationCursor(last) : null,
  };
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
      const direction = input?.direction ?? 'toStaff';
      const toParent = kind === 'ParentStaff' && direction === 'toParent';

      if (toParent) {
        if (!canRespondToParentMessages(ctx.user)) {
          throw toForbidden(
            new AccessDeniedError('listing parents requires message responder access'),
          );
        }
      } else if (kind === 'ParentStaff') {
        await requireParentStaffThreadAuthor(ctx);
      } else if (kind === 'StaffDirect') {
        if (!canUseStaffMessaging(ctx.user)) {
          throw toForbidden(new AccessDeniedError('staff direct messaging requires staff access'));
        }
      } else if (kind === 'StudentDirect') {
        await requireStudentMessageAuthor(ctx);
      } else {
        requireSupervisorMessageAuthor(ctx.user);
      }

      const users = await ctx.db.user.findMany({
        where: toParent
          ? { active: true, role: 'Parent' }
          : kind === 'StaffDirect'
            ? { active: true, role: { in: [...STAFF_MESSAGE_ROLES] } }
            : kind === 'StudentDirect'
              ? {
                  active: true,
                  OR: [
                    { role: { in: ['Head', 'Pastor'] } },
                    { role: 'Student', studentProfile: { is: { active: true } } },
                  ],
                }
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
            (toParent
              ? user.role === 'Parent'
              : kind === 'StaffDirect'
                ? canUseStaffMessaging(user)
                : kind === 'StudentDirect'
                  ? user.role === 'Head' || user.role === 'Pastor' || user.role === 'Student'
                  : canRespondToParentMessages(user) &&
                    user.role !== 'Parent' &&
                    user.role !== 'Student'),
        )
        .map((user) => displayRecipient(ctx, user));
    }),

    listConversations: authedProcedure
      .input(listConversationsInput)
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 20;
        const threads = await loadVisibleThreadSummaries(ctx);
        const kindFilter = input?.kinds ? new Set(input.kinds) : null;
        const conversations = groupThreadsByConversation(threads)
          .map((group) => mapConversationSummary(ctx, group))
          .filter((conversation) => !kindFilter || kindFilter.has(conversation.kind))
          .sort((a, b) => {
            const aLatest = a.latestMessage?.createdAt ?? a.updatedAt;
            const bLatest = b.latestMessage?.createdAt ?? b.updatedAt;
            const diff = bLatest.getTime() - aLatest.getTime();
            return diff || b.id.localeCompare(a.id);
          });

        return paginateConversations(conversations, limit, input?.cursor);
      }),

    listThreads: authedProcedure.query(async ({ ctx }) => {
      const threads = await loadVisibleThreadSummaries(ctx);
      return threads.map((thread) => mapThreadSummary(ctx, thread));
    }),

    openStaffroom: authedProcedure.mutation(async ({ ctx }) => {
      const thread = await ensureStaffroomThread(ctx);
      return thread;
    }),

    openConversation: authedProcedure
      .input(openConversationInput)
      .mutation(async ({ ctx, input }) => {
        let participantIds: string[];
        let adminId: string | null = input.recipientId;
        let parentId: string | null = null;
        let supervisorId: string | null = null;
        let subject: string;
        let conversationId: string;

        if (input.kind === 'ParentStaff') {
          const resolved = await resolveParentStaffThreadParticipants(ctx, input.recipientId);
          parentId = resolved.parentId;
          adminId = resolved.adminId;
          participantIds = [resolved.parentId, resolved.adminId];
          subject = `Message with ${displayRecipient(ctx, resolved.recipient).fullName}`;
          conversationId = `ParentStaff:${resolved.parentId}:${resolved.adminId}`;
        } else if (input.kind === 'StaffDirect') {
          if (!canUseStaffMessaging(ctx.user)) {
            throw toForbidden(
              new AccessDeniedError('staff direct messaging requires staff access'),
            );
          }
          const recipient = await loadStaffMessageRecipient(ctx, input.recipientId);
          adminId = null;
          participantIds = [ctx.user.id, input.recipientId];
          subject = `Message with ${displayRecipient(ctx, recipient).fullName}`;
          conversationId = directConversationIdForUsers('StaffDirect', participantIds);
        } else if (input.kind === 'StudentDirect') {
          await requireStudentMessageAuthor(ctx);
          const recipient = await loadStudentMessageRecipient(ctx, input.recipientId);
          adminId = null;
          participantIds = [ctx.user.id, input.recipientId];
          subject = `Message with ${displayRecipient(ctx, recipient).fullName}`;
          conversationId = directConversationIdForUsers('StudentDirect', participantIds);
        } else {
          requireSupervisorMessageAuthor(ctx.user);
          const recipient = await loadParentMessageAssignee(ctx, input.recipientId);
          supervisorId = ctx.user.id;
          participantIds = [ctx.user.id, input.recipientId];
          subject = `Message with ${displayRecipient(ctx, recipient).fullName}`;
          conversationId = `SupervisorHead:${ctx.user.id}:${input.recipientId}`;
        }

        const existing = groupThreadsByConversation(await loadVisibleThreadSummaries(ctx)).find(
          (group) => group.id === conversationId,
        );
        if (existing) return mapConversationSummary(ctx, existing);

        const thread = await ctx.db.messageThread.create({
          data: {
            kind: input.kind,
            parentId,
            supervisorId,
            adminId,
            subject,
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
            meta: {
              source: 'message.openConversation',
              recipientId: input.recipientId,
              kind: input.kind,
            },
          },
        });

        const createdThread = await assertThreadAccess(
          ctx,
          await ctx.db.messageThread.findUnique({
            where: { id: thread.id },
            include: threadSummaryInclude,
          }),
        );

        return mapConversationSummary(ctx, {
          id: conversationIdForThread(createdThread),
          threads: [createdThread],
        });
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
        const resolved = await resolveParentStaffThreadParticipants(ctx, input.adminId);
        parentId = resolved.parentId;
        adminId = resolved.adminId;
        participantIds = [resolved.parentId, resolved.adminId];
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

      const thread = await assertThreadAccess(
        ctx,
        await ctx.db.messageThread.findUnique({
          where: { id: input.threadId },
          select: threadNotificationSelect,
        }),
      );

      return createMessageInThread({
        body: input.body,
        ctx,
        getEmailClient,
        thread,
      });
    }),

    sendInConversation: authedProcedure
      .input(sendConversationInput)
      .mutation(async ({ ctx, input }) => {
        requireMessageReader(ctx.user);
        if (ctx.user.role === 'Student') {
          await requireStudentMessageAuthor(ctx);
        }

        const threads = await loadVisibleThreadDetails(ctx);
        const group = groupThreadsByConversation(threads).find(
          (conversation) => conversation.id === input.conversationId,
        );
        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'conversation not found' });
        }

        const canonicalThread = newestThread(group.threads);
        const thread = await assertThreadAccess(
          ctx,
          await ctx.db.messageThread.findUnique({
            where: { id: canonicalThread.id },
            select: threadNotificationSelect,
          }),
        );

        return createMessageInThread({
          body: input.body,
          ctx,
          getEmailClient,
          thread,
        });
      }),

    listConversationMessages: authedProcedure
      .input(conversationInput)
      .query(async ({ ctx, input }) => {
        requireMessageReader(ctx.user);

        const threads = await loadVisibleThreadDetails(ctx);
        const group = groupThreadsByConversation(threads).find(
          (conversation) => conversation.id === input.conversationId,
        );
        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'conversation not found' });
        }

        const markedReadCounts = await Promise.all(
          group.threads.map((thread) => markThreadRead(ctx, thread)),
        );
        if (markedReadCounts.some((count) => count > 0)) {
          const refreshedThreads = await loadVisibleThreadDetails(ctx);
          const refreshedGroup = groupThreadsByConversation(refreshedThreads).find(
            (conversation) => conversation.id === input.conversationId,
          );
          if (!refreshedGroup) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'conversation not found' });
          }
          return mapConversationMessages(ctx, refreshedGroup);
        }

        return mapConversationMessages(ctx, group);
      }),

    listInThread: authedProcedure.input(threadInput).query(async ({ ctx, input }) => {
      requireMessageReader(ctx.user);

      const thread = await ctx.db.messageThread.findUnique({
        where: { id: input.threadId },
        include: threadMessageInclude,
      });
      const accessibleThread = await assertThreadAccess(ctx, thread);
      const markedReadCount = await markThreadRead(ctx, accessibleThread);

      if (markedReadCount > 0) {
        const updatedThread = await ctx.db.messageThread.findUnique({
          where: { id: input.threadId },
          include: threadMessageInclude,
        });
        return mapThreadMessages(ctx, await assertThreadAccess(ctx, updatedThread));
      }

      return mapThreadMessages(ctx, accessibleThread);
    }),
  });
}

export const messageRouter = createMessageRouter();
