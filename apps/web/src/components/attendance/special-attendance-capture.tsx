'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bus, MapPin, RefreshCw, RotateCcw } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { attendanceStatuses, type AttendanceStatus } from './attendance-options';

type SpecialAttendanceRegister =
  RouterOutputs['attendance']['specialForDate']['session']['register'];
type SpecialAttendanceRow = RouterOutputs['attendance']['specialForDate']['rows'][number];

type SpecialAttendanceCaptureProps = {
  canRecord: boolean;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
};

const specialRegisters = [
  { id: 'FieldTrip', label: 'Field trip' },
  { id: 'MinibusInbound', label: 'Minibus inbound' },
  { id: 'MinibusOutbound', label: 'Minibus outbound' },
  { id: 'TheCedars', label: 'The Cedars' },
] as const satisfies readonly { id: SpecialAttendanceRegister; label: string }[];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function isMinibusRegister(register: SpecialAttendanceRegister): boolean {
  return register === 'MinibusInbound' || register === 'MinibusOutbound';
}

function statusTone(status: AttendanceStatus | null): 'amber' | 'green' | 'red' {
  if (status === 'Absent') return 'red';
  if (status === 'Late') return 'amber';
  if (status === 'Present') return 'green';
  return 'amber';
}

function registerLabel(register: SpecialAttendanceRegister): string {
  return specialRegisters.find((option) => option.id === register)?.label ?? register;
}

function withoutRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [recordKey, value] of Object.entries(record)) {
    if (recordKey !== key) {
      next[recordKey] = value;
    }
  }
  return next;
}

