import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const attendanceRouter = router({
  forDate: authedProcedure
    .input(z.object({ date: z.coerce.date() }))
    .query(() => notImplemented('attendance.forDate')),
  mark: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        date: z.coerce.date(),
        status: z.enum(['Present', 'Absent', 'Late']),
      }),
    )
    .mutation(() => notImplemented('attendance.mark')),
});
