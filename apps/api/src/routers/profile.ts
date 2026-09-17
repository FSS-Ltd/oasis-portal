import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  canUseLinkedChildGuardianAccess,
  PARENT_EMAIL_NOTIFICATION_CATEGORIES,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  createDefaultClerkInvitationClient,
  createDefaultClerkUserEmailClient,
  type ClerkInvitationClient,
  type ClerkUserEmailClient,
} from '../lib/clerk.js';
import { buildUserInviteEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import { logOperationalEvent } from '../lib/observability.js';
import { authedProcedure, router } from '../trpc.js';

export interface ProfileRouterDeps {
  appUrl?: string;
  clerk?: ClerkInvitationClient;
  emailClient?: EmailClient;
  userEmailClient?: ClerkUserEmailClient;
}

const SIGN_UP_PATH = '/sign-up';

const profileUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  tags: true,
  fullNameEnc: true,
  emailEnc: true,
  phoneEnc: true,
  addressEnc: true,
  active: true,
  parentEmailNotificationsEnabled: true,
  parentEmailNotificationOptOuts: true,
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
  acceptedInvitations: {
    where: { status: 'Accepted', guardianLinkInviterId: { not: null } },
    orderBy: { acceptedAt: 'desc' },
    take: 1,
    select: {
      guardianLinkInviter: {
        select: {
          id: true,
          fullNameEnc: true,
          emailEnc: true,
        },
      },
    },
  },
});

type ProfileUserRow = Prisma.UserGetPayload<{ select: typeof profileUserSelect }>;

const updateMyProfileInput = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  phone: z.string().trim().max(50, 'Phone number is too long').nullable().optional(),
  address: z.string().trim().max(500, 'Address is too long').nullable().optional(),
});
type UpdateMyProfileInput = z.infer<typeof updateMyProfileInput>;

const parentEmailNotificationCategoryInput = z.enum(PARENT_EMAIL_NOTIFICATION_CATEGORIES);

const updateEmailNotificationPreferencesInput = z
  .object({
    enabled: z.boolean(),
    optedOutCategories: z
      .array(parentEmailNotificationCategoryInput)
      .max(PARENT_EMAIL_NOTIFICATION_CATEGORIES.length),
  })
  .superRefine((input, refinement) => {
    if (new Set(input.optedOutCategories).size === input.optedOutCategories.length) return;
    refinement.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'email notification categories must be unique',
      path: ['optedOutCategories'],
    });
  });

const inviteSpouseInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

const spouseInvitationSelect = Prisma.validator<Prisma.UserInvitationSelect>()({
  id: true,
  clerkInvitationId: true,
  emailEnc: true,
  emailStatus: true,
  guardianLinkInviterId: true,
  guardianLinkStudentIds: true,
  createdAt: true,
});

type SpouseInvitationRow = Prisma.UserInvitationGetPayload<{
  select: typeof spouseInvitationSelect;
}>;

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
  entity: string,
): string {
  return decryptRequiredText({ decrypt }, value, entity);
}

function normaliseNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canInviteSpouse(user: Pick<SessionUser, 'role'>): boolean {
  return canUseLinkedChildGuardianAccess(user);
}

function sanitizeEmailDeliveryError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }

  return {
    name: 'UnknownEmailDeliveryError',
    message: typeof err === 'string' ? err : 'non-error thrown during email delivery',
  };
}

