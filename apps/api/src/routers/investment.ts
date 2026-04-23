import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const investmentRouter = router({
  account: authedProcedure
    .input(z.object({ studentId: z.string().cuid() }))
    .query(() => notImplemented('investment.account')),
  navHistory: authedProcedure
    .input(z.object({ days: z.number().int().positive().max(365).default(30) }))
    .query(() => notImplemented('investment.navHistory')),
  buy: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        merits: z.number().int().positive(),
      }),
    )
    .mutation(() => notImplemented('investment.buy')),
  sell: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        units: z.number().positive(),
      }),
    )
    .mutation(() => notImplemented('investment.sell')),
  tickNav: authedProcedure.mutation(() => notImplemented('investment.tickNav')),
});
