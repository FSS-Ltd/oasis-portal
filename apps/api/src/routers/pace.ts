import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const paceRouter = router({
  forStudent: authedProcedure
    .input(z.object({ studentId: z.string().cuid() }))
    .query(() => notImplemented('pace.forStudent')),
  record: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        subjectId: z.string().cuid(),
        paceNumber: z.number().int().positive(),
        selfTestScore: z.number().int().min(0).max(100).optional(),
        paceTestScore: z.number().int().min(0).max(100).optional(),
        completedAt: z.coerce.date().optional(),
      }),
    )
    .mutation(() => notImplemented('pace.record')),
});
