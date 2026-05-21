'use client';

import { Mail, Send, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import {
  formatDate,
  formatNumber,
  formatSignedNumber,
  formatTerm,
  reportStatusLabel,
  reportStatusTone,
  type TermReport,
} from './report-format';

interface ReportDetailProps {
  canEdit: boolean;
  headSummary: string;
  onHeadSummaryChange?: (value: string) => void;
  onReview?: () => void;
  onSend?: () => void;
  report: TermReport | null;
  reviewPending?: boolean;
  sendPending?: boolean;
}

interface ReportMetricProps {
  label: string;
  value: string;
  detail?: string;
}

function ReportMetric({ detail, label, value }: ReportMetricProps) {
  return (
    <span className="report-metric">
      <small>{label}</small>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </span>
  );
}

function EmptyReportDetail({ canEdit }: { canEdit: boolean }) {
  return (
    <section className="panel panel__body report-detail" aria-labelledby="report-detail-title">
      <div className="section-title">
        <div>
          <h2 id="report-detail-title">Report Detail</h2>
          <p className="muted">{canEdit ? 'Select a student to begin.' : 'Select a report.'}</p>
        </div>
      </div>
      <div className="empty-state">
        {canEdit ? 'No report selected.' : 'No sent report selected.'}
      </div>
    </section>
  );
}

function TextEntries({
  emptyLabel,
  entries,
}: {
  emptyLabel: string;
  entries: TermReport['compiled']['notes'];
}) {
  if (entries.length === 0) return <div className="empty-state">{emptyLabel}</div>;

  return (
    <div className="report-entry-list">
      {entries.map((entry) => (
        <article className="report-entry" key={`${entry.createdAt}-${entry.note ?? ''}`}>
          <span>{formatDate(entry.createdAt)}</span>
          {'category' in entry && entry.category ? <strong>{entry.category}</strong> : null}
          <p>{entry.note ?? 'No note recorded.'}</p>
        </article>
      ))}
    </div>
  );
}

export function ReportDetail({
  canEdit,
  headSummary,
  onHeadSummaryChange,
  onReview,
  onSend,
  report,
  reviewPending = false,
  sendPending = false,
}: ReportDetailProps) {
  if (!report) return <EmptyReportDetail canEdit={canEdit} />;

  const { compiled } = report;
  const isSent = report.status === 'Sent';
  const attendanceDetail = `${formatNumber(compiled.attendance.present)} present · ${formatNumber(
    compiled.attendance.absent,
  )} absent · ${formatNumber(compiled.attendance.late)} late`;

  return (
    <section className="panel panel__body report-detail" aria-labelledby="report-detail-title">
      <div className="report-detail__header">
        <div>
          <p className="eyebrow">{formatTerm(report.term)}</p>
          <h2 id="report-detail-title">{compiled.studentDisplayName}</h2>
          <span>Compiled {formatDate(compiled.compiledAt)}</span>
        </div>
        <Badge tone={reportStatusTone(report.status)}>{reportStatusLabel(report.status)}</Badge>
      </div>

      <div className="report-metric-grid" aria-label="Report summary">
        <ReportMetric
          detail={attendanceDetail}
          label="Attendance"
          value={`${String(compiled.attendance.attendancePct)}%`}
        />
        <ReportMetric
          detail={`${formatNumber(compiled.behaviour.demeritsCount)} demerits`}
          label="Merits"
          value={formatNumber(compiled.behaviour.meritsEarned)}
        />
        <ReportMetric
          detail="Spend balance"
          label="Spend"
          value={formatNumber(compiled.balances.Spend)}
        />
        <ReportMetric
          detail="Saving balance"
          label="Saving"
          value={formatNumber(compiled.balances.Saving)}
        />
      </div>

      <div className="report-section">
        <div className="section-title">
          <div>
            <h2>PACE Progress</h2>
            <p className="muted">
              {formatNumber(compiled.paces.length)} subjects in this snapshot.
            </p>
          </div>
        </div>
        {compiled.paces.length === 0 ? (
          <div className="empty-state">No PACE progress recorded.</div>
        ) : (
          <div className="report-pace-list">
            {compiled.paces.map((pace) => (
              <article
                className="report-pace-row"
                key={`${pace.subjectCode}-${String(pace.currentPace)}`}
              >
                <div>
                  <strong>{pace.subjectName}</strong>
                  <span>{pace.subjectCode}</span>
                </div>
                <div>
                  <small>Current PACE</small>
                  <strong>{formatNumber(pace.currentPace)}</strong>
                </div>
                <div>
                  <small>Completed</small>
                  <strong>{formatNumber(pace.pacesCompletedThisTerm)}</strong>
                </div>
                <div>
                  <small>Avg score</small>
                  <strong>
                    {pace.averageTestScore === null ? 'N/A' : `${String(pace.averageTestScore)}%`}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="report-two-column">
        <section className="report-section" aria-labelledby="report-notes-title">
          <div className="section-title">
            <div>
              <h2 id="report-notes-title">General Notes</h2>
              <p className="muted">Sensitive notes are excluded.</p>
            </div>
          </div>
          <TextEntries emptyLabel="No general notes recorded." entries={compiled.notes} />
        </section>

        <section className="report-section" aria-labelledby="report-behaviour-title">
          <div className="section-title">
            <div>
              <h2 id="report-behaviour-title">Behaviour Notes</h2>
              <p className="muted">General behaviour entries only.</p>
            </div>
          </div>
          <TextEntries
            emptyLabel="No general behaviour notes recorded."
            entries={compiled.behaviour.generalEntries}
          />
        </section>
      </div>

      <section className="report-section" aria-labelledby="report-merits-title">
        <div className="section-title">
          <div>
            <h2 id="report-merits-title">Merit Activity</h2>
            <p className="muted">Latest ledger activity included in the snapshot.</p>
          </div>
        </div>
        {compiled.meritActivity.length === 0 ? (
          <div className="empty-state">No merit activity recorded.</div>
        ) : (
          <div className="report-ledger-list">
            {compiled.meritActivity.map((activity) => (
              <article
                className="report-ledger-row"
                key={`${activity.createdAt}-${activity.reason}`}
              >
                <span>{formatDate(activity.createdAt)}</span>
                <strong>{activity.account}</strong>
                <p>{activity.reason}</p>
                <b>{formatSignedNumber(activity.delta)}</b>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="report-section report-head-summary" aria-labelledby="head-summary-title">
        <div className="section-title">
          <div>
            <h2 id="head-summary-title">Head Summary</h2>
            <p className="muted">
              {isSent ? 'Frozen in the sent report.' : 'Reviewed before send.'}
            </p>
          </div>
        </div>
        {canEdit && !isSent ? (
          <Field label="Summary">
            <textarea
              className="input textarea"
              maxLength={3000}
              onChange={(event) => onHeadSummaryChange?.(event.target.value)}
              value={headSummary}
            />
          </Field>
        ) : (
          <p className="report-head-summary__text">
            {compiled.headSummary.trim() || 'No Head summary recorded.'}
          </p>
        )}
      </section>

      {canEdit ? (
        <div className="report-actions">
          <Button
            disabled={isSent || !onReview}
            onClick={onReview}
            pending={reviewPending}
            type="button"
          >
            <UserCheck aria-hidden="true" size={16} />
            Review
          </Button>
          <Button
            disabled={isSent || !onSend}
            onClick={onSend}
            pending={sendPending}
            type="button"
            variant="secondary"
          >
            {isSent ? <Mail aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
            {isSent ? 'Sent' : 'Send'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
