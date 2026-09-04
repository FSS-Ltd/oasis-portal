import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  canManageStaffParentVolunteerAccess,
  currentOasisTerm,
  isOasisOperatingDay,
  isStaff,
  nextOasisTerm,
  resolveParentVolunteerAccess,
  requireStaff,
  type OasisTerm,
  type SessionUser,
} from '@oasis/domain';
import { adminOperationsProcedure, authedProcedure, router } from '../trpc.js';
import type { AppContext } from '../context.js';
import { dateKey, normalizeDate } from '../lib/daily-year-band-scope.js';
import { assertOperatingDate, assertRotaDate } from '../lib/operational-date.js';

const STAFF_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'ClubsAdmin',
  'Supervisor',
] as const;

const availabilityWindowInput = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((input) => input.startMinute < input.endMinute, {
    message: 'startMinute must be before endMinute',
    path: ['endMinute'],
  });

const setAvailabilityInput = z.object({
  windows: z.array(availabilityWindowInput).max(42).default([]),
});

const dateKeyInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid date');
const monthKeyInput = z.string().regex(/^\d{4}-\d{2}$/u, 'Enter a valid month');

const PARENT_VOLUNTEER_MAX_TERM_DAYS = 128;
const PARENT_VOLUNTEER_NEXT_TERM_OPENING_DAYS = 7;

const PARENT_VOLUNTEER_PLACEMENTS = {
  Centre: { dailyCapacity: 2, label: 'Centre volunteer' },
  LunchAndClubsPrimary: { dailyCapacity: 3, label: 'Primary lunch and clubs volunteer' },
  LunchAndClubsSecondary: { dailyCapacity: 2, label: 'Secondary lunch and clubs volunteer' },
} as const;

type ParentVolunteerPlacement = keyof typeof PARENT_VOLUNTEER_PLACEMENTS;
type ParentVolunteerScope = 'parent' | 'staff';
type ParentVolunteerDaySlot = {
  date: string;
  selected: boolean;
  status: 'Selected' | 'Full' | 'Available';
  spacesRemaining: number;
};
type ParentVolunteerLunchAndClubs = {
  primary: { dailyCapacity: number; days: ParentVolunteerDaySlot[] };
  secondary: { dailyCapacity: number; days: ParentVolunteerDaySlot[] };
};
type ParentVolunteerSharedTerm = {
  id: string;
  label: string;
  from: string;
  to: string;
  lunchAndClubs: ParentVolunteerLunchAndClubs;
};
type ParentVolunteerSlots =
  | {
      scope: 'parent';
      terms: (ParentVolunteerSharedTerm & {
        centreVolunteer: { dailyCapacity: number; days: ParentVolunteerDaySlot[] };
      })[];
    }
  | { scope: 'staff'; terms: ParentVolunteerSharedTerm[] };

const setMyParentVolunteerDaysInput = z
  .object({
    termId: z.string().regex(/^\d{4}-(Spring|Summer|Autumn)$/u, 'Choose a valid volunteer term'),
    centreDates: z.array(dateKeyInput).max(PARENT_VOLUNTEER_MAX_TERM_DAYS).optional(),
    primaryLunchAndClubsDates: z.array(dateKeyInput).max(PARENT_VOLUNTEER_MAX_TERM_DAYS).optional(),
    secondaryLunchAndClubsDates: z
      .array(dateKeyInput)
      .max(PARENT_VOLUNTEER_MAX_TERM_DAYS)
      .optional(),
  })
  .refine(
    (input) =>
      input.centreDates !== undefined ||
      input.primaryLunchAndClubsDates !== undefined ||
      input.secondaryLunchAndClubsDates !== undefined,
    { message: 'Choose volunteer days to save' },
  )
  .superRefine((input, ctx) => {
    const dateLists = [
      ['centreDates', input.centreDates],
      ['primaryLunchAndClubsDates', input.primaryLunchAndClubsDates],
      ['secondaryLunchAndClubsDates', input.secondaryLunchAndClubsDates],
    ] as const;
    for (const [field, dates] of dateLists) {
      if (!dates) continue;
      if (new Set(dates).size !== dates.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose each volunteer day only once',
          path: [field],
        });
      }
    }
    if (!input.primaryLunchAndClubsDates || !input.secondaryLunchAndClubsDates) return;
    const primaryDates = new Set(input.primaryLunchAndClubsDates);
    const duplicateLunchDate = input.secondaryLunchAndClubsDates.find((date) =>
      primaryDates.has(date),
    );
    if (duplicateLunchDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose either Primary or Secondary for lunch and clubs on the same day',
        path: ['secondaryLunchAndClubsDates'],
      });
    }
  });

const setStaffParentVolunteerAccessInput = z.object({
  userId: z.string().min(1),
  enabled: z.boolean(),
});

