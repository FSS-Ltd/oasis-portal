import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const noticeRouter = router({
  listForStaff: authedProcedure.query(() => notImplemented('notice.listForStaff')),
  post: authedProcedure
    .input(z.object({ title: z.string().min(1), body: z.string().min(1) }))
    .mutation(() => notImplemented('notice.post')),
  markRead: authedProcedure
    .input(z.object({ noticeId: z.string().cuid() }))
    .mutation(() => notImplemented('notice.markRead')),
});
