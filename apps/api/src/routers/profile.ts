import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import { authedProcedure, router } from '../trpc.js';

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
});

type ProfileUserRow = Prisma.UserGetPayload<{ select: typeof profileUserSelect }>;

const updateMyProfileInput = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').optional(),
  phone: z.string().trim().max(50, 'Phone number is too long').nullable().optional(),
  address: z.string().trim().max(500, 'Address is too long').nullable().optional(),
});

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
  };
}

async function loadProfile(ctx: Parameters<typeof mapProfile>[0] & {
  db: Parameters<typeof mapProfile>[0]['db'] & {
    user: {
      findUnique: (args: Prisma.UserFindUniqueArgs) => Promise<ProfileUserRow | null>;
    };
    auditLog: {
      create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown>;
    };
  };
  user: { id: string };
}) {
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
      meta: { source: 'profile.me', fields: ['fullName', 'email', 'phone', 'address'] },
    },
  });
  return profile;
}

export const profileRouter = router({
  me: authedProcedure.query(async ({ ctx }) => loadProfile(ctx)),

  updateMe: authedProcedure.input(updateMyProfileInput).mutation(async ({ ctx, input }) => {
    const data: Prisma.UserUpdateInput = {};
    if (input.fullName !== undefined) data.fullNameEnc = ctx.db.$enc.encrypt(input.fullName);
    if (input.phone !== undefined) data.phoneEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.phone));
    if (input.address !== undefined) {
      data.addressEnc = ctx.db.$enc.encrypt(normaliseNullableText(input.address));
    }

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
