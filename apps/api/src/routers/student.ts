import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const studentRouter = router({
  list: authedProcedure.query(() => notImplemented('student.list')),
  byId: authedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(() => notImplemented('student.byId')),
  create: authedProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        dob: z.coerce.date(),
        yearGroup: z.string(),
        enrolmentDate: z.coerce.date(),
      }),
    )
    .mutation(() => notImplemented('student.create')),
});
