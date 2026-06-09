import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { FaithCornerCommentStatus, Prisma } from '@oasis/db';
import type { AppContext } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import {
  loadCurrentFaithCornerContent,
  mapFaithCornerContent,
} from '../services/faith-corner.js';
import { adminOperationsProcedure, roleProcedure, router } from '../trpc.js';

const optionalTextInput = z
  .string()
  .trim()
  .max(1000)
  .nullable()
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    return value.length > 0 ? value : null;
  });

const publishFaithCornerInput = z
  .object({
    weeklyTheme: z.string().trim().min(1).max(120),
    memoryVerseReference: z.string().trim().min(1).max(80),
    memoryVerseText: z.string().trim().min(1).max(1000),
    reflectionPrompt: z.string().trim().min(1).max(1000),
    verseOfDayReference: optionalTextInput,
    verseOfDayText: optionalTextInput,
  })
  .refine(
    (input) =>
      (input.verseOfDayReference === null && input.verseOfDayText === null) ||
      (input.verseOfDayReference !== null && input.verseOfDayText !== null),
    {
      message: 'verse of the day reference and text must be provided together',
      path: ['verseOfDayText'],
    },
  );

const commentBodyInput = z.string().trim().min(1).max(500);
const commentIdInput = z.object({ commentId: z.string().min(1) });
const reviewCommentInput = commentIdInput.extend({
  status: z.enum(['Approved', 'Rejected']),
});

const commentSelect = {
  id: true,
  bodyEnc: true,
  status: true,
  studentId: true,
  createdAt: true,
  student: { select: { fullNameEnc: true } },
  _count: { select: { likes: true } },
} satisfies Prisma.FaithCornerCommentSelect;

const adminCommentSelect = {
  id: true,
  bodyEnc: true,
  status: true,
  studentId: true,
  createdAt: true,
  reviewedAt: true,
  student: { select: { fullNameEnc: true } },
  content: { select: { weeklyTheme: true } },
  _count: { select: { likes: true } },
} satisfies Prisma.FaithCornerCommentSelect;

type CommentRow = Prisma.FaithCornerCommentGetPayload<{ select: typeof commentSelect }>;
type AdminCommentRow = Prisma.FaithCornerCommentGetPayload<{
  select: typeof adminCommentSelect;
}>;

export interface FaithCornerCommentDto {
  id: string;
  body: string;
  authorFirstName: string;
  status: FaithCornerCommentStatus;
  createdAt: Date;
  likeCount: number;
  likedByCurrentStudent: boolean;
  isOwnComment: boolean;
}

export interface AdminFaithCornerCommentDto extends FaithCornerCommentDto {
  weeklyTheme: string;
  reviewedAt: Date | null;
}

function decryptRequired(
  ctx: AppContext,
  value: string | null | undefined,
  entity: string,
): string {
  const decrypted = ctx.db.$enc.decrypt(value);
  if (!decrypted) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `${entity} decrypt failed`,
    });
  }
  return decrypted;
}

function firstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/u)[0] ?? fullName;
}

function mapComment(
  ctx: AppContext,
  row: CommentRow,
  likedCommentIds: ReadonlySet<string>,
  currentStudentId: string,
): FaithCornerCommentDto {
  const fullName = decryptRequired(ctx, row.student.fullNameEnc, 'faith corner comment author');
  return {
    id: row.id,
    body: decryptRequired(ctx, row.bodyEnc, 'faith corner comment'),
    authorFirstName: firstNameFrom(fullName),
    status: row.status,
    createdAt: row.createdAt,
    likeCount: row._count.likes,
    likedByCurrentStudent: likedCommentIds.has(row.id),
    isOwnComment: row.studentId === currentStudentId,
  };
}