function buildSignUpRedirectUrl(appUrl: string | undefined): string {
  const trimmed = appUrl?.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'APP_URL is required to create invitation redirect URL',
    });
  }

  try {
    return new URL(SIGN_UP_PATH, trimmed).toString();
  } catch {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'APP_URL must be a valid absolute URL to create invitation redirect URL',
    });
  }
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
          emailEnc: string | null;
        } | null>;
      };
    };
  },
  input: { currentUserId: string; email: string | undefined },
  userEmailClient: ClerkUserEmailClient,
): Promise<Pick<Prisma.UserUpdateInput, 'emailEnc' | 'emailBidx'>> {
  if (input.email === undefined) return {};

  const currentUser = await ctx.db.user.findUnique({
    where: { id: input.currentUserId },
    select: { id: true, clerkId: true, emailEnc: true },
  });
  if (!currentUser) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'profile not found' });
  }

  const currentEmail = decryptRequired(
    (value) => ctx.db.$enc.decrypt(value),
    currentUser.emailEnc,
    'user PII',
  );
  if (currentEmail.trim().toLowerCase() === input.email) return {};

  const emailBidx = ctx.db.$enc.blindIndex(input.email);
  const existingEmailUser = await ctx.db.user.findUnique({
    where: { emailBidx },
    select: { id: true },
  });
  if (existingEmailUser && existingEmailUser.id !== input.currentUserId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'email address is already in use' });
  }

  await userEmailClient.updatePrimaryEmail({
    clerkUserId: currentUser.clerkId,
    email: input.email,
  });

  return {
    emailEnc: ctx.db.$enc.encrypt(input.email),
    emailBidx,
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
  input: UpdateMyProfileInput,
): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) data.fullNameEnc = ctx.db.$enc.encrypt(input.fullName);
  if (input.phone !== undefined) {
    data.phoneEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.phone));
  }
  if (input.address !== undefined) {
    data.addressEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.address));
  }
  return data;
}

function mapProfileInviter(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  inviter: ProfileUserRow['acceptedInvitations'][number]['guardianLinkInviter'] | null | undefined,
) {
  if (!inviter) return null;

  return {
    id: inviter.id,
    fullName: decryptRequired(ctx.db.$enc.decrypt, inviter.fullNameEnc, 'inviter PII'),
    email: decryptRequired(ctx.db.$enc.decrypt, inviter.emailEnc, 'inviter PII'),
  };
}

function mapProfile(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  user: ProfileUserRow,
) {
  const acceptedSpouseInvitation = user.acceptedInvitations[0];

  return {
    id: user.id,
    role: user.role,
    tags: user.tags,
    fullName: decryptRequired(ctx.db.$enc.decrypt, user.fullNameEnc, 'user PII'),
    email: decryptRequired(ctx.db.$enc.decrypt, user.emailEnc, 'user PII'),
    phone: ctx.db.$enc.decrypt(user.phoneEnc),
    address: ctx.db.$enc.decrypt(user.addressEnc),
    active: user.active,
    emailNotificationPreferences: {
      enabled: user.parentEmailNotificationsEnabled,
      optedOutCategories: [...user.parentEmailNotificationOptOuts],
    },
    requires2fa: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    children: user.guardianOf.map((guardian) => ({
      id: guardian.student.id,
      fullName: decryptRequired(ctx.db.$enc.decrypt, guardian.student.fullNameEnc, 'student PII'),
      yearGroup: guardian.student.yearGroup,
      active: guardian.student.active,
    })),
    invitedBy: mapProfileInviter(ctx, acceptedSpouseInvitation?.guardianLinkInviter),
  };
}

function mapSpouseInvitation(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  invitation: SpouseInvitationRow,
) {
  return {
    id: invitation.id,
    email: decryptRequired(ctx.db.$enc.decrypt, invitation.emailEnc, 'invitation PII'),
    emailStatus: invitation.emailStatus,
    createdAt: invitation.createdAt,
  };
}

async function loadLinkedActiveChildIds(
  ctx: AppContext & { user: SessionUser },
): Promise<string[]> {
  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id, student: { active: true } },
    orderBy: { createdAt: 'desc' },
    select: { studentId: true },
  });
  return guardians.map((guardian) => guardian.studentId);
}

async function canManageParentEmailNotificationPreferences(
  ctx: AppContext & { user: SessionUser },
): Promise<boolean> {
  return ctx.user.role === 'Parent' || (await loadLinkedActiveChildIds(ctx)).length > 0;
}

