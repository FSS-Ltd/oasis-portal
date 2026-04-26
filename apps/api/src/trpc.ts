/**
 * tRPC base — procedures, middleware, typed error shape.
 *
 * Auth + RBAC layered on `ctx.user` (set by `createContext` from a Clerk
 * session). RBAC primitives live in `@oasis/domain` and are reused here —
 * do not duplicate role logic in this file.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import {
  AccessDeniedError,
  requireFullAdmin,
  requireRole,
  type Role,
} from '@oasis/domain';
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

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'sign-in required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const authedProcedure = publicProcedure.use(requireAuth);

function unwrapAccessDenied(err: unknown): AccessDeniedError | null {
  if (err instanceof AccessDeniedError) return err;
  if (err instanceof TRPCError && err.cause instanceof AccessDeniedError) return err.cause;
  return null;
}

function toTrpcError(err: unknown): TRPCError {
  const denied = unwrapAccessDenied(err);
  if (denied) {
    return new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
  }
  if (err instanceof TRPCError) return err;
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'unknown error',
    cause: err instanceof Error ? err : undefined,
  });
}

export const fullAdminProcedure = authedProcedure.use(({ ctx, next }) => {
  try {
    requireFullAdmin(ctx.user);
  } catch (err) {
    throw toTrpcError(err);
  }
  return next();
});

export function roleProcedure(...allowed: readonly Role[]) {
  return authedProcedure.use(({ ctx, next }) => {
    try {
      requireRole(ctx.user, ...allowed);
    } catch (err) {
      throw toTrpcError(err);
    }
    return next();
  });
}

/**
 * Wraps `authedProcedure` with audit-log writes. On every successful mutation
 * we record an `Update` row keyed by procedure path; on `AccessDeniedError`
 * we record a `PermissionDenied` row and rethrow as `FORBIDDEN`.
 *
 * Per-router handlers can write more specific `Create` / `Delete` / sensitive
 * read entries directly via `ctx.db.auditLog` when they have entity-level info.
 */
export const auditedProcedure = authedProcedure.use(async ({ ctx, path, type, next }) => {
  const result = await next();
  if (result.ok) {
    if (type === 'mutation') {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: path,
          meta: { type },
        },
      });
    }
    return result;
  }
  const denied = unwrapAccessDenied(result.error);
  if (denied) {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'PermissionDenied',
        entity: path,
        meta: { type, reason: denied.message },
      },
    });
    throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
  }
  return result;
});
