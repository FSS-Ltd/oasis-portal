'use client';

import { AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  STANDARD_SCHOOL_YEARS,
  displaySchoolYearLabel,
  type StandardSchoolYear,
} from '@oasis/domain';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput } from '@/components/ui/field';
import { api, type RouterOutputs } from '@/lib/trpc';

type Report = RouterOutputs['studentSettings']['adminReadinessReport'];
type ReportRow = Report['rows'][number];
type PendingRegistration = Report['pendingRegistrations'][number];
type ReportStatus = 'All' | 'Ready' | 'Exceptions';

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

function ratio(value: number | null): string {
  return value === null ? 'No records' : `${String(value)}%`;
}

function lockLabel(row: ReportRow): string {
  if (!row.lock.locked) return 'Unlocked';
  return row.lock.primarySource === 'HeadAcademic' ? 'Academic lock' : 'Parent lock';
}

function usageLabel(row: ReportRow): string {
  if (!row.usage.hasLimits) return 'No limits';
  const parts = [
    row.usage.hourlyUsageLimitMinutes
      ? `${String(row.usage.hourMinutes)}/${String(row.usage.hourlyUsageLimitMinutes)} hour`
      : null,
    row.usage.dailyUsageLimitMinutes
      ? `${String(row.usage.dayMinutes)}/${String(row.usage.dailyUsageLimitMinutes)} day`
      : null,
    row.usage.weeklyUsageLimitMinutes
      ? `${String(row.usage.weekMinutes)}/${String(row.usage.weeklyUsageLimitMinutes)} week`
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' · ');
}

function StudentPortalSummary({ report }: { report: Report }) {
  const cards = [
    ['Active students', report.summary.activeStudents],
    ['Linked accounts', report.summary.linkedAccounts],
    ['Ready', report.summary.readyAccounts],
    ['Exceptions', report.summary.exceptionAccounts],
    ['Locked', report.summary.lockedAccounts],
    ['Shop blocked', report.summary.shopBlockedAccounts],
    ['Usage limited', report.summary.usageLimitedAccounts],
    ['Pending requests', report.summary.pendingRegistrations],
  ] as const;

  return (
    <section className="student-portal-admin-summary">
      {cards.map(([label, value]) => (
        <div className="student-portal-admin-stat" key={label}>
          <span>{label}</span>
          <strong>{String(value)}</strong>
        </div>
      ))}
    </section>
  );
}

function ReadinessBadge({ row }: { row: ReportRow }) {
  if (row.ready) {
    return (
      <span className="badge badge--green">
        <CheckCircle2 aria-hidden="true" size={13} />
        Ready
      </span>
    );
  }

  return (
    <span className="badge badge--amber">
      <AlertTriangle aria-hidden="true" size={13} />
      Review
    </span>
  );
}

