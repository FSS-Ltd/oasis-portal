'use client';

import { Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
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
const staffTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

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
  return staffTimeFormatter.format(value);
}

function scheduleLabel(row: StaffAttendanceRow): string {
  const shiftLabels = row.shifts.map(
    (shift) =>
      `${formatTime(shift.startsAt)}-${formatTime(shift.endsAt)} · ${shift.bandName ?? 'Band'}`,
  );
  const volunteerLabels = row.volunteerPlacements.map((placement) => placement.label);
  const labels = [...shiftLabels, ...volunteerLabels];
  if (labels.length > 0) return labels.join(', ');
  return row.scheduled ? 'Scheduled' : 'Unscheduled';
}

export function StaffAttendanceRoster() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedPersonUserId, setSelectedPersonUserId] = useState(NO_SELECTION);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [selectedReasons, setSelectedReasons] = useState<Record<string, AbsenceReason>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  const staffQuery = api.attendance.staffForDate.useQuery({ date }, { retry: false });
  const operationalDatesQuery = api.calendar.operationalDates.useQuery(
    { dates: [date] },
    { retry: false },
  );
  const markMutation = api.attendance.markStaff.useMutation();
  const resetMutation = api.attendance.resetStaffForDate.useMutation();

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
      showSuccessToast(`${row.staffName} marked ${status}.`);
      await utils.attendance.staffForDate.invalidate({ date });
    } catch (err) {
      showErrorToast(err, 'Attendance could not be saved.');
      setRowErrors((current) => ({
        ...current,
        [row.staffUserId]: friendlyErrorMessage(err, 'Attendance could not be saved.'),
      }));
    } finally {
      setPendingRows((current) => withoutRecordKey(current, row.staffUserId));
    }
  }

  async function addUnscheduledPerson() {
    if (!selectedPersonUserId) return;
    const option = staffQuery.data?.unscheduledOptions.find(
      (person) => person.id === selectedPersonUserId,
    );
    if (!option) return;
    setPendingRows((current) => ({ ...current, [selectedPersonUserId]: true }));
    setRowErrors((current) => withoutRecordKey(current, selectedPersonUserId));
    setAddError(null);

    try {
      await markMutation.mutateAsync({
        staffUserId: selectedPersonUserId,
        date,
        status: 'Present',
      });
      setSelectedPersonUserId(NO_SELECTION);
      showSuccessToast(`${option.name} added to attendance.`);
      await utils.attendance.staffForDate.invalidate({ date });
    } catch (err) {
      setAddError(friendlyErrorMessage(err, 'Person could not be added.'));
      showErrorToast(err, 'Person could not be added.');
    } finally {
      setPendingRows((current) => withoutRecordKey(current, selectedPersonUserId));
    }
  }

  async function resetRegister() {
    if (!window.confirm('Reset this staff and volunteer register for the selected date?')) return;
    try {
      const result = await resetMutation.mutateAsync({ date });
      setSelectedStatuses({});
      setSelectedReasons({});
      setRowErrors({});
      showSuccessToast(
        `Staff and volunteer register reset. ${String(result.deletedCount)} records cleared.`,
      );
      await utils.attendance.staffForDate.invalidate({ date });
    } catch (err) {
      showErrorToast(err, 'Staff and volunteer register could not be reset.');
    }
  }

  const rows = staffQuery.data?.rows ?? [];
  const unscheduledOptions = staffQuery.data?.unscheduledOptions ?? [];
  const unscheduledStaffOptions = unscheduledOptions.filter(
    (option) => option.personKind === 'staff',
  );
  const unscheduledParentVolunteerOptions = unscheduledOptions.filter(
    (option) => option.personKind === 'parentVolunteer',
  );
  const dateStatus = operationalDatesQuery.data?.[0];
  const canRecordForDate = dateStatus?.kind === 'operating';
  const columns: DataTableColumn<StaffAttendanceRow>[] = [
    {
      id: 'name',
      header: 'Person',
      render: (row) => (
        <span className="student-row__text">
          <strong>{row.staffName}</strong>
          <span className="badge-list">
            {roleLabel(row.role)}
            {row.isParentVolunteer ? <Badge tone="green">Parent volunteer</Badge> : null}
          </span>
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
  ];

  if (canRecordForDate) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Mark attendance</span>,
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
    });
  }

  return (
    <section className="attendance-staff-roster">
      <div className="section-title">
        <div>
          <h2>Staff &amp; volunteer attendance</h2>
          <p className="muted">
            Mark scheduled staff and volunteers, or add someone who came in to help.
          </p>
        </div>
      </div>

      <div className="toolbar attendance-toolbar">
        <div className="toolbar__search attendance-toolbar__date">
          <TextInput
            aria-label="Staff and volunteer attendance date"
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
          <Button
            disabled={!canRecordForDate || rows.every((row) => row.status === null)}
            onClick={() => {
              void resetRegister();
            }}
            pending={resetMutation.isPending}
            type="button"
            variant="danger"
          >
            <RotateCcw aria-hidden="true" size={16} />
            Reset
          </Button>
        </div>
      </div>

      {dateStatus && !canRecordForDate ? (
        <p className="status--warning">
          Staff and volunteer attendance is unavailable: {dateStatus.label}.
        </p>
      ) : null}

      <div className="panel panel__body attendance-unscheduled-panel">
        <SelectInput
          aria-label="Unscheduled staff member or parent volunteer"
          onChange={(event) => {
            setSelectedPersonUserId(event.target.value);
            setAddError(null);
          }}
          value={selectedPersonUserId}
        >
          <option value={NO_SELECTION}>Add unscheduled person</option>
          <optgroup label="Staff">
            {unscheduledStaffOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Parent volunteers">
            {unscheduledParentVolunteerOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </optgroup>
        </SelectInput>
        <Button
          disabled={!canRecordForDate || !selectedPersonUserId}
          onClick={() => {
            void addUnscheduledPerson();
          }}
          pending={selectedPersonUserId ? (pendingRows[selectedPersonUserId] ?? false) : false}
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
              detail="Create staff shifts or volunteer bookings before marking attendance."
              title="No staff or volunteers scheduled"
            />
          }
          errorMessage={staffQuery.error ? friendlyErrorMessage(staffQuery.error) : undefined}
          getRowKey={(row) => row.staffUserId}
          loading={staffQuery.isLoading}
          loadingLabel="Loading staff and volunteer attendance..."
          rows={rows}
          tableClassName="attendance-table"
        />
      </div>
    </section>
  );
}
