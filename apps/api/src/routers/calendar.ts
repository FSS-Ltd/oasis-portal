import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  canManageCalendar,
  isFullAdmin,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const calendarAudienceSchema = z.enum(['All', 'Parents', 'Supervisors', 'Heads']);
type CalendarAudience = z.infer<typeof calendarAudienceSchema>;
const calendarCategorySchema = z.enum([
  'HalfTerm',
  'Trips',
  'OasisDays',
  'Birthdays',
  'Meetings',
  'Trainings',
]);
type CalendarCategory = z.infer<typeof calendarCategorySchema>;
const manualCalendarCategorySchema = calendarCategorySchema.exclude(['Birthdays']);

interface CalendarEventRow {
  id: string;
  title: string;
  descriptionEnc: string | null;
  audience: CalendarAudience;
  category: CalendarCategory;
  startDate: Date;
  endDate: Date;
  startTimeMinutes: number | null;
  endTimeMinutes: number | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid date');
const timeKeySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Enter a valid time');

const calendarEventInput = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(160, 'Title is too long'),
  description: z.string().trim().max(4000, 'Description is too long').optional(),
  audience: calendarAudienceSchema.default('All'),
  category: manualCalendarCategorySchema.default('OasisDays'),
  startDate: dateKeySchema,
  endDate: dateKeySchema.optional(),
  startTime: timeKeySchema.optional(),
  endTime: timeKeySchema.optional(),
});

const updateCalendarEventInput = calendarEventInput.extend({
  id: z.string().min(1),
});

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireCalendarManager(user: SessionUser): void {
  if (canManageCalendar(user)) return;
  throw toForbidden(
    new AccessDeniedError('calendar management requires Head or calendar-manager staff tag'),
  );
}

function requireHeadAudienceManager(user: SessionUser, audience: CalendarAudience): void {
  if (audience !== 'Heads' || isFullAdmin(user)) return;
  throw toForbidden(
    new AccessDeniedError(
      'head-only calendar dates require Head, Principal, Pastor, or Head of Discipline',
    ),
  );
}

function requireStaffCalendarReader(user: SessionUser): void {
  if (isStaff(user)) return;
  throw toForbidden(new AccessDeniedError('staff calendar requires full-admin or Supervisor'));
}

function requireParentCalendarReader(user: SessionUser): void {
  if (user.role === 'Parent' || isFullAdmin(user)) return;
  throw toForbidden(new AccessDeniedError('parent calendar requires Parent or full-admin'));
}

function dateFromKey(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter a valid date' });
  }
  return date;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function timeFromMinutes(value: number | null): string | null {
  if (value === null) return null;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function minutesFromTime(value: string): number {
  const [hoursValue, minutesValue] = value.split(':');
  return Number(hoursValue) * 60 + Number(minutesValue);
}

function normaliseDescription(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateDateRange(startDate: Date, endDate: Date): void {
  if (endDate < startDate) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'calendar end date must be on or after start date',
    });
  }
}

function validateTimeRange(input: {
  endDate: Date;
  endTime: string | undefined;
  startDate: Date;
  startTime: string | undefined;
}): { endTimeMinutes: number | null; startTimeMinutes: number | null } {
  const hasStartTime = input.startTime !== undefined;
  const hasEndTime = input.endTime !== undefined;
  if (!hasStartTime && !hasEndTime) return { startTimeMinutes: null, endTimeMinutes: null };
  if (!hasStartTime || !hasEndTime) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'calendar time range requires both start and end time',
    });
  }
  const startTime = input.startTime;
  const endTime = input.endTime;
  if (!startTime || !endTime) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'calendar time range requires both start and end time',
    });
  }
  if (dateKey(input.startDate) !== dateKey(input.endDate)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'calendar time range is only available for single-date events',
    });
  }

  const startTimeMinutes = minutesFromTime(startTime);
  const endTimeMinutes = minutesFromTime(endTime);
  if (endTimeMinutes <= startTimeMinutes) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'calendar end time must be after start time',
    });
  }
  return { startTimeMinutes, endTimeMinutes };
}

function decryptOptional(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null,
): string | null {
  if (!value) return null;
  return decrypt(value);
}

function mapCalendarEvent(ctx: AuthedContext, event: CalendarEventRow) {
  return {
    id: event.id,
    title: event.title,
    description: decryptOptional(ctx.db.$enc.decrypt, event.descriptionEnc),
    audience: event.audience,
    category: event.category,
    startDate: dateKey(event.startDate),
    endDate: dateKey(event.endDate),
    startTime: timeFromMinutes(event.startTimeMinutes),
    endTime: timeFromMinutes(event.endTimeMinutes),
    active: event.active,
    createdById: event.createdById,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    source: 'Manual' as const,
  };
}

