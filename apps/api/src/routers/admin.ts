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
import {
  PERMISSION_TAGS,
  createSubjectInput,
  createYearGroupBandInput,
  deactivateSubjectInput,
  deactivateYearGroupBandInput,
  inviteUserInput,
  linkGuardianInput,
  updatePacePolicyInput,
  updateSubjectInput,
  updateYearGroupBandInput,
} from '@oasis/domain';
import { fullAdminProcedure, router } from '../trpc.js';
import { createDefaultClerkInvitationClient, type ClerkInvitationClient } from '../lib/clerk.js';

export interface AdminRouterDeps {
  clerk?: ClerkInvitationClient;
}

const searchParentsInput = z
  .object({
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(25).default(10),
  })
  .optional();

const permissionTagSchema = z.enum(
  PERMISSION_TAGS as unknown as readonly [
    (typeof PERMISSION_TAGS)[number],
    ...(typeof PERMISSION_TAGS)[number][],
  ],
);

const updateUserTagsInput = z.object({
  userId: z.string().min(1),
  tags: z.array(permissionTagSchema).default([]),
});

const STUDENT_DRILLTHROUGH_TAG = 'student-drillthrough-viewer';

function assertCanAssignStudentDrillThroughTag(
  actorRole: string,
  currentTags: readonly string[],
  nextTags: readonly string[],
) {
  const currentHasTag = currentTags.includes(STUDENT_DRILLTHROUGH_TAG);
  const nextHasTag = nextTags.includes(STUDENT_DRILLTHROUGH_TAG);
  if (currentHasTag === nextHasTag || actorRole === 'Head') return;

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'student drill-through tag can only be changed by Head',
  });
}

async function assertUniqueBandName(
  ctx: {
    db: {
      yearGroupBand: {
        findFirst: (args: Prisma.YearGroupBandFindFirstArgs) => Promise<{ id: string } | null>;
      };
    };
  },
  name: string,
  exceptId?: string,
) {
  const existing = await ctx.db.yearGroupBand.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'year-group band name already exists' });
  }
}

