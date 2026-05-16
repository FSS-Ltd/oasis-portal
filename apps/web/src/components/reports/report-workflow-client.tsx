'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api, type RouterInputs, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput } from '@/components/ui/field';
import { ReportDetail } from './report-detail';
import { ReportHistoryList } from './report-history-list';
import {
  ReportStudentSelector,
  type ReportStudent,
  type ReportWorkflowMode,
} from './report-student-selector';
import {
  formatNumber,
  formatTerm,
  type TermReport,
} from './report-format';

type AdminStudent = RouterOutputs['student']['list'][number];
type ParentStudent = RouterOutputs['childLog']['listAccessibleStudents'][number];
type ReviewReportInput = RouterInputs['report']['review'];

interface ReportWorkflowClientProps {
  mode: ReportWorkflowMode;
}

const TERM_OPTIONS = ['2026-Spring', '2026-Summer', '2026-Autumn'] as const;

function currentTerm(): (typeof TERM_OPTIONS)[number] {
  const month = new Date().getMonth();
  if (month < 4) return '2026-Spring';
  if (month < 8) return '2026-Summer';
  return '2026-Autumn';
}

function mapAdminStudent(student: AdminStudent): ReportStudent {
  return {
    id: student.id,
    fullName: student.fullName,
    yearGroup: student.yearGroup,
  };
}

