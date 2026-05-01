import type { RouterOutputs } from '@/lib/trpc';

type DrillThrough = RouterOutputs['childLog']['drillThrough'];
type AttendanceEntry = DrillThrough['attendance'][number];
type AttendanceStatus = AttendanceEntry['status'];

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
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

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function displayMonth(attendance: readonly AttendanceEntry[], fallbackDateKey: string): Date {
  const latestDate = attendance.reduce<string | null>(
    (latest, entry) => (latest === null || entry.date > latest ? entry.date : latest),
    null,
  );
  return parseDateKey(latestDate ?? fallbackDateKey);
}

export function AttendanceCalendar({
  attendance,
  fallbackDateKey,
}: {
  attendance: readonly AttendanceEntry[];
  fallbackDateKey: string;
}) {
  const monthDate = displayMonth(attendance, fallbackDateKey);
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const statusByDate = new Map(attendance.map((entry) => [entry.date, entry.status]));

  return (
    <section className="panel panel__body student-attendance-calendar" aria-label="Attendance calendar">
      <h3>{monthLabel(monthDate)}</h3>
      <div className="student-attendance-calendar__grid">
        {WEEKDAY_LABELS.map((label, index) => (
          <span className="student-attendance-calendar__weekday" key={`${label}-${String(index)}`}>
            {label}
          </span>
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = new Date(Date.UTC(year, month, day));
          const dateKey = toDateKey(date);
          const status = statusByDate.get(dateKey);
          const className = [
            'student-attendance-calendar__day',
            statusClass(status),
            !status && isWeekend(date) ? 'is-weekend' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <time
              aria-label={`${dateKey}: ${statusLabel(status)}`}
              className={className}
              dateTime={dateKey}
              key={dateKey}
              title={statusLabel(status)}
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
      </div>
    </section>
  );
}

function AttendanceLegendItem({
  label,
  tone,
}: {
  label: string;
  tone: 'present' | 'absent' | 'late';
}) {
  return (
    <span className={`student-attendance-calendar__legend-item is-${tone}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
