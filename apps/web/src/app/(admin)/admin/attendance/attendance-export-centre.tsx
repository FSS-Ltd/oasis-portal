'use client';

import { useMemo, useState } from 'react';
import { Download, RefreshCw, UsersRound } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { SelectInput, TextInput } from '@/components/ui/field';
import { downloadCsv } from '@/components/attendance/download-csv';

const ALL_RECORDS = '__all';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date || todayKey()}T00:00:00.000Z`);
}

type ExportPanelProps = {
  title: string;
  detail: string;
  selectLabel: string;
  allLabel: string;
  options: readonly { id: string; label: string }[];
  selectedId: string;
  pending: boolean;
  disabled: boolean;
  error?: string | undefined;
  onSelectedIdChange: (value: string) => void;
  onExport: () => void;
};

function ExportPanel({
  title,
  detail,
  selectLabel,
  allLabel,
  options,
  selectedId,
  pending,
  disabled,
  error,
  onSelectedIdChange,
  onExport,
}: ExportPanelProps) {
  return (
    <section className="panel panel__body attendance-export-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <p className="muted">{detail}</p>
        </div>
        <span className="badge badge--blue">
          <UsersRound aria-hidden="true" size={14} />
          {options.length}
        </span>
      </div>
      <div className="attendance-export-panel__controls">
        <SelectInput
          aria-label={selectLabel}
          onChange={(event) => {
            onSelectedIdChange(event.target.value);
          }}
          value={selectedId}
        >
          <option value={ALL_RECORDS}>{allLabel}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
        <Button disabled={disabled} onClick={onExport} pending={pending} type="button">
          <Download aria-hidden="true" size={16} />
          Export CSV
        </Button>
      </div>
      {error ? <p className="status--error attendance-export-panel__error">{error}</p> : null}
    </section>
  );
}

export function AttendanceExportCentre() {
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const [studentId, setStudentId] = useState(ALL_RECORDS);
  const [staffUserId, setStaffUserId] = useState(ALL_RECORDS);
  const optionsQuery = api.attendance.listExportOptions.useQuery(undefined, { retry: false });

  const fromDate = useMemo(() => asDate(from), [from]);
  const toDate = useMemo(() => asDate(to), [to]);
  const selectedStudentId = studentId === ALL_RECORDS ? undefined : studentId;
  const selectedStaffUserId = staffUserId === ALL_RECORDS ? undefined : staffUserId;

  const studentExportQuery = api.attendance.exportStudentsCsv.useQuery(
    { from: fromDate, to: toDate, studentId: selectedStudentId },
    { enabled: false, retry: false },
  );
  const staffExportQuery = api.attendance.exportStaffCsv.useQuery(
    { from: fromDate, to: toDate, staffUserId: selectedStaffUserId },
    { enabled: false, retry: false },
  );

  function exportStudents() {
    void studentExportQuery.refetch().then((result) => {
      if (result.data) {
        downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
      }
    });
  }

  function exportStaff() {
    void staffExportQuery.refetch().then((result) => {
      if (result.data) {
        downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
      }
    });
  }

  const students = optionsQuery.data?.students ?? [];
  const staff = optionsQuery.data?.staff ?? [];
  const exportDisabled = from.length === 0 || to.length === 0;

  return (
    <section className="attendance-export-centre">
      <div className="section-title">
        <div>
          <h2>Export centre</h2>
          <p className="muted">Download date-range student or staff attendance records.</p>
        </div>
        <Button
          onClick={() => {
            void optionsQuery.refetch();
          }}
          pending={optionsQuery.isFetching}
          type="button"
          variant="secondary"
        >
          <RefreshCw aria-hidden="true" size={16} />
          Refresh lists
        </Button>
      </div>

      <div className="panel panel__body attendance-export-range">
        <label className="field">
          <span className="field__label">From</span>
          <TextInput
            onChange={(event) => {
              setFrom(event.target.value);
            }}
            type="date"
            value={from}
          />
        </label>
        <label className="field">
          <span className="field__label">To</span>
          <TextInput
            onChange={(event) => {
              setTo(event.target.value);
            }}
            type="date"
            value={to}
          />
        </label>
      </div>

      {optionsQuery.error ? (
        <p className="status--error attendance-export-centre__error">{optionsQuery.error.message}</p>
      ) : null}

      <div className="attendance-export-grid">
        <ExportPanel
          allLabel="All students"
          detail="Use this for register extracts across active and historical attendance rows."
          disabled={exportDisabled}
          error={studentExportQuery.error?.message}
          onExport={exportStudents}
          onSelectedIdChange={setStudentId}
          options={students}
          pending={studentExportQuery.isFetching}
          selectedId={studentId}
          selectLabel="Student export scope"
          title="Student attendance"
        />
        <ExportPanel
          allLabel="All staff"
          detail="Use this for supervisor and full-admin staff attendance extracts."
          disabled={exportDisabled}
          error={staffExportQuery.error?.message}
          onExport={exportStaff}
          onSelectedIdChange={setStaffUserId}
          options={staff}
          pending={staffExportQuery.isFetching}
          selectedId={staffUserId}
          selectLabel="Staff export scope"
          title="Staff attendance"
        />
      </div>
    </section>
  );
}
