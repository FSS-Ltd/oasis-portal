import { publicProcedure, router } from '../trpc.js';

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, at: new Date().toISOString() })),
});
