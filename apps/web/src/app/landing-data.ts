import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { logOperationalEvent, operationalErrorMessage } from '@oasis/api';
import { prisma } from '@oasis/db';
import { attendanceRate, currentOasisTerm, type OasisTerm } from '@oasis/domain';

const DAY_MS = 24 * 60 * 60 * 1000;
const LANDING_EVENT_LIMIT = 4;
const LANDING_DATA_TIMEOUT_MS = 2_500;

export interface LandingCalendarEvent {
  date: Date;
  description: string | null;
  endDate: Date;
  id: string;
  title: string;
}

export interface LandingAttendanceWeek {
  attendanceRate: number | null;
  startDate: Date;
}

export interface LandingAttendanceSummary {
  absent: number;
  attendanceRate: number | null;
  late: number;
  present: number;
  total: number;
  weeks: LandingAttendanceWeek[];
}

export interface LandingVersePlaceholder {
  reference: string;
  text: string;
}

export interface LandingPageData {
  attendance: LandingAttendanceSummary;
  events: LandingCalendarEvent[];
  term: OasisTerm;
  versePlaceholder: LandingVersePlaceholder;
}

interface LandingDataFallbackOptions {
  event: string;
  message: string;
  meta: Record<string, string | number>;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekStart(date: Date): Date {
  const dayOffset = (date.getUTCDay() + 6) % 7;
  return addUtcDays(startOfUtcDay(date), -dayOffset);
}

function decryptCalendarDescription(value: string | null): string | null {
  if (!value) return null;
  const decrypted = prisma.$enc.decrypt(value);
  return decrypted && decrypted.trim().length > 0 ? decrypted : null;
}

function termWeekStarts(term: OasisTerm, referenceDate: Date): Date[] {
  const starts: Date[] = [];
  const end = minDate(startOfUtcDay(referenceDate), addUtcDays(term.to, -1));
  for (let cursor = weekStart(term.from); cursor <= end; cursor = addUtcDays(cursor, 7)) {
    starts.push(cursor);
  }
  return starts.slice(-6);
}

function emptyLandingAttendance(term: OasisTerm, today: Date): LandingAttendanceSummary {
  return {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    attendanceRate: null,
    weeks: termWeekStarts(term, today).map((startDate) => ({
      startDate,
      attendanceRate: null,
    })),
  };
}

function recordLandingDataFailure(options: LandingDataFallbackOptions, err: unknown): void {
  logOperationalEvent({
    event: options.event,
    level: 'warn',
    message: options.message,
    meta: { ...options.meta, error: operationalErrorMessage(err) },
  });
  Sentry.withScope((scope) => {
    scope.setTag('landing.data_source', options.event);
    for (const [key, value] of Object.entries(options.meta)) {
      scope.setTag(`landing.${key}`, String(value));
    }
    Sentry.captureException(err);
  });
}

async function withLandingDataFallback<T>(
  loader: Promise<T>,
  fallback: T,
  options: LandingDataFallbackOptions,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let recordedFailure = false;
  const recordFailureOnce = (err: unknown) => {
    if (recordedFailure) return;
    recordedFailure = true;
    recordLandingDataFailure(options, err);
  };
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      recordFailureOnce(
        new Error(`Landing data loader exceeded ${String(LANDING_DATA_TIMEOUT_MS)}ms`),
      );
      resolve(fallback);
    }, LANDING_DATA_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      loader.catch((err: unknown) => {
        recordFailureOnce(err);
        return fallback;
      }),
      timeout,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function loadLandingCalendarEvents(term: OasisTerm, today: Date) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      active: true,
      audience: { in: ['All', 'Parents'] },
      endDate: { gte: today },
      startDate: { lt: term.to },
      AND: [
        { category: { notIn: ['Meetings', 'Birthdays'] } },
        { OR: [{ category: { not: 'Trainings' } }, { audience: 'Parents' }] },
      ],
    },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      descriptionEnc: true,
      startDate: true,
      endDate: true,
    },
    take: LANDING_EVENT_LIMIT,
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: decryptCalendarDescription(event.descriptionEnc),
    date: event.startDate,
    endDate: event.endDate,
  }));
}

async function loadLandingAttendance(
  term: OasisTerm,
  today: Date,
): Promise<LandingAttendanceSummary> {
  const attendanceTo = minDate(addUtcDays(today, 1), term.to);
  const rows = await prisma.attendance.findMany({
    where: {
      date: { gte: term.from, lt: attendanceTo },
      student: { active: true },
    },
    select: { date: true, status: true },
  });

  const present = rows.filter((row) => row.status === 'Present').length;
  const absent = rows.filter((row) => row.status === 'Absent').length;
  const late = rows.filter((row) => row.status === 'Late').length;
  const total = rows.length;
  const weekCounts = new Map<string, { late: number; present: number; total: number }>();

  for (const row of rows) {
    const key = dateKey(weekStart(row.date));
    const current = weekCounts.get(key) ?? { late: 0, present: 0, total: 0 };
    current.total += 1;
    if (row.status === 'Present') current.present += 1;
    if (row.status === 'Late') current.late += 1;
    weekCounts.set(key, current);
  }

  return {
    total,
    present,
    absent,
    late,
    attendanceRate: attendanceRate({ late, present, total }, { decimalPlaces: 1 }),
    weeks: termWeekStarts(term, today).map((startDate) => {
      const counts = weekCounts.get(dateKey(startDate)) ?? { late: 0, present: 0, total: 0 };
      return {
        startDate,
        attendanceRate: attendanceRate(counts, { decimalPlaces: 1 }),
      };
    }),
  };
}

export async function loadLandingPageData(
  referenceDate: Date = new Date(),
): Promise<LandingPageData> {
  const term = currentOasisTerm(referenceDate);
  const today = startOfUtcDay(referenceDate);
  const emptyAttendance = emptyLandingAttendance(term, today);
  const [events, attendance] = await Promise.all([
    withLandingDataFallback(loadLandingCalendarEvents(term, today), [], {
      event: 'landing.calendar_data_failed',
      message: 'Landing calendar data failed',
      meta: { term: term.id },
    }),
    withLandingDataFallback(loadLandingAttendance(term, today), emptyAttendance, {
      event: 'landing.attendance_data_failed',
      message: 'Landing attendance data failed',
      meta: { term: term.id },
    }),
  ]);

  return {
    term,
    events,
    attendance,
    versePlaceholder: {
      text: 'Train up a child in the way he should go, And when he is old he will not depart from it.',
      reference: 'Proverbs 22:6 NKJV',
    },
  };
}
