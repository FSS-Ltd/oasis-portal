import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  assertCanManageClub,
  canSignUpForClub,
  isFullAdmin,
  type SessionUser,
  validateClubDraft,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

type AuthedContext = AppContext & { user: SessionUser };

interface ClubSignupSummary {
  studentId: string;
}

interface ClubRow {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  capacity: number | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  signups: ClubSignupSummary[];
}

const clubCreateInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  schedule: z.string().trim().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

const clubUpdateInput = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  schedule: z.string().trim().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

const clubStudentInput = z.object({
  clubId: z.string().cuid(),
  studentId: z.string().cuid(),
});

const clubIdInput = z.object({ clubId: z.string().cuid() });

const clubListInclude = Prisma.validator<Prisma.ClubInclude>()({
  signups: {
    where: { status: 'Active' },
    select: { studentId: true },
  },
});

const clubListOrderBy = [
  { active: 'desc' },
  { name: 'asc' },
  { createdAt: 'desc' },
] as const satisfies Prisma.ClubOrderByWithRelationInput[];

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireClubManager(user: SessionUser): void {
  try {
    assertCanManageClub(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function canManageClubs(user: SessionUser): boolean {
  return isFullAdmin(user) || user.role === 'ClubsAdmin';
}

function requireClubListAccess(user: SessionUser): void {
  if (canManageClubs(user) || user.role === 'Parent') return;
  throw toForbidden(new AccessDeniedError('clubs require Parent, ClubsAdmin, or full-admin'));
}

function requireSignupActor(user: SessionUser): 'full-admin' | 'parent' {
  if (isFullAdmin(user)) return 'full-admin';
  if (user.role === 'Parent') return 'parent';
  throw toForbidden(new AccessDeniedError('club signups require Parent or full-admin'));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function mapClub(
  user: SessionUser,
  club: ClubRow,
  linkedStudentIds: ReadonlySet<string> = new Set(),
) {
  const signedUpStudentIds =
    user.role === 'Parent'
      ? club.signups
          .filter((signup) => linkedStudentIds.has(signup.studentId))
          .map((signup) => signup.studentId)
      : [];

  return {
    id: club.id,
    name: club.name,
    description: club.description,
    schedule: club.schedule,
    capacity: club.capacity,
    active: club.active,
    createdById: club.createdById,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    activeSignupCount: club.signups.length,
    signedUpStudentIds,
  };
}

async function loadLinkedActiveStudentIds(ctx: AuthedContext): Promise<Set<string>> {
  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id, student: { active: true } },
    select: { studentId: true },
  });
  return new Set(guardians.map((guardian) => guardian.studentId));
}

async function assertParentLinkedStudent(
  db: Pick<AuthedContext['db'], 'guardian'>,
  user: SessionUser,
  studentId: string,
  options: { requireActive: boolean },
): Promise<void> {
  const guardian = await db.guardian.findUnique({
    where: { userId_studentId: { userId: user.id, studentId } },
    select: { student: { select: { id: true, active: true } } },
  });

  if (!guardian) {
    throw toForbidden(new AccessDeniedError('parent is not linked to this student'));
  }
  if (options.requireActive && !guardian.student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
}

async function assertFullAdminActiveStudent(
  db: Pick<AuthedContext['db'], 'student'>,
  studentId: string,
): Promise<void> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true },
  });
  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  if (!student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
}

function handleSignupCreateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'student is already signed up for this club',
      cause: error,
    });
  }
  throw error;
}