function mapAdminComment(ctx: AppContext, row: AdminCommentRow): AdminFaithCornerCommentDto {
  const fullName = decryptRequired(ctx, row.student.fullNameEnc, 'faith corner comment author');
  return {
    id: row.id,
    body: decryptRequired(ctx, row.bodyEnc, 'faith corner comment'),
    authorFirstName: firstNameFrom(fullName),
    status: row.status,
    createdAt: row.createdAt,
    likeCount: row._count.likes,
    likedByCurrentStudent: false,
    isOwnComment: false,
    weeklyTheme: row.content.weeklyTheme,
    reviewedAt: row.reviewedAt,
  };
}

async function loadOwnActiveStudent(ctx: AppContext): Promise<{ id: string; active: boolean }> {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'authentication required' });
  }

  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: { id: true, active: true },
  });
  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }
  return student;
}

async function loadCurrentContentId(ctx: AppContext): Promise<string> {
  const content = await ctx.db.faithCornerContent.findFirst({
    where: { active: true },
    select: { id: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
  if (!content) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'faith corner content not found' });
  }
  return content.id;
}

async function loadCommentLikeState(
  ctx: AppContext,
  commentIds: readonly string[],
  studentId: string,
): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  const likes = await ctx.db.faithCornerCommentLike.findMany({
    where: { commentId: { in: [...commentIds] }, studentId },
    select: { commentId: true },
  });
  return new Set(likes.map((like) => like.commentId));
}

