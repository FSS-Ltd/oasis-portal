import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  AccessDeniedError,
  canManageClubs,
  canSellInShop,
  canUseClubLeadAccess,
  requireStaff,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  dateKey,
  dayEnd,
  loadDailyYearBandScope,
  normalizeDate,
  studentWhereForDailyScope,
} from '../lib/daily-year-band-scope.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };
type AttendanceStatus = 'Present' | 'Absent' | 'Late';

const summaryInput = z
  .object({
    date: z.coerce.date().optional(),
  })
  .optional();

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireStaffHomeAccess(ctx: AuthedContext): void {
  try {
    requireStaff(ctx.user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function startOfWeek(date: Date): Date {
  const next = normalizeDate(date);
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() - day + 1);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function countAttendance(rows: Array<{ attendance: Array<{ status: AttendanceStatus }> }>) {
  const counts = {
    absent: 0,
    late: 0,
    marked: 0,
    present: 0,
    total: rows.length,
    unmarked: 0,
  };

  for (const row of rows) {
    const status = row.attendance[0]?.status ?? null;
    if (!status) {
      counts.unmarked += 1;
      continue;
    }

    counts.marked += 1;
    if (status === 'Present') counts.present += 1;
    if (status === 'Absent') counts.absent += 1;
    if (status === 'Late') counts.late += 1;
  }

  return counts;
}

function mapNextShift(
  shift:
    | {
        kind: 'Cover' | 'Meeting';
        yearGroupBand: { name: string; colour: string } | null;
        startsAt: Date;
        endsAt: Date;
      }
    | null
    | undefined,
) {
  if (!shift) return null;
  return {
    bandColour: shift.yearGroupBand?.colour ?? null,
    bandName: shift.yearGroupBand?.name ?? null,
    endsAt: shift.endsAt,
    kind: shift.kind,
    startsAt: shift.startsAt,
  };
}

export const staffHomeRouter = router({
  summary: authedProcedure.input(summaryInput).query(async ({ ctx, input }) => {
    requireStaffHomeAccess(ctx);

    const today = normalizeDate(input?.date ?? new Date());
    const tomorrow = dayEnd(today);
    const weekStart = startOfWeek(today);
    const weekEnd = addDays(weekStart, 6);
    const scope = await loadDailyYearBandScope(ctx, today);
    const canUseShopCounter = canSellInShop(ctx.user);
    const canManageClubsAccess = canManageClubs(ctx.user);
    const canUseClubLead = canUseClubLeadAccess(ctx.user);
    const canUseClubs = canManageClubsAccess || canUseClubLead;

    const [
      students,
      shiftsThisWeek,
      pendingSwapCount,
      behaviourCount,
      paceCount,
      notices,
      readyReservationCount,
      assignedClubCount,
    ] = await Promise.all([
      ctx.db.student.findMany({
        where: { active: true, ...studentWhereForDailyScope(scope) },
        select: {
          id: true,
          attendance: {
            where: { date: today },
            select: { status: true },
            take: 1,
          },
        },
      }),
      ctx.db.staffShift.findMany({
        where: {
          staffUserId: ctx.user.id,
          date: { gte: weekStart, lte: weekEnd },
        },
        orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
        select: {
          id: true,
          kind: true,
          date: true,
          startsAt: true,
          endsAt: true,
          yearGroupBand: { select: { name: true, colour: true } },
        },
      }),
      ctx.db.shiftSwapRequest.count({
        where: {
          status: 'Pending',
          OR: [{ requesterUserId: ctx.user.id }, { targetUserId: ctx.user.id }],
        },
      }),
      ctx.db.behaviourEntry.count({
        where: {
          recordedById: ctx.user.id,
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      ctx.db.paceRecord.count({
        where: {
          recordedById: ctx.user.id,
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      ctx.db.staffNotice.findMany({
        where: {
          active: true,
          audience: { in: ['Supervisors', 'Both'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          id: true,
          reads: {
            where: { userId: ctx.user.id },
            select: { userId: true },
            take: 1,
          },
        },
      }),
      canUseShopCounter
        ? ctx.db.shopReservation.count({ where: { status: 'Ready' } })
        : Promise.resolve(0),
      canUseClubs
        ? canManageClubs(ctx.user)
          ? ctx.db.club.count({ where: { active: true } })
          : ctx.db.clubLeadAssignment.count({
              where: { userId: ctx.user.id, club: { active: true } },
            })
        : Promise.resolve(0),
    ]);

    const shiftsToday = shiftsThisWeek.filter((shift) => dateKey(shift.date) === dateKey(today));
    const nextShift = shiftsThisWeek.find((shift) => shift.endsAt >= new Date()) ?? shiftsToday[0];

    return {
      attendance: countAttendance(students),
      behaviour: { entriesRecordedToday: behaviourCount },
      clubs: { assignedClubCount },
      date: dateKey(today),
      notices: {
        unread: notices.filter((notice) => notice.reads.length === 0).length,
      },
      pace: { testsRecordedToday: paceCount },
      permissions: {
        canManageClubs: canManageClubsAccess,
        canUseClubLeadAccess: canUseClubLead,
        canUseClubs,
        canUseShopCounter,
      },
      rota: {
        nextShift: mapNextShift(nextShift),
        pendingSwapCount,
        shiftsToday: shiftsToday.length,
        shiftsThisWeek: shiftsThisWeek.length,
      },
      shop: { readyReservationCount },
    };
  }),
});
