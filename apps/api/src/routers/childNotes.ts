import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  canUseAllStudentSupervisorWorkflow,
  canViewSensitiveChildNotes,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { loadDailyYearBandScope, studentMatchesDailyScope } from '../lib/daily-year-band-scope.js';
import { authedProcedure, fullAdminProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

async function requireChildNoteWorkflow(ctx: AuthedContext, entity: string): Promise<void> {
  if (isStaff(ctx.user)) return;
  const denied = new AccessDeniedError('child notes require full-admin or Supervisor');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function assertActiveStudent(
  ctx: AuthedContext,
  studentId: string,
): Promise<{ id: string; yearGroup: string }> {
  const student = await ctx.db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true, yearGroup: true },
  });
  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  if (!student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
  return student;
}

async function denyOutOfChildNoteScope(
  ctx: AuthedContext,
  entity: string,
  meta: Record<string, unknown>,
): Promise<never> {
  const denied = new AccessDeniedError('student is outside supervisor assigned year band');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { ...meta, role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireStudentInChildNoteScope(
  ctx: AuthedContext,
  entity: string,
  student: { id: string; yearGroup: string },
): Promise<void> {
  const scope = await loadDailyYearBandScope(ctx, new Date());
  if (canUseAllStudentSupervisorWorkflow(ctx.user) || studentMatchesDailyScope(scope, student)) {
    return;
  }

  await denyOutOfChildNoteScope(ctx, entity, {
    studentId: student.id,
    studentYearGroup: student.yearGroup,
    date: scope.dayKey,
    assignedBands: scope.assignedBands.map((band) => band.id),
  });
}

export const childNotesRouter = router({
  create: authedProcedure
    .input(
      z.object({
        studentId: z.string().min(1),
        note: z.string().trim().min(1).max(3000),
        sensitive: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireChildNoteWorkflow(ctx, 'childNotes.create');
      const student = await assertActiveStudent(ctx, input.studentId);
      await requireStudentInChildNoteScope(ctx, 'childNotes.create', student);

      const note = await ctx.db.childNote.create({
        data: {
          studentId: input.studentId,
          noteEnc: ctx.db.$enc.encrypt(input.note),
          sensitive: input.sensitive,
          createdById: ctx.user.id,
        },
        select: {
          id: true,
          studentId: true,
          sensitive: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'ChildNote',
          entityId: note.id,
          meta: { studentId: input.studentId, sensitive: input.sensitive },
        },
      });

      return note;
    }),

  listForStudent: authedProcedure
    .input(z.object({ studentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireChildNoteWorkflow(ctx, 'childNotes.listForStudent');
      const student = await assertActiveStudent(ctx, input.studentId);
      await requireStudentInChildNoteScope(ctx, 'childNotes.listForStudent', student);

      const canReadSensitive = canViewSensitiveChildNotes(ctx.user);
      const notes = await ctx.db.childNote.findMany({
        where: {
          studentId: input.studentId,
          deletedAt: null,
          ...(canReadSensitive ? {} : { sensitive: false }),
        },
        include: {
          createdBy: { select: { id: true, fullNameEnc: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const sensitiveCount = notes.filter((note) => note.sensitive).length;
      if (sensitiveCount > 0) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'ReadSensitive',
            entity: 'ChildNote',
            meta: {
              studentId: input.studentId,
              count: sensitiveCount,
              source: 'childNotes.listForStudent',
            },
          },
        });
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ChildNote',
          meta: {
            studentId: input.studentId,
            count: notes.length,
            source: 'childNotes.listForStudent',
          },
        },
      });

      return {
        studentId: input.studentId,
        notes: notes.map((note) => ({
          id: note.id,
          studentId: note.studentId,
          note: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
          sensitive: note.sensitive,
          createdById: note.createdById,
          createdByName: decryptRequired(
            ctx.db.$enc.decrypt,
            note.createdBy.fullNameEnc,
            'user PII',
          ),
          createdByRole: note.createdBy.role,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })),
      };
    }),

  update: fullAdminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        note: z.string().trim().min(1).max(3000),
        sensitive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.childNote.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          studentId: true,
          sensitive: true,
          deletedAt: true,
        },
      });
      if (!existing || existing.deletedAt !== null) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'child note not found' });
      }

      const note = await ctx.db.childNote.update({
        where: { id: input.id },
        data: {
          noteEnc: ctx.db.$enc.encrypt(input.note),
          sensitive: input.sensitive,
        },
        select: {
          id: true,
          studentId: true,
          sensitive: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'ChildNote',
          entityId: note.id,
          meta: {
            studentId: note.studentId,
            previousSensitive: existing.sensitive,
            sensitive: note.sensitive,
            noteChanged: true,
          },
        },
      });

      return note;
    }),

  delete: fullAdminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.childNote.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          studentId: true,
          sensitive: true,
          deletedAt: true,
        },
      });
      if (!existing || existing.deletedAt !== null) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'child note not found' });
      }

      const note = await ctx.db.childNote.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), deletedById: ctx.user.id },
        select: { id: true, studentId: true, sensitive: true },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Delete',
          entity: 'ChildNote',
          entityId: note.id,
          meta: { studentId: note.studentId, previousSensitive: existing.sensitive },
        },
      });

      return note;
    }),
});
