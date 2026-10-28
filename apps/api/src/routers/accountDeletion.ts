import { createClerkClient } from '@clerk/backend';
import { TRPCError } from '@trpc/server';
import {
  canUseLinkedChildStudentSettingsAccess,
  isStudentAdult,
} from '@oasis/domain/studentPortalSettings';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { logOperationalEvent } from '../lib/observability.js';
import { deleteUserAccount } from '../services/delete-user-account.js';
import { authedProcedure, router, userAccountAdminProcedure } from '../trpc.js';

export interface AccountDeletionClerkAdapter {
  deleteUser(clerkUserId: string): Promise<void>;
}

export interface AccountDeletionRouterDeps {
  clerk?: AccountDeletionClerkAdapter;
}

const subjectInput = z.object({ studentId: z.string().min(1).optional() });
const userIdInput = z.object({ userId: z.string().min(1) });

const CLEAR_REQUEST = { deletionRequestedAt: null, deletionRequestedById: null } as const;

function createDefaultClerkAdapter(): AccountDeletionClerkAdapter {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required to delete Clerk users');
  const client = createClerkClient({ secretKey });
  return {
    async deleteUser(clerkUserId) {
      await client.users.deleteUser(clerkUserId);
    },
  };
}

type AuthedCtx = AppContext & { user: NonNullable<AppContext['user']> };

/** Resolves whose account a request is about: the caller's own, or a linked under-18 student's. */
async function resolveSubjectUserId(
  ctx: AuthedCtx,
  input: z.infer<typeof subjectInput>,
): Promise<string> {
  if (input.studentId) {
    if (!canUseLinkedChildStudentSettingsAccess(ctx.user)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'only a linked parent can do this' });
    }
    const guardian = await ctx.db.guardian.findFirst({
      where: { userId: ctx.user.id, studentId: input.studentId },
      select: { student: { select: { userId: true, dobEnc: true } } },
    });
    if (!guardian) throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
    if (isStudentAdult({ dateOfBirth: ctx.db.$enc.decrypt(guardian.student.dobEnc) })) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'parent account control is disabled for students who are 18 or older',
      });
    }
    if (!guardian.student.userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'this student has no account' });
    }
    return guardian.student.userId;
  }

  if (ctx.user.role === 'Student') {
    const student = await ctx.db.student.findUnique({
      where: { userId: ctx.user.id },
      select: { dobEnc: true },
    });
    const dob = student ? ctx.db.$enc.decrypt(student.dobEnc) : null;
    if (!dob || !isStudentAdult({ dateOfBirth: dob })) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'ask your parent or carer to request deletion of this account',
      });
    }
  }
  return ctx.user.id;
}

async function loadSubject(ctx: AuthedCtx, userId: string) {
  const subject = await ctx.db.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkId: true, deletedAt: true, deletionRequestedAt: true },
  });
  if (!subject || subject.deletedAt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'account not found' });
  }
  return subject;
}

async function loadPending(ctx: AuthedCtx, userId: string) {
  const subject = await loadSubject(ctx, userId);
  if (!subject.deletionRequestedAt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'no pending deletion request' });
  }
  return subject;
}

function audit(ctx: AuthedCtx, entityId: string, source: string) {
  return ctx.db.auditLog.create({
    data: { userId: ctx.user.id, action: 'Update', entity: 'User', entityId, meta: { source } },
  });
}

export function createAccountDeletionRouter(deps: AccountDeletionRouterDeps = {}) {
  return router({
    status: authedProcedure.input(subjectInput).query(async ({ ctx, input }) => {
      const userId = await resolveSubjectUserId(ctx, input).catch((error: unknown) => {
        if (error instanceof TRPCError && error.code === 'FORBIDDEN') return null;
        throw error;
      });
      if (!userId) return { requestedAt: null, canRequest: false };
      const subject = await loadSubject(ctx, userId);
      return { requestedAt: subject.deletionRequestedAt, canRequest: true };
    }),

    request: authedProcedure.input(subjectInput).mutation(async ({ ctx, input }) => {
      const userId = await resolveSubjectUserId(ctx, input);
      const subject = await loadSubject(ctx, userId);
      if (subject.deletionRequestedAt) {
        throw new TRPCError({ code: 'CONFLICT', message: 'a deletion request is already pending' });
      }
      await ctx.db.user.update({
        where: { id: userId },
        data: { deletionRequestedAt: new Date(), deletionRequestedById: ctx.user.id },
        select: { id: true },
      });
      await audit(ctx, userId, 'accountDeletion.request');
      return { id: userId };
    }),

    cancel: authedProcedure.input(subjectInput).mutation(async ({ ctx, input }) => {
      const userId = await resolveSubjectUserId(ctx, input);
      await loadPending(ctx, userId);
      await ctx.db.user.update({
        where: { id: userId },
        data: CLEAR_REQUEST,
        select: { id: true },
      });
      await audit(ctx, userId, 'accountDeletion.cancel');
      return { id: userId };
    }),

    queue: userAccountAdminProcedure.query(async ({ ctx }) => {
      const users = await ctx.db.user.findMany({
        where: { deletionRequestedAt: { not: null }, deletedAt: null },
        orderBy: { deletionRequestedAt: 'asc' },
        take: 100,
        select: {
          id: true,
          role: true,
          fullNameEnc: true,
          deletionRequestedAt: true,
          deletionRequestedById: true,
        },
      });
      const rows = users.flatMap((user) =>
        user.deletionRequestedAt
          ? [
              {
                userId: user.id,
                fullName: ctx.db.$enc.decrypt(user.fullNameEnc),
                role: user.role,
                requestedAt: user.deletionRequestedAt,
                requestedBySelf: user.deletionRequestedById === user.id,
              },
            ]
          : [],
      );
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { count: rows.length, source: 'accountDeletion.queue' },
        },
      });
      return rows;
    }),

    approve: userAccountAdminProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
      const subject = await loadPending(ctx, input.userId);
      await deleteUserAccount({ actor: ctx.user, userId: input.userId, withRls: ctx.withRls });

      // The account is already deactivated, so a Clerk failure leaves the person locked out of the
      // API. ponytail: no retry queue, an admin removes the Clerk user by hand if this reports false.
      let clerkUserDeleted = true;
      try {
        await (deps.clerk ?? createDefaultClerkAdapter()).deleteUser(subject.clerkId);
      } catch (error) {
        clerkUserDeleted = false;
        logOperationalEvent({
          event: 'account_deletion.clerk_delete_failed',
          level: 'error',
          message: 'Account deleted but the Clerk user could not be removed',
          meta: { errorType: error instanceof Error ? error.name : 'unknown' },
        });
      }
      return { id: input.userId, clerkUserDeleted };
    }),

    decline: userAccountAdminProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
      await loadPending(ctx, input.userId);
      await ctx.db.user.update({
        where: { id: input.userId },
        data: CLEAR_REQUEST,
        select: { id: true },
      });
      await audit(ctx, input.userId, 'accountDeletion.decline');
      return { id: input.userId };
    }),
  });
}

export const accountDeletionRouter = createAccountDeletionRouter();
