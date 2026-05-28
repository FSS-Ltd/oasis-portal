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
  CHILD_REGISTRATION_PROMPT_ROLES,
  PERMISSION_TAGS,
  TECHNICAL_SUPPORT_MANAGEABLE_ROLES,
  canAnswerChildRegistrationPrompt,
  canManageUserAccountRole,
  canManageUserAccounts,
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
  updateUserRoleInput,
  updatePacePolicyInput,
  updateSubjectInput,
  updateYearGroupBandInput,
} from '@oasis/domain';
import { authedProcedure, fullAdminProcedure, router, userAccountAdminProcedure } from '../trpc.js';
import {
  createDefaultClerkInvitationClient,
  createDefaultClerkUserEmailClient,
  type ClerkInvitationClient,
  type ClerkUserEmailClient,
} from '../lib/clerk.js';
import { buildUserInviteEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';
import { logOperationalEvent } from '../lib/observability.js';
import type { AppContext } from '../context.js';

export interface AdminRouterDeps {
  appUrl?: string;
  clerk?: ClerkInvitationClient;
  emailClient?: EmailClient;
  userEmailClient?: ClerkUserEmailClient;
}

const POST_SIGN_IN_PATH = '/post-sign-in';
const GUARDIAN_ACCOUNT_ROLES = [
  'Parent',
  ...CHILD_REGISTRATION_PROMPT_ROLES,
] as const satisfies readonly Role[];
const HEAD_ONLY_PERMISSION_TAGS = [
  'student-drillthrough-viewer',
  'supervisor-all-students',
  'calendar-manager',
  'parent-message-responder',
] as const satisfies readonly PermissionTag[];

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
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid date')
    .nullable()
    .optional(),
  phone: z.string().trim().max(50, 'Phone number is too long').nullable().optional(),
  address: z.string().trim().max(500, 'Address is too long').nullable().optional(),
});
type UpdateUserProfileInput = z.infer<typeof updateUserProfileInput>;

const updateUserAccountProfileInput = updateUserProfileInput.omit({ dob: true, email: true });

const updateUserAccountStatusInput = z.object({
  userId: z.string().min(1),
  active: z.boolean(),
});

const resendUserInvitationInput = z.object({
  id: z.string().min(1),
});

const adminUserProfileSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  tags: true,
  fullNameEnc: true,
  emailEnc: true,
  dobEnc: true,
  phoneEnc: true,
  addressEnc: true,
  active: true,
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

const userAccountSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  fullNameEnc: true,
  emailEnc: true,
  phoneEnc: true,
  addressEnc: true,
  active: true,
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
  if (isFullAdmin(actor)) return {};
  return { role: { in: [...TECHNICAL_SUPPORT_MANAGEABLE_ROLES] } };
}

function invitationScopeWhereFor(actor: SessionUser): Prisma.UserInvitationWhereInput {
  if (isFullAdmin(actor)) return {};
  return { role: { in: [...TECHNICAL_SUPPORT_MANAGEABLE_ROLES] } };
}

function assertCanChangeHeadOnlyTags(
  actorRole: string,
  currentTags: readonly string[],
  nextTags: readonly string[],
) {
  const changedTag = HEAD_ONLY_PERMISSION_TAGS.find(
    (tag) => currentTags.includes(tag) !== nextTags.includes(tag),
  );
  if (!changedTag || actorRole === 'Head') return;

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `${changedTag} tag can only be changed by Head`,
  });
}

function assertCanInviteUser(actor: SessionUser, role: Role, tags: readonly string[]) {
  if (isFullAdmin(actor)) {
    assertCanChangeHeadOnlyTags(actor.role, [], tags);
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

function assertCanUseInvitationWorkflow(actor: SessionUser) {
  if (isFullAdmin(actor) || canManageUserAccounts(actor)) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'requires full admin or Technical Support',
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

function sanitizeEmailDeliveryError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
    };
  }

  return {
    name: 'UnknownEmailDeliveryError',
    message: typeof err === 'string' ? err : 'non-error thrown during email delivery',
  };
}

function normaliseNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseNullableDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter a valid date' });
  }
  if (date > new Date()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'date of birth cannot be in the future' });
  }
  return value;
}

function normaliseTags(tags: readonly string[]): string[] {
  return [...new Set(tags)].sort();
}

function hasSameTags(left: readonly string[], right: readonly string[]): boolean {
  const leftTags = normaliseTags(left);
  const rightTags = normaliseTags(right);
  return (
    leftTags.length === rightTags.length && leftTags.every((tag, index) => tag === rightTags[index])
  );
}

