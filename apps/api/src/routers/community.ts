import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import { AccessDeniedError, isFullAdmin, type SessionUser } from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const CENTRAL_GROUP_TITLE = 'Central Community';
const CENTRAL_GROUP_DESCRIPTION = 'A place for all students to interact safely.';
const MAX_MESSAGE_LENGTH = 2000;
const COMMUNITY_GROUP_NOT_FOUND_MESSAGE = 'community group not found';

const communitySettingsSelect = Prisma.validator<Prisma.StudentPortalSettingsSelect>()({
  communityMessagingBlocked: true,
  communityMessagingBlockedReasonEnc: true,
  communityMessagingBlockedById: true,
  communityMessagingBlockedAt: true,
});

const studentDisplaySelect = Prisma.validator<Prisma.StudentSelect>()({
  id: true,
  userId: true,
  active: true,
  fullNameEnc: true,
  yearGroup: true,
});

const studentWithSettingsSelect = Prisma.validator<Prisma.StudentSelect>()({
  ...studentDisplaySelect,
  user: {
    select: {
      id: true,
      active: true,
      role: true,
      fullNameEnc: true,
      clerkId: true,
    },
  },
  portalSettings: { select: communitySettingsSelect },
});

const groupListInclude = Prisma.validator<Prisma.CommunityGroupInclude>()({
  members: {
    include: {
      student: { select: studentWithSettingsSelect },
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: {
      senderStudent: { select: studentDisplaySelect },
      reads: { select: { studentId: true, readAt: true } },
    },
  },
  _count: { select: { members: true, messages: true } },
});

const groupAccessInclude = Prisma.validator<Prisma.CommunityGroupInclude>()({
  members: true,
});

const messageInclude = Prisma.validator<Prisma.CommunityMessageInclude>()({
  senderStudent: { select: studentDisplaySelect },
  reads: { select: { studentId: true, readAt: true } },
});

type StudentWithSettings = Prisma.StudentGetPayload<{ select: typeof studentWithSettingsSelect }>;
type StudentDisplay = Prisma.StudentGetPayload<{ select: typeof studentDisplaySelect }>;
type GroupListRow = Prisma.CommunityGroupGetPayload<{ include: typeof groupListInclude }>;
type GroupAccessRow = Prisma.CommunityGroupGetPayload<{ include: typeof groupAccessInclude }>;
type MessageRow = Prisma.CommunityMessageGetPayload<{ include: typeof messageInclude }>;

const groupIdInput = z.object({ groupId: z.string().min(1) }).strict();

const sendMessageInput = z
  .object({
    groupId: z.string().min(1),
    body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  })
  .strict();

const createGroupInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().nullable(),
    isPublic: z.boolean(),
    active: z.boolean(),
  })
  .strict();

const updateGroupInput = createGroupInput.extend({
  groupId: z.string().min(1),
});

const setMembershipInput = z
  .object({
    groupId: z.string().min(1),
    studentId: z.string().min(1),
    active: z.boolean(),
  })
  .strict();

const setStudentMessagingBlockedInput = z
  .object({
    studentId: z.string().min(1),
    blocked: z.boolean(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function decryptOptional(ctx: AuthedContext, value: string | null | undefined): string | null {
  return ctx.db.$enc.decrypt(value) ?? null;
}

function decryptRequired(ctx: AuthedContext, value: string | null | undefined, label: string) {
  const decrypted = ctx.db.$enc.decrypt(value);
  if (!decrypted) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `${label} could not be decrypted`,
    });
  }
  return decrypted;
}

function requireCommunityAdmin(user: SessionUser): void {
  if (isFullAdmin(user)) return;
  throw toForbidden(new AccessDeniedError('community moderation requires full-admin access'));
}

async function loadStudentProfile(ctx: AuthedContext): Promise<StudentWithSettings> {
  if (ctx.user.role !== 'Student') {
    throw toForbidden(new AccessDeniedError('community access requires a student account'));
  }

  const student = await ctx.db.student.findFirst({
    where: { userId: ctx.user.id, active: true },
    select: studentWithSettingsSelect,
  });

  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }

  return student;
}

