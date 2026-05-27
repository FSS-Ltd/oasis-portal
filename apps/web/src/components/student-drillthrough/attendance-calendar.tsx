'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isOasisOperatingDay } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';

type DrillThrough = RouterOutputs['childLog']['drillThrough'];
type AttendanceEntry = DrillThrough['attendance'][number];
type AttendanceStatus = AttendanceEntry['status'];

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function compareMonth(left: Date, right: Date): number {
  return left.getUTCFullYear() * 12 + left.getUTCMonth() - (right.getUTCFullYear() * 12 + right.getUTCMonth());
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function statusClass(status: AttendanceStatus | undefined): string {
  if (status === 'Present') return 'is-present';
  if (status === 'Absent') return 'is-absent';
  if (status === 'Late') return 'is-late';
  return 'is-unrecorded';
}

function statusLabel(status: AttendanceStatus | undefined): string {
  return status ?? 'No record';
}

function calendarOffset(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function dayLabel(status: AttendanceStatus | undefined, closed: boolean): string {
  if (closed) return 'Centre closed';
  return statusLabel(status);
}

export function AttendanceCalendar({
  attendance,
  earliestDateKey,
  fallbackDateKey,
}: {
  attendance: readonly AttendanceEntry[];
  earliestDateKey: string;
  fallbackDateKey: string;
}) {
  const currentMonth = useMemo(() => monthStart(parseDateKey(fallbackDateKey)), [fallbackDateKey]);
  const earliestMonth = useMemo(() => monthStart(parseDateKey(earliestDateKey)), [earliestDateKey]);
  const [monthDate, setMonthDate] = useState(currentMonth);
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlankDays = calendarOffset(firstDay);
  const statusByDate = new Map(attendance.map((entry) => [entry.date, entry.status]));
  const canGoBack = compareMonth(monthDate, earliestMonth) > 0;
  const canGoForward = compareMonth(monthDate, currentMonth) < 0;

  return (
    <section className="panel panel__body student-attendance-calendar" aria-label="Attendance calendar">
      <div className="student-attendance-calendar__header">
        <h3>{monthLabel(monthDate)}</h3>
        <div className="student-attendance-calendar__controls">
          <button
            aria-label="View previous month"
            disabled={!canGoBack}
            onClick={() => {
              setMonthDate((value) => addMonths(value, -1));
            }}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="View next month"
            disabled={!canGoForward}
            onClick={() => {
              setMonthDate((value) => addMonths(value, 1));
            }}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <div className="student-attendance-calendar__grid">
        {WEEKDAY_LABELS.map((label, index) => (
          <span className="student-attendance-calendar__weekday" key={`${label}-${String(index)}`}>
            {label}
          </span>
        ))}
        {Array.from({ length: leadingBlankDays }, (_, index) => (
          <span aria-hidden="true" className="student-attendance-calendar__blank" key={`blank-${String(index)}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = new Date(Date.UTC(year, month, day));
          const dateKey = toDateKey(date);
          const status = statusByDate.get(dateKey);
          const closed = !isOasisOperatingDay(date);
          const className = [
            'student-attendance-calendar__day',
            closed ? 'is-closed' : statusClass(status),
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <time
              aria-label={`${dateKey}: ${dayLabel(status, closed)}`}
              className={className}
              dateTime={dateKey}
              key={dateKey}
              title={dayLabel(status, closed)}
            >
              {day}
            </time>
          );
        })}
      </div>
      <div className="student-attendance-calendar__legend" aria-label="Attendance legend">
        <AttendanceLegendItem label="Present" tone="present" />
        <AttendanceLegendItem label="Absent" tone="absent" />
        <AttendanceLegendItem label="Late" tone="late" />
        <AttendanceLegendItem label="Closed" tone="closed" />
      </div>
    </section>
  );
}

function AttendanceLegendItem({
  label,
  tone,
}: {
  label: string;
  tone: 'present' | 'absent' | 'late' | 'closed';
}) {
  return (
    <span className={`student-attendance-calendar__legend-item is-${tone}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