function activeAudienceWhere(audiences: readonly CalendarAudience[]) {
  return {
    active: true,
    audience: { in: [...audiences] },
  };
}

function visibleAudiencesFor(user: SessionUser): readonly CalendarAudience[] {
  if (user.role === 'Parent') return ['All', 'Parents'];
  if (isFullAdmin(user)) return ['All', 'Supervisors', 'Heads'];
  if (isStaff(user)) return ['All', 'Supervisors'];
  return ['All'];
}

function adminEventWhere(user: SessionUser) {
  if (isFullAdmin(user)) return undefined;
  return { audience: { not: 'Heads' as const } };
}

function eventDataFromInput(
  ctx: AuthedContext,
  input: z.infer<typeof calendarEventInput>,
): {
  title: string;
  descriptionEnc: string | null;
  audience: CalendarAudience;
  category: Exclude<CalendarCategory, 'Birthdays'>;
  startDate: Date;
  endDate: Date;
  startTimeMinutes: number | null;
  endTimeMinutes: number | null;
} {
  const startDate = dateFromKey(input.startDate);
  const endDate = dateFromKey(input.endDate ?? input.startDate);
  validateDateRange(startDate, endDate);
  requireHeadAudienceManager(ctx.user, input.audience);
  const timeRange = validateTimeRange({
    startDate,
    endDate,
    startTime: input.startTime,
    endTime: input.endTime,
  });
  const description = normaliseDescription(input.description);

  return {
    title: input.title,
    descriptionEnc: description ? ctx.db.$enc.encrypt(description) : null,
    audience: input.audience,
    category: input.category,
    startDate,
    endDate,
    ...timeRange,
  };
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

function birthdayDateForYear(dob: string, year: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dob);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
    return dateKey(candidate);
  }
  if (month === 2 && day === 29) return `${String(year)}-02-28`;
  return null;
}

function birthdayYears(): number[] {
  const currentYear = new Date().getUTCFullYear();
  return [currentYear - 1, currentYear, currentYear + 1];
}

function mapBirthdayEvent(input: {
  date: string;
  id: string;
  name: string;
  personType: 'Student' | 'Supervisor';
}) {
  const date = dateFromKey(input.date);
  return {
    id: `birthday:${input.personType.toLowerCase()}:${input.id}:${input.date.slice(0, 4)}`,
    title: `${input.name}'s birthday`,
    description: null,
    audience: 'Heads' as const,
    category: 'Birthdays' as const,
    startDate: input.date,
    endDate: input.date,
    startTime: null,
    endTime: null,
    active: true,
    createdById: 'system',
    createdAt: date,
    updatedAt: date,
    source: 'Birthday' as const,
    personType: input.personType,
  };
}

async function listBirthdayEvents(ctx: AuthedContext) {
  if (!isFullAdmin(ctx.user)) return [];
  const [students, supervisors] = await Promise.all([
    ctx.db.student.findMany({
      where: { active: true },
      select: { id: true, fullNameEnc: true, dobEnc: true },
      orderBy: [{ createdAt: 'asc' }],
    }),
    ctx.db.user.findMany({
      where: { active: true, role: 'Supervisor', dobEnc: { not: null } },
      select: { id: true, fullNameEnc: true, dobEnc: true },
      orderBy: [{ createdAt: 'asc' }],
    }),
  ]);
  const years = birthdayYears();

  return [
    ...students.flatMap((student) => {
      const name = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII');
      const dob = decryptRequired(ctx.db.$enc.decrypt, student.dobEnc, 'student PII');
      return years.flatMap((year) => {
        const date = birthdayDateForYear(dob, year);
        return date
          ? [mapBirthdayEvent({ id: student.id, name, date, personType: 'Student' })]
          : [];
      });
    }),
    ...supervisors.flatMap((supervisor) => {
      if (!supervisor.dobEnc) return [];
      const name = decryptRequired(ctx.db.$enc.decrypt, supervisor.fullNameEnc, 'user PII');
      const dob = decryptRequired(ctx.db.$enc.decrypt, supervisor.dobEnc, 'user PII');
      return years.flatMap((year) => {
        const date = birthdayDateForYear(dob, year);
        return date
          ? [mapBirthdayEvent({ id: supervisor.id, name, date, personType: 'Supervisor' })]
          : [];
      });
    }),
  ].sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title),
  );
}

