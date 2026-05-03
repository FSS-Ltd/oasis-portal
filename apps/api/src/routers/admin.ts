/**
 * Head-admin operations (PR-1.5).
 *
 * - `admin.inviteUser`: creates a Clerk invitation pre-stamped with role/tags
 *   in `publicMetadata`. The webhook (clerkWebhook.ts) reads those at signup.
 * - `admin.linkGuardian`: idempotent guardian-student link via `create` +
 *   P2002 catch (atomic, no TOCTOU race).
 *
 * Most RBAC is enforced by `fullAdminProcedure`; safe account-shell operations
 * use `userAccountAdminProcedure`. Audit rows are written manually
 * (entity-specific) rather than via `auditedProcedure`'s generic Update row.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  PERMISSION_TAGS,
  TECHNICAL_SUPPORT_MANAGEABLE_ROLES,
  canManageUserAccountRole,
  createSubjectInput,
  createYearGroupBandInput,
  deactivateSubjectInput,
  deactivateYearGroupBandInput,
  inviteUserInput,
  isFullAdmin,
  linkGuardianInput,
  type PermissionTag,
  type Role,
  type SessionUser,
  updatePacePolicyInput,
  updateSubjectInput,
  updateYearGroupBandInput,
} from '@oasis/domain';
import { fullAdminProcedure, headProcedure, router, userAccountAdminProcedure } from '../trpc.js';
import {
  createDefaultClerkInvitationClient,
  createDefaultClerkUserDeletionClient,
  type ClerkInvitationClient,
  type ClerkUserDeletionClient,
} from '../lib/clerk.js';
import { buildUserInviteEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';

export interface AdminRouterDeps {
  clerk?: ClerkInvitationClient;
  clerkUserDeletion?: ClerkUserDeletionClient;
  emailClient?: EmailClient;
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

const updateUserProfileInput = z.object({
  userId: z.string().min(1),
  fullName: z.string().trim().min(1, 'Enter the user name').optional(),
  phone: z.string().trim().max(50, 'Phone number is too long').nullable().optional(),
  address: z.string().trim().max(500, 'Address is too long').nullable().optional(),
});
type UpdateUserProfileInput = z.infer<typeof updateUserProfileInput>;

const updateUserAccountStatusInput = z.object({
  userId: z.string().min(1),
  active: z.boolean(),
});

const deleteUserAccountInput = z.object({
  userId: z.string().min(1),
  confirmation: z.literal('DELETE'),
});

const archiveStudentInput = z.object({
  studentId: z.string().min(1),
  confirmation: z.literal('ARCHIVE'),
});

const restoreArchivedStudentInput = z.object({
  studentId: z.string().min(1),
});

const adminUserProfileSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  tags: true,
  fullNameEnc: true,
  emailEnc: true,
  phoneEnc: true,
  addressEnc: true,
  active: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  guardianOf: {
    orderBy: { createdAt: 'desc' },
    select: {
      student: {
        select: {
          id: true,
          fullNameEnc: true,
          yearGroup: true,
          active: true,
        },
      },
    },
  },
});

type AdminUserProfileRow = Prisma.UserGetPayload<{ select: typeof adminUserProfileSelect }>;

const STUDENT_DRILLTHROUGH_TAG = 'student-drillthrough-viewer';

const userAccountSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  fullNameEnc: true,
  emailEnc: true,
  phoneEnc: true,
  addressEnc: true,
  active: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

type UserAccountRow = Prisma.UserGetPayload<{ select: typeof userAccountSelect }>;

const userInvitationSelect = Prisma.validator<Prisma.UserInvitationSelect>()({
  id: true,
  clerkInvitationId: true,
  role: true,
  tags: true,
  emailEnc: true,
  status: true,
  emailStatus: true,
  createdAt: true,
  updatedAt: true,
});

type UserInvitationRow = Prisma.UserInvitationGetPayload<{
  select: typeof userInvitationSelect;
}>;

function accountScopeWhereFor(actor: SessionUser): Prisma.UserWhereInput {
  if (isFullAdmin(actor)) return { deletedAt: null };
  return { deletedAt: null, role: { in: [...TECHNICAL_SUPPORT_MANAGEABLE_ROLES] } };
}

function invitationScopeWhereFor(actor: SessionUser): Prisma.UserInvitationWhereInput {
  if (isFullAdmin(actor)) return {};
  return { role: { in: [...TECHNICAL_SUPPORT_MANAGEABLE_ROLES] } };
}

function assertUserIsManageable<T extends { id: string; deletedAt?: Date | null }>(
  existingUser: T | null,
): asserts existingUser is T {
  if (!existingUser || existingUser.deletedAt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
  }
}

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

function assertCanInviteUser(actor: SessionUser, role: Role, tags: readonly string[]) {
  if (isFullAdmin(actor)) {
    assertCanAssignStudentDrillThroughTag(actor.role, [], tags);
    return;
  }

  if (!canManageUserAccountRole(actor, role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Technical Support cannot invite ${role} accounts`,
    });
  }

  if (tags.length > 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Technical Support cannot assign permission tags',
    });
  }
}

function assertCanManageTargetRole(actor: SessionUser, role: Role) {
  if (canManageUserAccountRole(actor, role)) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `Technical Support cannot manage ${role} accounts`,
  });
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

function normaliseNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tombstoneUserUpdateData(
  ctx: {
    db: {
      $enc: {
        blindIndex(value: string): string;
        encrypt(value: string): string;
        encrypt(value: string | null | undefined): string | null;
      };
    };
  },
  userId: string,
  deletedAt: Date,
): Prisma.UserUpdateInput {
  const suffix = `${userId}-${String(deletedAt.getTime())}`;
  const tombstoneEmail = `deleted-${suffix}@deleted.oasis.local`;
  return {
    active: false,
    deletedAt,
    authDeletedAt: deletedAt,
    tags: [],
    fullNameEnc: ctx.db.$enc.encrypt(`Deleted user ${userId}`),
    emailEnc: ctx.db.$enc.encrypt(tombstoneEmail),
    emailBidx: ctx.db.$enc.blindIndex(tombstoneEmail),
    phoneEnc: null,
    addressEnc: null,
  };
}

function userProfileUpdateData(
  ctx: {
    db: {
      $enc: {
        encrypt(value: string): string;
        encrypt(value: string | null | undefined): string | null;
      };
    };
  },
  input: UpdateUserProfileInput,
): { data: Prisma.UserUpdateInput; fields: string[] } {
  const data: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) data.fullNameEnc = ctx.db.$enc.encrypt(input.fullName);
  if (input.phone !== undefined) {
    data.phoneEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.phone));
  }
  if (input.address !== undefined) {
    data.addressEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.address));
  }

  return { data, fields: Object.keys(data).sort() };
}

function mapAdminUserProfile(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  user: AdminUserProfileRow,
) {
  return {
    id: user.id,
    role: user.role,
    tags: user.tags,
    fullName: decryptRequired(ctx.db.$enc.decrypt, user.fullNameEnc, 'user PII'),
    email: decryptRequired(ctx.db.$enc.decrypt, user.emailEnc, 'user PII'),
    phone: ctx.db.$enc.decrypt(user.phoneEnc),
    address: ctx.db.$enc.decrypt(user.addressEnc),
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    children: user.guardianOf.map((guardian) => ({
      id: guardian.student.id,
      fullName: decryptRequired(ctx.db.$enc.decrypt, guardian.student.fullNameEnc, 'student PII'),
      yearGroup: guardian.student.yearGroup,
      active: guardian.student.active,
    })),
  };
}

function mapUserAccount(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  user: UserAccountRow,
) {
  return {
    id: user.id,
    role: user.role,
    fullName: decryptRequired(ctx.db.$enc.decrypt, user.fullNameEnc, 'user PII'),
    email: decryptRequired(ctx.db.$enc.decrypt, user.emailEnc, 'user PII'),
    phone: ctx.db.$enc.decrypt(user.phoneEnc),
    address: ctx.db.$enc.decrypt(user.addressEnc),
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapUserInvitation(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  invitation: UserInvitationRow,
) {
  return {
    id: invitation.id,
    invitationId: invitation.clerkInvitationId,
    role: invitation.role,
    tags: invitation.tags as PermissionTag[],
    email: decryptRequired(ctx.db.$enc.decrypt, invitation.emailEnc, 'invitation PII'),
    status: invitation.status,
    emailStatus: invitation.emailStatus,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
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
  let cachedClerkUserDeletion: ClerkUserDeletionClient | null = deps.clerkUserDeletion ?? null;
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getClerk = (): ClerkInvitationClient => {
    if (cachedClerk) return cachedClerk;
    cachedClerk = createDefaultClerkInvitationClient();
    return cachedClerk;
  };
  const getClerkUserDeletion = (): ClerkUserDeletionClient => {
    if (cachedClerkUserDeletion) return cachedClerkUserDeletion;
    cachedClerkUserDeletion = createDefaultClerkUserDeletionClient();
    return cachedClerkUserDeletion;
  };
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
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

    createSubject: fullAdminProcedure.input(createSubjectInput).mutation(async ({ ctx, input }) => {
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

    updateSubject: fullAdminProcedure.input(updateSubjectInput).mutation(async ({ ctx, input }) => {
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
              meta: {
                code: subject.code,
                active: subject.active,
                source: 'admin.deactivateSubject',
              },
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

    listUserAccounts: userAccountAdminProcedure.query(async ({ ctx }) => {
      const users = await ctx.db.user.findMany({
        where: accountScopeWhereFor(ctx.user),
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        take: 100,
        select: userAccountSelect,
      });

      const rows = users.map((user) => mapUserAccount(ctx, user));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { count: rows.length, source: 'admin.listUserAccounts' },
        },
      });

      return rows;
    }),

    listUserInvitations: userAccountAdminProcedure.query(async ({ ctx }) => {
      const invitations = await ctx.db.userInvitation.findMany({
        where: { ...invitationScopeWhereFor(ctx.user), status: 'Pending' },
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
        select: userInvitationSelect,
      });

      const rows = invitations.map((invitation) => mapUserInvitation(ctx, invitation));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'UserInvitation',
          meta: { count: rows.length, source: 'admin.listUserInvitations' },
        },
      });

      return rows;
    }),

    updateUserAccountProfile: userAccountAdminProcedure
      .input(updateUserProfileInput)
      .mutation(async ({ ctx, input }) => {
        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, deletedAt: true },
        });
        assertUserIsManageable(existingUser);
        assertCanManageTargetRole(ctx.user, existingUser.role);

        const { data, fields } = userProfileUpdateData(ctx, input);
        if (fields.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'no user profile fields provided' });
        }

        try {
          const user = await ctx.db.user.update({
            where: { id: input.userId },
            data,
            select: userAccountSelect,
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'User',
              entityId: user.id,
              meta: { fields, source: 'admin.updateUserAccountProfile' },
            },
          });

          return mapUserAccount(ctx, user);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
          }
          throw err;
        }
      }),

    updateUserAccountStatus: userAccountAdminProcedure
      .input(updateUserAccountStatusInput)
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id && !input.active) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'cannot deactivate your own account',
          });
        }

        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, deletedAt: true },
        });
        assertUserIsManageable(existingUser);
        assertCanManageTargetRole(ctx.user, existingUser.role);

        try {
          const user = await ctx.db.user.update({
            where: { id: input.userId },
            data: { active: input.active },
            select: userAccountSelect,
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'User',
              entityId: user.id,
              meta: { active: user.active, source: 'admin.updateUserAccountStatus' },
            },
          });

          return mapUserAccount(ctx, user);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
          }
          throw err;
        }
      }),

    deleteUserAccount: headProcedure
      .input(deleteUserAccountInput)
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'cannot delete your own account',
          });
        }

        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            clerkId: true,
            role: true,
            deletedAt: true,
            studentProfile: { select: { id: true } },
          },
        });
        assertUserIsManageable(existingUser);
        if (existingUser.studentProfile) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'student login accounts must be archived from the student record',
          });
        }

        await getClerkUserDeletion().deleteUser(existingUser.clerkId);

        const deletedAt = new Date();
        const data = tombstoneUserUpdateData(ctx, existingUser.id, deletedAt);
        const deleted = await ctx.db.$transaction(async (tx) => {
          const user = await tx.user.update({
            where: { id: existingUser.id },
            data,
            select: { id: true, deletedAt: true, authDeletedAt: true },
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Delete',
              entity: 'User',
              entityId: existingUser.id,
              meta: {
                role: existingUser.role,
                source: 'admin.deleteUserAccount',
                authDeleted: true,
                piiScrubbed: true,
              },
            },
          });
          return user;
        });

        return {
          id: deleted.id,
          deletedAt: deleted.deletedAt,
          authDeletedAt: deleted.authDeletedAt,
        };
      }),

    archiveStudent: headProcedure.input(archiveStudentInput).mutation(async ({ ctx, input }) => {
      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: {
          id: true,
          archivedAt: true,
          user: {
            select: {
              id: true,
              clerkId: true,
              role: true,
              deletedAt: true,
            },
          },
        },
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (student.archivedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is already archived' });
      }

      const linkedUser = student.user && !student.user.deletedAt ? student.user : null;
      if (linkedUser) {
        await getClerkUserDeletion().deleteUser(linkedUser.clerkId);
      }

      const archivedAt = new Date();
      const userTombstoneData = linkedUser
        ? tombstoneUserUpdateData(ctx, linkedUser.id, archivedAt)
        : null;
      const studentUpdateData: Prisma.StudentUpdateInput = {
        active: false,
        archivedAt,
      };
      if (student.user) studentUpdateData.user = { disconnect: true };

      const archived = await ctx.db.$transaction(async (tx) => {
        if (linkedUser && userTombstoneData) {
          await tx.user.update({
            where: { id: linkedUser.id },
            data: userTombstoneData,
            select: { id: true },
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Delete',
              entity: 'User',
              entityId: linkedUser.id,
              meta: {
                role: linkedUser.role,
                studentId: student.id,
                source: 'admin.archiveStudent',
                authDeleted: true,
                piiScrubbed: true,
              },
            },
          });
        }

        const row = await tx.student.update({
          where: { id: student.id },
          data: studentUpdateData,
          select: { id: true, active: true, archivedAt: true, userId: true },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'Student',
            entityId: student.id,
            meta: {
              archived: true,
              previousUserId: student.user?.id ?? null,
              authDeleted: Boolean(linkedUser),
              source: 'admin.archiveStudent',
            },
          },
        });
        return row;
      });

      return {
        id: archived.id,
        active: archived.active,
        archivedAt: archived.archivedAt,
        userId: archived.userId,
        deletedUserId: linkedUser?.id ?? null,
      };
    }),

    restoreArchivedStudent: headProcedure
      .input(restoreArchivedStudentInput)
      .mutation(async ({ ctx, input }) => {
        const existingStudent = await ctx.db.student.findUnique({
          where: { id: input.studentId },
          select: { id: true, archivedAt: true },
        });
        if (!existingStudent) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
        }
        if (!existingStudent.archivedAt) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not archived' });
        }

        const restored = await ctx.db.student.update({
          where: { id: input.studentId },
          data: { active: true, archivedAt: null },
          select: { id: true, active: true, archivedAt: true, userId: true },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'Student',
            entityId: restored.id,
            meta: {
              archived: false,
              userId: restored.userId,
              source: 'admin.restoreArchivedStudent',
            },
          },
        });
        return restored;
      }),

    listUsers: fullAdminProcedure.query(async ({ ctx }) => {
      const users = await ctx.db.user.findMany({
        where: { active: true, deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        take: 100,
        select: adminUserProfileSelect,
      });

      const rows = users.map((user) => mapAdminUserProfile(ctx, user));
      const linkedChildCount = rows.reduce((count, row) => count + row.children.length, 0);

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { count: rows.length, linkedChildCount, source: 'admin.listUsers' },
        },
      });

      return rows;
    }),

    updateUserProfile: fullAdminProcedure
      .input(updateUserProfileInput)
      .mutation(async ({ ctx, input }) => {
        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, deletedAt: true },
        });
        assertUserIsManageable(existingUser);

        const { data, fields } = userProfileUpdateData(ctx, input);
        if (fields.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'no user profile fields provided' });
        }

        try {
          const user = await ctx.db.user.update({
            where: { id: input.userId },
            data,
            select: adminUserProfileSelect,
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'User',
              entityId: user.id,
              meta: { fields, source: 'admin.updateUserProfile' },
            },
          });

          return mapAdminUserProfile(ctx, user);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
          }
          throw err;
        }
      }),

    updateUserTags: fullAdminProcedure
      .input(updateUserTagsInput)
      .mutation(async ({ ctx, input }) => {
        const tags = [...new Set(input.tags)].sort();
        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, tags: true, deletedAt: true },
        });
        assertUserIsManageable(existingUser);
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
      const where: Prisma.UserWhereInput = { role: 'Parent', active: true, deletedAt: null };
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

    inviteUser: userAccountAdminProcedure
      .input(inviteUserInput)
      .mutation(async ({ ctx, input }) => {
        assertCanInviteUser(ctx.user, input.role, input.tags);
        const emailBidx = ctx.db.$enc.blindIndex(input.email);

        const [existingUser, existingPendingInvite] = await Promise.all([
          ctx.db.user.findUnique({
            where: { emailBidx },
            select: { id: true, deletedAt: true },
          }),
          ctx.db.userInvitation.findFirst({
            where: { emailBidx, status: 'Pending' },
            select: { id: true },
          }),
        ]);

        if (existingUser && !existingUser.deletedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'a user account already exists for this email',
          });
        }

        if (existingPendingInvite) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'a pending invitation already exists for this email',
          });
        }

        const inviteParams: Parameters<ClerkInvitationClient['createInvitation']>[0] = {
          emailAddress: input.email,
          publicMetadata: { role: input.role, tags: input.tags },
          ignoreExisting: true,
          notify: false,
        };
        if (input.redirectUrl !== undefined) inviteParams.redirectUrl = input.redirectUrl;
        const invitation = await getClerk().createInvitation(inviteParams);
        if (!invitation.url) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'clerk invitation link missing',
          });
        }

        let storedInvitation: UserInvitationRow;
        try {
          storedInvitation = await ctx.db.userInvitation.create({
            data: {
              clerkInvitationId: invitation.id,
              role: input.role,
              tags: [...input.tags],
              emailEnc: ctx.db.$enc.encrypt(input.email),
              emailBidx,
              status: 'Pending',
              emailStatus: 'NotSent',
              invitedById: ctx.user.id,
            },
            select: userInvitationSelect,
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'a pending invitation already exists for this email',
            });
          }
          throw err;
        }

        const email = buildUserInviteEmail({
          to: input.email,
          role: input.role,
          inviteUrl: invitation.url,
        });
        let emailResult: Awaited<ReturnType<EmailClient['send']>>;
        try {
          emailResult = await getEmailClient().send(email);
        } catch (err) {
          await ctx.db.userInvitation.update({
            where: { id: storedInvitation.id },
            data: { emailStatus: 'Failed' },
            select: { id: true },
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'invitation email send failed',
            cause: err instanceof Error ? err : undefined,
          });
        }

        await ctx.db.userInvitation.update({
          where: { id: storedInvitation.id },
          data: {
            emailStatus: 'Sent',
            emailMessageId: emailResult.id,
          },
          select: { id: true },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'Invitation',
            entityId: invitation.id,
            meta: {
              role: input.role,
              tags: input.tags,
              invitationStatus: invitation.status,
              emailStatus: 'Sent',
            },
          },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'Email',
            entityId: emailResult.id,
            meta: {
              invitationId: invitation.id,
              subject: email.subject,
              source: 'admin.inviteUser',
            },
          },
        });

        return {
          invitationId: invitation.id,
          status: invitation.status,
          emailStatus: 'Sent' as const,
        };
      }),

    linkGuardian: fullAdminProcedure.input(linkGuardianInput).mutation(async ({ ctx, input }) => {
      const [parentUser, student] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, deletedAt: true },
        }),
        ctx.db.student.findUnique({ where: { id: input.studentId } }),
      ]);
      assertUserIsManageable(parentUser);
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
