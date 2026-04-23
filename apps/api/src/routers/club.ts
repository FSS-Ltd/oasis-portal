import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const clubRouter = router({
  list: authedProcedure.query(() => notImplemented('club.list')),
  create: authedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        schedule: z.string().optional(),
        capacity: z.number().int().positive().optional(),
      }),
    )
    .mutation(() => notImplemented('club.create')),
  update: authedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        schedule: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(() => notImplemented('club.update')),
  signUp: authedProcedure
    .input(z.object({ clubId: z.string().cuid(), studentId: z.string().cuid() }))
    .mutation(() => notImplemented('club.signUp')),
  withdraw: authedProcedure
    .input(z.object({ clubId: z.string().cuid(), studentId: z.string().cuid() }))
    .mutation(() => notImplemented('club.withdraw')),
  notify: authedProcedure
    .input(
      z.object({
        clubId: z.string().cuid(),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(() => notImplemented('club.notify')),
});