function sortCalendarEvents<
  T extends { active: boolean; createdAt: Date; startDate: string; title: string },
>(events: readonly T[]): T[] {
  return [...events].sort(
    (left, right) =>
      Number(right.active) - Number(left.active) ||
      left.startDate.localeCompare(right.startDate) ||
      right.createdAt.getTime() - left.createdAt.getTime() ||
      left.title.localeCompare(right.title),
  );
}

async function assertCalendarEventCanBeManaged(ctx: AuthedContext, id: string): Promise<void> {
  const event = await ctx.db.calendarEvent.findUnique({
    where: { id },
    select: { id: true, audience: true },
  });
  if (!event) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'calendar event not found' });
  }
  requireHeadAudienceManager(ctx.user, event.audience);
}

export const calendarRouter = router({
  listForAdmin: authedProcedure.query(async ({ ctx }) => {
    requireCalendarManager(ctx.user);
    const where = adminEventWhere(ctx.user);

    const events = await ctx.db.calendarEvent.findMany({
      ...(where ? { where } : {}),
      orderBy: [{ active: 'desc' }, { startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return sortCalendarEvents([
      ...events.map((event) => mapCalendarEvent(ctx, event)),
      ...(await listBirthdayEvents(ctx)),
    ]);
  }),

  listForStaff: authedProcedure.query(async ({ ctx }) => {
    requireStaffCalendarReader(ctx.user);

    const events = await ctx.db.calendarEvent.findMany({
      where: activeAudienceWhere(visibleAudiencesFor(ctx.user)),
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return sortCalendarEvents([
      ...events.map((event) => mapCalendarEvent(ctx, event)),
      ...(await listBirthdayEvents(ctx)),
    ]);
  }),

  listForParents: authedProcedure.query(async ({ ctx }) => {
    requireParentCalendarReader(ctx.user);

    const events = await ctx.db.calendarEvent.findMany({
      where: activeAudienceWhere(['All', 'Parents']),
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return sortCalendarEvents(events.map((event) => mapCalendarEvent(ctx, event)));
  }),

  listVisible: authedProcedure.query(async ({ ctx }) => {
    const events = await ctx.db.calendarEvent.findMany({
      where: activeAudienceWhere(visibleAudiencesFor(ctx.user)),
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return sortCalendarEvents([
      ...events.map((event) => mapCalendarEvent(ctx, event)),
      ...(await listBirthdayEvents(ctx)),
    ]);
  }),

  create: authedProcedure.input(calendarEventInput).mutation(async ({ ctx, input }) => {
    requireCalendarManager(ctx.user);

    const event = await ctx.db.calendarEvent.create({
      data: {
        ...eventDataFromInput(ctx, input),
        active: true,
        createdById: ctx.user.id,
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'CalendarEvent',
        entityId: event.id,
        meta: {
          source: 'calendar.create',
          audience: event.audience,
          category: event.category,
          startDate: dateKey(event.startDate),
          endDate: dateKey(event.endDate),
          startTime: timeFromMinutes(event.startTimeMinutes),
          endTime: timeFromMinutes(event.endTimeMinutes),
        },
      },
    });

    return mapCalendarEvent(ctx, event);
  }),

  update: authedProcedure.input(updateCalendarEventInput).mutation(async ({ ctx, input }) => {
    requireCalendarManager(ctx.user);
    await assertCalendarEventCanBeManaged(ctx, input.id);

    const event = await ctx.db.calendarEvent.update({
      where: { id: input.id },
      data: eventDataFromInput(ctx, input),
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'CalendarEvent',
        entityId: event.id,
        meta: {
          source: 'calendar.update',
          audience: event.audience,
          category: event.category,
          startDate: dateKey(event.startDate),
          endDate: dateKey(event.endDate),
          startTime: timeFromMinutes(event.startTimeMinutes),
          endTime: timeFromMinutes(event.endTimeMinutes),
        },
      },
    });

    return mapCalendarEvent(ctx, event);
  }),

  archive: authedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireCalendarManager(ctx.user);
      await assertCalendarEventCanBeManaged(ctx, input.id);

      const event = await ctx.db.calendarEvent.update({
        where: { id: input.id },
        data: { active: false },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'CalendarEvent',
          entityId: event.id,
          meta: { source: 'calendar.archive' },
        },
      });

      return mapCalendarEvent(ctx, event);
    }),
});
