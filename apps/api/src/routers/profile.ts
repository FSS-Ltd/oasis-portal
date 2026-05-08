import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import type { AppContext } from '../context.js';
import { createDefaultClerkUserEmailClient, type ClerkUserEmailClient } from '../lib/clerk.js';
import { authedProcedure, router } from '../trpc.js';

export interface ProfileRouterDeps {
  userEmailClient?: ClerkUserEmailClient;
}

const profileUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  role: true,
  tags: true,
  fullNameEnc: true,
  emailEnc: true,
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

type ProfileUserRow = Prisma.UserGetPayload<{ select: typeof profileUserSelect }>;

const updateMyProfileInput = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  phone: z.string().trim().max(50, 'Phone number is too long').nullable().optional(),
  address: z.string().trim().max(500, 'Address is too long').nullable().optional(),
});
type UpdateMyProfileInput = z.infer<typeof updateMyProfileInput>;

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

function mapProfile(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  user: ProfileUserRow,
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
    requires2fa: false,
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

async function loadProfile(
  ctx: AppContext & { user: { id: string } },
) {
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
  return profile;
}

export function createProfileRouter(deps: ProfileRouterDeps = {}) {
  let cachedUserEmailClient: ClerkUserEmailClient | null = deps.userEmailClient ?? null;
  const getUserEmailClient = (): ClerkUserEmailClient => {
    if (cachedUserEmailClient) return cachedUserEmailClient;
    cachedUserEmailClient = createDefaultClerkUserEmailClient();
    return cachedUserEmailClient;
  };

  return router({
    me: authedProcedure.query(async ({ ctx }) => loadProfile(ctx)),

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
  });
}

export const profileRouter = createProfileRouter();
