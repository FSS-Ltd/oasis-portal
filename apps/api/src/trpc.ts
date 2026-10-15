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
  canViewIncidentReports,
  canUseCompliance,
  canViewCompliance,
  canUseComplianceAdminTag,
  canUseClubsLeadPortal,
  canUseAdminOperations,
  isStaff,
  requireAdminOperations,
  requireFullAdmin,
  requireRole,
  requireUserAccountAdmin,
  type Role,
} from '@oasis/domain';
import type { AppContext } from './context.js';

const CLIENT_INTERNAL_ERROR_MESSAGE =
  'Something went wrong. Try again, or contact an administrator if it continues.';

export function clientSafeErrorMessage(error: TRPCError, message: string): string {
  return error.code === 'INTERNAL_SERVER_ERROR' ? CLIENT_INTERNAL_ERROR_MESSAGE : message;
}

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const message = clientSafeErrorMessage(error, shape.message);
    return {
      ...shape,
      message,
      data: {
        ...shape.data,
        accessDenied: error.cause instanceof AccessDeniedError,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'sign-in required' });
  }
  if (ctx.user.requires2fa) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'two-factor authentication required',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const authenticatedProcedure = publicProcedure.use(requireAuth);

export const agreementRecipientProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'Student') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Adult account required.' });
  }
  return next();
});

export const authedProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'SafeguardingLead') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This role is limited to compliance pages.',
    });
  }
  return next();
});

export const complianceAdminProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'Head' && !canUseComplianceAdminTag(ctx.user)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Compliance administration access required.',
    });
  }
  return next();
});

export const incidentWriteProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'SafeguardingLead' && !canUseComplianceAdminTag(ctx.user)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Incident editing access required.' });
  }
  return next();
});

export const complianceProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (!canViewCompliance(ctx.user)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Compliance access required.' });
  }
  return next();
});

export const incidentReadProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (!canViewIncidentReports(ctx.user)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Incident report access required.' });
  }
  return next();
});

export const complianceEditorProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (!canUseCompliance(ctx.user)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Compliance editing access required.' });
  }
  return next();
});

export const complianceBadgeProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (
    !canUseCompliance(ctx.user) &&
    !isStaff(ctx.user) &&
    !canUseAdminOperations(ctx.user) &&
    !canUseClubsLeadPortal(ctx.user)
  ) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required.' });
  }
  return next();
});

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

export const adminOperationsProcedure = authedProcedure.use(({ ctx, next }) => {
  try {
    requireAdminOperations(ctx.user);
  } catch (err) {
    throw toTrpcError(err);
  }
  return next();
});

export const userAccountAdminProcedure = authedProcedure.use(({ ctx, next }) => {
  try {
    requireUserAccountAdmin(ctx.user);
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
