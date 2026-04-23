import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const titheRouter = router({
  getConfig: authedProcedure
    .input(z.object({ studentId: z.string().cuid() }))
    .query(() => notImplemented('tithe.getConfig')),
  setPercentage: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        percentage: z.union([z.literal(10), z.literal(15), z.literal(20)]),
      }),
    )
    .mutation(() => notImplemented('tithe.setPercentage')),
  runWeek: authedProcedure
    .input(z.object({ weekStart: z.coerce.date() }))
    .mutation(() => notImplemented('tithe.runWeek')),
});
