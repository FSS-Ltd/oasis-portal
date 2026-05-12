'use client';

import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { canonicalSchoolYear, displaySchoolYearLabel } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput, TextInput } from '@/components/ui/field';
import { downloadCsv } from './download-csv';
import {
  absenceReasonLabels,
  absenceReasons,
  attendanceStatusLabel,
  attendanceStatuses,
  type AbsenceReason,
} from './attendance-options';

const UNBANDED_FILTER = '__unbanded';

type AttendanceStatus = (typeof attendanceStatuses)[number];

type AttendanceRow = {
  studentId: string;
  studentName: string;
  yearGroup: string;
  date: string;
  status: AttendanceStatus | null;
  absenceReason: AbsenceReason | null;
  absenceReasonLabel: string | null;
  recordedAt: Date | null;
};

type Band = {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
};

type AttendanceCaptureProps = {
  canExport: boolean;
  canRecord?: boolean;
  emptyMessage?: string;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
  showBandFilter?: boolean;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function bandForRow(row: Pick<AttendanceRow, 'yearGroup'>, bands: readonly Band[]): Band | null {
  const canonical = canonicalSchoolYear(row.yearGroup);
  return (
    bands.find(
      (band) =>
        band.standardYears.includes(row.yearGroup) ||
        (canonical !== null && band.standardYears.includes(canonical)),
    ) ?? null
  );
}

function withoutRecordKey<T>(record: Record<string, T>, keyToRemove: string): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== keyToRemove) next[key] = value;
  }
  return next;
}

