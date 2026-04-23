import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const behaviourRouter = router({
  listForStudent: authedProcedure
    .input(z.object({ studentId: z.string().cuid() }))
    .query(() => notImplemented('behaviour.listForStudent')),
  log: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        type: z.enum(['Merit', 'Demerit']),
        category: z.string().min(1),
        note: z.string().optional(),
        visibility: z.enum(['General', 'Sensitive']).default('General'),
        // Merit: positive integer; Demerit: server overrides to DEMERIT_COST.
        amount: z.number().int().positive().optional(),
      }),
    )
    .mutation(() => notImplemented('behaviour.log')),
});
