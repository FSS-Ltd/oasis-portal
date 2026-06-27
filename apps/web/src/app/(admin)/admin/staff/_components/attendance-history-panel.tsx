'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Download, RefreshCw } from 'lucide-react';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { downloadCsv } from '@/components/attendance/download-csv';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import { formatDate } from './people-profile-model';

type StudentAttendanceRow = RouterOutputs['attendance']['studentHistory'][number];
type StaffAttendanceRow = RouterOutputs['attendance']['staffHistory'][number];
type AttendanceRow = StudentAttendanceRow | StaffAttendanceRow;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(value: string): Date {
  return new Date(`${value || todayKey()}T00:00:00.000Z`);
}

function statusTone(status: AttendanceRow['status']): 'amber' | 'green' | 'red' {
  if (status === 'Present') return 'green';
  if (status === 'Late') return 'amber';
  return 'red';
}

interface AttendanceHistoryCardProps {
  error?: string | undefined;
  exportError?: string | undefined;
  exportPending: boolean;
  from: string;
  loading: boolean;
  onExport: () => void;
  onFromChange: (value: string) => void;
  onRefresh: () => void;
  onToChange: (value: string) => void;
  rows: readonly AttendanceRow[];
  to: string;
}

function filterRowsForRange(
  rows: readonly AttendanceRow[],
  from: string,
  to: string,
): AttendanceRow[] {
  if (!from || !to) return [];
  return rows.filter((row) => row.date >= from && row.date <= to);
}

function AttendanceHistoryCard({
  error,
  exportError,
  exportPending,
  from,
  loading,
  onExport,
  onFromChange,
  onRefresh,
  onToChange,
  rows,
  to,
}: AttendanceHistoryCardProps) {
  const controlsDisabled = from.length === 0 || to.length === 0;
  const visibleRows = filterRowsForRange(rows, from, to);
  const rangeLabel =
    from.length > 0 && to.length > 0 ? `${formatDate(from)} to ${formatDate(to)}` : null;

  return (
    <section className="panel">
      <div className="panel__body attendance-history-panel">
        <div className="section-title">
          <div>
            <h2>Attendance history</h2>
            <p className="muted">Review attendance dates within the selected range.</p>
          </div>
          <div className="attendance-history-panel__actions">
            <Button onClick={onRefresh} pending={loading} type="button" variant="secondary">
              <RefreshCw aria-hidden="true" size={16} />
              Refresh
            </Button>
            <Button
              disabled={controlsDisabled}
              onClick={onExport}
              pending={exportPending}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="attendance-history-panel__filters">
          <Field label="Attendance from">
            <TextInput
              onChange={(event) => {
                onFromChange(event.target.value);
              }}
              type="date"
              value={from}
            />
          </Field>
          <Field label="Attendance to">
            <TextInput
              onChange={(event) => {
                onToChange(event.target.value);
              }}
              type="date"
              value={to}
            />
          </Field>
        </div>
        {rangeLabel ? (
          <p className="muted attendance-history-panel__range">
            Showing attendance dates from {rangeLabel}.
          </p>
        ) : null}

        {error ? <p className="status--error">{error}</p> : null}
        {exportError ? <p className="status--error">{exportError}</p> : null}
        {loading ? (
          <p className="muted attendance-history-panel__range">Refreshing range...</p>
        ) : null}

        {visibleRows.length === 0 && !loading && !error ? (
          <EmptyState detail="Try a wider date range." title="No attendance records found" />
        ) : null}

        {visibleRows.length > 0 ? (
          <div className="attendance-history-list">
            {visibleRows.map((row) => (
              <article className="attendance-history-row" key={row.id}>
                <span className="attendance-history-row__icon">
                  <CalendarCheck aria-hidden="true" size={17} />
                </span>
                <div>
                  <strong>{formatDate(row.date)}</strong>
                  <span>Entered on {formatDate(row.recordedAt)}</span>
                </div>
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StudentAttendanceHistoryPanel({ studentId }: { studentId: string }) {
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const fromDate = useMemo(() => asDate(from), [from]);
  const toDate = useMemo(() => asDate(to), [to]);
  const historyQuery = api.attendance.studentHistory.useQuery(
    { studentId, from: fromDate, to: toDate },
    { enabled: from.length > 0 && to.length > 0, retry: false },
  );
  const exportQuery = api.attendance.exportStudentsCsv.useQuery(
    { studentId, from: fromDate, to: toDate },
    { enabled: false, retry: false },
  );

  function exportHistory() {
    void exportQuery.refetch().then((result) => {
      if (result.data) {
        downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
      }
    });
  }

  return (
    <AttendanceHistoryCard
      error={historyQuery.error ? friendlyErrorMessage(historyQuery.error) : undefined}
      exportError={exportQuery.error ? friendlyErrorMessage(exportQuery.error) : undefined}
      exportPending={exportQuery.isFetching}
      from={from}
      loading={historyQuery.isFetching}
      onExport={exportHistory}
      onFromChange={setFrom}
      onRefresh={() => {
        void historyQuery.refetch();
      }}
      onToChange={setTo}
      rows={historyQuery.data ?? []}
      to={to}
    />
  );
}

export function StaffAttendanceHistoryPanel({ staffUserId }: { staffUserId: string }) {
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const fromDate = useMemo(() => asDate(from), [from]);
  const toDate = useMemo(() => asDate(to), [to]);
  const historyQuery = api.attendance.staffHistory.useQuery(
    { staffUserId, from: fromDate, to: toDate },
    { enabled: from.length > 0 && to.length > 0, retry: false },
  );
  const exportQuery = api.attendance.exportStaffCsv.useQuery(
    { staffUserId, from: fromDate, to: toDate },
    { enabled: false, retry: false },
  );

  function exportHistory() {
    void exportQuery.refetch().then((result) => {
      if (result.data) {
        downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
      }
    });
  }

  return (
    <AttendanceHistoryCard
      error={historyQuery.error ? friendlyErrorMessage(historyQuery.error) : undefined}
      exportError={exportQuery.error ? friendlyErrorMessage(exportQuery.error) : undefined}
      exportPending={exportQuery.isFetching}
      from={from}
      loading={historyQuery.isFetching}
      onExport={exportHistory}
      onFromChange={setFrom}
      onRefresh={() => {
        void historyQuery.refetch();
      }}
      onToChange={setTo}
      rows={historyQuery.data ?? []}
      to={to}
    />
  );
}