const monthlyAvailabilityWindowInput = z
  .object({
    date: dateKeyInput,
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((input) => input.startMinute < input.endMinute, {
    message: 'startMinute must be before endMinute',
    path: ['endMinute'],
  });

const setMonthlyAvailabilityInput = z.object({
  month: monthKeyInput,
  windows: z.array(monthlyAvailabilityWindowInput).max(124).default([]),
});

const staffAvailabilityInput = z
  .object({
    staffUserIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .optional();

const staffMonthlyAvailabilityInput = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    staffUserIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

const dateRangeInput = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

const shiftKindSchema = z.enum(['Cover', 'Meeting']);

const createShiftInput = z.object({
  staffUserId: z.string().min(1),
  kind: shiftKindSchema.default('Cover'),
  yearGroupBandId: z.string().min(1).optional(),
  date: z.coerce.date(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

const shiftInput = createShiftInput.refine(
  (input) => input.startsAt.getTime() < input.endsAt.getTime(),
  {
    message: 'startsAt must be before endsAt',
    path: ['endsAt'],
  },
);

const updateShiftInput = z
  .object({
    id: z.string().min(1),
    staffUserId: z.string().min(1).optional(),
    kind: shiftKindSchema.optional(),
    yearGroupBandId: z.string().min(1).nullable().optional(),
    date: z.coerce.date().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (input) =>
      input.staffUserId !== undefined ||
      input.kind !== undefined ||
      input.yearGroupBandId !== undefined ||
      input.date !== undefined ||
      input.startsAt !== undefined ||
      input.endsAt !== undefined ||
      input.notes !== undefined,
    { message: 'at least one field must be provided' },
  );

const requestSwapInput = z.object({
  fromShiftId: z.string().min(1),
  toShiftId: z.string().min(1),
});

const reviewSwapInput = z.object({
  id: z.string().min(1),
});

const deleteShiftInput = z.object({
  id: z.string().min(1),
});

function dateFromKey(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter a valid date' });
  }
  return date;
}

function monthRange(month: string): { from: Date; to: Date } {
  const [yearValue, monthValue] = month.split('-');
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { from, to };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function availableParentVolunteerTerms(now = new Date()): OasisTerm[] {
  const currentTerm = currentOasisTerm(now);
  const nextTerm = nextOasisTerm(now);
  if (!nextTerm) return [currentTerm];

  const nextTermOpeningDate = addDays(nextTerm.from, -PARENT_VOLUNTEER_NEXT_TERM_OPENING_DAYS);
  return normalizeDate(now).getTime() >= nextTermOpeningDate.getTime()
    ? [currentTerm, nextTerm]
    : [currentTerm];
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} PII decrypt failed` });
  }
  return decrypted;
}

type RouterCtx = { db: AppContext['db']; user: SessionUser };

function mapStaffUser(
  decrypt: AppContext['db']['$enc']['decrypt'],
  user: { id: string; role: SessionUser['role']; fullNameEnc: string; emailEnc: string | null },
) {
  return {
    id: user.id,
    role: user.role,
    fullName: decryptRequired(decrypt, user.fullNameEnc, 'user'),
    email: decryptRequired(decrypt, user.emailEnc, 'user'),
  };
}

function assertStaffWorkflow(user: SessionUser): void {
  try {
    requireStaff(user);
  } catch (err) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: err instanceof Error ? err.message : 'supervisor workflow access denied',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

function assertCanManageStaffParentVolunteerAccess(user: SessionUser): void {
  if (!canManageStaffParentVolunteerAccess(user)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'staff parent volunteer access management is not available',
    });
  }
}

const activeGuardianSelect = {
  where: { student: { active: true } },
  select: { id: true },
} satisfies Prisma.GuardianFindManyArgs;

const staffParentVolunteerAccessSelect = {
  id: true,
  role: true,
  fullNameEnc: true,
  staffParentVolunteerAccess: true,
  guardianOf: activeGuardianSelect,
} satisfies Prisma.UserSelect;

type StaffParentVolunteerAccessUser = Prisma.UserGetPayload<{
  select: typeof staffParentVolunteerAccessSelect;
}>;

function mapStaffParentVolunteerAccess(
  decrypt: AppContext['db']['$enc']['decrypt'],
  user: StaffParentVolunteerAccessUser,
) {
  return {
    id: user.id,
    role: user.role,
    fullName: decryptRequired(decrypt, user.fullNameEnc, 'user'),
    childCount: user.guardianOf.length,
    enabled: user.staffParentVolunteerAccess,
  };
}

async function lockStaffParentVolunteerEligibility(
  tx: Prisma.TransactionClient,
  userId: string,
  requireEnabledAccess: boolean,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT eligible_user."id"
    FROM "User" AS eligible_user
    INNER JOIN "Guardian" AS guardian_link
      ON guardian_link."userId" = eligible_user."id"
    INNER JOIN "Student" AS active_student
      ON active_student."id" = guardian_link."studentId"
    WHERE eligible_user."id" = ${userId}
      AND eligible_user."active" = TRUE
      AND eligible_user."role" NOT IN ('Parent', 'Student')
      AND (${requireEnabledAccess} = FALSE OR eligible_user."staffParentVolunteerAccess" = TRUE)
      AND active_student."active" = TRUE
    FOR UPDATE OF eligible_user, guardian_link, active_student
  `;
  return rows.length > 0;
}

async function resolveParentVolunteerScope(ctx: RouterCtx): Promise<ParentVolunteerScope> {
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.user.id },
    select: {
      role: true,
      active: true,
      staffParentVolunteerAccess: true,
      guardianOf: activeGuardianSelect,
    },
  });
  if (!user) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'parent volunteer access is not available',
    });
  }
  const access = resolveParentVolunteerAccess({
    active: user.active,
    activeGuardianCount: user.guardianOf.length,
    role: user.role,
    staffParentVolunteerAccess: user.staffParentVolunteerAccess,
  });
  if (access) return access;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'parent volunteer access is not available',
  });
}

function assertParentVolunteerDatesWithinTerm(dates: readonly string[], term: OasisTerm): void {
  const invalidDate = dates.find((value) => {
    const date = dateFromKey(value);
    return date.getTime() < term.from.getTime() || date.getTime() >= term.to.getTime();
  });
  if (invalidDate) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Volunteer days must be within an available term',
    });
  }
}

