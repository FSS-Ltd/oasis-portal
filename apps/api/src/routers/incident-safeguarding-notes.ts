import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import { incidentReadProcedure, router } from '../trpc.js';

const reportInput = z.object({ reportId: z.string().min(1) });
const addNoteInput = reportInput.extend({ body: z.string().trim().min(1).max(3000) });

export const incidentSafeguardingNotesRouter = router({
  list: incidentReadProcedure.input(reportInput).query(async ({ ctx, input }) => {
    if (ctx.user.role !== 'Head' && ctx.user.role !== 'SafeguardingLead') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Safeguarding notes access required.' });
    }
    const notes = await ctx.withRls(async (tx) => {
      const report = await tx.incidentReport.findUnique({
        where: { id: input.reportId },
        select: { id: true },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found.' });
      return tx.incidentSafeguardingNote.findMany({
        where: { reportId: input.reportId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { author: { select: { fullNameEnc: true } } },
      });
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'ReadSensitive',
        entity: 'IncidentSafeguardingNote',
        meta: { reportId: input.reportId, count: notes.length },
      },
    });
    return notes.map((note) => ({
      id: note.id,
      body: decryptRequiredText(ctx.db.$enc, note.bodyEnc, 'safeguarding note'),
      authorName: decryptRequiredText(ctx.db.$enc, note.author.fullNameEnc, 'note author'),
      createdAt: note.createdAt,
    }));
  }),

  add: incidentReadProcedure.input(addNoteInput).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== 'SafeguardingLead') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Safeguarding Lead access required.' });
    }
    const note = await ctx.withRls(async (tx) => {
      const report = await tx.incidentReport.findUnique({
        where: { id: input.reportId },
        select: { id: true, status: true },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found.' });
      if (report.status === 'Draft') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Submit the report before adding notes.',
        });
      }
      return tx.incidentSafeguardingNote.create({
        data: {
          reportId: input.reportId,
          authorId: ctx.user.id,
          bodyEnc: ctx.db.$enc.encrypt(input.body),
        },
        select: { id: true },
      });
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'IncidentSafeguardingNote',
        entityId: note.id,
        meta: { reportId: input.reportId },
      },
    });
    return note;
  }),
});