async function loadActiveStudent(
  ctx: AuthedContext,
  studentId: string,
): Promise<StudentWithSettings> {
  const student = await ctx.db.student.findFirst({
    where: { id: studentId, active: true },
    select: studentWithSettingsSelect,
  });

  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }

  return student;
}

async function ensureCentralCommunityGroup(ctx: AuthedContext): Promise<{ id: string }> {
  const existing = await ctx.db.communityGroup.findFirst({
    where: { isCentral: true },
    select: { id: true },
  });
  if (existing) return existing;

  const group = await ctx.db.communityGroup.create({
    data: {
      title: CENTRAL_GROUP_TITLE,
      descriptionEnc: ctx.db.$enc.encrypt(CENTRAL_GROUP_DESCRIPTION),
      isCentral: true,
      isPublic: true,
      active: true,
      createdById: isFullAdmin(ctx.user) ? ctx.user.id : null,
    },
    select: { id: true },
  });

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Create',
      entity: 'CommunityGroup',
      entityId: group.id,
      meta: { source: 'community.ensureCentralCommunityGroup', isCentral: true },
    },
  });

  return group;
}

async function ensureCentralMembership(ctx: AuthedContext, studentId: string): Promise<void> {
  const centralGroup = await ensureCentralCommunityGroup(ctx);
  await ctx.db.communityGroupMember.upsert({
    where: { groupId_studentId: { groupId: centralGroup.id, studentId } },
    create: { groupId: centralGroup.id, studentId, active: true },
    update: { active: true },
  });
}

function isActiveMember(group: GroupAccessRow | GroupListRow, studentId: string): boolean {
  return group.members.some((member) => member.studentId === studentId && member.active);
}

async function assertStudentGroupAccess(
  ctx: AuthedContext,
  groupId: string,
  studentId: string,
): Promise<GroupAccessRow> {
  const group = await ctx.db.communityGroup.findUnique({
    where: { id: groupId },
    include: groupAccessInclude,
  });

  if (!group || !group.active || !isActiveMember(group, studentId)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: COMMUNITY_GROUP_NOT_FOUND_MESSAGE });
  }

  return group;
}

async function assertStudentCanSend(
  ctx: AuthedContext,
  groupId: string,
  student: StudentWithSettings,
): Promise<void> {
  await assertStudentGroupAccess(ctx, groupId, student.id);
  if (student.portalSettings?.communityMessagingBlocked) {
    throw toForbidden(new AccessDeniedError('student community messaging is disabled'));
  }
}

function displayStudent(ctx: AuthedContext, student: StudentDisplay) {
  return {
    id: student.id,
    userId: student.userId,
    fullName: decryptRequired(ctx, student.fullNameEnc, 'student name'),
    yearGroup: student.yearGroup,
  };
}

function messagingBlockState(ctx: AuthedContext, student: StudentWithSettings) {
  const settings = student.portalSettings;
  return {
    communityMessagingBlocked: settings?.communityMessagingBlocked ?? false,
    communityMessagingBlockedReason: decryptOptional(
      ctx,
      settings?.communityMessagingBlockedReasonEnc,
    ),
    communityMessagingBlockedById: settings?.communityMessagingBlockedById ?? null,
    communityMessagingBlockedAt: settings?.communityMessagingBlockedAt ?? null,
  };
}