export const faithCornerRouter = router({
  currentForAdmin: adminOperationsProcedure.query(async ({ ctx }) =>
    loadCurrentFaithCornerContent(ctx),
  ),

  currentForStudent: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, {
      entity: 'faithCorner.currentForStudent',
      studentId: student.id,
    });

    return loadCurrentFaithCornerContent(ctx, student.id);
  }),

  listComments: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, {
      entity: 'faithCorner.listComments',
      studentId: student.id,
    });

    const contentId = await loadCurrentContentId(ctx);
    const comments = await ctx.db.faithCornerComment.findMany({
      where: {
        contentId,
        OR: [{ status: 'Approved' }, { studentId: student.id }],
      },
      select: commentSelect,
      orderBy: [{ createdAt: 'asc' }],
    });
    const likedCommentIds = await loadCommentLikeState(
      ctx,
      comments.map((comment) => comment.id),
      student.id,
    );

    if (comments.length > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'FaithCornerComment',
          meta: { source: 'faithCorner.listComments', count: comments.length * 2 },
        },
      });
    }

    return comments.map((comment) => mapComment(ctx, comment, likedCommentIds, student.id));
  }),

  toggleCurrentLike: roleProcedure('Student').mutation(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, {
      entity: 'faithCorner.toggleCurrentLike',
      studentId: student.id,
    });

    const contentId = await loadCurrentContentId(ctx);
    const where = { contentId_studentId: { contentId, studentId: student.id } };
    const existing = await ctx.db.faithCornerContentLike.findUnique({
      where,
      select: { contentId: true },
    });
    if (existing) {
      await ctx.db.faithCornerContentLike.delete({ where });
    } else {
      await ctx.db.faithCornerContentLike.create({
        data: { contentId, studentId: student.id },
      });
    }

    return loadCurrentFaithCornerContent(ctx, student.id);
  }),

  submitComment: roleProcedure('Student')
    .input(z.object({ body: commentBodyInput }))
    .mutation(async ({ ctx, input }) => {
      const student = await loadOwnActiveStudent(ctx);
      await assertStudentPortalAccess(ctx, {
        entity: 'faithCorner.submitComment',
        studentId: student.id,
      });

      const contentId = await loadCurrentContentId(ctx);
      const comment = await ctx.db.faithCornerComment.create({
        data: {
          contentId,
          studentId: student.id,
          bodyEnc: ctx.db.$enc.encrypt(input.body),
          status: 'Pending',
        },
        select: commentSelect,
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'FaithCornerComment',
          entityId: comment.id,
          meta: { source: 'faithCorner.submitComment' },
        },
      });

      return mapComment(ctx, comment, new Set(), student.id);
    }),

  toggleCommentLike: roleProcedure('Student')
    .input(commentIdInput)
    .mutation(async ({ ctx, input }) => {
      const student = await loadOwnActiveStudent(ctx);
      await assertStudentPortalAccess(ctx, {
        entity: 'faithCorner.toggleCommentLike',
        studentId: student.id,
      });

      const comment = await ctx.db.faithCornerComment.findUnique({
        where: { id: input.commentId },
        select: {
          id: true,
          status: true,
          content: { select: { active: true } },
        },
      });
      if (!comment || comment.status !== 'Approved' || !comment.content.active) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'faith corner comment not found' });
      }

      const where = { commentId_studentId: { commentId: comment.id, studentId: student.id } };
      const existing = await ctx.db.faithCornerCommentLike.findUnique({
        where,
        select: { commentId: true },
      });
      if (existing) {
        await ctx.db.faithCornerCommentLike.delete({ where });
      } else {
        await ctx.db.faithCornerCommentLike.create({
          data: { commentId: comment.id, studentId: student.id },
        });
      }

      const likeCount = await ctx.db.faithCornerCommentLike.count({
        where: { commentId: comment.id },
      });
      return { likedByCurrentStudent: !existing, likeCount };
    }),

  pendingCommentsForAdmin: adminOperationsProcedure.query(async ({ ctx }) => {
    const comments = await ctx.db.faithCornerComment.findMany({
      where: { status: 'Pending' },
      select: adminCommentSelect,
      orderBy: [{ createdAt: 'asc' }],
    });

    if (comments.length > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'FaithCornerComment',
          meta: { source: 'faithCorner.pendingCommentsForAdmin', count: comments.length * 2 },
        },
      });
    }

    return comments.map((comment) => mapAdminComment(ctx, comment));
  }),

  reviewComment: adminOperationsProcedure
    .input(reviewCommentInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.faithCornerComment.findUnique({
        where: { id: input.commentId },
        select: { id: true, status: true },
      });
      if (!existing || existing.status !== 'Pending') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'pending comment not found' });
      }

      const comment = await ctx.db.faithCornerComment.update({
        where: { id: input.commentId },
        data: {
          status: input.status,
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
        },
        select: adminCommentSelect,
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'FaithCornerComment',
          entityId: comment.id,
          meta: { source: 'faithCorner.reviewComment', status: input.status },
        },
      });

      return mapAdminComment(ctx, comment);
    }),

  publish: adminOperationsProcedure
    .input(publishFaithCornerInput)
    .mutation(async ({ ctx, input }) =>
      ctx.db.$transaction(
        async (tx) => {
          await tx.faithCornerContent.updateMany({
            where: { active: true },
            data: { active: false, updatedById: ctx.user.id },
          });

          const content = await tx.faithCornerContent.create({
            data: {
              weeklyTheme: input.weeklyTheme,
              memoryVerseReference: input.memoryVerseReference,
              memoryVerseTextEnc: ctx.db.$enc.encrypt(input.memoryVerseText),
              reflectionPromptEnc: ctx.db.$enc.encrypt(input.reflectionPrompt),
              verseOfDayReference: input.verseOfDayReference,
              verseOfDayTextEnc: input.verseOfDayText
                ? ctx.db.$enc.encrypt(input.verseOfDayText)
                : null,
              active: true,
              publishedAt: new Date(),
              createdById: ctx.user.id,
              updatedById: ctx.user.id,
            },
            select: {
              id: true,
              weeklyTheme: true,
              memoryVerseReference: true,
              memoryVerseTextEnc: true,
              reflectionPromptEnc: true,
              verseOfDayReference: true,
              verseOfDayTextEnc: true,
              publishedAt: true,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'FaithCornerContent',
              entityId: content.id,
              meta: {
                source: 'faithCorner.publish',
                hasVerseOfDay: input.verseOfDayText !== null,
              },
            },
          });

          return mapFaithCornerContent(ctx.db.$enc.decrypt, content);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    ),
});
