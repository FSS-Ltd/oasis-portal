import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { isStaff, requireStaff, type SessionUser } from '@oasis/domain';
import { fullAdminProcedure, authedProcedure, router } from '../trpc.js';
import type { AppContext } from '../context.js';

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

const staffAvailabilityInput = z
  .object({
    staffUserIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .optional();

const dateRangeInput = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

const shiftBaseInput = z.object({
  staffUserId: z.string().min(1),
  yearGroupBandId: z.string().min(1),
  date: z.coerce.date(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

const shiftInput = shiftBaseInput.refine(
  (input) => input.startsAt.getTime() < input.endsAt.getTime(),
  {
    message: 'startsAt must be before endsAt',
    path: ['endsAt'],
  },
);

const updateShiftInput = shiftBaseInput
  .partial()
  .extend({
    id: z.string().min(1),
  })
  .refine(
    (input) =>
      input.staffUserId !== undefined ||
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

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
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
  user: { id: string; role: SessionUser['role']; fullNameEnc: string; emailEnc: string },
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
  yearGroupBandId: string;
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
    yearGroupBandId: string;
    date: Date;
    startsAt: Date;
    endsAt: Date;
    notes: string | null;
    staffUser?: {
      id: string;
      role: SessionUser['role'];
      fullNameEnc: string;
      emailEnc: string;
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

  weekSchedule: fullAdminProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    return listScheduleWithStaff(ctx, input, 'rota.weekSchedule');
  }),

  listStaff: fullAdminProcedure.query(async ({ ctx }) => {
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

  staffAvailability: fullAdminProcedure
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

  createShift: fullAdminProcedure.input(shiftInput).mutation(async ({ ctx, input }) => {
    const date = normalizeDate(input.date);
    await assertActiveStaffUser(ctx, input.staffUserId);
    await assertActiveBand(ctx, input.yearGroupBandId);
    await assertNoShiftOverlap(ctx, { ...input, date });

    const shift = await ctx.db.staffShift.create({
      data: {
        staffUserId: input.staffUserId,
        yearGroupBandId: input.yearGroupBandId,
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
          yearGroupBandId: shift.yearGroupBandId,
          date: dateKey(shift.date),
          startsAt: shift.startsAt.toISOString(),
          endsAt: shift.endsAt.toISOString(),
        },
      },
    });

    return mapShift(shift);
  }),

  updateShift: fullAdminProcedure.input(updateShiftInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.staffShift.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        staffUserId: true,
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
      yearGroupBandId: input.yearGroupBandId ?? existing.yearGroupBandId,
      date: normalizeDate(input.date ?? existing.date),
      startsAt: input.startsAt ?? existing.startsAt,
      endsAt: input.endsAt ?? existing.endsAt,
    };
    if (next.startsAt.getTime() >= next.endsAt.getTime()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'startsAt must be before endsAt' });
    }

    await assertActiveStaffUser(ctx, next.staffUserId);
    await assertActiveBand(ctx, next.yearGroupBandId);
    await assertNoShiftOverlap(ctx, { ...next, exceptShiftId: existing.id });

    const data = {
      ...(input.staffUserId !== undefined ? { staffUserId: input.staffUserId } : {}),
      ...(input.yearGroupBandId !== undefined ? { yearGroupBandId: input.yearGroupBandId } : {}),
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
          yearGroupBandId: shift.yearGroupBandId,
          date: dateKey(shift.date),
        },
      },
    });

    return mapShift(shift);
  }),

  pendingSwapRequests: fullAdminProcedure.query(async ({ ctx }) => {
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

  approveSwap: fullAdminProcedure.input(reviewSwapInput).mutation(async ({ ctx, input }) => {
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

  rejectSwap: fullAdminProcedure.input(reviewSwapInput).mutation(async ({ ctx, input }) => {
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
