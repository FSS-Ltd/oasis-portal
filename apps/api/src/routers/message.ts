import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const messageRouter = router({
  listThreads: authedProcedure.query(() => notImplemented('message.listThreads')),
  openThread: authedProcedure
    .input(z.object({ adminId: z.string().cuid(), subject: z.string().min(1) }))
    .mutation(() => notImplemented('message.openThread')),
  send: authedProcedure
    .input(z.object({ threadId: z.string().cuid(), body: z.string().min(1) }))
    .mutation(() => notImplemented('message.send')),
  listInThread: authedProcedure
    .input(z.object({ threadId: z.string().cuid() }))
    .query(() => notImplemented('message.listInThread')),
});