function mapGroup(ctx: AuthedContext, group: GroupListRow, currentStudentId: string | null) {
  const joined = currentStudentId ? isActiveMember(group, currentStudentId) : false;
  const latestMessage = group.messages[0] ?? null;
  const activeMembers = group.members.filter((member) => member.active);

  return {
    id: group.id,
    title: group.title,
    description: decryptOptional(ctx, group.descriptionEnc),
    isCentral: group.isCentral,
    isPublic: group.isPublic,
    active: group.active,
    joined,
    memberCount: activeMembers.length,
    members: activeMembers.map((member) => ({
      studentId: member.studentId,
      joinedAt: member.joinedAt,
      student: displayStudent(ctx, member.student),
    })),
    messageCount: group._count.messages,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    latestMessage: latestMessage
      ? {
          id: latestMessage.id,
          senderStudentId: latestMessage.senderStudentId,
          sender: displayStudent(ctx, latestMessage.senderStudent),
          createdAt: latestMessage.createdAt,
        }
      : null,
  };
}

function latestOtherReadAt(message: MessageRow): Date | null {
  return (
    message.reads
      .filter((read) => read.studentId !== message.senderStudentId)
      .sort((a, b) => b.readAt.getTime() - a.readAt.getTime())[0]?.readAt ?? null
  );
}

function mapMessage(ctx: AuthedContext, message: MessageRow, currentStudentId: string) {
  const latestReadAtByOtherStudent = latestOtherReadAt(message);
  return {
    id: message.id,
    groupId: message.groupId,
    senderStudentId: message.senderStudentId,
    sender: displayStudent(ctx, message.senderStudent),
    body: decryptRequired(ctx, message.bodyEnc, 'community message body'),
    createdAt: message.createdAt,
    readByCurrentStudent:
      message.senderStudentId === currentStudentId ||
      message.reads.some((read) => read.studentId === currentStudentId),
    readByOtherStudents: latestReadAtByOtherStudent !== null,
    latestReadAtByOtherStudent,
  };
}

async function markGroupRead(
  ctx: AuthedContext,
  groupId: string,
  studentId: string,
  messages: MessageRow[],
): Promise<number> {
  const unreadMessageIds = messages
    .filter(
      (message) =>
        message.senderStudentId !== studentId &&
        !message.reads.some((read) => read.studentId === studentId),
    )
    .map((message) => message.id);

  if (unreadMessageIds.length === 0) return 0;

  const result = await ctx.db.communityMessageRead.createMany({
    data: unreadMessageIds.map((messageId) => ({ messageId, studentId })),
    skipDuplicates: true,
  });

  if (result.count > 0) {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'CommunityMessageRead',
        entityId: groupId,
        meta: {
          count: result.count,
          source: 'community.listGroupMessages.markRead',
        },
      },
    });
  }

  return result.count;
}

async function listMessages(ctx: AuthedContext, groupId: string): Promise<MessageRow[]> {
  return ctx.db.communityMessage.findMany({
    where: { groupId, deletedAt: null },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
  });
}

async function ensureActiveStudentCentralMemberships(ctx: AuthedContext): Promise<void> {
  const centralGroup = await ensureCentralCommunityGroup(ctx);
  const students = await ctx.db.student.findMany({
    where: { active: true, userId: { not: null } },
    select: { id: true },
  });
  await ctx.db.communityGroupMember.createMany({
    data: students.map((student) => ({ groupId: centralGroup.id, studentId: student.id })),
    skipDuplicates: true,
  });
}

