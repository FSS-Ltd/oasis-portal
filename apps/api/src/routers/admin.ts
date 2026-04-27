/**
 * Head-admin operations (PR-1.5).
 *
 * - `admin.inviteUser`: creates a Clerk invitation pre-stamped with role/tags
 *   in `publicMetadata`. The webhook (clerkWebhook.ts) reads those at signup.
 * - `admin.linkGuardian`: idempotent guardian-student link via `create` +
 *   P2002 catch (atomic, no TOCTOU race).
 *
 * RBAC is enforced by `fullAdminProcedure`. Audit rows are written manually
 * (entity-specific) rather than via `auditedProcedure`'s generic Update row.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import { inviteUserInput, linkGuardianInput } from '@oasis/domain';
import { fullAdminProcedure, router } from '../trpc.js';
import {
  createDefaultClerkInvitationClient,
  type ClerkInvitationClient,
} from '../lib/clerk.js';

export interface AdminRouterDeps {
  clerk?: ClerkInvitationClient;
}

const searchParentsInput = z
  .object({
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(25).default(10),
  })
  .optional();

export function createAdminRouter(deps: AdminRouterDeps = {}) {
  let cachedClerk: ClerkInvitationClient | null = deps.clerk ?? null;
  const getClerk = (): ClerkInvitationClient => {
    if (cachedClerk) return cachedClerk;
    cachedClerk = createDefaultClerkInvitationClient();
    return cachedClerk;
  };

  return router({
    listActiveSubjects: fullAdminProcedure.query(async ({ ctx }) => {
      const subjects = await ctx.db.subject.findMany({
        where: { active: true },
        orderBy: [{ code: 'asc' }],
        select: { id: true, code: true, name: true },
      });

      return subjects;
    }),

    searchParents: fullAdminProcedure
      .input(searchParentsInput)
      .query(async ({ ctx, input }) => {
        const where: Prisma.UserWhereInput = { role: 'Parent', active: true };
        if (input?.search) where.emailBidx = ctx.db.$enc.blindIndex(input.search);

        const parents = await ctx.db.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input?.limit ?? 10,
          select: { id: true, fullNameEnc: true, emailEnc: true },
        });

        const rows = parents.map((parent) => {
          const fullName = ctx.db.$enc.decrypt(parent.fullNameEnc);
          const email = ctx.db.$enc.decrypt(parent.emailEnc);
          if (!fullName || !email) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'parent PII decrypt failed',
            });
          }
          return { id: parent.id, fullName, email };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'User',
            meta: { count: rows.length, source: 'admin.searchParents' },
          },
        });

        return rows;
      }),

    inviteUser: fullAdminProcedure
      .input(inviteUserInput)
      .mutation(async ({ ctx, input }) => {
        const inviteParams: Parameters<ClerkInvitationClient['createInvitation']>[0] = {
          emailAddress: input.email,
          publicMetadata: { role: input.role, tags: input.tags },
          ignoreExisting: true,
          notify: true,
        };
        if (input.redirectUrl !== undefined) inviteParams.redirectUrl = input.redirectUrl;
        const invitation = await getClerk().createInvitation(inviteParams);

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'Invitation',
            entityId: invitation.id,
            meta: { role: input.role, tags: input.tags, invitationStatus: invitation.status },
          },
        });

        return {
          invitationId: invitation.id,
          status: invitation.status,
          url: invitation.url,
        };
      }),

    linkGuardian: fullAdminProcedure
      .input(linkGuardianInput)
      .mutation(async ({ ctx, input }) => {
        const [parentUser, student] = await Promise.all([
          ctx.db.user.findUnique({ where: { id: input.userId } }),
          ctx.db.student.findUnique({ where: { id: input.studentId } }),
        ]);
        if (!parentUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
        }
        if (!student) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
        }
        if (parentUser.role !== 'Parent') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `cannot link guardian: user role is ${parentUser.role}, expected Parent`,
          });
        }

        try {
          const created = await ctx.db.guardian.create({
            data: { userId: input.userId, studentId: input.studentId },
          });
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'Guardian',
              entityId: created.id,
              meta: { parentUserId: input.userId, studentId: input.studentId },
            },
          });
          return { created: true, guardianId: created.id };
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            const existing = await ctx.db.guardian.findUnique({
              where: {
                userId_studentId: { userId: input.userId, studentId: input.studentId },
              },
            });
            if (existing) {
              return { created: false, guardianId: existing.id };
            }
          }
          throw err;
        }
      }),
  });
}

export const adminRouter = createAdminRouter();