export function createAdminRouter(deps: AdminRouterDeps = {}) {
  let cachedClerk: ClerkInvitationClient | null = deps.clerk ?? null;
  const getClerk = (): ClerkInvitationClient => {
    if (cachedClerk) return cachedClerk;
    cachedClerk = createDefaultClerkInvitationClient();
    return cachedClerk;
  };

  return router({
    listYearGroupBands: fullAdminProcedure.query(async ({ ctx }) => {
      return ctx.db.yearGroupBand.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          standardYears: true,
          active: true,
          sortOrder: true,
          colour: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),

    createYearGroupBand: fullAdminProcedure
      .input(createYearGroupBandInput)
      .mutation(async ({ ctx, input }) => {
        await assertUniqueBandName(ctx, input.name);

        try {
          const band = await ctx.db.yearGroupBand.create({
            data: input,
            select: {
              id: true,
              name: true,
              standardYears: true,
              active: true,
              sortOrder: true,
              colour: true,
            },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'YearGroupBand',
              entityId: band.id,
              meta: {
                name: band.name,
                standardYears: band.standardYears,
                sortOrder: band.sortOrder,
                colour: band.colour,
              },
            },
          });

          return band;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'year-group band name already exists',
            });
          }
          throw err;
        }
      }),

    updateYearGroupBand: fullAdminProcedure
      .input(updateYearGroupBandInput)
      .mutation(async ({ ctx, input }) => {
        if (input.name !== undefined) {
          await assertUniqueBandName(ctx, input.name, input.id);
        }

        const data: Prisma.YearGroupBandUpdateInput = {};
        if (input.name !== undefined) data.name = input.name;
        if (input.standardYears !== undefined) data.standardYears = input.standardYears;
        if (input.colour !== undefined) data.colour = input.colour;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        try {
          const band = await ctx.db.yearGroupBand.update({
            where: { id: input.id },
            data,
            select: {
              id: true,
              name: true,
              standardYears: true,
              active: true,
              sortOrder: true,
              colour: true,
            },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'YearGroupBand',
              entityId: band.id,
              meta: {
                fields: Object.keys(data).sort(),
                name: band.name,
                standardYears: band.standardYears,
                sortOrder: band.sortOrder,
                colour: band.colour,
              },
            },
          });

          return band;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'year-group band not found' });
          }
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'year-group band name already exists',
            });
          }
          throw err;
        }
      }),

    deactivateYearGroupBand: fullAdminProcedure
      .input(deactivateYearGroupBandInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const band = await ctx.db.yearGroupBand.update({
            where: { id: input.id },
            data: { active: false },
            select: { id: true, name: true, active: true },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'YearGroupBand',
              entityId: band.id,
              meta: {
                name: band.name,
                active: band.active,
                source: 'admin.deactivateYearGroupBand',
              },
            },
          });

          return band;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'year-group band not found' });
          }
          throw err;
        }
      }),

    listSubjects: fullAdminProcedure.query(async ({ ctx }) => {
      return ctx.db.subject.findMany({
        orderBy: [{ code: 'asc' }],
        select: { id: true, code: true, name: true, active: true },
      });
    }),

    createSubject: fullAdminProcedure
      .input(createSubjectInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const subject = await ctx.db.subject.create({
            data: { code: input.code, name: input.name },
            select: { id: true, code: true, name: true, active: true },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'Subject',
              entityId: subject.id,
              meta: { code: subject.code, name: subject.name },
            },
          });

          return subject;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `subject code "${input.code}" already exists`,
            });
          }
          throw err;
        }
      }),

    updateSubject: fullAdminProcedure
      .input(updateSubjectInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const subject = await ctx.db.subject.update({
            where: { id: input.id },
            data: { ...(input.name !== undefined ? { name: input.name } : {}) },
            select: { id: true, code: true, name: true, active: true },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'Subject',
              entityId: subject.id,
              meta: { name: subject.name, source: 'admin.updateSubject' },
            },
          });

          return subject;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'subject not found' });
          }
          throw err;
        }
      }),

    deactivateSubject: fullAdminProcedure
      .input(deactivateSubjectInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const subject = await ctx.db.subject.update({
            where: { id: input.id },
            data: { active: false },
            select: { id: true, code: true, name: true, active: true },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'Subject',
              entityId: subject.id,
              meta: { code: subject.code, active: subject.active, source: 'admin.deactivateSubject' },
            },
          });

          return subject;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'subject not found' });
          }
          throw err;
        }
      }),

    getPacePolicy: fullAdminProcedure.query(async ({ ctx }) => {
      const policy = await ctx.db.pacePolicy.findUnique({ where: { id: 'default' } });
      if (!policy) {
        return {
          id: 'default',
          dailyTestLimitEnabled: false,
          maxTestsPerStudentPerDay: 2,
          samePaceSameDayBlockEnabled: true,
          passThreshold: 80,
        };
      }
      return policy;
    }),

    updatePacePolicy: fullAdminProcedure
      .input(updatePacePolicyInput)
      .mutation(async ({ ctx, input }) => {
        const policy = await ctx.db.pacePolicy.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            dailyTestLimitEnabled: input.dailyTestLimitEnabled ?? false,
            maxTestsPerStudentPerDay: input.maxTestsPerStudentPerDay ?? 2,
            samePaceSameDayBlockEnabled: input.samePaceSameDayBlockEnabled ?? true,
            passThreshold: input.passThreshold ?? 80,
          },
          update: {
            ...(input.dailyTestLimitEnabled !== undefined
              ? { dailyTestLimitEnabled: input.dailyTestLimitEnabled }
              : {}),
            ...(input.maxTestsPerStudentPerDay !== undefined
              ? { maxTestsPerStudentPerDay: input.maxTestsPerStudentPerDay }
              : {}),
            ...(input.samePaceSameDayBlockEnabled !== undefined
              ? { samePaceSameDayBlockEnabled: input.samePaceSameDayBlockEnabled }
              : {}),
            ...(input.passThreshold !== undefined ? { passThreshold: input.passThreshold } : {}),
          },
          select: {
            id: true,
            dailyTestLimitEnabled: true,
            maxTestsPerStudentPerDay: true,
            samePaceSameDayBlockEnabled: true,
            passThreshold: true,
          },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'PacePolicy',
            entityId: policy.id,
            meta: { fields: Object.keys(input).sort(), ...input },
          },
        });

        return policy;
      }),

    listActiveSubjects: fullAdminProcedure.query(async ({ ctx }) => {
      const subjects = await ctx.db.subject.findMany({
        where: { active: true },
        orderBy: [{ code: 'asc' }],
        select: { id: true, code: true, name: true },
      });

      return subjects;
    }),

    listUsers: fullAdminProcedure.query(async ({ ctx }) => {
      const users = await ctx.db.user.findMany({
        where: { active: true },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        take: 100,
        select: {
          id: true,
          role: true,
          tags: true,
          fullNameEnc: true,
          emailEnc: true,
        },
      });

      const rows = users.map((user) => {
        const fullName = ctx.db.$enc.decrypt(user.fullNameEnc);
        const email = ctx.db.$enc.decrypt(user.emailEnc);
        if (!fullName || !email) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'user PII decrypt failed',
          });
        }
        return { id: user.id, role: user.role, tags: user.tags, fullName, email };
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { count: rows.length, source: 'admin.listUsers' },
        },
      });

      return rows;
    }),

    updateUserTags: fullAdminProcedure
      .input(updateUserTagsInput)
      .mutation(async ({ ctx, input }) => {
        const tags = [...new Set(input.tags)].sort();
        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, tags: true },
        });
        if (!existingUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
        }
        assertCanAssignStudentDrillThroughTag(ctx.user.role, existingUser.tags, tags);

        try {
          const user = await ctx.db.user.update({
            where: { id: input.userId },
            data: { tags },
            select: { id: true, tags: true },
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'User',
              entityId: user.id,
              meta: { tags: user.tags, source: 'admin.updateUserTags' },
            },
          });

          return { id: user.id, tags: user.tags };
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
          }
          throw err;
        }
      }),

    searchParents: fullAdminProcedure.input(searchParentsInput).query(async ({ ctx, input }) => {
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

    inviteUser: fullAdminProcedure.input(inviteUserInput).mutation(async ({ ctx, input }) => {
      assertCanAssignStudentDrillThroughTag(ctx.user.role, [], input.tags);
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

    linkGuardian: fullAdminProcedure.input(linkGuardianInput).mutation(async ({ ctx, input }) => {
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