export function createCommunityRouter() {
  return router({
    listStudentGroups: authedProcedure.query(async ({ ctx }) => {
      const student = await loadStudentProfile(ctx);
      await ensureCentralMembership(ctx, student.id);

      const groups = await ctx.db.communityGroup.findMany({
        include: groupListInclude,
        orderBy: [{ isCentral: 'desc' }, { updatedAt: 'desc' }],
      });

      return {
        currentStudentId: student.id,
        ...messagingBlockState(ctx, student),
        groups: groups
          .filter((group) => group.active && (group.isPublic || isActiveMember(group, student.id)))
          .map((group) => mapGroup(ctx, group, student.id)),
      };
    }),

    joinGroup: authedProcedure.input(groupIdInput).mutation(async ({ ctx, input }) => {
      const student = await loadStudentProfile(ctx);
      const group = await ctx.db.communityGroup.findUnique({
        where: { id: input.groupId },
        include: groupAccessInclude,
      });

      if (!group || !group.active || (!group.isPublic && !isActiveMember(group, student.id))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: COMMUNITY_GROUP_NOT_FOUND_MESSAGE });
      }

      await ctx.db.communityGroupMember.upsert({
        where: { groupId_studentId: { groupId: group.id, studentId: student.id } },
        create: { groupId: group.id, studentId: student.id, active: true },
        update: { active: true },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'CommunityGroupMember',
          entityId: group.id,
          meta: { source: 'community.joinGroup', studentId: student.id },
        },
      });

      return { id: group.id, joined: true };
    }),

    listGroupMessages: authedProcedure.input(groupIdInput).query(async ({ ctx, input }) => {
      const student = await loadStudentProfile(ctx);
      await assertStudentGroupAccess(ctx, input.groupId, student.id);

      const initialMessages = await listMessages(ctx, input.groupId);
      const markedReadCount = await markGroupRead(ctx, input.groupId, student.id, initialMessages);
      const messages =
        markedReadCount > 0 ? await listMessages(ctx, input.groupId) : initialMessages;

      return {
        groupId: input.groupId,
        currentStudentId: student.id,
        ...messagingBlockState(ctx, student),
        messages: messages.map((message) => mapMessage(ctx, message, student.id)),
      };
    }),

    listAdminGroupMessages: authedProcedure.input(groupIdInput).query(async ({ ctx, input }) => {
      requireCommunityAdmin(ctx.user);

      const group = await ctx.db.communityGroup.findUnique({
        where: { id: input.groupId },
        include: groupAccessInclude,
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: COMMUNITY_GROUP_NOT_FOUND_MESSAGE });
      }

      const messages = await listMessages(ctx, input.groupId);
      return {
        groupId: input.groupId,
        messages: messages.map((message) => mapMessage(ctx, message, '')),
      };
    }),

    sendMessage: authedProcedure.input(sendMessageInput).mutation(async ({ ctx, input }) => {
      const student = await loadStudentProfile(ctx);
      await assertStudentCanSend(ctx, input.groupId, student);

      const message = await ctx.db.communityMessage.create({
        data: {
          groupId: input.groupId,
          senderStudentId: student.id,
          bodyEnc: ctx.db.$enc.encrypt(input.body),
        },
        include: messageInclude,
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'CommunityMessage',
          entityId: message.id,
          meta: { source: 'community.sendMessage', groupId: input.groupId },
        },
      });

      return mapMessage(ctx, message, student.id);
    }),

    listAdminGroups: authedProcedure.query(async ({ ctx }) => {
      requireCommunityAdmin(ctx.user);
      await ensureActiveStudentCentralMemberships(ctx);

      const groups = await ctx.db.communityGroup.findMany({
        include: groupListInclude,
        orderBy: [{ isCentral: 'desc' }, { updatedAt: 'desc' }],
      });

      return groups.map((group) => mapGroup(ctx, group, null));
    }),

    createGroup: authedProcedure.input(createGroupInput).mutation(async ({ ctx, input }) => {
      requireCommunityAdmin(ctx.user);

      const group = await ctx.db.communityGroup.create({
        data: {
          title: input.title,
          descriptionEnc: input.description ? ctx.db.$enc.encrypt(input.description) : null,
          isCentral: false,
          isPublic: input.isPublic,
          active: input.active,
          createdById: ctx.user.id,
        },
        include: groupListInclude,
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'CommunityGroup',
          entityId: group.id,
          meta: { source: 'community.createGroup' },
        },
      });

      return mapGroup(ctx, group, null);
    }),

    updateGroup: authedProcedure.input(updateGroupInput).mutation(async ({ ctx, input }) => {
      requireCommunityAdmin(ctx.user);

      const group = await ctx.db.communityGroup.update({
        where: { id: input.groupId },
        data: {
          title: input.title,
          descriptionEnc: input.description ? ctx.db.$enc.encrypt(input.description) : null,
          isPublic: input.isPublic,
          active: input.active,
          updatedById: ctx.user.id,
          updatedAt: new Date(),
        },
        include: groupListInclude,
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'CommunityGroup',
          entityId: group.id,
          meta: { source: 'community.updateGroup' },
        },
      });

      return mapGroup(ctx, group, null);
    }),

    setMembership: authedProcedure.input(setMembershipInput).mutation(async ({ ctx, input }) => {
      requireCommunityAdmin(ctx.user);
      await loadActiveStudent(ctx, input.studentId);

      const group = await ctx.db.communityGroup.findUnique({
        where: { id: input.groupId },
        include: groupAccessInclude,
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: COMMUNITY_GROUP_NOT_FOUND_MESSAGE });
      }

      const member = await ctx.db.communityGroupMember.upsert({
        where: {
          groupId_studentId: {
            groupId: input.groupId,
            studentId: input.studentId,
          },
        },
        create: {
          groupId: input.groupId,
          studentId: input.studentId,
          active: input.active,
          updatedById: ctx.user.id,
          updatedAt: new Date(),
        },
        update: {
          active: input.active,
          updatedById: ctx.user.id,
          updatedAt: new Date(),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'CommunityGroupMember',
          entityId: input.groupId,
          meta: {
            source: 'community.setMembership',
            studentId: input.studentId,
            active: input.active,
          },
        },
      });

      return member;
    }),

    listStudentModeration: authedProcedure.query(async ({ ctx }) => {
      requireCommunityAdmin(ctx.user);
      await ensureActiveStudentCentralMemberships(ctx);

      const students = await ctx.db.student.findMany({
        where: { active: true, userId: { not: null } },
        select: studentWithSettingsSelect,
        orderBy: { fullNameEnc: 'asc' },
      });

      return students.map((student) => ({
        studentId: student.id,
        userId: student.userId,
        fullName: decryptRequired(ctx, student.fullNameEnc, 'student name'),
        yearGroup: student.yearGroup,
        ...messagingBlockState(ctx, student),
      }));
    }),

    setStudentMessagingBlocked: authedProcedure
      .input(setStudentMessagingBlockedInput)
      .mutation(async ({ ctx, input }) => {
        requireCommunityAdmin(ctx.user);
        const student = await loadActiveStudent(ctx, input.studentId);
        const reason = input.blocked ? input.reason?.trim() || null : null;

        const settings = await ctx.db.studentPortalSettings.upsert({
          where: { studentId: student.id },
          create: {
            studentId: student.id,
            communityMessagingBlocked: input.blocked,
            communityMessagingBlockedReasonEnc: reason ? ctx.db.$enc.encrypt(reason) : null,
            communityMessagingBlockedById: ctx.user.id,
            communityMessagingBlockedAt: new Date(),
          },
          update: {
            communityMessagingBlocked: input.blocked,
            communityMessagingBlockedReasonEnc: reason ? ctx.db.$enc.encrypt(reason) : null,
            communityMessagingBlockedById: ctx.user.id,
            communityMessagingBlockedAt: new Date(),
          },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StudentPortalSettings',
            entityId: student.id,
            meta: {
              source: 'community.setStudentMessagingBlocked',
              blocked: input.blocked,
            },
          },
        });

        return {
          studentId: student.id,
          userId: student.userId,
          fullName: decryptRequired(ctx, student.fullNameEnc, 'student name'),
          yearGroup: student.yearGroup,
          communityMessagingBlocked: settings.communityMessagingBlocked,
          communityMessagingBlockedReason: decryptOptional(
            ctx,
            settings.communityMessagingBlockedReasonEnc,
          ),
          communityMessagingBlockedById: settings.communityMessagingBlockedById,
          communityMessagingBlockedAt: settings.communityMessagingBlockedAt,
        };
      }),
  });
}

export const communityRouter = createCommunityRouter();
