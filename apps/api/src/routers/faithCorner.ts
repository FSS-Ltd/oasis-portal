import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
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

    return loadCurrentFaithCornerContent(ctx);
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
