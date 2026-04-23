import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const reportRouter = router({
  draft: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        term: z.string().min(1),
      }),
    )
    .mutation(() => notImplemented('report.draft')),
  review: authedProcedure
    .input(z.object({ reportId: z.string().cuid(), headSummary: z.string().optional() }))
    .mutation(() => notImplemented('report.review')),
  send: authedProcedure
    .input(z.object({ reportId: z.string().cuid() }))
    .mutation(() => notImplemented('report.send')),
  listForStudent: authedProcedure
    .input(z.object({ studentId: z.string().cuid() }))
    .query(() => notImplemented('report.listForStudent')),
});
