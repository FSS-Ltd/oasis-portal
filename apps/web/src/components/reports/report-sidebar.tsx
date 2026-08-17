'use client';

import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ReportHistoryList } from './report-history-list';
import {
  ReportStudentSelector,
  type ReportStudent,
  type ReportWorkflowMode,
} from './report-student-selector';
import { formatNumber, reportCountLabel, type TermReport } from './report-format';

interface ReportSidebarProps {
  mode: ReportWorkflowMode;
  onReportSelect: (reportId: string) => void;
  onStudentSelect: (studentId: string) => void;
  periodKey: string;
  reports: readonly TermReport[];
  reportsLoading: boolean;
  selectedReportId: string;
  selectedStudentId: string;
  students: readonly ReportStudent[];
}

export function ReportSidebar({
  mode,
  onReportSelect,
  onStudentSelect,
  periodKey,
  reports,
  reportsLoading,
  selectedReportId,
  selectedStudentId,
  students,
}: ReportSidebarProps) {
  return (
    <div className="report-sidebar">
      <ReportStudentSelector
        mode={mode}
        onSelect={onStudentSelect}
        periodKey={periodKey}
        reports={reports}
        selectedStudentId={selectedStudentId}
        students={students}
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
          onSelect={onReportSelect}
          reports={reports}
          selectedReportId={selectedReportId}
        />
      </section>
    </div>
  );
}