export function SpecialAttendanceCapture({
  canRecord,
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
}: SpecialAttendanceCaptureProps) {
  const [internalSelectedDate, setInternalSelectedDate] = useState(todayKey);
  const [register, setRegister] = useState<SpecialAttendanceRegister>('FieldTrip');
  const [destination, setDestination] = useState('');
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  const specialQuery = api.attendance.specialForDate.useQuery({ date, register }, { retry: false });
  const saveSessionMutation = api.attendance.saveSpecialSession.useMutation();
  const markMutation = api.attendance.markSpecial.useMutation();
  const resetMutation = api.attendance.resetSpecialForDate.useMutation();

  const rows = specialQuery.data?.rows ?? [];
  const sessionDestination = specialQuery.data?.session.destination ?? '';
  const minibus = isMinibusRegister(register);

  useEffect(() => {
    setDestination(sessionDestination);
  }, [register, selectedDate, sessionDestination]);

  async function saveDestination() {
    try {
      const saved = await saveSessionMutation.mutateAsync({ date, register, destination });
      setDestination(saved.destination ?? '');
      showSuccessToast('Minibus destination saved.');
      await utils.attendance.specialForDate.invalidate({ date, register });
    } catch (error) {
      showErrorToast(error, 'Minibus destination could not be saved.');
    }
  }

  async function markSpecial(row: SpecialAttendanceRow, status: AttendanceStatus) {
    setPendingRows((current) => ({ ...current, [row.studentId]: true }));
    setRowErrors((current) => withoutRecordKey(current, row.studentId));

    try {
      await markMutation.mutateAsync({ date, register, studentId: row.studentId, status });
      showSuccessToast(`${row.studentName} marked ${status}.`);
      await utils.attendance.specialForDate.invalidate({ date, register });
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [row.studentId]: friendlyErrorMessage(error, 'Special attendance could not be saved.'),
      }));
      showErrorToast(error, 'Special attendance could not be saved.');
    } finally {
      setPendingRows((current) => withoutRecordKey(current, row.studentId));
    }
  }

  async function resetRegister() {
    if (!window.confirm(`Reset ${registerLabel(register)} for the selected date?`)) return;
    try {
      const result = await resetMutation.mutateAsync({ date, register });
      setRowErrors({});
      showSuccessToast(`Special register reset. ${String(result.deletedCount)} records cleared.`);
      await utils.attendance.specialForDate.invalidate({ date, register });
    } catch (error) {
      showErrorToast(error, 'Special attendance could not be reset.');
    }
  }

  const columns: DataTableColumn<SpecialAttendanceRow>[] = [
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
    {
      id: 'year',
      header: 'Year',
      render: (row) => displaySchoolYearLabel(row.yearGroup),
    },
    {
      id: 'status',
      header: 'Status',
      render: (row) => (
        <>
          <Badge tone={statusTone(row.status)}>{row.status ?? 'Unmarked'}</Badge>
          {pendingRows[row.studentId] ? (
            <span className="attendance-row-note">Saving...</span>
          ) : null}
          {rowErrors[row.studentId] ? (
            <span className="attendance-row-error">{rowErrors[row.studentId]}</span>
          ) : null}
        </>
      ),
    },
  ];

  if (canRecord) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Mark special attendance</span>,
      render: (row) => {
        const pending = pendingRows[row.studentId] ?? false;
        const disabled = pending || (minibus && sessionDestination.trim().length === 0);

        return (
          <div className="segmented-actions">
            {attendanceStatuses.map((status) => (
              <Button
                className={row.status === status ? 'is-selected' : undefined}
                disabled={disabled}
                key={status}
                onClick={() => {
                  void markSpecial(row, status);
                }}
                size="sm"
                type="button"
                variant={row.status === status ? 'primary' : 'secondary'}
              >
                {status}
              </Button>
            ))}
          </div>
        );
      },
    });
  }

  return (
    <section className="attendance-special-capture">
      <div className="section-title">
        <div>
          <h2>Special attendance</h2>
          <p className="muted">
            Record field trips, minibus journeys, and days at The Cedars without changing the daily
            register.
          </p>
        </div>
        <Badge tone="blue">
          <MapPin aria-hidden="true" size={14} />
          {registerLabel(register)}
        </Badge>
      </div>

      <div className="toolbar attendance-toolbar">
        <div className="toolbar__search attendance-toolbar__date">
          <TextInput
            aria-label="Special attendance date"
            onChange={(event) => {
              setInternalSelectedDate(event.target.value);
              onSelectedDateChange?.(event.target.value);
              setRowErrors({});
            }}
            type="date"
            value={selectedDate}
          />
          <SelectInput
            aria-label="Special attendance register"
            onChange={(event) => {
              setRegister(event.target.value as SpecialAttendanceRegister);
              setRowErrors({});
            }}
            value={register}
          >
            {specialRegisters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <Button
            onClick={() => {
              void specialQuery.refetch();
            }}
            pending={specialQuery.isFetching}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </Button>
          {canRecord ? (
            <Button
              disabled={rows.every((row) => row.status === null)}
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
          ) : null}
        </div>
      </div>

      {minibus ? (
        <div className="panel panel__body attendance-special-destination">
          <Field hint="Saved once for this date and journey direction." label="Destination">
            <TextInput
              aria-label="Minibus destination"
              maxLength={240}
              onChange={(event) => {
                setDestination(event.target.value);
              }}
              required
              value={destination}
            />
          </Field>
          <Button
            disabled={destination.trim().length === 0}
            onClick={() => {
              void saveDestination();
            }}
            pending={saveSessionMutation.isPending}
            type="button"
          >
            <Bus aria-hidden="true" size={16} />
            Save destination
          </Button>
        </div>
      ) : null}

      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={
            <EmptyState
              detail="The daily register scope has no active students for this date."
              title="No students found"
            />
          }
          errorMessage={specialQuery.error ? friendlyErrorMessage(specialQuery.error) : undefined}
          getRowKey={(row) => row.studentId}
          loading={specialQuery.isLoading}
          loadingLabel="Loading special attendance..."
          rows={rows}
          tableClassName="attendance-table"
        />
      </div>
    </section>
  );
}