function assertPendingInvitationMatchesInput(
  invitation: UserInvitationRow,
  input: { role: Role; tags: readonly PermissionTag[] },
) {
  if (invitation.role === input.role && hasSameTags(invitation.tags, input.tags)) return;

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'a pending invitation already exists for this email with a different role or tags',
  });
}

function assertInvitationCanUseClerkStatus(invitation: ClerkInvitationClientResult) {
  if (invitation.status === 'accepted') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'this invitation has already been accepted and cannot be resent',
    });
  }
}

type ClerkInvitationClientResult = Awaited<ReturnType<ClerkInvitationClient['createInvitation']>>;

function buildPostSignInRedirectUrl(appUrl: string | undefined): string {
  const trimmed = appUrl?.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'APP_URL is required to create invitation redirect URL',
    });
  }

  try {
    return new URL(POST_SIGN_IN_PATH, trimmed).toString();
  } catch {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'APP_URL must be a valid absolute URL to create invitation redirect URL',
    });
  }
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
  if (input.dob !== undefined) data.dobEnc = ctx.db.$enc.encrypt(normaliseNullableDate(input.dob));
  if (input.phone !== undefined) {
    data.phoneEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.phone));
  }
  if (input.address !== undefined) {
    data.addressEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.address));
  }

  return { data, fields: Object.keys(data).sort() };
}

