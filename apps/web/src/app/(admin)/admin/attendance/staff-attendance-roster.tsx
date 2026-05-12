'use client';

import { Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { roleLabel } from '@/lib/profile-display';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput, TextInput } from '@/components/ui/field';
import {
  absenceReasonLabels,
  absenceReasons,
  attendanceStatusLabel,
  attendanceStatuses,
  type AbsenceReason,
  type AttendanceStatus,
} from '@/components/attendance/attendance-options';

type StaffAttendanceRow = RouterOutputs['attendance']['staffForDate']['rows'][number];

const NO_SELECTION = '';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function withoutRecordKey<T>(record: Record<string, T>, keyToRemove: string): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== keyToRemove) next[key] = value;
  }
  return next;
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function scheduleLabel(row: StaffAttendanceRow): string {
  if (!row.scheduled) return 'Unscheduled';
  if (row.shifts.length === 0) return 'Scheduled';
  return row.shifts
    .map(
      (shift) =>
        `${formatTime(shift.startsAt)}-${formatTime(shift.endsAt)} · ${shift.bandName ?? 'Band'}`,
    )
    .join(', ');
}

export function StaffAttendanceRoster() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState(NO_SELECTION);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [selectedReasons, setSelectedReasons] = useState<Record<string, AbsenceReason>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  const staffQuery = api.attendance.staffForDate.useQuery({ date }, { retry: false });
  const markMutation = api.attendance.markStaff.useMutation();

  async function markStaff(
    row: StaffAttendanceRow,
    status: AttendanceStatus,
    absenceReason?: AbsenceReason,
  ) {
    setSelectedStatuses((current) => ({ ...current, [row.staffUserId]: status }));
    if (absenceReason) {
      setSelectedReasons((current) => ({ ...current, [row.staffUserId]: absenceReason }));
    }
    setPendingRows((current) => ({ ...current, [row.staffUserId]: true }));
    setRowErrors((current) => withoutRecordKey(current, row.staffUserId));

    try {
      await markMutation.mutateAsync({ staffUserId: row.staffUserId, date, status, absenceReason });
      await utils.attendance.staffForDate.invalidate({ date });
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [row.staffUserId]:
          err instanceof Error ? err.message : 'Supervisor attendance could not be saved.',
      }));
    } finally {
      setPendingRows((current) => withoutRecordKey(current, row.staffUserId));
    }
  }

  async function addUnscheduledSupervisor() {
    if (!selectedStaffUserId) return;
    const option = staffQuery.data?.unscheduledOptions.find(
      (staff) => staff.id === selectedStaffUserId,
    );
    if (!option) return;
    setPendingRows((current) => ({ ...current, [selectedStaffUserId]: true }));
    setRowErrors((current) => withoutRecordKey(current, selectedStaffUserId));
    setAddError(null);

    try {
      await markMutation.mutateAsync({ staffUserId: selectedStaffUserId, date, status: 'Present' });
      setSelectedStaffUserId(NO_SELECTION);
      await utils.attendance.staffForDate.invalidate({ date });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Supervisor could not be added.');
    } finally {
      setPendingRows((current) => withoutRecordKey(current, selectedStaffUserId));
    }
  }

  const rows = staffQuery.data?.rows ?? [];
  const columns: DataTableColumn<StaffAttendanceRow>[] = [
    {
      id: 'name',
      header: 'Supervisor',
      render: (row) => (
        <span className="student-row__text">
          <strong>{row.staffName}</strong>
          <span>{roleLabel(row.role)}</span>
        </span>
      ),
    },
    {
      id: 'schedule',
      header: 'Schedule',
      render: (row) => (
        <span className={row.scheduled ? undefined : 'muted'}>{scheduleLabel(row)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (row) => {
        const selectedStatus = selectedStatuses[row.staffUserId] ?? row.status;
        const selectedReason = selectedReasons[row.staffUserId] ?? row.absenceReason;
        const pending = pendingRows[row.staffUserId] ?? false;
        const rowError = rowErrors[row.staffUserId];

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
    {
      id: 'actions',
      header: <span className="sr-only">Mark supervisor attendance</span>,
      render: (row) => {
        const selectedStatus = selectedStatuses[row.staffUserId] ?? row.status;
        const selectedReason = selectedReasons[row.staffUserId] ?? row.absenceReason ?? '';
        const pending = pendingRows[row.staffUserId] ?? false;

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
                      setSelectedStatuses((current) => ({ ...current, [row.staffUserId]: status }));
                      setRowErrors((current) => withoutRecordKey(current, row.staffUserId));
                      return;
                    }
                    setSelectedReasons((current) => withoutRecordKey(current, row.staffUserId));
                    void markStaff(row, status);
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
                aria-label={`Absence reason for ${row.staffName}`}
                disabled={pending}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  const reason = value as AbsenceReason;
                  setSelectedReasons((current) => ({ ...current, [row.staffUserId]: reason }));
                  void markStaff(row, 'Absent', reason);
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
    },
  ];

  return (
    <section className="attendance-staff-roster">
      <div className="section-title">
        <div>
          <h2>Supervisor attendance</h2>
          <p className="muted">
            Mark scheduled supervisors, or add someone who came in unscheduled.
          </p>
        </div>
      </div>

      <div className="toolbar attendance-toolbar">
        <div className="toolbar__search attendance-toolbar__date">
          <TextInput
            aria-label="Supervisor attendance date"
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setSelectedStatuses({});
              setSelectedReasons({});
              setRowErrors({});
            }}
            type="date"
            value={selectedDate}
          />
          <Button
            onClick={() => {
              void staffQuery.refetch();
            }}
            pending={staffQuery.isFetching}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="panel panel__body attendance-unscheduled-panel">
        <SelectInput
          aria-label="Unscheduled supervisor"
          onChange={(event) => {
            setSelectedStaffUserId(event.target.value);
            setAddError(null);
          }}
          value={selectedStaffUserId}
        >
          <option value={NO_SELECTION}>Add unscheduled supervisor</option>
          {(staffQuery.data?.unscheduledOptions ?? []).map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.label}
            </option>
          ))}
        </SelectInput>
        <Button
          disabled={!selectedStaffUserId}
          onClick={() => {
            void addUnscheduledSupervisor();
          }}
          pending={selectedStaffUserId ? (pendingRows[selectedStaffUserId] ?? false) : false}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          Add present
        </Button>
        {addError ? (
          <p className="status--error attendance-unscheduled-panel__error">{addError}</p>
        ) : null}
      </div>

      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={
            <EmptyState
              detail="Create rota shifts before marking supervisor attendance."
              title="No supervisors scheduled"
            />
          }
          errorMessage={staffQuery.error?.message}
          getRowKey={(row) => row.staffUserId}
          loading={staffQuery.isLoading}
          loadingLabel="Loading supervisor attendance..."
          rows={rows}
          tableClassName="attendance-table"
        />
      </div>
    </section>
  );
}
