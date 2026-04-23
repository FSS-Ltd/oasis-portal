import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const meritLedgerRouter = router({
  balances: authedProcedure
    .input(z.object({ studentId: z.string().cuid() }))
    .query(() => notImplemented('meritLedger.balances')),
  activity: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        range: z.enum(['week', 'month']),
      }),
    )
    .query(() => notImplemented('meritLedger.activity')),
  transfer: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        from: z.enum(['Spend', 'Saving', 'Investment']),
        to: z.enum(['Spend', 'Saving', 'Investment']),
        amount: z.number().int().positive(),
      }),
    )
    .mutation(() => notImplemented('meritLedger.transfer')),
});