async function userEmailUpdateData(
  ctx: {
    db: {
      $enc: {
        blindIndex(value: string): string;
        decrypt(value: string | null | undefined): string | null;
        encrypt(value: string): string;
      };
      user: {
        findUnique: (args: Prisma.UserFindUniqueArgs) => Promise<{
          id: string;
          clerkId: string;
          emailEnc: string;
        } | null>;
      };
    };
  },
  input: { targetUserId: string; email: string | undefined },
  userEmailClient: ClerkUserEmailClient,
): Promise<Pick<Prisma.UserUpdateInput, 'emailEnc' | 'emailBidx'>> {
  if (input.email === undefined) return {};

  const targetUser = await ctx.db.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, clerkId: true, emailEnc: true },
  });
  if (!targetUser) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
  }

  const currentEmail = decryptRequired(
    (value) => ctx.db.$enc.decrypt(value),
    targetUser.emailEnc,
    'user PII',
  );
  if (currentEmail.trim().toLowerCase() === input.email) return {};

  const emailBidx = ctx.db.$enc.blindIndex(input.email);
  const existingEmailUser = await ctx.db.user.findUnique({
    where: { emailBidx },
    select: { id: true },
  });
  if (existingEmailUser && existingEmailUser.id !== input.targetUserId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'email address is already in use' });
  }

  await userEmailClient.updatePrimaryEmail({
    clerkUserId: targetUser.clerkId,
    email: input.email,
  });

  return {
    emailEnc: ctx.db.$enc.encrypt(input.email),
    emailBidx,
  };
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
    dob: ctx.db.$enc.decrypt(user.dobEnc),
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
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  let cachedUserEmailClient: ClerkUserEmailClient | null = deps.userEmailClient ?? null;
  const getClerk = (): ClerkInvitationClient => {
    if (cachedClerk) return cachedClerk;
    cachedClerk = createDefaultClerkInvitationClient();
    return cachedClerk;
  };
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };
  const getUserEmailClient = (): ClerkUserEmailClient => {
    if (cachedUserEmailClient) return cachedUserEmailClient;
    cachedUserEmailClient = createDefaultClerkUserEmailClient();
    return cachedUserEmailClient;
  };
  const getInvitationRedirectUrl = (): string =>
    buildPostSignInRedirectUrl(deps.appUrl ?? process.env.APP_URL);

  const createClerkInvitation = async (input: {
    email: string;
    role: Role;
    tags: readonly PermissionTag[];
  }): Promise<ClerkInvitationClientResult> => {
    const inviteParams: Parameters<ClerkInvitationClient['createInvitation']>[0] = {
      emailAddress: input.email,
      publicMetadata: { role: input.role, tags: [...input.tags] },
      redirectUrl: getInvitationRedirectUrl(),
      ignoreExisting: true,
      notify: false,
    };
    const invitation = await getClerk().createInvitation(inviteParams);
    if (!invitation.url) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'clerk invitation link missing',
      });
    }
    return invitation;
  };

  const resolveClerkInvitationForDelivery = async (input: {
    email: string;
    existingInvitation?: ClerkInvitationClientResult | undefined;
    storedInvitation: UserInvitationRow;
  }): Promise<ClerkInvitationClientResult> => {
    const current =
      input.existingInvitation ??
      (await getClerk().findInvitation(input.storedInvitation.clerkInvitationId));

    if (current) {
      assertInvitationCanUseClerkStatus(current);
      if (input.existingInvitation && current.status === 'pending' && current.url) return current;
      if (current.status === 'pending') {
        await getClerk().revokeInvitation(current.id);
      }
    }

    const replacement = await createClerkInvitation({
      email: input.email,
      role: input.storedInvitation.role,
      tags: input.storedInvitation.tags as PermissionTag[],
    });

    return replacement;
  };

  const deliverInvitationEmail = async (input: {
    auditAction: 'Create' | 'Update';
    ctx: AppContext & { user: SessionUser };
    email: string;
    existingInvitation?: ClerkInvitationClientResult | undefined;
    source: 'admin.inviteUser' | 'admin.resendUserInvitation';
    storedInvitation: UserInvitationRow;
  }) => {
    const invitation = await resolveClerkInvitationForDelivery({
      email: input.email,
      existingInvitation: input.existingInvitation,
      storedInvitation: input.storedInvitation,
    });
    if (!invitation.url) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'clerk invitation link missing',
      });
    }

    await input.ctx.db.userInvitation.update({
      where: { id: input.storedInvitation.id },
      data: {
        emailStatus: 'NotSent',
        emailMessageId: null,
        ...(invitation.id === input.storedInvitation.clerkInvitationId
          ? {}
          : { clerkInvitationId: invitation.id }),
      },
      select: { id: true },
    });

    const email = buildUserInviteEmail({
      to: input.email,
      role: input.storedInvitation.role,
      inviteUrl: invitation.url,
    });
    let emailResult: Awaited<ReturnType<EmailClient['send']>>;
    try {
      emailResult = await getEmailClient().send(email);
    } catch (err) {
      await input.ctx.db.userInvitation.update({
        where: { id: input.storedInvitation.id },
        data: { emailStatus: 'Failed', emailMessageId: null },
        select: { id: true },
      });
      await input.ctx.db.auditLog.create({
        data: {
          userId: input.ctx.user.id,
          action: 'Update',
          entity: 'Invitation',
          entityId: invitation.id,
          meta: {
            role: input.storedInvitation.role,
            tags: input.storedInvitation.tags,
            invitationStatus: invitation.status,
            emailStatus: 'Failed',
            source: input.source,
          },
        },
      });
      logOperationalEvent({
        event: 'email.delivery_failed',
        level: 'error',
        message: 'Invitation email delivery failed',
        meta: {
          error: sanitizeEmailDeliveryError(err),
          invitationId: invitation.id,
          role: input.storedInvitation.role,
          source: input.source,
          status: invitation.status,
        },
        requestId: input.ctx.requestId,
        userId: input.ctx.user.id,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'invitation email send failed',
        cause: err instanceof Error ? err : undefined,
      });
    }

    await input.ctx.db.userInvitation.update({
      where: { id: input.storedInvitation.id },
      data: {
        emailStatus: 'Sent',
        emailMessageId: emailResult.id,
      },
      select: { id: true },
    });

    await input.ctx.db.auditLog.create({
      data: {
        userId: input.ctx.user.id,
        action: input.auditAction,
        entity: 'Invitation',
        entityId: invitation.id,
        meta: {
          role: input.storedInvitation.role,
          tags: input.storedInvitation.tags,
          invitationStatus: invitation.status,
          emailStatus: 'Sent',
          source: input.source,
        },
      },
    });
    await input.ctx.db.auditLog.create({
      data: {
        userId: input.ctx.user.id,
        action: 'Create',
        entity: 'Email',
        entityId: emailResult.id,
        meta: {
          invitationId: invitation.id,
          subject: email.subject,
          source: input.source,
        },
      },
    });

    return {
      invitationId: invitation.id,
      status: invitation.status,
      emailStatus: 'Sent' as const,
    };
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

    listUserInvitations: authedProcedure.query(async ({ ctx }) => {
      assertCanUseInvitationWorkflow(ctx.user);
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
      .input(updateUserAccountProfileInput)
      .mutation(async ({ ctx, input }) => {
        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true },
        });
        if (!existingUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
        }
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
          select: { id: true, role: true },
        });
        if (!existingUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
        }
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

    listUsers: fullAdminProcedure.query(async ({ ctx }) => {
      const users = await ctx.db.user.findMany({
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
        const { data } = userProfileUpdateData(ctx, input);
        if (input.email !== undefined) {
          if (!isFullAdmin(ctx.user)) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'only full admins can change account email addresses',
            });
          }
          Object.assign(
            data,
            await userEmailUpdateData(
              ctx,
              { targetUserId: input.userId, email: input.email },
              getUserEmailClient(),
            ),
          );
        }

        const fields = Object.keys(data).sort();
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

    updateUserRole: fullAdminProcedure
      .input(updateUserRoleInput)
      .mutation(async ({ ctx, input }) => {
        if (!isFullAdmin(ctx.user)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'only full admins can change user roles',
          });
        }
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'cannot change your own role',
          });
        }

        const existingUser = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, tags: true },
        });
        if (!existingUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
        }

        const nextTags = input.role === 'Parent' ? [] : existingUser.tags;
        const clearedTags = input.role === 'Parent' ? existingUser.tags : [];

        try {
          const user = await ctx.db.user.update({
            where: { id: input.userId },
            data: { role: input.role, tags: nextTags },
            select: adminUserProfileSelect,
          });

          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'User',
              entityId: user.id,
              meta: {
                previousRole: existingUser.role,
                nextRole: user.role,
                clearedTags,
                source: 'admin.updateUserRole',
              },
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
          select: { id: true, tags: true },
        });
        if (!existingUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
        }
        assertCanChangeHeadOnlyTags(ctx.user.role, existingUser.tags, tags);

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

    searchGuardianAccounts: fullAdminProcedure
      .input(searchParentsInput)
      .query(async ({ ctx, input }) => {
        const where: Prisma.UserWhereInput = {
          active: true,
          role: { in: [...GUARDIAN_ACCOUNT_ROLES] },
        };
        if (input?.search) where.emailBidx = ctx.db.$enc.blindIndex(input.search);

        const users = await ctx.db.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input?.limit ?? 10,
          select: { id: true, role: true, fullNameEnc: true, emailEnc: true },
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
          return { id: user.id, role: user.role, fullName, email };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'User',
            meta: { count: rows.length, source: 'admin.searchGuardianAccounts' },
          },
        });

        return rows;
      }),

    inviteUser: authedProcedure.input(inviteUserInput).mutation(async ({ ctx, input }) => {
      assertCanUseInvitationWorkflow(ctx.user);
      assertCanInviteUser(ctx.user, input.role, input.tags);
      const emailBidx = ctx.db.$enc.blindIndex(input.email);

      const [existingUser, existingPendingInvite] = await Promise.all([
        ctx.db.user.findUnique({
          where: { emailBidx },
          select: { id: true },
        }),
        ctx.db.userInvitation.findFirst({
          where: { emailBidx, status: 'Pending' },
          select: userInvitationSelect,
        }),
      ]);

      if (existingUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'a user account already exists for this email',
        });
      }

      if (existingPendingInvite) {
        assertPendingInvitationMatchesInput(existingPendingInvite, input);
        if (existingPendingInvite.emailStatus === 'Sent') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'a pending invitation already exists for this email; use resend on the pending invite if needed',
          });
        }

        return deliverInvitationEmail({
          auditAction: 'Update',
          ctx,
          email: input.email,
          source: 'admin.inviteUser',
          storedInvitation: existingPendingInvite,
        });
      }

      const invitation = await createClerkInvitation({
        email: input.email,
        role: input.role,
        tags: input.tags,
      });

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
            message:
              'a pending invitation already exists for this email; refresh pending invites and resend if needed',
          });
        }
        throw err;
      }

      return deliverInvitationEmail({
        auditAction: 'Create',
        ctx,
        email: input.email,
        existingInvitation: invitation,
        source: 'admin.inviteUser',
        storedInvitation,
      });
    }),

    resendUserInvitation: authedProcedure
      .input(resendUserInvitationInput)
      .mutation(async ({ ctx, input }) => {
        assertCanUseInvitationWorkflow(ctx.user);
        const storedInvitation = await ctx.db.userInvitation.findFirst({
          where: { ...invitationScopeWhereFor(ctx.user), id: input.id, status: 'Pending' },
          select: userInvitationSelect,
        });
        if (!storedInvitation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'pending invitation not found' });
        }

        const email = decryptRequired(
          ctx.db.$enc.decrypt,
          storedInvitation.emailEnc,
          'invitation PII',
        );

        return deliverInvitationEmail({
          auditAction: 'Update',
          ctx,
          email,
          source: 'admin.resendUserInvitation',
          storedInvitation,
        });
      }),

    linkGuardian: fullAdminProcedure.input(linkGuardianInput).mutation(async ({ ctx, input }) => {
      const [targetUser, student] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, active: true },
        }),
        ctx.db.student.findUnique({ where: { id: input.studentId } }),
      ]);
      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
      }
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!targetUser.active) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'cannot link guardian: user account is inactive',
        });
      }
      if (targetUser.role !== 'Parent' && !canAnswerChildRegistrationPrompt(targetUser)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `cannot link guardian: user role is ${targetUser.role}`,
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
            meta: {
              guardianUserId: input.userId,
              studentId: input.studentId,
              targetRole: targetUser.role,
            },
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
