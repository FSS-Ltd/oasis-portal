import { TRPCError } from '@trpc/server';
import { currentOasisAcademicPeriod, isOasisOperatingDay } from '@oasis/domain';
import type { AppContext } from '../context.js';
import { dateKey, normalizeDate } from './daily-year-band-scope.js';

export type OperationalDateStatus = {
  date: string;
  kind: 'operating' | 'fieldTrip' | 'closed';
  label: string;
};

type OperationalDateDb = Pick<AppContext['db'], 'calendarEvent'>;

function closedDateLabel(date: Date): string {
  const period = currentOasisAcademicPeriod(date);
  if (period?.kind === 'halfTerm') return 'Half term';
  if (period?.kind === 'holiday') return period.label;
  if (period?.kind === 'term') return 'Closed day';
  return 'Outside published term dates';
}

export async function operationalDateStatus(
  db: OperationalDateDb,
  inputDate: Date,
): Promise<OperationalDateStatus> {
  const date = normalizeDate(inputDate);
  if (isOasisOperatingDay(date)) {
    return { date: dateKey(date), kind: 'operating', label: 'Operating day' };
  }

  const trip = await db.calendarEvent.findFirst({
    where: {
      active: true,
      category: 'Trips',
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  });
  if (trip) return { date: dateKey(date), kind: 'fieldTrip', label: 'Planned field trip' };

  return { date: dateKey(date), kind: 'closed', label: closedDateLabel(date) };
}

export async function assertOperatingDate(db: OperationalDateDb, date: Date): Promise<void> {
  const status = await operationalDateStatus(db, date);
  if (status.kind === 'operating') return;
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `This action is only available on an operating day. ${status.label}.`,
  });
}

export async function assertRotaDate(db: OperationalDateDb, date: Date): Promise<void> {
  const status = await operationalDateStatus(db, date);
  if (status.kind !== 'closed') return;
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Rota shifts are only available on operating days or planned field trips. ${status.label}.`,
  });
}

export async function assertFieldTripAttendanceDate(
  db: OperationalDateDb,
  date: Date,
): Promise<void> {
  const status = await operationalDateStatus(db, date);
  if (status.kind !== 'closed') return;
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Field-trip attendance is only available on an operating day or planned field trip. ${status.label}.`,
  });
}
