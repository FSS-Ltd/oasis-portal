import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  canViewSensitiveChildNotes,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

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

async function assertActiveStudent(ctx: AuthedContext, studentId: string): Promise<void> {
  const student = await ctx.db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true },
  });
  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  if (!student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
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
      await assertActiveStudent(ctx, input.studentId);

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
      await assertActiveStudent(ctx, input.studentId);

      const canReadSensitive = canViewSensitiveChildNotes(ctx.user);
      const notes = await ctx.db.childNote.findMany({
        where: {
          studentId: input.studentId,
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
            meta: { studentId: input.studentId, count: sensitiveCount, source: 'childNotes.listForStudent' },
          },
        });
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ChildNote',
          meta: { studentId: input.studentId, count: notes.length, source: 'childNotes.listForStudent' },
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
          createdByName: decryptRequired(ctx.db.$enc.decrypt, note.createdBy.fullNameEnc, 'user PII'),
          createdByRole: note.createdBy.role,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })),
      };
    }),
});
