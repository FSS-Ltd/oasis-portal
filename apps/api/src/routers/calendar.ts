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

const calendarAudienceSchema = z.enum(['All', 'Parents', 'Supervisors']);
type CalendarAudience = z.infer<typeof calendarAudienceSchema>;

interface CalendarEventRow {
  id: string;
  title: string;
  descriptionEnc: string | null;
  audience: CalendarAudience;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid date');

const calendarEventInput = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(160, 'Title is too long'),
  description: z.string().trim().max(4000, 'Description is too long').optional(),
  audience: calendarAudienceSchema.default('All'),
  startDate: dateKeySchema,
  endDate: dateKeySchema.optional(),
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
    new AccessDeniedError('calendar management requires full-admin or calendar-manager'),
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
    startDate: dateKey(event.startDate),
    endDate: dateKey(event.endDate),
    active: event.active,
    createdById: event.createdById,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function activeAudienceWhere(audiences: readonly CalendarAudience[]) {
  return {
    active: true,
    audience: { in: [...audiences] },
  };
}

function eventDataFromInput(
  ctx: AuthedContext,
  input: z.infer<typeof calendarEventInput>,
): {
  title: string;
  descriptionEnc: string | null;
  audience: CalendarAudience;
  startDate: Date;
  endDate: Date;
} {
  const startDate = dateFromKey(input.startDate);
  const endDate = dateFromKey(input.endDate ?? input.startDate);
  validateDateRange(startDate, endDate);
  const description = normaliseDescription(input.description);

  return {
    title: input.title,
    descriptionEnc: description ? ctx.db.$enc.encrypt(description) : null,
    audience: input.audience,
    startDate,
    endDate,
  };
}

async function assertCalendarEventExists(ctx: AuthedContext, id: string): Promise<void> {
  const event = await ctx.db.calendarEvent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'calendar event not found' });
  }
}

export const calendarRouter = router({
  listForAdmin: authedProcedure.query(async ({ ctx }) => {
    requireCalendarManager(ctx.user);

    const events = await ctx.db.calendarEvent.findMany({
      orderBy: [{ active: 'desc' }, { startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return events.map((event) => mapCalendarEvent(ctx, event));
  }),

  listForStaff: authedProcedure.query(async ({ ctx }) => {
    requireStaffCalendarReader(ctx.user);

    const events = await ctx.db.calendarEvent.findMany({
      where: activeAudienceWhere(['All', 'Supervisors']),
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return events.map((event) => mapCalendarEvent(ctx, event));
  }),

  listForParents: authedProcedure.query(async ({ ctx }) => {
    requireParentCalendarReader(ctx.user);

    const events = await ctx.db.calendarEvent.findMany({
      where: activeAudienceWhere(['All', 'Parents']),
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return events.map((event) => mapCalendarEvent(ctx, event));
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
          startDate: dateKey(event.startDate),
          endDate: dateKey(event.endDate),
        },
      },
    });

    return mapCalendarEvent(ctx, event);
  }),

  update: authedProcedure.input(updateCalendarEventInput).mutation(async ({ ctx, input }) => {
    requireCalendarManager(ctx.user);
    await assertCalendarEventExists(ctx, input.id);

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
          startDate: dateKey(event.startDate),
          endDate: dateKey(event.endDate),
        },
      },
    });

    return mapCalendarEvent(ctx, event);
  }),

  archive: authedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireCalendarManager(ctx.user);
      await assertCalendarEventExists(ctx, input.id);

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