export const clubRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    requireClubListAccess(ctx.user);

    const linkedStudentIds =
      ctx.user.role === 'Parent' ? await loadLinkedActiveStudentIds(ctx) : new Set<string>();
    const clubs =
      ctx.user.role === 'Parent'
        ? await ctx.db.club.findMany({
            where: { active: true },
            include: clubListInclude,
            orderBy: clubListOrderBy,
          })
        : await ctx.db.club.findMany({
            include: clubListInclude,
            orderBy: clubListOrderBy,
          });

    return clubs.map((club) => mapClub(ctx.user, club, linkedStudentIds));
  }),

  create: authedProcedure.input(clubCreateInput).mutation(async ({ ctx, input }) => {
    requireClubManager(ctx.user);

    const draft = validateClubDraft({
      name: input.name,
      ...(input.capacity !== null && input.capacity !== undefined
        ? { capacity: input.capacity }
        : {}),
    });
    const club = await ctx.db.club.create({
      data: {
        name: draft.name,
        description: normalizeOptionalText(input.description),
        schedule: normalizeOptionalText(input.schedule),
        capacity: input.capacity ?? null,
        active: true,
        createdById: ctx.user.id,
      },
      include: {
        signups: {
          where: { status: 'Active' },
          select: { studentId: true },
        },
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'Club',
        entityId: club.id,
        meta: { source: 'club.create', capacity: club.capacity },
      },
    });

    return mapClub(ctx.user, { ...club, signups: [] });
  }),

  update: authedProcedure.input(clubUpdateInput).mutation(async ({ ctx, input }) => {
    requireClubManager(ctx.user);

    const existing = await ctx.db.club.findUnique({
      where: { id: input.id },
      include: {
        signups: {
          where: { status: 'Active' },
          select: { studentId: true },
        },
      },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
    }
    if (input.capacity !== undefined && input.capacity !== null) {
      validateClubDraft({ name: input.name ?? existing.name, capacity: input.capacity });
      if (input.capacity < existing.signups.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'capacity cannot be below active signup count',
        });
      }
    }

    const data: Prisma.ClubUpdateInput = {};
    if (input.name !== undefined) {
      data.name = validateClubDraft({ name: input.name }).name;
    }
    if (input.description !== undefined) {
      data.description = normalizeOptionalText(input.description);
    }
    if (input.schedule !== undefined) {
      data.schedule = normalizeOptionalText(input.schedule);
    }
    if (input.capacity !== undefined) {
      data.capacity = input.capacity;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    const club = await ctx.db.club.update({
      where: { id: input.id },
      data,
      include: {
        signups: {
          where: { status: 'Active' },
          select: { studentId: true },
        },
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'Club',
        entityId: club.id,
        meta: {
          source: input.active === false ? 'club.deactivate' : 'club.update',
          fields: Object.keys(data).sort(),
        },
      },
    });

    return mapClub(ctx.user, club);
  }),

  roster: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
    requireClubManager(ctx.user);

    const club = await ctx.db.club.findUnique({
      where: { id: input.clubId },
      include: {
        signups: {
          where: { status: 'Active' },
          include: {
            student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!club) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
    }

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { source: 'club.roster', clubId: club.id, count: club.signups.length },
      },
    });

    return {
      clubId: club.id,
      signups: club.signups.map((signup) => ({
        id: signup.id,
        studentId: signup.studentId,
        studentName: decryptRequired(ctx.db.$enc.decrypt, signup.student.fullNameEnc, 'student PII'),
        yearGroup: signup.student.yearGroup,
        signedUpAt: signup.createdAt,
      })),
    };
  }),

  signUp: authedProcedure
    .input(clubStudentInput)
    .mutation(async ({ ctx, input }) => {
      const actor = requireSignupActor(ctx.user);

      try {
        return await ctx.db.$transaction(
          async (tx) => {
            const club = await tx.club.findUnique({
              where: { id: input.clubId },
              include: {
                signups: {
                  where: { status: 'Active' },
                  select: { studentId: true },
                },
              },
            });
            if (!club) {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
            }
            if (!club.active) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'club is inactive' });
            }

            if (actor === 'parent') {
              await assertParentLinkedStudent(tx, ctx.user, input.studentId, {
                requireActive: true,
              });
            } else {
              await assertFullAdminActiveStudent(tx, input.studentId);
            }

            const signupCheckInput = {
              currentActiveSignups: club.signups.length,
              alreadySignedUp: club.signups.some((signup) => signup.studentId === input.studentId),
              ...(club.capacity !== null ? { capacity: club.capacity } : {}),
            };
            const signupCheck = canSignUpForClub(signupCheckInput);
            if (signupCheck !== true) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: signupCheck });
            }

            const signup = await tx.clubSignup.create({
              data: {
                clubId: input.clubId,
                studentId: input.studentId,
                signedUpByUserId: ctx.user.id,
                status: 'Active',
              },
              select: {
                id: true,
                clubId: true,
                studentId: true,
                signedUpByUserId: true,
                status: true,
                createdAt: true,
                withdrawnAt: true,
              },
            });

            await tx.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Create',
                entity: 'ClubSignup',
                entityId: signup.id,
                meta: { source: 'club.signUp', clubId: input.clubId, studentId: input.studentId },
              },
            });

            return signup;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        handleSignupCreateError(error);
      }
    }),

  withdraw: authedProcedure.input(clubStudentInput).mutation(async ({ ctx, input }) => {
    const actor = requireSignupActor(ctx.user);

    return ctx.db.$transaction(async (tx) => {
      const club = await tx.club.findUnique({
        where: { id: input.clubId },
        select: { id: true },
      });
      if (!club) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }

      if (actor === 'parent') {
        await assertParentLinkedStudent(tx, ctx.user, input.studentId, { requireActive: false });
      }

      const activeSignup = await tx.clubSignup.findFirst({
        where: { clubId: input.clubId, studentId: input.studentId, status: 'Active' },
        select: { id: true },
      });
      if (!activeSignup) {
        return {
          id: null,
          clubId: input.clubId,
          studentId: input.studentId,
          status: 'Withdrawn' as const,
          withdrawn: false,
          withdrawnAt: null,
        };
      }

      const signup = await tx.clubSignup.update({
        where: { id: activeSignup.id },
        data: { status: 'Withdrawn', withdrawnAt: new Date() },
        select: {
          id: true,
          clubId: true,
          studentId: true,
          signedUpByUserId: true,
          status: true,
          createdAt: true,
          withdrawnAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'ClubSignup',
          entityId: signup.id,
          meta: { source: 'club.withdraw', clubId: input.clubId, studentId: input.studentId },
        },
      });

      return { ...signup, withdrawn: true };
    });
  }),

  notify: authedProcedure
    .input(
      z.object({
        clubId: z.string().cuid(),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(() => notImplemented('club.notify')),
});
