'use client';

import { useMemo, useState } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { CheckCircle2, Clock3, RotateCcw, Save, XCircle } from 'lucide-react';
import {
  DailyDemeritBadge,
  useDailyDemeritStatusMap,
} from '@/components/behaviour/daily-demerit-badge';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { type ManagedClub, nextScheduledDate } from './club-schedule-utils';

type ClubAttendanceRow = RouterOutputs['club']['attendanceForSession']['students'][number];
type ClubAttendanceStatus = NonNullable<ClubAttendanceRow['status']>;

const statuses = [
  { value: 'Present', label: 'Present', icon: CheckCircle2 },
  { value: 'Late', label: 'Late', icon: Clock3 },
  { value: 'Absent', label: 'Absent', icon: XCircle },
] as const satisfies readonly {
  value: ClubAttendanceStatus;
  label: string;
  icon: typeof CheckCircle2;
}[];

function statusTone(status: ClubAttendanceStatus | null): 'amber' | 'green' | 'red' {
  if (status === 'Absent') return 'red';
  if (status) return 'green';
  return 'amber';
}

function statusLabel(status: ClubAttendanceStatus | null): string {
  return status ?? 'Unmarked';
}

export function ClubAttendancePanel({ club }: { club: ManagedClub }) {
  const utils = api.useUtils();
  const [selectedDate, setSelectedDate] = useState(() => nextScheduledDate(club));
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [pendingAll, setPendingAll] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const date = useMemo(() => new Date(`${selectedDate}T00:00:00.000Z`), [selectedDate]);
  const attendanceQuery = api.club.attendanceForSession.useQuery(
    { clubId: club.id, date },
    { retry: false },
  );
  const operationalDatesQuery = api.calendar.operationalDates.useQuery(
    { dates: [date] },
    {
      retry: false,
    },
  );
  const demeritStatusQuery = useDailyDemeritStatusMap(date, true, club.id);
  const markAttendance = api.club.markAttendance.useMutation();
  const resetAttendance = api.club.resetAttendanceForSession.useMutation();
  const rows = attendanceQuery.data?.students ?? [];
  const dateStatus = operationalDatesQuery.data?.[0];
  const canRecordForDate = dateStatus?.kind === 'operating';
  const counts = rows.reduce(
    (totals, row) => {
      if (row.status === 'Present') totals.present += 1;
      else if (row.status === 'Late') totals.late += 1;
      else if (row.status === 'Absent') totals.absent += 1;
      else totals.unmarked += 1;
      return totals;
    },
    { absent: 0, late: 0, present: 0, unmarked: 0 },
  );

  async function mark(row: ClubAttendanceRow, status: ClubAttendanceStatus) {
    setPendingStudentId(row.studentId);
    setRowErrors((current) => {
      const { [row.studentId]: _removed, ...next } = current;
      void _removed;
      return next;
    });
    try {
      await markAttendance.mutateAsync({
        clubId: club.id,
        date,
        studentId: row.studentId,
        status,
      });
      showSuccessToast(`${row.studentName} marked ${status.toLowerCase()}.`);
      await utils.club.attendanceForSession.invalidate({ clubId: club.id, date });
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [row.studentId]: friendlyErrorMessage(error, 'Club attendance could not be saved.'),
      }));
      showErrorToast(error, 'Club attendance could not be saved.');
    } finally {
      setPendingStudentId(null);
    }
  }

  async function markAllPresent() {
    setPendingAll(true);
    setRowErrors({});
    try {
      for (const row of rows) {
        await markAttendance.mutateAsync({
          clubId: club.id,
          date,
          studentId: row.studentId,
          status: 'Present',
        });
      }
      showSuccessToast('Register saved. All students marked present.');
      await utils.club.attendanceForSession.invalidate({ clubId: club.id, date });
    } catch (error) {
      setRowErrors({
        all: friendlyErrorMessage(error, 'Club attendance could not be saved.'),
      });
      showErrorToast(error, 'Club attendance could not be saved.');
    } finally {
      setPendingAll(false);
    }
  }

  async function resetRegister() {
    if (!window.confirm('Reset this club register for the selected date?')) return;
    setPendingAll(true);
    setRowErrors({});
    try {
      const result = await resetAttendance.mutateAsync({ clubId: club.id, date });
      showSuccessToast(`Club register reset. ${String(result.deletedCount)} records cleared.`);
      await utils.club.attendanceForSession.invalidate({ clubId: club.id, date });
    } catch (error) {
      setRowErrors({
        all: friendlyErrorMessage(error, 'Club attendance could not be reset.'),
      });
      showErrorToast(error, 'Club attendance could not be reset.');
    } finally {
      setPendingAll(false);
    }
  }

  return (
    <section className="club-modal-section" aria-labelledby="club-attendance-title">
      <div className="section-title">
        <div>
          <p className="muted">Club-only register</p>
          <h3 id="club-attendance-title">Attendance</h3>
        </div>
        <div className="club-attendance-toolbar">
          <Field label="Session date">
            <TextInput
              onChange={(event) => {
                setSelectedDate(event.target.value);
              }}
              type="date"
              value={selectedDate}
            />
          </Field>
          <Button
            disabled={!canRecordForDate || rows.length === 0 || pendingAll}
            onClick={() => {
              void markAllPresent();
            }}
            pending={pendingAll}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Save aria-hidden="true" size={14} />
            Mark all present
          </Button>
          <Button
            disabled={!canRecordForDate || rows.every((row) => row.status === null) || pendingAll}
            onClick={() => {
              void resetRegister();
            }}
            pending={resetAttendance.isPending}
            size="sm"
            type="button"
            variant="danger"
          >
            <RotateCcw aria-hidden="true" size={14} />
            Reset
          </Button>
        </div>
      </div>

      {dateStatus && !canRecordForDate ? (
        <p className="status--warning">Club attendance is unavailable: {dateStatus.label}.</p>
      ) : null}

      <div className="club-attendance-summary" aria-label="Attendance summary">
        <span className="club-attendance-summary__item club-attendance-summary__item--present">
          <strong>{String(counts.present)}</strong>
          <small>Present</small>
        </span>
        <span className="club-attendance-summary__item club-attendance-summary__item--late">
          <strong>{String(counts.late)}</strong>
          <small>Late</small>
        </span>
        <span className="club-attendance-summary__item club-attendance-summary__item--absent">
          <strong>{String(counts.absent)}</strong>
          <small>Absent</small>
        </span>
        <span className="club-attendance-summary__item">
          <strong>{String(counts.unmarked)}</strong>
          <small>Unmarked</small>
        </span>
      </div>

      {attendanceQuery.isLoading ? <div className="empty-state">Loading attendance...</div> : null}
      {attendanceQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(attendanceQuery.error)}</p>
      ) : null}
      {!attendanceQuery.isLoading && rows.length === 0 ? (
        <div className="empty-state">No signed-up students for this club.</div>
      ) : null}
      {rowErrors.all ? <p className="status--error">{rowErrors.all}</p> : null}

      <div className="club-attendance-list">
        {rows.map((row) => {
          const pending = pendingStudentId === row.studentId;
          return (
            <article className="club-attendance-row" key={row.studentId}>
              <div className="student-row">
                <Avatar className="student-row__avatar" name={row.studentName} />
                <span className="student-row__text">
                  <strong>{row.studentName}</strong>
                  <span>{displaySchoolYearLabel(row.yearGroup)}</span>
                </span>
                <DailyDemeritBadge
                  status={demeritStatusQuery.statusByStudentId.get(row.studentId)}
                />
              </div>
              <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
              <div className="club-attendance-actions">
                {statuses.map(({ icon: Icon, label, value }) => (
                  <Button
                    disabled={!canRecordForDate || pending || pendingAll}
                    key={value}
                    onClick={() => {
                      void mark(row, value);
                    }}
                    pending={pending && row.status !== value}
                    size="sm"
                    type="button"
                    variant={row.status === value ? 'primary' : 'secondary'}
                  >
                    <Icon aria-hidden="true" size={14} />
                    {label}
                  </Button>
                ))}
              </div>
              {rowErrors[row.studentId] ? (
                <p className="status--error">{rowErrors[row.studentId]}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