export function AttendanceCapture({
  canExport,
  canRecord = true,
  emptyMessage = 'Create active students before recording attendance.',
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  showBandFilter = false,
}: AttendanceCaptureProps) {
  const [internalSelectedDate, setInternalSelectedDate] = useState(todayKey);
  const [selectedBand, setSelectedBand] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [selectedReasons, setSelectedReasons] = useState<Record<string, AbsenceReason>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  const attendanceQuery = api.attendance.forDate.useQuery({ date }, { retry: false });
  const bandsQuery = api.attendance.listYearGroupBands.useQuery(undefined, {
    enabled: showBandFilter,
    retry: false,
  });
  const exportQuery = api.attendance.exportStudentsCsv.useQuery(
    { from: date, to: date },
    { enabled: false, retry: false },
  );
  const markMutation = api.attendance.mark.useMutation();

  const bands = showBandFilter ? (bandsQuery.data ?? []) : [];
  const rows = attendanceQuery.data ?? [];
  const filteredRows = rows.filter((row) => {
    if (!showBandFilter || selectedBand === 'all') return true;
    const band = bandForRow(row, bands);
    if (selectedBand === UNBANDED_FILTER) return band === null;
    return band?.id === selectedBand;
  });

  async function markAttendance(
    row: AttendanceRow,
    status: AttendanceStatus,
    absenceReason?: AbsenceReason,
  ) {
    setSelectedStatuses((current) => ({ ...current, [row.studentId]: status }));
    if (absenceReason) {
      setSelectedReasons((current) => ({ ...current, [row.studentId]: absenceReason }));
    }
    setPendingRows((current) => ({ ...current, [row.studentId]: true }));
    setRowErrors((current) => withoutRecordKey(current, row.studentId));

    try {
      await markMutation.mutateAsync({ studentId: row.studentId, date, status, absenceReason });
      await utils.attendance.forDate.invalidate({ date });
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [row.studentId]: err instanceof Error ? err.message : 'Attendance could not be saved.',
      }));
    } finally {
      setPendingRows((current) => withoutRecordKey(current, row.studentId));
    }
  }

  const tableEmpty =
    rows.length === 0 ? (
      <EmptyState detail={emptyMessage} title="No active students found" />
    ) : (
      <EmptyState
        detail="Choose another band or return to all bands."
        title="No students in this band"
      />
    );

  const columns: DataTableColumn<AttendanceRow>[] = [
    {
      id: 'name',
      header: 'Name',
      render: (row) => (
        <div className="student-row">
          <Avatar className="student-row__avatar" name={row.studentName} />
          <span className="student-row__text">
            <strong>{row.studentName}</strong>
            <span>{row.studentId}</span>
          </span>
        </div>
      ),
    },
    { id: 'year', header: 'Year', render: (row) => displaySchoolYearLabel(row.yearGroup) },
  ];

  if (showBandFilter) {
    columns.push({
      id: 'band',
      header: 'Band',
      render: (row) => {
        const band = bandForRow(row, bands);
        return band ? (
          <span className="attendance-band">
            <span style={{ backgroundColor: band.colour }} />
            {band.name}
          </span>
        ) : (
          <span className="muted">Unbanded</span>
        );
      },
    });
  }

  columns.push(
    { id: 'date', header: 'Date', render: (row) => row.date },
    {
      id: 'status',
      header: 'Status',
      render: (row) => {
        const selectedStatus = selectedStatuses[row.studentId] ?? row.status;
        const selectedReason = selectedReasons[row.studentId] ?? row.absenceReason;
        const pending = pendingRows[row.studentId] ?? false;
        const rowError = rowErrors[row.studentId];

        return (
          <>
            <Badge tone={selectedStatus === 'Absent' ? 'red' : selectedStatus ? 'green' : 'amber'}>
              {attendanceStatusLabel(selectedStatus, selectedReason, row.absenceReasonLabel)}
            </Badge>
            {pending ? <span className="attendance-row-note">Saving...</span> : null}
            {rowError ? <span className="attendance-row-error">{rowError}</span> : null}
          </>
        );
      },
    },
    {
      id: 'recorded',
      header: 'Recorded',
      render: (row) =>
        row.recordedAt ? (
          row.recordedAt.toLocaleString()
        ) : (
          <span className="muted">Not recorded</span>
        ),
    },
  );

  if (canRecord) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Mark attendance</span>,
      render: (row) => {
        const selectedStatus = selectedStatuses[row.studentId] ?? row.status;
        const selectedReason = selectedReasons[row.studentId] ?? row.absenceReason ?? '';
        const pending = pendingRows[row.studentId] ?? false;

        return (
          <div className="attendance-action-stack">
            <div className="segmented-actions">
              {attendanceStatuses.map((status) => (
                <Button
                  className={selectedStatus === status ? 'is-selected' : undefined}
                  disabled={pending}
                  key={status}
                  onClick={() => {
                    if (status === 'Absent') {
                      setSelectedStatuses((current) => ({ ...current, [row.studentId]: status }));
                      setRowErrors((current) => withoutRecordKey(current, row.studentId));
                      return;
                    }
                    setSelectedReasons((current) => withoutRecordKey(current, row.studentId));
                    void markAttendance(row, status);
                  }}
                  size="sm"
                  type="button"
                  variant={selectedStatus === status ? 'primary' : 'secondary'}
                >
                  {status}
                </Button>
              ))}
            </div>
            {selectedStatus === 'Absent' ? (
              <SelectInput
                aria-label={`Absence reason for ${row.studentName}`}
                disabled={pending}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  const reason = value as AbsenceReason;
                  setSelectedReasons((current) => ({ ...current, [row.studentId]: reason }));
                  void markAttendance(row, 'Absent', reason);
                }}
                required
                value={selectedReason}
              >
                <option value="">Choose reason</option>
                {absenceReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {absenceReasonLabels[reason]}
                  </option>
                ))}
              </SelectInput>
            ) : null}
          </div>
        );
      },
    });
  }

  return (
    <section>
      <div className="toolbar attendance-toolbar">
        <div className="toolbar__search attendance-toolbar__date">
          <TextInput
            aria-label="Attendance date"
            onChange={(event) => {
              setInternalSelectedDate(event.target.value);
              onSelectedDateChange?.(event.target.value);
            }}
            type="date"
            value={selectedDate}
          />
          {showBandFilter ? (
            <SelectInput
              aria-label="Year-group band filter"
              onChange={(event) => {
                setSelectedBand(event.target.value);
              }}
              value={selectedBand}
            >
              <option value="all">All bands</option>
              {bands.map((band) => (
                <option key={band.id} value={band.id}>
                  {band.name}
                </option>
              ))}
              <option value={UNBANDED_FILTER}>Unbanded</option>
            </SelectInput>
          ) : null}
          <Button
            onClick={() => {
              void attendanceQuery.refetch();
              if (showBandFilter) void bandsQuery.refetch();
            }}
            pending={attendanceQuery.isFetching || bandsQuery.isFetching}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </Button>
        </div>
        {canExport ? (
          <Button
            onClick={() => {
              void exportQuery.refetch().then((result) => {
                if (result.data) {
                  downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
                }
              });
            }}
            pending={exportQuery.isFetching}
            type="button"
            variant="secondary"
          >
            <Download aria-hidden="true" size={16} />
            Export CSV
          </Button>
        ) : null}
      </div>

      {showBandFilter && bandsQuery.error ? (
        <p className="status--error attendance-error">{bandsQuery.error.message}</p>
      ) : null}

      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={tableEmpty}
          errorMessage={attendanceQuery.error?.message}
          getRowKey={(row) => row.studentId}
          loading={attendanceQuery.isLoading}
          loadingLabel="Loading attendance..."
          rows={filteredRows}
          tableClassName="attendance-table"
        />
      </div>

      {exportQuery.error ? (
        <p className="status--error attendance-error">{exportQuery.error.message}</p>
      ) : null}
    </section>
  );
}
