/**
 * tRPC base — procedures, middleware, typed error shape.
 *
 * Phase 1 adds: Clerk auth middleware, RBAC guards that call requireFullAdmin /
 * requireOwnChild / requireTag on `ctx.user`, and audit-log writes for every
 * mutation + every Sensitive read.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { AccessDeniedError } from '@oasis/domain';
import type { AppContext } from './context.js';

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        accessDenied: error.cause instanceof AccessDeniedError,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'sign-in required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const authedProcedure = publicProcedure.use(requireAuthed);
