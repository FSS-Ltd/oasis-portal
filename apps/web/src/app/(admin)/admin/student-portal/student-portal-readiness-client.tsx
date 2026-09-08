'use client';

import { AlertTriangle, CheckCircle2, Filter, UserPlus, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type Report = RouterOutputs['studentSettings']['adminReadinessReport'];
type ReportRow = Report['rows'][number];
type ReportStatus = 'All' | 'Ready' | 'Exceptions';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const usernamePattern = /^[a-z0-9]+$/iu;
const maxVisiblePaceSubjects = 3;

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
    row.usage.dailyUsageLimitMinutes
      ? `${String(row.usage.dayMinutes)}/${String(row.usage.dailyUsageLimitMinutes)} day`
      : null,
    row.usage.offLimitWeekdays.length > 0
      ? `Off ${row.usage.offLimitWeekdays
          .map((weekday) => weekdayLabels[weekday] ?? String(weekday))
          .join(', ')}`
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' · ');
}

function visiblePaceSubjects(row: ReportRow): ReportRow['paceSubjects'] {
  return row.paceSubjects.slice(0, maxVisiblePaceSubjects);
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

function loginIdentifierValidationMessage(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter a username or email address.';
  if (trimmed.includes('@')) {
    if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)) {
      return 'Enter a valid email address.';
    }
    return null;
  }
  if (trimmed.length < 4 || trimmed.length > 64 || !usernamePattern.test(trimmed)) {
    return 'Username must be 4 to 64 letters or numbers.';
  }
  return null;
}

function CreateStudentLoginModal({
  onClose,
  onCreated,
  student,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  student: ReportRow;
}) {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const createLogin = api.studentSettings.adminCreateStudentLogin.useMutation();

  useEffect(() => {
    setLoginIdentifier('');
    setPassword('');
    setLocalError(null);
  }, [student.studentId]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);

    const identifierError = loginIdentifierValidationMessage(loginIdentifier);
    if (identifierError) {
      setLocalError(identifierError);
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setLocalError('Password must be 12 to 128 characters.');
      return;
    }

    try {
      await createLogin.mutateAsync({
        loginIdentifier: loginIdentifier.trim(),
        password,
        studentId: student.studentId,
      });
      showSuccessToast('Student login created.');
      setPassword('');
      await onCreated();
      onClose();
    } catch (error) {
      const message = friendlyErrorMessage(error, 'Student login could not be created.');
      setLocalError(message);
      showErrorToast(error, 'Student login could not be created.');
    }
  }

  return (
    <div aria-modal="true" className="pace-modal-backdrop" role="dialog">
      <form
        aria-labelledby="create-student-login-title"
        className="pace-modal"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <header className="pace-modal__header">
          <div>
            <h2 id="create-student-login-title">Create student login</h2>
            <p>
              {student.fullName} · {displaySchoolYearLabel(student.yearGroup)}
            </p>
          </div>
          <Button
            aria-label="Close create student login"
            disabled={createLogin.isPending}
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>

        <div className="pace-modal__body">
          <div className="pace-modal__summary">
            <span>Account status</span>
            <strong>Login pending</strong>
          </div>
          <Field label="Username or email">
            <TextInput
              autoComplete="username"
              disabled={createLogin.isPending}
              maxLength={254}
              onChange={(event) => {
                setLoginIdentifier(event.target.value);
                setLocalError(null);
              }}
              placeholder="jamielearner or jamie@example.com"
              required
              value={loginIdentifier}
            />
          </Field>
          <Field label="Initial password">
            <TextInput
              autoComplete="new-password"
              disabled={createLogin.isPending}
              maxLength={128}
              onChange={(event) => {
                setPassword(event.target.value);
                setLocalError(null);
              }}
              placeholder="New secure password"
              required
              type="password"
              value={password}
            />
          </Field>
          {localError ? (
            <p className="status--error" role="alert">
              {localError}
            </p>
          ) : null}
        </div>

        <footer className="pace-modal__footer">
          <Button
            disabled={createLogin.isPending}
            onClick={onClose}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={loginIdentifier.trim().length === 0 || password.length === 0}
            pending={createLogin.isPending}
            type="submit"
          >
            <UserPlus aria-hidden="true" size={16} />
            Create login
          </Button>
        </footer>
      </form>
    </div>
  );
}

function StudentPortalTable({
  onCreateLogin,
  rows,
}: {
  onCreateLogin: (row: ReportRow) => void;
  rows: ReportRow[];
}) {
  if (rows.length === 0) {
    return <EmptyState title="No student portal rows match these filters" />;
  }

  function openIfUnlinked(row: ReportRow): void {
    if (!row.accountLinked) onCreateLogin(row);
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
            <tr
              className={!row.accountLinked ? 'student-portal-admin-row--action' : undefined}
              key={row.studentId}
              onClick={() => {
                openIfUnlinked(row);
              }}
            >
              <td>
                <strong>{row.fullName}</strong>
                <span>{displaySchoolYearLabel(row.yearGroup)}</span>
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
                  {!row.accountLinked ? (
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateLogin(row);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <UserPlus aria-hidden="true" size={14} />
                      Create login
                    </Button>
                  ) : null}
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
                    {String(row.attendance.attended)}/{String(row.attendance.recorded)} attended
                  </span>
                  <span>
                    {String(row.attendance.present)} present · {String(row.attendance.late)} late ·{' '}
                    {String(row.attendance.absent)} absent
                  </span>
                </div>
              </td>
              <td>
                {row.paceSubjects.length > 0 ? (
                  <div className="student-portal-admin-stack">
                    {visiblePaceSubjects(row).map((subject) => (
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

export function StudentPortalReadinessClient() {
  const [status, setStatus] = useState<ReportStatus>('All');
  const [ageBand, setAgeBand] = useState<string>('All');
  const [selectedStudent, setSelectedStudent] = useState<ReportRow | null>(null);
  const input = useMemo(
    () => ({
      status,
      ...(ageBand === 'All' ? {} : { ageBand }),
    }),
    [ageBand, status],
  );
  const report = api.studentSettings.adminReadinessReport.useQuery(input, { retry: false });
  const bands = api.admin.listYearGroupBands.useQuery(undefined, { retry: false });

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
                setAgeBand(event.target.value);
              }}
              value={ageBand}
            >
              <option value="All">All</option>
              {(bands.data ?? []).map((band) => (
                <option key={band.id} value={band.id}>
                  {band.name}
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
            <StudentPortalTable
              onCreateLogin={(row) => {
                setSelectedStudent(row);
              }}
              rows={report.data.rows}
            />
          </section>
          {selectedStudent ? (
            <CreateStudentLoginModal
              onClose={() => {
                setSelectedStudent(null);
              }}
              onCreated={async () => {
                await report.refetch();
              }}
              student={selectedStudent}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