function StudentPortalTable({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No student portal rows match these filters" />;
  }

  return (
    <div className="student-registration-table-wrap">
      <table className="student-registration-table student-portal-admin-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Readiness</th>
            <th>Account</th>
            <th>Controls</th>
            <th>Merits</th>
            <th>Attendance</th>
            <th>PACE</th>
            <th>Clubs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>
                <strong>{row.fullName}</strong>
                <span>{row.yearGroup}</span>
              </td>
              <td>
                <div className="student-portal-admin-stack">
                  <ReadinessBadge row={row} />
                  {row.readinessIssues.length > 0 ? (
                    <span>{row.readinessIssues.join(' · ')}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <div className="student-portal-admin-stack">
                  <span>{row.accountLinked ? 'Login linked' : 'Login pending'}</span>
                  <span>{String(row.guardianCount)} parent/carer link(s)</span>
                </div>
              </td>
              <td>
                <div className="student-portal-admin-stack">
                  <span>{lockLabel(row)}</span>
                  <span>
                    {row.parentMeritShopBlocked ? 'Merit shop blocked' : 'Shop available'}
                  </span>
                  <span>{usageLabel(row)}</span>
                </div>
              </td>
              <td>{String(row.meritsTotal)}</td>
              <td>
                <div className="student-portal-admin-stack">
                  <span>{ratio(row.attendance.attendanceRate)}</span>
                  <span>
                    {String(row.attendance.present)} present · {String(row.attendance.late)} late ·{' '}
                    {String(row.attendance.absent)} absent
                  </span>
                </div>
              </td>
              <td>
                {row.paceSubjects.length > 0 ? (
                  <div className="student-portal-admin-stack">
                    {row.paceSubjects.slice(0, 3).map((subject) => (
                      <span key={`${row.studentId}-${subject.subjectName}`}>
                        {subject.subjectName} {String(subject.currentPaceNumber)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted">No PACE records</span>
                )}
              </td>
              <td>{String(row.activeClubSignupCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingRegistrations({ rows }: { rows: PendingRegistration[] }) {
  return (
    <section className="panel panel__body" aria-labelledby="student-portal-pending-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Launch queue</p>
          <h2 id="student-portal-pending-title">Pending student requests</h2>
        </div>
        <span className="badge badge--blue">{String(rows.length)}</span>
      </div>
      {rows.length > 0 ? (
        <div className="student-registration-code-list">
          {rows.map((row) => (
            <div className="student-registration-code-row" key={row.id}>
              <div>
                <strong>{row.fullName}</strong>
                <span>
                  {row.yearGroup} · {formatDate(row.submittedAt)}
                </span>
              </div>
              <span className="badge badge--amber">{row.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No pending student requests" />
      )}
    </section>
  );
}

export function StudentPortalReadinessClient() {
  const [status, setStatus] = useState<ReportStatus>('All');
  const [ageBand, setAgeBand] = useState<StandardSchoolYear | 'All'>('All');
  const input = useMemo(
    () => ({
      status,
      ...(ageBand === 'All' ? {} : { ageBand }),
    }),
    [ageBand, status],
  );
  const report = api.studentSettings.adminReadinessReport.useQuery(input, { retry: false });

  return (
    <div className="student-registration-admin-page">
      <section className="dashboard-hero">
        <p>Student portal</p>
        <h1>Launch readiness</h1>
        <span>Review account setup, parent controls, usage limits, and activity signals.</span>
      </section>

      <section className="panel panel__body" aria-labelledby="student-portal-filters-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Filters</p>
            <h2 id="student-portal-filters-title">Admin report</h2>
          </div>
          <Filter aria-hidden="true" size={20} />
        </div>
        <div className="form-grid form-grid--two">
          <Field label="Readiness">
            <SelectInput
              onChange={(event) => {
                setStatus(event.target.value as ReportStatus);
              }}
              value={status}
            >
              <option value="All">All</option>
              <option value="Ready">Ready</option>
              <option value="Exceptions">Exceptions</option>
            </SelectInput>
          </Field>
          <Field label="Age band">
            <SelectInput
              onChange={(event) => {
                setAgeBand(event.target.value as StandardSchoolYear | 'All');
              }}
              value={ageBand}
            >
              <option value="All">All</option>
              {STANDARD_SCHOOL_YEARS.map((year) => (
                <option key={year} value={year}>
                  {displaySchoolYearLabel(year)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </section>

      {report.isLoading ? (
        <section className="panel panel__body">
          <EmptyState title="Loading student portal readiness" />
        </section>
      ) : report.error ? (
        <section className="panel panel__body">
          <EmptyState title="Student portal report unavailable" />
        </section>
      ) : report.data ? (
        <>
          <StudentPortalSummary report={report.data} />
          <section className="panel panel__body" aria-labelledby="student-portal-table-title">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Readiness</p>
                <h2 id="student-portal-table-title">Student accounts</h2>
              </div>
              <span className="badge badge--blue">{String(report.data.rows.length)} rows</span>
            </div>
            <StudentPortalTable rows={report.data.rows} />
          </section>
          <PendingRegistrations rows={report.data.pendingRegistrations} />
        </>
      ) : null}
    </div>
  );
}
