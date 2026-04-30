'use client';

import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/trpc';
import { MotionList, MotionTableRow } from '@/components/admin/motion';
import { Button } from '@/components/ui/button';
import { SelectInput, TextInput } from '@/components/ui/field';

const attendanceStatuses = ['Present', 'Absent', 'Late'] as const;
const UNBANDED_FILTER = '__unbanded';

type AttendanceStatus = (typeof attendanceStatuses)[number];

type AttendanceRow = {
  studentId: string;
  studentName: string;
  yearGroup: string;
  date: string;
  status: AttendanceStatus | null;
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

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function downloadCsv(filename: string, csv: string, contentType: string): void {
  const blob = new Blob([csv], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bandForRow(row: Pick<AttendanceRow, 'yearGroup'>, bands: readonly Band[]): Band | null {
  return bands.find((band) => band.standardYears.includes(row.yearGroup)) ?? null;
}

export function AttendanceCapture({
  canExport,
  emptyMessage = 'Create active students before recording attendance.',
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  showBandFilter = false,
}: AttendanceCaptureProps) {
  const [internalSelectedDate, setInternalSelectedDate] = useState(todayKey);
  const [selectedBand, setSelectedBand] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, AttendanceStatus>>({});
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

  async function markAttendance(row: AttendanceRow, status: AttendanceStatus) {
    setSelectedStatuses((current) => ({ ...current, [row.studentId]: status }));
    setPendingRows((current) => ({ ...current, [row.studentId]: true }));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[row.studentId];
      return next;
    });

    try {
      await markMutation.mutateAsync({ studentId: row.studentId, date, status });
      await utils.attendance.forDate.invalidate({ date });
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [row.studentId]: err instanceof Error ? err.message : 'Attendance could not be saved.',
      }));
    } finally {
      setPendingRows((current) => {
        const next = { ...current };
        delete next[row.studentId];
        return next;
      });
    }
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
              onChange={(event) => setSelectedBand(event.target.value)}
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
              attendanceQuery.refetch();
              if (showBandFilter) bandsQuery.refetch();
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
            onClick={async () => {
              const result = await exportQuery.refetch();
              if (result.data) {
                downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
              }
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
        {attendanceQuery.isLoading ? (
          <div className="empty-state">Loading attendance...</div>
        ) : attendanceQuery.error ? (
          <div className="empty-state status--error">{attendanceQuery.error.message}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <strong>No active students found</strong>
            <span>{emptyMessage}</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            <strong>No students in this band</strong>
            <span>Choose another band or return to all bands.</span>
          </div>
        ) : (
          <MotionList>
            <table className="table attendance-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Year</th>
                  {showBandFilter ? <th>Band</th> : null}
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recorded</th>
                  <th>
                    <span className="sr-only">Mark attendance</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const band = bandForRow(row, bands);
                  const selectedStatus = selectedStatuses[row.studentId] ?? row.status;
                  const pending = pendingRows[row.studentId] ?? false;
                  const rowError = rowErrors[row.studentId];

                  return (
                    <MotionTableRow key={row.studentId}>
                      <td>
                        <div className="student-row">
                          <span className="student-row__avatar">{initials(row.studentName)}</span>
                          <span className="student-row__text">
                            <strong>{row.studentName}</strong>
                            <span>{row.studentId}</span>
                          </span>
                        </div>
                      </td>
                      <td>{row.yearGroup}</td>
                      {showBandFilter ? (
                        <td>
                          {band ? (
                            <span className="attendance-band">
                              <span style={{ backgroundColor: band.colour }} />
                              {band.name}
                            </span>
                          ) : (
                            <span className="muted">Unbanded</span>
                          )}
                        </td>
                      ) : null}
                      <td>{row.date}</td>
                      <td>
                        <span className={selectedStatus ? 'badge badge--green' : 'badge badge--amber'}>
                          {selectedStatus ?? 'Unmarked'}
                        </span>
                        {pending ? <span className="attendance-row-note">Saving...</span> : null}
                        {rowError ? <span className="attendance-row-error">{rowError}</span> : null}
                      </td>
                      <td>
                        {row.recordedAt ? (
                          row.recordedAt.toLocaleString()
                        ) : (
                          <span className="muted">Not recorded</span>
                        )}
                      </td>
                      <td>
                        <div className="segmented-actions">
                          {attendanceStatuses.map((status) => (
                            <Button
                              className={selectedStatus === status ? 'is-selected' : undefined}
                              disabled={pending}
                              key={status}
                              onClick={() => markAttendance(row, status)}
                              size="sm"
                              type="button"
                              variant={selectedStatus === status ? 'primary' : 'secondary'}
                            >
                              {status}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </MotionTableRow>
                  );
                })}
              </tbody>
            </table>
          </MotionList>
        )}
      </div>

      {exportQuery.error ? (
        <p className="status--error attendance-error">{exportQuery.error.message}</p>
      ) : null}
    </section>
  );
}