async function loadSpouseInviteStatus(ctx: AppContext & { user: SessionUser }) {
  if (!canInviteSpouse(ctx.user)) {
    return {
      canInvite: false,
      linkedChildCount: 0,
      pendingInvitation: null,
      spouseLinked: false,
    };
  }

  const linkedChildIds = await loadLinkedActiveChildIds(ctx);
  if (linkedChildIds.length === 0) {
    return {
      canInvite: false,
      linkedChildCount: 0,
      pendingInvitation: null,
      spouseLinked: false,
    };
  }

  const [existingLinkedParent, pendingInvitation] = await Promise.all([
    ctx.db.guardian.findFirst({
      where: {
        studentId: { in: linkedChildIds },
        userId: { not: ctx.user.id },
        student: { active: true },
        user: { active: true, role: 'Parent' },
      },
      select: { id: true },
    }),
    ctx.db.userInvitation.findFirst({
      where: {
        status: 'Pending',
        role: 'Parent',
        guardianLinkStudentIds: { hasSome: linkedChildIds },
      },
      orderBy: { createdAt: 'desc' },
      select: spouseInvitationSelect,
    }),
  ]);
  if (pendingInvitation) {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'UserInvitation',
        entityId: pendingInvitation.id,
        meta: { source: 'profile.spouseInviteStatus' },
      },
    });
  }

  return {
    canInvite: !existingLinkedParent && !pendingInvitation,
    linkedChildCount: linkedChildIds.length,
    pendingInvitation: pendingInvitation ? mapSpouseInvitation(ctx, pendingInvitation) : null,
    spouseLinked: Boolean(existingLinkedParent),
  };
}

async function loadProfile(ctx: AppContext & { user: { id: string } }) {
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.user.id },
    select: profileUserSelect,
  });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'profile not found' });
  }

  const profile = mapProfile(ctx, user);
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'User',
      entityId: user.id,
      meta: {
        source: 'profile.me',
        fields: ['fullName', 'email', 'phone', 'address'],
        linkedChildCount: profile.children.length,
      },
    },
  });

  if (profile.invitedBy) {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        entityId: profile.invitedBy.id,
        meta: {
          source: 'profile.me.invitedBy',
          fields: ['fullName', 'email'],
        },
      },
    });
  }

  return profile;
}

