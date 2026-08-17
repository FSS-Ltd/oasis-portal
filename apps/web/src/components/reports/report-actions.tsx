'use client';

import { Download, Mail, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TermReport } from './report-format';

interface ReportActionsProps {
  canEdit: boolean;
  editorDirty: boolean;
  onReview?: () => void;
  onSend?: () => void;
  report: TermReport;
  reviewDisabled?: boolean;
  reviewPending?: boolean;
  sendPending?: boolean;
}

export function ReportActions({
  canEdit,
  editorDirty,
  onReview,
  onSend,
  report,
  reviewDisabled = false,
  reviewPending = false,
  sendPending = false,
}: ReportActionsProps) {
  const isSent = report.status === 'Sent';
  const downloadHref = `/api/reports/${encodeURIComponent(report.id)}/pdf`;

  return (
    <div className="panel panel__body report-actions">
      {canEdit && !isSent ? (
        <Button
          disabled={!onReview || reviewDisabled}
          onClick={onReview}
          pending={reviewPending}
          type="button"
        >
          <Save aria-hidden="true" size={16} />
          Save and Review
        </Button>
      ) : null}

      {editorDirty ? (
        <button className="button button--secondary button--md" disabled type="button">
          <Download aria-hidden="true" size={16} />
          Download PDF
        </button>
      ) : (
        <a className="button button--secondary button--md" download href={downloadHref}>
          <Download aria-hidden="true" size={16} />
          Download PDF
        </a>
      )}

      {canEdit ? (
        <Button
          disabled={isSent || editorDirty || !onSend}
          onClick={onSend}
          pending={sendPending}
          type="button"
          variant="secondary"
        >
          {isSent ? <Mail aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
          {isSent ? 'Sent' : 'Send'}
        </Button>
      ) : null}

      {editorDirty ? (
        <p className="report-unsaved-note" role="status">
          Save and review changes before downloading the PDF or sending this report.
        </p>
      ) : null}
    </div>
  );
}
