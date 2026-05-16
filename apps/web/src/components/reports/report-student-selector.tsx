'use client';

import { UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  formatNumber,
  reportStatusLabel,
  reportStatusTone,
  type TermReport,
} from './report-format';

export type ReportWorkflowMode = 'admin' | 'parent';

export interface ReportStudent {
  id: string;
  fullName: string;
  yearGroup: string;
}

interface ReportStudentSelectorProps {
  mode: ReportWorkflowMode;
  onSelect: (studentId: string) => void;
  reports: readonly TermReport[];
  selectedStudentId: string;
  students: readonly ReportStudent[];
  term: string;
}

function latestReportForTerm(reports: readonly TermReport[], term: string): TermReport | null {
  return reports.find((report) => report.term === term) ?? reports[0] ?? null;
}

export function ReportStudentSelector({
  mode,
  onSelect,
  reports,
  selectedStudentId,
  students,
  term,
}: ReportStudentSelectorProps) {
  const currentTermReport = latestReportForTerm(reports, term);

  return (
    <section className="panel panel__body report-student-panel" aria-labelledby="report-students">
      <div className="section-title">
        <div>
          <h2 id="report-students">{mode === 'admin' ? 'Students' : 'Children'}</h2>
          <p className="muted">{formatNumber(students.length)} available.</p>
        </div>
        <Badge tone="blue">
          <UsersRound aria-hidden="true" size={14} />
          {formatNumber(students.length)}
        </Badge>
      </div>
      {students.length === 0 ? (
        <div className="empty-state">
          {mode === 'admin' ? 'No active students found.' : 'No linked children found.'}
        </div>
      ) : (
        <div className="report-student-list">
          {students.map((student) => {
            const selected = student.id === selectedStudentId;
            const badgeLabel =
              selected && currentTermReport
                ? reportStatusLabel(currentTermReport.status)
                : selected
                  ? 'No draft'
                  : 'Open';
            const badgeTone =
              selected && currentTermReport ? reportStatusTone(currentTermReport.status) : 'grey';

            return (
              <button
                className={['report-student-row', selected ? 'is-selected' : undefined]
                  .filter(Boolean)
                  .join(' ')}
                key={student.id}
                onClick={() => {
                  onSelect(student.id);
                }}
                type="button"
              >
                <span className="report-student-row__avatar" aria-hidden="true">
                  {student.fullName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{student.fullName}</strong>
                  <small>{student.yearGroup}</small>
                </span>
                <Badge tone={badgeTone}>{badgeLabel}</Badge>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
