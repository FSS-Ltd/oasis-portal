'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEFAULT_REPORT_SECTIONS, resolveReportPeriod } from '@oasis/domain';
import { api, type RouterInputs, type RouterOutputs } from '@/lib/trpc';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { ReportActions } from './report-actions';
import { ReportDetail } from './report-detail';
import { ReportDraftControls } from './report-draft-controls';
import {
  editorStateForReport,
  hasBlankReportNotes,
  type ReportEditorState,
} from './report-editor-state';
import type { DraftPeriod } from './report-period-controls';
import type { DraftSections } from './report-section-picker';
import { ReportSidebar } from './report-sidebar';
import type { ReportStudent, ReportWorkflowMode } from './report-student-selector';
import { formatNumber, reportCountLabel, type TermReport } from './report-format';

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
  const [editor, setEditor] = useState<ReportEditorState>(() => editorStateForReport(null));
  const [editorDirty, setEditorDirty] = useState(false);
  const editorReportIdRef = useRef<string | null>(null);

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
      setEditor(editorStateForReport(report));
      setEditorDirty(false);
      editorReportIdRef.current = report.id;
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
      setEditor(editorStateForReport(report));
      setEditorDirty(false);
      editorReportIdRef.current = report.id;
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
    const nextReportId = selectedReport?.id ?? null;
    if (editorReportIdRef.current === nextReportId) return;
    editorReportIdRef.current = nextReportId;
    setEditor(editorStateForReport(selectedReport));
    setEditorDirty(false);
    if (selectedReport) {
      setPeriod(periodInputForReport(selectedReport));
      setSections({ ...selectedReport.compiled.sections });
    }
  }, [selectedReport]);

  function confirmDiscardEdits(): boolean {
    return (
      !editorDirty ||
      window.confirm('You have unsaved report changes. Discard them and continue?')
    );
  }

  function selectStudent(studentId: string): void {
    if (!confirmDiscardEdits()) return;
    setSelectedStudentId(studentId);
    setSelectedReportId('');
  }

  function selectReport(reportIdValue: string): void {
    if (reportIdValue === selectedReport?.id || !confirmDiscardEdits()) return;
    setSelectedReportId(reportIdValue);
  }

  function updateEditor(update: Partial<ReportEditorState>): void {
    setEditor((current) => ({ ...current, ...update }));
    setEditorDirty(true);
  }

  async function handleDraft(): Promise<void> {
    if (!selectedStudent || !confirmDiscardEdits()) return;
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
      progressComment: editor.progressComment.trim(),
      behaviourNotes: editor.behaviourNotes.map(({ category, id, note }) => ({
        id,
        note: note.trim(),
        ...(category?.trim() ? { category: category.trim() } : {}),
      })),
      generalNotes: editor.generalNotes.map(({ id, note }) => ({ id, note: note.trim() })),
    };
    try {
      await reviewReport.mutateAsync(payload);
    } catch {
      // Toast is handled by the mutation onError callback.
    }
  }

  async function handleSend(): Promise<void> {
    if (!selectedReport || editorDirty) return;
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
        <ReportSidebar
          mode={mode}
          onReportSelect={selectReport}
          onStudentSelect={selectStudent}
          periodKey={selectedPeriodKey}
          reports={reports}
          reportsLoading={reportsLoading}
          selectedReportId={selectedReport?.id ?? ''}
          selectedStudentId={selectedStudentId}
          students={students}
        />

        <div className="report-main">
          {mode === 'admin' ? (
            <ReportDraftControls
              hasSelectedStudent={selectedStudent !== null}
              onGenerate={() => {
                void handleDraft();
              }}
              onPeriodChange={(nextPeriod) => {
                if (!confirmDiscardEdits()) return;
                setPeriod(nextPeriod);
                setSelectedReportId('');
              }}
              onSectionsChange={setSections}
              pending={draftReport.isPending}
              period={period}
              sections={sections}
            />
          ) : null}

          <ReportDetail
            behaviourNotes={editor.behaviourNotes}
            canEdit={mode === 'admin'}
            editorDisabled={reviewReport.isPending || sendReport.isPending}
            generalNotes={editor.generalNotes}
            onBehaviourNotesChange={(entries) => {
              updateEditor({ behaviourNotes: entries });
            }}
            onGeneralNotesChange={(entries) => {
              updateEditor({ generalNotes: entries });
            }}
            onProgressCommentChange={(value) => {
              updateEditor({ progressComment: value });
            }}
            progressComment={editor.progressComment}
            report={selectedReport}
          />
          {selectedReport ? (
            <ReportActions
              canEdit={mode === 'admin'}
              editorDirty={editorDirty}
              onReview={() => {
                void handleReview();
              }}
              onSend={() => {
                void handleSend();
              }}
              report={selectedReport}
              reviewDisabled={hasBlankReportNotes(editor)}
              reviewPending={reviewReport.isPending}
              sendPending={sendReport.isPending}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