function mapParentStudent(student: ParentStudent): ReportStudent {
  return {
    id: student.id,
    fullName: student.fullName,
    yearGroup: student.yearGroup,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The report action failed.';
}

function latestReportForTerm(reports: readonly TermReport[], term: string): TermReport | null {
  return reports.find((report) => report.term === term) ?? reports[0] ?? null;
}

function reportCountLabel(count: number): string {
  return count === 1 ? '1 report' : `${formatNumber(count)} reports`;
}

export function ReportWorkflowClient({ mode }: ReportWorkflowClientProps) {
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const [selectedStudentId, setSelectedStudentId] = useState(
    () => searchParams.get('studentId') ?? '',
  );
  const [selectedReportId, setSelectedReportId] = useState(
    () => searchParams.get('reportId') ?? '',
  );
  const [term, setTerm] = useState<(typeof TERM_OPTIONS)[number]>(currentTerm);
  const [headSummary, setHeadSummary] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const adminStudentsQuery = api.student.list.useQuery(
    { includeInactive: false },
    { enabled: mode === 'admin', retry: false },
  );
  const parentStudentsQuery = api.childLog.listAccessibleStudents.useQuery(
    { linkedOnly: true },
    { enabled: mode === 'parent', retry: false },
  );

  const students = useMemo<ReportStudent[]>(() => {
    if (mode === 'admin') return (adminStudentsQuery.data ?? []).map(mapAdminStudent);
    return (parentStudentsQuery.data ?? []).map(mapParentStudent);
  }, [adminStudentsQuery.data, mode, parentStudentsQuery.data]);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const reportStudentId = selectedStudent?.id ?? '';
  const reportsQuery = api.report.listForStudent.useQuery(
    { studentId: reportStudentId },
    { enabled: reportStudentId.length > 0, retry: false },
  );

  const reports = useMemo(() => reportsQuery.data?.reports ?? [], [reportsQuery.data?.reports]);
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ??
    (mode === 'admin' ? latestReportForTerm(reports, term) : reports[0]) ??
    null;

  const draftReport = api.report.draft.useMutation({
    onSuccess: async (report) => {
      setSelectedReportId(report.id);
      setHeadSummary(report.compiled.headSummary);
      setStatusMessage('Draft generated.');
      await utils.report.listForStudent.invalidate();
    },
  });
  const reviewReport = api.report.review.useMutation({
    onSuccess: async (report) => {
      setSelectedReportId(report.id);
      setHeadSummary(report.compiled.headSummary);
      setStatusMessage('Report reviewed.');
      await utils.report.listForStudent.invalidate();
    },
  });
  const sendReport = api.report.send.useMutation({
    onSuccess: async (report) => {
      setSelectedReportId(report.id);
      setStatusMessage('Report sent.');
      await utils.report.listForStudent.invalidate();
    },
  });

  useEffect(() => {
    if (students.length === 0) return;
    if (selectedStudentId && students.some((student) => student.id === selectedStudentId)) return;
    setSelectedStudentId(students[0]?.id ?? '');
  }, [selectedStudentId, students]);

  useEffect(() => {
    if (reports.length === 0) {
      setSelectedReportId('');
      return;
    }
    if (selectedReportId && reports.some((report) => report.id === selectedReportId)) return;
    setSelectedReportId(selectedReport?.id ?? '');
  }, [reports, selectedReport?.id, selectedReportId]);

  useEffect(() => {
    setHeadSummary(selectedReport?.compiled.headSummary ?? '');
  }, [selectedReport?.id, selectedReport?.compiled.headSummary]);

  function selectStudent(studentId: string): void {
    setSelectedStudentId(studentId);
    setSelectedReportId('');
    setStatusMessage(null);
    setActionError(null);
  }

  async function handleDraft(): Promise<void> {
    if (!selectedStudent) return;
    setStatusMessage(null);
    setActionError(null);
    try {
      await draftReport.mutateAsync({ studentId: selectedStudent.id, term });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  async function handleReview(): Promise<void> {
    if (!selectedReport) return;
    setStatusMessage(null);
    setActionError(null);
    const trimmedSummary = headSummary.trim();
    const payload: ReviewReportInput = trimmedSummary
      ? { reportId: selectedReport.id, headSummary: trimmedSummary }
      : { reportId: selectedReport.id };
    try {
      await reviewReport.mutateAsync(payload);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  async function handleSend(): Promise<void> {
    if (!selectedReport) return;
    setStatusMessage(null);
    setActionError(null);
    try {
      await sendReport.mutateAsync({ reportId: selectedReport.id });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  const studentQueryError =
    mode === 'admin' ? adminStudentsQuery.error?.message : parentStudentsQuery.error?.message;
  const reportsError = reportsQuery.error?.message;
  const loadingStudents =
    mode === 'admin' ? adminStudentsQuery.isLoading : parentStudentsQuery.isLoading;
  const reportsLoading = reportsQuery.isLoading || reportsQuery.isFetching;
  const sentReports = reports.filter((report) => report.status === 'Sent').length;

  return (
    <div className="report-page">
      <div className="dashboard-hero">
        <p>{mode === 'admin' ? 'Reports' : 'Term reports'}</p>
        <h1>{mode === 'admin' ? 'Term Reports' : 'Reports'}</h1>
        <span>
          {mode === 'admin'
            ? 'Draft, review, and send end-of-term snapshots.'
            : 'Read sent reports for linked children.'}
        </span>
      </div>

      <div className="report-summary-grid" aria-label="Report overview">
        <span>
          <small>{mode === 'admin' ? 'Students' : 'Children'}</small>
          <strong>{formatNumber(students.length)}</strong>
        </span>
        <span>
          <small>Selected</small>
          <strong>{selectedStudent?.fullName ?? 'None'}</strong>
        </span>
        <span>
          <small>Reports</small>
          <strong>{reportCountLabel(reports.length)}</strong>
        </span>
        <span>
          <small>Sent</small>
          <strong>{formatNumber(sentReports)}</strong>
        </span>
      </div>

      {studentQueryError ? <p className="status--error">{studentQueryError}</p> : null}
      {reportsError ? <p className="status--error">{reportsError}</p> : null}
      {loadingStudents ? <div className="empty-state">Loading students...</div> : null}

      <div className="report-layout">
        <div className="report-sidebar">
          <ReportStudentSelector
            mode={mode}
            onSelect={selectStudent}
            reports={reports}
            selectedStudentId={selectedStudentId}
            students={students}
            term={term}
          />

          <section className="panel panel__body report-list-panel" aria-labelledby="report-list-title">
            <div className="section-title">
              <div>
                <h2 id="report-list-title">Report History</h2>
                <p className="muted">
                  {reportsLoading ? 'Loading reports...' : reportCountLabel(reports.length)}
                </p>
              </div>
              <Badge tone="blue">
                <FileText aria-hidden="true" size={14} />
                {formatNumber(reports.length)}
              </Badge>
            </div>
            <ReportHistoryList
              onSelect={setSelectedReportId}
              reports={reports}
              selectedReportId={selectedReport?.id ?? ''}
            />
          </section>
        </div>

        <div className="report-main">
          {mode === 'admin' ? (
            <section className="panel panel__body report-controls" aria-labelledby="report-actions">
              <div className="section-title">
                <div>
                  <h2 id="report-actions">Draft Controls</h2>
                  <p className="muted">Drafting refreshes the selected term snapshot.</p>
                </div>
              </div>
              <div className="report-control-row">
                <Field label="Term">
                  <SelectInput
                    onChange={(event) => {
                      setTerm(event.target.value as (typeof TERM_OPTIONS)[number]);
                      setSelectedReportId('');
                    }}
                    value={term}
                  >
                    {TERM_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatTerm(option)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Button
                  disabled={!selectedStudent}
                  onClick={() => {
                    void handleDraft();
                  }}
                  pending={draftReport.isPending}
                  type="button"
                  variant="secondary"
                >
                  <RefreshCw aria-hidden="true" size={16} />
                  Generate Draft
                </Button>
              </div>
            </section>
          ) : null}

          <ReportDetail
            canEdit={mode === 'admin'}
            errorMessage={actionError}
            headSummary={headSummary}
            onHeadSummaryChange={setHeadSummary}
            onReview={() => {
              void handleReview();
            }}
            onSend={() => {
              void handleSend();
            }}
            report={selectedReport}
            reviewPending={reviewReport.isPending}
            sendPending={sendReport.isPending}
            statusMessage={statusMessage}
          />
        </div>
      </div>
    </div>
  );
}