export function createProfileRouter(deps: ProfileRouterDeps = {}) {
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
    buildSignUpRedirectUrl(deps.appUrl ?? process.env.APP_URL);

  async function createSpouseClerkInvitation(input: { email: string }) {
    const invitation = await getClerk().createInvitation({
      emailAddress: input.email,
      publicMetadata: { role: 'Parent', tags: [] },
      redirectUrl: getInvitationRedirectUrl(),
      ignoreExisting: true,
      notify: false,
    });
    if (!invitation.url) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'clerk invitation link missing',
      });
    }
    return { ...invitation, url: invitation.url };
  }

  return router({
    me: authedProcedure.query(async ({ ctx }) => loadProfile(ctx)),

    spouseInviteStatus: authedProcedure.query(async ({ ctx }) => loadSpouseInviteStatus(ctx)),

    inviteSpouse: authedProcedure.input(inviteSpouseInput).mutation(async ({ ctx, input }) => {
      if (!canInviteSpouse(ctx.user)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'spouse invites require a linked guardian role',
        });
      }

      const linkedChildIds = await loadLinkedActiveChildIds(ctx);
      if (linkedChildIds.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'link at least one child before inviting a spouse',
        });
      }

      const status = await loadSpouseInviteStatus(ctx);
      if (!status.canInvite) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: status.spouseLinked
            ? 'a spouse or second parent is already linked to this family'
            : 'a spouse invitation is already pending for this family',
        });
      }

      const emailBidx = ctx.db.$enc.blindIndex(input.email);
      const [existingUser, existingPendingInvite] = await Promise.all([
        ctx.db.user.findUnique({ where: { emailBidx }, select: { id: true } }),
        ctx.db.userInvitation.findFirst({
          where: { emailBidx, status: 'Pending' },
          select: { id: true },
        }),
      ]);
      if (existingUser) {
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

      const invitation = await createSpouseClerkInvitation({ email: input.email });
      const storedInvitation = await ctx.db.userInvitation.create({
        data: {
          clerkInvitationId: invitation.id,
          role: 'Parent',
          tags: [],
          emailEnc: ctx.db.$enc.encrypt(input.email),
          emailBidx,
          status: 'Pending',
          emailStatus: 'NotSent',
          invitedById: ctx.user.id,
          guardianLinkInviterId: ctx.user.id,
          guardianLinkStudentIds: linkedChildIds,
        },
        select: spouseInvitationSelect,
      });

      const email = buildUserInviteEmail({
        to: input.email,
        role: 'Parent',
        inviteUrl: invitation.url,
      });

      try {
        const emailResult = await getEmailClient().send(email);
        await ctx.db.userInvitation.update({
          where: { id: storedInvitation.id },
          data: { emailStatus: 'Sent', emailMessageId: emailResult.id },
          select: { id: true },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'Invitation',
            entityId: invitation.id,
            meta: {
              role: 'Parent',
              source: 'profile.inviteSpouse',
              linkedChildCount: linkedChildIds.length,
              emailStatus: 'Sent',
              invitationStatus: invitation.status,
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
              source: 'profile.inviteSpouse',
            },
          },
        });

        return {
          invitationId: invitation.id,
          emailStatus: 'Sent' as const,
          status: invitation.status,
        };
      } catch (err) {
        await ctx.db.userInvitation.update({
          where: { id: storedInvitation.id },
          data: { emailStatus: 'Failed', emailMessageId: null },
          select: { id: true },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'Invitation',
            entityId: invitation.id,
            meta: {
              role: 'Parent',
              source: 'profile.inviteSpouse',
              linkedChildCount: linkedChildIds.length,
              emailStatus: 'Failed',
              invitationStatus: invitation.status,
            },
          },
        });
        logOperationalEvent({
          event: 'email.delivery_failed',
          level: 'error',
          message: 'Spouse invitation email delivery failed',
          meta: {
            error: sanitizeEmailDeliveryError(err),
            invitationId: invitation.id,
            source: 'profile.inviteSpouse',
            status: invitation.status,
          },
          requestId: ctx.requestId,
          userId: ctx.user.id,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'spouse invitation email send failed',
          cause: err instanceof Error ? err : undefined,
        });
      }
    }),

    updateMe: authedProcedure.input(updateMyProfileInput).mutation(async ({ ctx, input }) => {
      const emailData =
        input.email === undefined
          ? {}
          : await userEmailUpdateData(
              ctx,
              { currentUserId: ctx.user.id, email: input.email },
              getUserEmailClient(),
            );
      const data: Prisma.UserUpdateInput = {
        ...userProfileUpdateData(ctx, input),
        ...emailData,
      };

      const fields = Object.keys(data).sort();
      if (fields.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'no profile fields provided' });
      }

      try {
        await ctx.db.user.update({
          where: { id: ctx.user.id },
          data,
          select: { id: true },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'profile not found' });
        }
        throw err;
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'User',
          entityId: ctx.user.id,
          meta: { fields, source: 'profile.updateMe' },
        },
      });

      return loadProfile(ctx);
    }),

    updateEmailNotificationPreferences: authedProcedure
      .input(updateEmailNotificationPreferencesInput)
      .mutation(async ({ ctx, input }) => {
        if (!(await canManageParentEmailNotificationPreferences(ctx))) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'email notification preferences require parent or linked-child access',
          });
        }

        try {
          await ctx.db.user.update({
            where: { id: ctx.user.id },
            data: {
              parentEmailNotificationsEnabled: input.enabled,
              parentEmailNotificationOptOuts: input.optedOutCategories,
            },
            select: { id: true },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'profile not found' });
          }
          throw err;
        }

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'User',
            entityId: ctx.user.id,
            meta: {
              fields: ['parentEmailNotificationOptOuts', 'parentEmailNotificationsEnabled'],
              source: 'profile.updateEmailNotificationPreferences',
            },
          },
        });

        return loadProfile(ctx);
      }),
  });
}

export const profileRouter = createProfileRouter();
