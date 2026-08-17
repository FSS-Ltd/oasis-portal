'use client';

import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  reportStatusLabel,
  reportStatusTone,
  type TermReport,
} from './report-format';

interface ReportHistoryListProps {
  onSelect: (reportId: string) => void;
  reports: readonly TermReport[];
  selectedReportId: string;
}

export function ReportHistoryList({
  onSelect,
  reports,
  selectedReportId,
}: ReportHistoryListProps) {
  if (reports.length === 0) return <div className="empty-state">No reports found.</div>;

  return (
    <div className="report-list" aria-label="Reports">
      {reports.map((report) => (
        <button
          className={[
            'report-list__item',
            report.id === selectedReportId ? 'is-selected' : undefined,
          ]
            .filter(Boolean)
            .join(' ')}
          key={report.id}
          onClick={() => {
            onSelect(report.id);
          }}
          type="button"
        >
          <span>
            <strong>{report.period.label}</strong>
            <small>{report.sentAt ? `Sent ${formatDate(report.sentAt)}` : 'Not sent'}</small>
          </span>
          <Badge tone={reportStatusTone(report.status)}>{reportStatusLabel(report.status)}</Badge>
        </button>
      ))}
    </div>
  );
}
