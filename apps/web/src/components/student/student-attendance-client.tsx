'use client';

import { CalendarCheck, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { AttendanceCalendar } from '@/components/student-drillthrough/attendance-calendar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentAttendance = RouterOutputs['attendance']['studentSummary'];
type AttendanceRecord = StudentAttendance['records'][number];

const summaryCards = [
  { field: 'present', label: 'Present', icon: CheckCircle2, tone: 'green' },
  { field: 'late', label: 'Late', icon: Clock3, tone: 'amber' },
  { field: 'absent', label: 'Absent', icon: XCircle, tone: 'red' },
] as const satisfies readonly {
  field: keyof Pick<StudentAttendance['summary'], 'present' | 'late' | 'absent'>;
  label: string;
  icon: typeof CheckCircle2;
  tone: 'green' | 'amber' | 'red';
}[];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function statusTone(status: AttendanceRecord['status']): 'green' | 'amber' | 'red' {
  if (status === 'Present') return 'green';
  if (status === 'Late') return 'amber';
  return 'red';
}

function AttendanceSummaryCards({ summary }: { summary: StudentAttendance['summary'] }) {
  return (
    <section className="student-attendance-summary-grid" aria-label="Attendance totals">
      <article className="student-attendance-summary-card student-attendance-summary-card--rate">
        <CalendarCheck aria-hidden="true" size={18} />
        <small>Attendance rate</small>
        <strong>{summary.attendanceRate === null ? 'No records' : `${String(summary.attendanceRate)}%`}</strong>
        <span>
          {String(summary.attended)}/{String(summary.total)} attended days
        </span>
      </article>
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            className={`student-attendance-summary-card student-attendance-summary-card--${card.tone}`}
            key={card.field}
          >
            <Icon aria-hidden="true" size={18} />
            <small>{card.label}</small>
            <strong>{String(summary[card.field])}</strong>
            <span>{card.label.toLowerCase()} records</span>
          </article>
        );
      })}
    </section>
  );
}

function AttendanceRecordList({ records }: { records: readonly AttendanceRecord[] }) {
  if (records.length === 0) {
    return <div className="student-dashboard-empty">No attendance records in this range.</div>;
  }

  return (
    <div className="student-attendance-record-list" aria-label="Recent attendance records">
      {records.slice(0, 8).map((record) => (
        <article className="student-attendance-record" key={record.id}>
          <time dateTime={record.date}>{formatDate(record.date)}</time>
          <Badge tone={statusTone(record.status)}>{record.status}</Badge>
          <span>
            {record.status === 'Absent'
              ? (record.absenceReasonLabel ?? 'No absence reason recorded')
              : 'Recorded by the Learning Centre'}
          </span>
        </article>
      ))}
    </div>
  );
}

export function StudentAttendanceClient() {
  const attendance = api.attendance.studentSummary.useQuery(undefined, { retry: false });

  if (attendance.isLoading) {
    return <div className="student-inline-state">Loading attendance...</div>;
  }

  if (attendance.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(attendance.error)}
        title="Attendance unavailable"
      />
    );
  }

  if (!attendance.data) {
    return <EmptyState detail="No attendance data was returned." title="No attendance data" />;
  }

  return (
    <div className="student-page student-attendance-page">
      <section className="student-wallet-hero student-attendance-hero">
        <div>
          <p>Attendance</p>
          <h1>Attendance Summary</h1>
          <span>
            {formatDate(attendance.data.from)} to {formatDate(attendance.data.to)}
          </span>
        </div>
        <div className="student-attendance-hero__meta">
          <CalendarCheck aria-hidden="true" size={18} />
          <small>Recorded days</small>
          <strong>{String(attendance.data.summary.total)}</strong>
        </div>
      </section>

      <AttendanceSummaryCards summary={attendance.data.summary} />

      {attendance.data.records.length === 0 ? (
        <EmptyState
          detail="Attendance will appear here after the Learning Centre records it."
          title="No attendance recorded"
        />
      ) : (
        <div className="student-attendance-layout">
          <AttendanceCalendar
            attendance={attendance.data.records}
            earliestDateKey={attendance.data.from}
            fallbackDateKey={attendance.data.to}
          />
          <section className="student-dashboard-panel" aria-labelledby="student-attendance-recent-title">
            <div className="student-dashboard-panel__head">
              <div>
                <p>Recent records</p>
                <h2 id="student-attendance-recent-title">Attendance by date</h2>
              </div>
            </div>
            <AttendanceRecordList records={attendance.data.records} />
          </section>
        </div>
      )}
    </div>
  );
}
