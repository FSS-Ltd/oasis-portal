'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DEFAULT_REPORT_SECTIONS, resolveReportPeriod } from '@oasis/domain';
import { api, type RouterInputs, type RouterOutputs } from '@/lib/trpc';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReportDetail } from './report-detail';
import { ReportHistoryList } from './report-history-list';
import { ReportPeriodControls, type DraftPeriod } from './report-period-controls';
import { ReportSectionPicker, type DraftSections } from './report-section-picker';
import {
  ReportStudentSelector,
  type ReportStudent,
  type ReportWorkflowMode,
} from './report-student-selector';
import { formatNumber, type TermReport } from './report-format';

type AdminStudent = RouterOutputs['student']['list'][number];
type ParentStudent = RouterOutputs['childLog']['listAccessibleStudents'][number];
type ReviewReportInput = RouterInputs['report']['review'];

interface ReportWorkflowClientProps {
  mode: ReportWorkflowMode;
}

function initialPeriod(referenceDate = new Date()): DraftPeriod {
  const year = referenceDate.getUTCFullYear();
  return {
    type: 'AcademicYear',
    startYear: referenceDate.getUTCMonth() >= 8 ? year : year - 1,
  };
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

function latestReportForPeriod(
  reports: readonly TermReport[],
  periodKey: string,
): TermReport | null {
  return reports.find((report) => report.period.key === periodKey) ?? null;
}

function periodInputForReport(report: TermReport): DraftPeriod {
  if (report.period.type === 'AcademicYear') {
    return { type: 'AcademicYear', startYear: Number(report.period.from.slice(0, 4)) };
  }
  if (report.period.type === 'Term') {
    return { type: 'Term', term: report.period.key };
  }
  return { type: 'Custom', from: report.period.from, to: report.period.to };
}

function reportSpecificNotes(entries: TermReport['compiled']['notes']) {
  return entries
    .filter((entry) => entry.origin === 'Report')
    .map((entry) => ({
      id: entry.id,
      ...(entry.category ? { category: entry.category } : {}),
      note: entry.note ?? '',
    }));
}

function reportCountLabel(count: number): string {
  return count === 1 ? '1 report' : `${formatNumber(count)} reports`;
}

export function ReportWorkflowClient({ mode }: ReportWorkflowClientProps) {
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const [selectedStudentId, setSelectedStudentId] = useState(
    () => searchParams?.get('studentId') ?? '',
  );
  const [selectedReportId, setSelectedReportId] = useState(
    () => searchParams?.get('reportId') ?? '',
  );
  const [period, setPeriod] = useState<DraftPeriod>(initialPeriod);
  const [sections, setSections] = useState<DraftSections>({ ...DEFAULT_REPORT_SECTIONS });
  const [headSummary, setHeadSummary] = useState('');

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
  const selectedPeriodKey = useMemo(() => {
    try {
      return resolveReportPeriod(period).snapshot.key;
    } catch {
      return '';
    }
  }, [period]);
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ??
    (mode === 'admin' ? latestReportForPeriod(reports, selectedPeriodKey) : reports[0]) ??
    null;

  const draftReport = api.report.draft.useMutation({
    onSuccess: async (report) => {
      setSelectedReportId(report.id);
      setPeriod(periodInputForReport(report));
      setSections({ ...report.compiled.sections });
      setHeadSummary(report.compiled.headSummary);
      showSuccessToast('Draft generated.');
      await utils.report.listForStudent.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Draft could not be generated.');
    },
  });
  const reviewReport = api.report.review.useMutation({
    onSuccess: async (report) => {
      setSelectedReportId(report.id);
      setHeadSummary(report.compiled.headSummary);
      showSuccessToast('Report reviewed.');
      await utils.report.listForStudent.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Report could not be reviewed.');
    },
  });
  const sendReport = api.report.send.useMutation({
    onSuccess: async (report) => {
      setSelectedReportId(report.id);
      showSuccessToast('Report sent.');
      await utils.report.listForStudent.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Report could not be sent.');
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
    if (selectedReport) {
      setPeriod(periodInputForReport(selectedReport));
      setSections({ ...selectedReport.compiled.sections });
    }
  }, [selectedReport?.id, selectedReport?.compiled.headSummary]);

  function selectStudent(studentId: string): void {
    setSelectedStudentId(studentId);
    setSelectedReportId('');
  }

  async function handleDraft(): Promise<void> {
    if (!selectedStudent) return;
    try {
      await draftReport.mutateAsync({ studentId: selectedStudent.id, period, sections });
    } catch {
      // Toast is handled by the mutation onError callback.
    }
  }

  async function handleReview(): Promise<void> {
    if (!selectedReport) return;
    const payload: ReviewReportInput = {
      reportId: selectedReport.id,
      progressComment: headSummary.trim(),
      behaviourNotes: reportSpecificNotes(selectedReport.compiled.behaviour.generalEntries),
      generalNotes: reportSpecificNotes(selectedReport.compiled.notes).map(({ id, note }) => ({
        id,
        note,
      })),
    };
    try {
      await reviewReport.mutateAsync(payload);
    } catch {
      // Toast is handled by the mutation onError callback.
    }
  }

  async function handleSend(): Promise<void> {
    if (!selectedReport) return;
    try {
      await sendReport.mutateAsync({ reportId: selectedReport.id });
    } catch {
      // Toast is handled by the mutation onError callback.
    }
  }

  const studentQueryError =
    mode === 'admin'
      ? adminStudentsQuery.error
        ? friendlyErrorMessage(adminStudentsQuery.error)
        : null
      : parentStudentsQuery.error
        ? friendlyErrorMessage(parentStudentsQuery.error)
        : null;
  const reportsError = reportsQuery.error ? friendlyErrorMessage(reportsQuery.error) : null;
  const loadingStudents =
    mode === 'admin' ? adminStudentsQuery.isLoading : parentStudentsQuery.isLoading;
  const reportsLoading = reportsQuery.isLoading || reportsQuery.isFetching;
  const sentReports = reports.filter((report) => report.status === 'Sent').length;

  return (
    <div className="report-page">
      <div className="dashboard-hero">
        <p>{mode === 'admin' ? 'Reports' : 'Student reports'}</p>
        <h1>Student Reports</h1>
        <span>
          {mode === 'admin'
            ? 'Draft, review, and send configurable progress snapshots.'
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
            periodKey={selectedPeriodKey}
          />

          <section
            className="panel panel__body report-list-panel"
            aria-labelledby="report-list-title"
          >
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
                  <p className="muted">Choose the reporting period and included sections.</p>
                </div>
              </div>
              <ReportPeriodControls
                disabled={draftReport.isPending}
                onChange={(nextPeriod) => {
                  setPeriod(nextPeriod);
                  setSelectedReportId('');
                }}
                value={period}
              />
              <ReportSectionPicker
                disabled={draftReport.isPending}
                onChange={setSections}
                value={sections}
              />
              <div className="report-control-row report-control-row--actions">
                <span className="muted">Generate or refresh this saved snapshot.</span>
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
          />
        </div>
      </div>
    </div>
  );
}
