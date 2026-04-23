import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const leaderboardRouter = router({
  get: authedProcedure
    .input(
      z.object({
        kind: z.enum(['TopTithers', 'TopInvestors', 'TopSavers', 'HighestDemerits']),
        limit: z.number().int().positive().max(50).default(10),
      }),
    )
    .query(() => notImplemented('leaderboard.get')),
});