async function listParentVolunteerSlots(
  ctx: RouterCtx,
  scope: ParentVolunteerScope,
): Promise<ParentVolunteerSlots> {
  const terms = availableParentVolunteerTerms();
  const firstTerm = terms[0] as OasisTerm;
  const lastTerm = terms.at(-1) as OasisTerm;
  const rows = await ctx.db.parentVolunteerDay.findMany({
    where: { date: { gte: firstTerm.from, lte: addDays(lastTerm.to, -1) } },
    select: { date: true, parentUserId: true, placement: true },
  });
  const volunteersByPlacementAndDate = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${row.placement}:${dateKey(row.date)}`;
    volunteersByPlacementAndDate.set(key, [
      ...(volunteersByPlacementAndDate.get(key) ?? []),
      row.parentUserId,
    ]);
  }

  const slotsForPlacement = (placement: ParentVolunteerPlacement, term: OasisTerm) => {
    const { dailyCapacity } = PARENT_VOLUNTEER_PLACEMENTS[placement];
    const termDays = Math.ceil((term.to.getTime() - term.from.getTime()) / 86_400_000);
    return Array.from({ length: termDays }, (_, index) => addDays(term.from, index))
      .filter(isOasisOperatingDay)
      .map((termDate) => {
        const date = dateKey(termDate);
        const volunteerIds = volunteersByPlacementAndDate.get(`${placement}:${date}`) ?? [];
        const selected = volunteerIds.includes(ctx.user.id);
        return {
          date,
          selected,
          status: selected
            ? ('Selected' as const)
            : volunteerIds.length >= dailyCapacity
              ? ('Full' as const)
              : ('Available' as const),
          spacesRemaining: Math.max(dailyCapacity - volunteerIds.length, 0),
        };
      });
  };

  const sharedTerms: ParentVolunteerSharedTerm[] = terms.map((term) => ({
    id: term.id,
    label: term.label,
    from: dateKey(term.from),
    to: dateKey(addDays(term.to, -1)),
    lunchAndClubs: {
      primary: {
        dailyCapacity: PARENT_VOLUNTEER_PLACEMENTS.LunchAndClubsPrimary.dailyCapacity,
        days: slotsForPlacement('LunchAndClubsPrimary', term),
      },
      secondary: {
        dailyCapacity: PARENT_VOLUNTEER_PLACEMENTS.LunchAndClubsSecondary.dailyCapacity,
        days: slotsForPlacement('LunchAndClubsSecondary', term),
      },
    },
  }));
  if (scope === 'staff') return { scope, terms: sharedTerms };
  return {
    scope,
    terms: terms.map((term, index) => {
      const sharedTerm = sharedTerms[index];
      if (!sharedTerm) throw new Error('Parent volunteer term serialization failed');
      return {
        ...sharedTerm,
        centreVolunteer: {
          dailyCapacity: PARENT_VOLUNTEER_PLACEMENTS.Centre.dailyCapacity,
          days: slotsForPlacement('Centre', term),
        },
      };
    }),
  };
}

function parentVolunteerDatesByPlacement(
  input: z.infer<typeof setMyParentVolunteerDaysInput>,
  scope: ParentVolunteerScope,
): { placement: ParentVolunteerPlacement; dates: string[] }[] {
  const datesByPlacement: { placement: ParentVolunteerPlacement; dates: string[] | undefined }[] = [
    ...(scope === 'parent' ? [{ placement: 'Centre' as const, dates: input.centreDates }] : []),
    { placement: 'LunchAndClubsPrimary', dates: input.primaryLunchAndClubsDates },
    { placement: 'LunchAndClubsSecondary', dates: input.secondaryLunchAndClubsDates },
  ];
  return datesByPlacement.filter(
    (selection): selection is { placement: ParentVolunteerPlacement; dates: string[] } =>
      selection.dates !== undefined,
  );
}

function assertNoAvailabilityOverlap(windows: z.infer<typeof availabilityWindowInput>[]): void {
  const sorted = [...windows].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous &&
      current &&
      previous.dayOfWeek === current.dayOfWeek &&
      current.startMinute < previous.endMinute
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'availability windows must not overlap',
      });
    }
  }
}

function assertNoMonthlyAvailabilityOverlap(
  windows: z.infer<typeof monthlyAvailabilityWindowInput>[],
): void {
  const sorted = [...windows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous &&
      current &&
      previous.date === current.date &&
      current.startMinute < previous.endMinute
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'monthly unavailability windows must not overlap',
      });
    }
  }
}

function assertMonthlyAvailabilityWithinMonth(
  month: string,
  windows: z.infer<typeof monthlyAvailabilityWindowInput>[],
): void {
  const invalidWindow = windows.find((window) => !window.date.startsWith(month));
  if (invalidWindow) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'monthly unavailability dates must be inside the selected month',
    });
  }
}

function assertShiftKindBand(input: {
  kind: 'Cover' | 'Meeting';
  yearGroupBandId: string | null | undefined;
}): void {
  if (input.kind === 'Cover' && !input.yearGroupBandId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'cover shifts require a year-group band',
    });
  }
}

async function assertActiveStaffUser(ctx: RouterCtx, staffUserId: string): Promise<void> {
  const user = await ctx.db.user.findUnique({
    where: { id: staffUserId },
    select: { id: true, role: true, active: true },
  });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'supervisor user not found' });
  }
  if (!user.active || !isStaff(user)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'user is not an active supervisor' });
  }
}

async function assertActiveBand(ctx: RouterCtx, yearGroupBandId: string): Promise<void> {
  const band = await ctx.db.yearGroupBand.findUnique({
    where: { id: yearGroupBandId },
    select: { id: true, active: true },
  });
  if (!band) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'year-group band not found' });
  }
  if (!band.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'year-group band is inactive' });
  }
}

async function assertNoShiftOverlap(
  ctx: RouterCtx,
  input: { staffUserId: string; date: Date; startsAt: Date; endsAt: Date; exceptShiftId?: string },
): Promise<void> {
  const overlap = await ctx.db.staffShift.findFirst({
    where: {
      staffUserId: input.staffUserId,
      date: normalizeDate(input.date),
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.exceptShiftId ? { NOT: { id: input.exceptShiftId } } : {}),
    },
    select: { id: true },
  });
  if (overlap) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'supervisor shift overlaps an existing shift',
    });
  }
}

function mapShift(shift: {
  id: string;
  staffUserId: string;
  kind: 'Cover' | 'Meeting';
  yearGroupBandId: string | null;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  yearGroupBand?: { name: string; colour: string } | null;
}) {
  return {
    id: shift.id,
    staffUserId: shift.staffUserId,
    yearGroupBandId: shift.yearGroupBandId,
    kind: shift.kind,
    date: dateKey(shift.date),
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    notes: shift.notes,
    bandName: shift.yearGroupBand?.name ?? null,
    bandColour: shift.yearGroupBand?.colour ?? null,
  };
}

function mapShiftWithStaff(
  decrypt: AppContext['db']['$enc']['decrypt'],
  shift: {
    id: string;
    staffUserId: string;
    kind: 'Cover' | 'Meeting';
    yearGroupBandId: string | null;
    date: Date;
    startsAt: Date;
    endsAt: Date;
    notes: string | null;
    staffUser?: {
      id: string;
      role: SessionUser['role'];
      fullNameEnc: string;
      emailEnc: string | null;
    } | null;
    yearGroupBand?: { name: string; colour: string } | null;
  },
) {
  return {
    ...mapShift(shift),
    staff: shift.staffUser ? mapStaffUser(decrypt, shift.staffUser) : null,
  };
}

async function listScheduleWithStaff(
  ctx: RouterCtx,
  input: z.infer<typeof dateRangeInput>,
  source: string,
  activeStaffOnly = false,
) {
  const from = normalizeDate(input.from);
  const to = normalizeDate(input.to);
  const rows = await ctx.db.staffShift.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(activeStaffOnly ? { staffUser: { active: true, role: { in: [...STAFF_ROLES] } } } : {}),
    },
    orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
    include: {
      staffUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
      yearGroupBand: { select: { name: true, colour: true } },
    },
  });

  const shifts = rows.map((row) => mapShiftWithStaff(ctx.db.$enc.decrypt, row));

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'StaffShift',
      meta: { count: shifts.length, source },
    },
  });

  return shifts;
}

export const rotaRouter = router({
  myAvailability: authedProcedure.query(async ({ ctx }) => {
    assertStaffWorkflow(ctx.user);
    return ctx.db.staffAvailabilityWindow.findMany({
      where: { staffUserId: ctx.user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      select: {
        id: true,
        dayOfWeek: true,
        startMinute: true,
        endMinute: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  setMyAvailability: authedProcedure
    .input(setAvailabilityInput)
    .mutation(async ({ ctx, input }) => {
      assertStaffWorkflow(ctx.user);
      assertNoAvailabilityOverlap(input.windows);

      const windows = input.windows
        .map((window) => ({
          staffUserId: ctx.user.id,
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);

      const rows = await ctx.db.$transaction(async (tx) => {
        await tx.staffAvailabilityWindow.deleteMany({ where: { staffUserId: ctx.user.id } });
        if (windows.length > 0) {
          await tx.staffAvailabilityWindow.createMany({ data: windows });
        }
        return tx.staffAvailabilityWindow.findMany({
          where: { staffUserId: ctx.user.id },
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
          select: {
            id: true,
            dayOfWeek: true,
            startMinute: true,
            endMinute: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StaffAvailability',
          entityId: ctx.user.id,
          meta: { windowCount: rows.length, source: 'rota.setMyAvailability' },
        },
      });

      return rows;
    }),

  myMonthlyAvailability: authedProcedure
    .input(z.object({ month: monthKeyInput }))
    .query(async ({ ctx, input }) => {
      assertStaffWorkflow(ctx.user);
      const range = monthRange(input.month);
      const rows = await ctx.db.staffMonthlyAvailabilityWindow.findMany({
        where: {
          staffUserId: ctx.user.id,
          date: { gte: range.from, lte: range.to },
        },
        orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
        select: {
          id: true,
          date: true,
          startMinute: true,
          endMinute: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return rows.map((row) => ({ ...row, date: dateKey(row.date) }));
    }),

  setMyMonthlyAvailability: authedProcedure
    .input(setMonthlyAvailabilityInput)
    .mutation(async ({ ctx, input }) => {
      assertStaffWorkflow(ctx.user);
      assertMonthlyAvailabilityWithinMonth(input.month, input.windows);
      assertNoMonthlyAvailabilityOverlap(input.windows);
      for (const window of input.windows) {
        await assertOperatingDate(ctx.db, dateFromKey(window.date));
      }

      const range = monthRange(input.month);
      const windows = input.windows
        .map((window) => ({
          staffUserId: ctx.user.id,
          date: dateFromKey(window.date),
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.startMinute - b.startMinute);

      const rows = await ctx.db.$transaction(async (tx) => {
        await tx.staffMonthlyAvailabilityWindow.deleteMany({
          where: {
            staffUserId: ctx.user.id,
            date: { gte: range.from, lte: range.to },
          },
        });
        if (windows.length > 0) {
          await tx.staffMonthlyAvailabilityWindow.createMany({ data: windows });
        }
        return tx.staffMonthlyAvailabilityWindow.findMany({
          where: {
            staffUserId: ctx.user.id,
            date: { gte: range.from, lte: range.to },
          },
          orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
          select: {
            id: true,
            date: true,
            startMinute: true,
            endMinute: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StaffMonthlyAvailability',
          entityId: ctx.user.id,
          meta: {
            month: input.month,
            windowCount: rows.length,
            source: 'rota.setMyMonthlyAvailability',
          },
        },
      });

      return rows.map((row) => ({ ...row, date: dateKey(row.date) }));
    }),

  listStaffParentVolunteerAccess: authedProcedure.query(async ({ ctx }) => {
    assertCanManageStaffParentVolunteerAccess(ctx.user);
    const users = await ctx.db.user.findMany({
      where: {
        active: true,
        role: { notIn: ['Parent', 'Student'] },
        guardianOf: { some: { student: { active: true } } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: staffParentVolunteerAccessSelect,
    });
    const staff = users.map((user) => mapStaffParentVolunteerAccess(ctx.db.$enc.decrypt, user));
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'StaffParentVolunteerAccess',
        meta: { count: staff.length, source: 'rota.listStaffParentVolunteerAccess' },
      },
    });
    return staff;
  }),

  setStaffParentVolunteerAccess: authedProcedure
    .input(setStaffParentVolunteerAccessInput)
    .mutation(async ({ ctx, input }) => {
      assertCanManageStaffParentVolunteerAccess(ctx.user);
      const { user } = await ctx.db.$transaction(async (tx) => {
        const targetEligible = await lockStaffParentVolunteerEligibility(tx, input.userId, false);
        if (!targetEligible) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Staff parent volunteer access can only be changed for eligible staff',
          });
        }
        const user = await tx.user.update({
          where: { id: input.userId },
          data: { staffParentVolunteerAccess: input.enabled },
          select: staffParentVolunteerAccessSelect,
        });
        const releasedReservationCount = input.enabled
          ? 0
          : (
              await tx.parentVolunteerDay.deleteMany({
                where: {
                  parentUserId: input.userId,
                  date: { gt: normalizeDate(new Date()) },
                  placement: { in: ['LunchAndClubsPrimary', 'LunchAndClubsSecondary'] },
                },
              })
            ).count;
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StaffParentVolunteerAccess',
            entityId: input.userId,
            meta: {
              enabled: input.enabled,
              releasedReservationCount,
              source: 'rota.setStaffParentVolunteerAccess',
            },
          },
        });
        return { user };
      });

      return mapStaffParentVolunteerAccess(ctx.db.$enc.decrypt, user);
    }),

  parentVolunteerSlots: authedProcedure.query(async ({ ctx }) => {
    const scope = await resolveParentVolunteerScope(ctx);
    return listParentVolunteerSlots(ctx, scope);
  }),

  setMyParentVolunteerDays: authedProcedure
    .input(setMyParentVolunteerDaysInput)
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveParentVolunteerScope(ctx);
      if (scope === 'staff' && input.centreDates !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Centre volunteering is not available to staff volunteers',
        });
      }
      const requestedSelections = parentVolunteerDatesByPlacement(input, scope).flatMap(
        ({ placement, dates }) => dates.map((date) => ({ date, placement })),
      );
      const term = availableParentVolunteerTerms().find(
        (candidate) => candidate.id === input.termId,
      );
      if (!term) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Volunteer term is not currently available',
        });
      }
      assertParentVolunteerDatesWithinTerm(
        requestedSelections.map((selection) => selection.date),
        term,
      );
      for (const selection of requestedSelections) {
        await assertOperatingDate(ctx.db, dateFromKey(selection.date));
      }

      const existingRows = await ctx.db.parentVolunteerDay.findMany({
        where: {
          parentUserId: ctx.user.id,
          date: { gte: term.from, lte: addDays(term.to, -1) },
        },
        select: { id: true, date: true, placement: true },
      });
      const requestedDatesByPlacement = new Map(
        parentVolunteerDatesByPlacement(input, scope).map(({ placement, dates }) => [
          placement,
          new Set(dates),
        ]),
      );
      const effectiveDatesByPlacement = new Map<ParentVolunteerPlacement, Set<string>>(
        (Object.keys(PARENT_VOLUNTEER_PLACEMENTS) as ParentVolunteerPlacement[]).map(
          (placement) => [
            placement,
            new Set(
              existingRows
                .filter((row) => row.placement === placement)
                .map((row) => dateKey(row.date)),
            ),
          ],
        ),
      );
      for (const [placement, dates] of requestedDatesByPlacement) {
        effectiveDatesByPlacement.set(placement, dates);
      }
      const primaryDates = effectiveDatesByPlacement.get('LunchAndClubsPrimary') ?? new Set();
      const secondaryDates = effectiveDatesByPlacement.get('LunchAndClubsSecondary') ?? new Set();
      const lunchAndClubsConflict = [...primaryDates].find((date) => secondaryDates.has(date));
      if (lunchAndClubsConflict) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Choose either Primary or Secondary for lunch and clubs on the same day',
        });
      }
      const existingSelectionKeys = new Set(
        existingRows.map((row) => `${row.placement}:${dateKey(row.date)}`),
      );
      const requestedSelectionKeys = new Set(
        requestedSelections.map((selection) => `${selection.placement}:${selection.date}`),
      );
      const recordsToRemove = existingRows.filter(
        (row) =>
          requestedDatesByPlacement.has(row.placement) &&
          !requestedSelectionKeys.has(`${row.placement}:${dateKey(row.date)}`),
      );
      const selectionsToCreate = requestedSelections.filter(
        (selection) => !existingSelectionKeys.has(`${selection.placement}:${selection.date}`),
      );

      let recordsToCreate: Array<{
        parentUserId: string;
        date: Date;
        placement: ParentVolunteerPlacement;
        slot: number;
      }> = [];

      if (selectionsToCreate.length > 0) {
        const requestedPairs = new Map<
          string,
          { date: string; placement: ParentVolunteerPlacement }
        >();
        for (const selection of requestedSelections) {
          requestedPairs.set(`${selection.placement}:${selection.date}`, {
            date: selection.date,
            placement: selection.placement,
          });
        }

        const existingReservations = await ctx.db.parentVolunteerDay.findMany({
          where: {
            OR: [...requestedPairs.values()].map(({ date, placement }) => ({
              date: dateFromKey(date),
              placement,
            })),
          },
          select: { date: true, placement: true, slot: true },
        });
        const occupiedSlotsByPlacementDate = new Map<string, Set<number>>();
        for (const reservation of existingReservations) {
          const key = `${reservation.placement}:${dateKey(reservation.date)}`;
          const occupiedSlots = occupiedSlotsByPlacementDate.get(key) ?? new Set<number>();
          occupiedSlots.add(reservation.slot);
          occupiedSlotsByPlacementDate.set(key, occupiedSlots);
        }

        recordsToCreate = selectionsToCreate.map((selection) => {
          const date = dateFromKey(selection.date);
          const key = `${selection.placement}:${selection.date}`;
          const occupiedSlots = occupiedSlotsByPlacementDate.get(key) ?? new Set<number>();
          const capacity = PARENT_VOLUNTEER_PLACEMENTS[selection.placement].dailyCapacity;
          const slot = Array.from({ length: capacity }, (_, index) => index + 1).find(
            (candidate) => !occupiedSlots.has(candidate),
          );
          if (!slot) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `${selection.date} already has no ${PARENT_VOLUNTEER_PLACEMENTS[selection.placement].label.toLowerCase()} spaces`,
            });
          }
          occupiedSlots.add(slot);
          occupiedSlotsByPlacementDate.set(key, occupiedSlots);

          return {
            parentUserId: ctx.user.id,
            date,
            placement: selection.placement,
            slot,
          };
        });
      }

      try {
        await ctx.db.$transaction(async (tx) => {
          if (scope === 'staff') {
            const accessAllowed = await lockStaffParentVolunteerEligibility(tx, ctx.user.id, true);
            if (!accessAllowed) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'parent volunteer access is not available',
              });
            }
          }

        if (recordsToRemove.length > 0) {
          await tx.parentVolunteerDay.deleteMany({
            where: { id: { in: recordsToRemove.map((row) => row.id) } },
          });
        }
        if (recordsToCreate.length > 0) {
          await tx.parentVolunteerDay.createMany({ data: recordsToCreate });
        }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more days were just filled. Refresh and choose another day.',
          });
        }
        throw error;
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'ParentVolunteerDay',
          entityId: ctx.user.id,
          meta: {
            addedSelections: selectionsToCreate,
            removedSelections: recordsToRemove.map((row) => ({
              date: dateKey(row.date),
              placement: row.placement,
            })),
            source: 'rota.setMyParentVolunteerDays',
          },
        },
      });

      return listParentVolunteerSlots(ctx, scope);
    }),

  parentVolunteerSchedule: adminOperationsProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const from = normalizeDate(input.from);
      const to = normalizeDate(input.to);
      const rows = await ctx.db.parentVolunteerDay.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: [{ date: 'asc' }, { slot: 'asc' }],
        include: {
          parentUser: { select: { id: true, fullNameEnc: true } },
        },
      });
      const volunteers = rows.map((row) => ({
        id: row.id,
        date: dateKey(row.date),
        placement: row.placement,
        parent: {
          id: row.parentUser.id,
          fullName: decryptRequired(ctx.db.$enc.decrypt, row.parentUser.fullNameEnc, 'parent'),
        },
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ParentVolunteerDay',
          meta: { count: volunteers.length, source: 'rota.parentVolunteerSchedule' },
        },
      });

      return volunteers;
    }),

  myRota: authedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    assertStaffWorkflow(ctx.user);
    const from = normalizeDate(input.from);
    const to = normalizeDate(input.to);
    const rows = await ctx.db.staffShift.findMany({
      where: {
        staffUserId: ctx.user.id,
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
      select: {
        id: true,
        staffUserId: true,
        kind: true,
        yearGroupBandId: true,
        date: true,
        startsAt: true,
        endsAt: true,
        notes: true,
        yearGroupBand: { select: { name: true, colour: true } },
      },
    });
    return rows.map(mapShift);
  }),

  swapCandidates: authedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    assertStaffWorkflow(ctx.user);
    const from = normalizeDate(input.from);
    const to = normalizeDate(input.to);
    const rows = await ctx.db.staffShift.findMany({
      where: {
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
      include: {
        staffUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        yearGroupBand: { select: { name: true, colour: true } },
      },
    });

    const shifts = rows
      .filter((row) => row.staffUserId !== ctx.user.id)
      .map((row) => mapShiftWithStaff(ctx.db.$enc.decrypt, row));

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'StaffShift',
        meta: { count: shifts.length, source: 'rota.swapCandidates' },
      },
    });

    return shifts;
  }),

  teamSchedule: authedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    assertStaffWorkflow(ctx.user);
    return listScheduleWithStaff(ctx, input, 'rota.teamSchedule', true);
  }),

  weekSchedule: adminOperationsProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    return listScheduleWithStaff(ctx, input, 'rota.weekSchedule');
  }),

  listStaff: adminOperationsProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.user.findMany({
      where: { active: true, role: { in: [...STAFF_ROLES] } },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        role: true,
        fullNameEnc: true,
        emailEnc: true,
      },
    });

    const staff = rows.map((row) => mapStaffUser(ctx.db.$enc.decrypt, row));

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: staff.length, source: 'rota.listStaff' },
      },
    });

    return staff;
  }),

  staffAvailability: adminOperationsProcedure
    .input(staffAvailabilityInput)
    .query(async ({ ctx, input }) => {
      const staffRows = await ctx.db.user.findMany({
        where: {
          active: true,
          role: { in: [...STAFF_ROLES] },
          ...(input?.staffUserIds ? { id: { in: input.staffUserIds } } : {}),
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          role: true,
          fullNameEnc: true,
          emailEnc: true,
        },
      });
      const staffIds = staffRows.map((row) => row.id);
      const windows = await ctx.db.staffAvailabilityWindow.findMany({
        where: { staffUserId: { in: staffIds } },
        orderBy: [{ staffUserId: 'asc' }, { dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        select: {
          id: true,
          staffUserId: true,
          dayOfWeek: true,
          startMinute: true,
          endMinute: true,
        },
      });

      const staff = staffRows.map((row) => ({
        ...mapStaffUser(ctx.db.$enc.decrypt, row),
        availability: windows
          .filter((window) => window.staffUserId === row.id)
          .map((window) => ({
            id: window.id,
            dayOfWeek: window.dayOfWeek,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          })),
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'StaffAvailability',
          meta: { count: staff.length, source: 'rota.staffAvailability' },
        },
      });

      return staff;
    }),

  staffMonthlyAvailability: adminOperationsProcedure
    .input(staffMonthlyAvailabilityInput)
    .query(async ({ ctx, input }) => {
      const from = normalizeDate(input.from);
      const to = normalizeDate(input.to);
      const staffRows = await ctx.db.user.findMany({
        where: {
          active: true,
          role: { in: [...STAFF_ROLES] },
          ...(input.staffUserIds ? { id: { in: input.staffUserIds } } : {}),
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          role: true,
          fullNameEnc: true,
          emailEnc: true,
        },
      });
      const staffIds = staffRows.map((row) => row.id);
      const windows = await ctx.db.staffMonthlyAvailabilityWindow.findMany({
        where: {
          staffUserId: { in: staffIds },
          date: { gte: from, lte: to },
        },
        orderBy: [{ staffUserId: 'asc' }, { date: 'asc' }, { startMinute: 'asc' }],
        select: {
          id: true,
          staffUserId: true,
          date: true,
          startMinute: true,
          endMinute: true,
        },
      });

      const staff = staffRows.map((row) => ({
        ...mapStaffUser(ctx.db.$enc.decrypt, row),
        availability: windows
          .filter((window) => window.staffUserId === row.id)
          .map((window) => ({
            id: window.id,
            date: dateKey(window.date),
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          })),
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'StaffMonthlyAvailability',
          meta: { count: staff.length, source: 'rota.staffMonthlyAvailability' },
        },
      });

      return staff;
    }),

  createShift: adminOperationsProcedure.input(shiftInput).mutation(async ({ ctx, input }) => {
    const date = normalizeDate(input.date);
    await assertRotaDate(ctx.db, date);
    assertShiftKindBand({ kind: input.kind, yearGroupBandId: input.yearGroupBandId ?? null });
    await assertActiveStaffUser(ctx, input.staffUserId);
    const yearGroupBandId = input.kind === 'Cover' ? (input.yearGroupBandId ?? null) : null;
    if (input.kind === 'Cover' && yearGroupBandId) {
      await assertActiveBand(ctx, yearGroupBandId);
    }
    await assertNoShiftOverlap(ctx, { ...input, date });

    const shift = await ctx.db.staffShift.create({
      data: {
        staffUserId: input.staffUserId,
        kind: input.kind,
        yearGroupBandId,
        date,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes ?? null,
      },
      include: { yearGroupBand: { select: { name: true, colour: true } } },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'StaffShift',
        entityId: shift.id,
        meta: {
          staffUserId: shift.staffUserId,
          kind: shift.kind,
          yearGroupBandId: shift.yearGroupBandId,
          date: dateKey(shift.date),
          startsAt: shift.startsAt.toISOString(),
          endsAt: shift.endsAt.toISOString(),
        },
      },
    });

    return mapShift(shift);
  }),

  updateShift: adminOperationsProcedure.input(updateShiftInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.staffShift.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        staffUserId: true,
        kind: true,
        yearGroupBandId: true,
        date: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'supervisor shift not found' });
    }

    const next = {
      staffUserId: input.staffUserId ?? existing.staffUserId,
      kind: input.kind ?? existing.kind,
      yearGroupBandId: input.yearGroupBandId ?? existing.yearGroupBandId,
      date: normalizeDate(input.date ?? existing.date),
      startsAt: input.startsAt ?? existing.startsAt,
      endsAt: input.endsAt ?? existing.endsAt,
    };
    if (next.startsAt.getTime() >= next.endsAt.getTime()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'startsAt must be before endsAt' });
    }

    await assertRotaDate(ctx.db, next.date);
    assertShiftKindBand(next);
    await assertActiveStaffUser(ctx, next.staffUserId);
    if (next.kind === 'Cover' && next.yearGroupBandId) {
      await assertActiveBand(ctx, next.yearGroupBandId);
    }
    await assertNoShiftOverlap(ctx, { ...next, exceptShiftId: existing.id });

    const data = {
      ...(input.staffUserId !== undefined ? { staffUserId: input.staffUserId } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(next.kind === 'Meeting'
        ? { yearGroupBandId: null }
        : input.yearGroupBandId !== undefined
          ? { yearGroupBandId: input.yearGroupBandId }
          : {}),
      ...(input.date !== undefined ? { date: next.date } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };

    const shift = await ctx.db.staffShift.update({
      where: { id: input.id },
      data,
      include: { yearGroupBand: { select: { name: true, colour: true } } },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'StaffShift',
        entityId: shift.id,
        meta: {
          fields: Object.keys(data).sort(),
          staffUserId: shift.staffUserId,
          kind: shift.kind,
          yearGroupBandId: shift.yearGroupBandId,
          date: dateKey(shift.date),
        },
      },
    });

    return mapShift(shift);
  }),

  deleteShift: adminOperationsProcedure.input(deleteShiftInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.staffShift.findUnique({
      where: { id: input.id },
      select: { id: true, staffUserId: true, date: true },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'supervisor shift not found' });
    }

    const pendingSwap = await ctx.db.shiftSwapRequest.findFirst({
      where: {
        status: 'Pending',
        OR: [{ fromShiftId: input.id }, { toShiftId: input.id }],
      },
      select: { id: true },
    });
    if (pendingSwap) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'shift has a pending swap request',
      });
    }

    const shift = await ctx.db.staffShift.delete({ where: { id: input.id } });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Delete',
        entity: 'StaffShift',
        entityId: shift.id,
        meta: {
          staffUserId: shift.staffUserId,
          date: dateKey(shift.date),
          source: 'rota.deleteShift',
        },
      },
    });

    return { id: shift.id };
  }),

  pendingSwapRequests: adminOperationsProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.shiftSwapRequest.findMany({
      where: { status: 'Pending' },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        requester: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        targetUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        fromShift: {
          include: {
            staffUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
            yearGroupBand: { select: { name: true, colour: true } },
          },
        },
        toShift: {
          include: {
            staffUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
            yearGroupBand: { select: { name: true, colour: true } },
          },
        },
      },
    });

    const requests = rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      requester: mapStaffUser(ctx.db.$enc.decrypt, row.requester),
      targetUser: mapStaffUser(ctx.db.$enc.decrypt, row.targetUser),
      fromShift: mapShiftWithStaff(ctx.db.$enc.decrypt, row.fromShift),
      toShift: mapShiftWithStaff(ctx.db.$enc.decrypt, row.toShift),
    }));

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'ShiftSwapRequest',
        meta: { count: requests.length, source: 'rota.pendingSwapRequests' },
      },
    });

    return requests;
  }),

  mySwapRequests: authedProcedure.query(async ({ ctx }) => {
    assertStaffWorkflow(ctx.user);
    const rows = await ctx.db.shiftSwapRequest.findMany({
      where: {
        status: 'Pending',
        OR: [{ requesterUserId: ctx.user.id }, { targetUserId: ctx.user.id }],
      },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        requester: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        targetUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        fromShift: {
          include: {
            staffUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
            yearGroupBand: { select: { name: true, colour: true } },
          },
        },
        toShift: {
          include: {
            staffUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
            yearGroupBand: { select: { name: true, colour: true } },
          },
        },
      },
    });

    const requests = rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      direction:
        row.requesterUserId === ctx.user.id ? ('Requested' as const) : ('Incoming' as const),
      requester: mapStaffUser(ctx.db.$enc.decrypt, row.requester),
      targetUser: mapStaffUser(ctx.db.$enc.decrypt, row.targetUser),
      fromShift: mapShiftWithStaff(ctx.db.$enc.decrypt, row.fromShift),
      toShift: mapShiftWithStaff(ctx.db.$enc.decrypt, row.toShift),
    }));

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'ShiftSwapRequest',
        meta: { count: requests.length, source: 'rota.mySwapRequests' },
      },
    });

    return requests;
  }),

  requestSwap: authedProcedure.input(requestSwapInput).mutation(async ({ ctx, input }) => {
    assertStaffWorkflow(ctx.user);
    if (input.fromShiftId === input.toShiftId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'cannot swap a shift with itself' });
    }

    const [fromShift, toShift] = await Promise.all([
      ctx.db.staffShift.findUnique({
        where: { id: input.fromShiftId },
        select: { id: true, staffUserId: true },
      }),
      ctx.db.staffShift.findUnique({
        where: { id: input.toShiftId },
        select: { id: true, staffUserId: true },
      }),
    ]);
    if (!fromShift || !toShift) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shift not found' });
    }
    if (fromShift.staffUserId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'requester must own fromShiftId' });
    }
    if (toShift.staffUserId === ctx.user.id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'cannot request a swap with yourself' });
    }

    const pending = await ctx.db.shiftSwapRequest.findFirst({
      where: {
        status: 'Pending',
        OR: [
          { fromShiftId: input.fromShiftId },
          { toShiftId: input.fromShiftId },
          { fromShiftId: input.toShiftId },
          { toShiftId: input.toShiftId },
        ],
      },
      select: { id: true },
    });
    if (pending) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'shift already has a pending swap' });
    }

    const request = await ctx.db.shiftSwapRequest.create({
      data: {
        requesterUserId: ctx.user.id,
        targetUserId: toShift.staffUserId,
        fromShiftId: input.fromShiftId,
        toShiftId: input.toShiftId,
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'ShiftSwapRequest',
        entityId: request.id,
        meta: {
          requesterUserId: request.requesterUserId,
          targetUserId: request.targetUserId,
          fromShiftId: request.fromShiftId,
          toShiftId: request.toShiftId,
        },
      },
    });

    return request;
  }),

  approveSwap: adminOperationsProcedure.input(reviewSwapInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.shiftSwapRequest.findUnique({
      where: { id: input.id },
      include: {
        fromShift: { select: { id: true, staffUserId: true } },
        toShift: { select: { id: true, staffUserId: true } },
      },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shift swap request not found' });
    }
    if (existing.status !== 'Pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'shift swap request is already reviewed',
      });
    }
    if (
      existing.fromShift.staffUserId !== existing.requesterUserId ||
      existing.toShift.staffUserId !== existing.targetUserId
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'shift assignments changed since request',
      });
    }

    const reviewedAt = new Date();
    const request = await ctx.db.$transaction(async (tx) => {
      await tx.staffShift.update({
        where: { id: existing.fromShiftId },
        data: { staffUserId: existing.targetUserId },
      });
      await tx.staffShift.update({
        where: { id: existing.toShiftId },
        data: { staffUserId: existing.requesterUserId },
      });
      return tx.shiftSwapRequest.update({
        where: { id: existing.id },
        data: { status: 'Approved', approvedById: ctx.user.id, reviewedAt },
      });
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'ShiftSwapRequest',
        entityId: request.id,
        meta: {
          status: request.status,
          fromShiftId: request.fromShiftId,
          toShiftId: request.toShiftId,
          source: 'rota.approveSwap',
        },
      },
    });

    return request;
  }),

  rejectSwap: adminOperationsProcedure.input(reviewSwapInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.shiftSwapRequest.findUnique({
      where: { id: input.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shift swap request not found' });
    }
    if (existing.status !== 'Pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'shift swap request is already reviewed',
      });
    }

    const request = await ctx.db.shiftSwapRequest.update({
      where: { id: existing.id },
      data: { status: 'Rejected', approvedById: ctx.user.id, reviewedAt: new Date() },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'ShiftSwapRequest',
        entityId: request.id,
        meta: {
          status: request.status,
          fromShiftId: request.fromShiftId,
          toShiftId: request.toShiftId,
          source: 'rota.rejectSwap',
        },
      },
    });

    return request;
  }),
});
