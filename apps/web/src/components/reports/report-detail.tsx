'use client';

import { formatPaceIdentifier } from '@oasis/domain';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import type { ReportSpecificNoteDraft } from './report-editor-state';
import { ReportNoteEditor } from './report-note-editor';
import {
  formatDate,
  formatNumber,
  formatSignedNumber,
  reportStatusLabel,
  reportStatusTone,
  type TermReport,
} from './report-format';

interface ReportDetailProps {
  behaviourNotes: readonly ReportSpecificNoteDraft[];
  canEdit: boolean;
  editorDisabled?: boolean;
  generalNotes: readonly ReportSpecificNoteDraft[];
  onBehaviourNotesChange?: (entries: ReportSpecificNoteDraft[]) => void;
  onGeneralNotesChange?: (entries: ReportSpecificNoteDraft[]) => void;
  onProgressCommentChange?: (value: string) => void;
  progressComment: string;
  report: TermReport | null;
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
          <p className="muted">{canEdit ? 'Choose a period or report to begin.' : 'Select a report.'}</p>
        </div>
      </div>
      <div className="empty-state">{canEdit ? 'No report selected.' : 'No sent report selected.'}</div>
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
        <article className="report-entry" key={entry.id}>
          <span>{formatDate(entry.createdAt)}</span>
          {entry.category ? <strong>{entry.category}</strong> : null}
          <p>{entry.note ?? 'No note recorded.'}</p>
        </article>
      ))}
    </div>
  );
}

function SectionHeading({ detail, id, title }: { detail: string; id: string; title: string }) {
  return (
    <div className="section-title">
      <div>
        <h2 id={id}>{title}</h2>
        <p className="muted">{detail}</p>
      </div>
    </div>
  );
}

export function ReportDetail({
  behaviourNotes,
  canEdit,
  editorDisabled = false,
  generalNotes,
  onBehaviourNotesChange,
  onGeneralNotesChange,
  onProgressCommentChange,
  progressComment,
  report,
}: ReportDetailProps) {
  if (!report) return <EmptyReportDetail canEdit={canEdit} />;

  const { compiled } = report;
  const isSent = report.status === 'Sent';
  const editable = canEdit && !isSent;
  const hasSummaryMetrics =
    compiled.sections.attendance ||
    compiled.sections.behaviourSummary ||
    compiled.sections.balances;
  const attendanceDetail = `${formatNumber(compiled.attendance.present)} present · ${formatNumber(
    compiled.attendance.absent,
  )} absent · ${formatNumber(compiled.attendance.late)} late`;
  const behaviourSourceEntries = compiled.behaviour.generalEntries.filter(
    (entry) => entry.origin === 'Source',
  );
  const generalSourceEntries = compiled.notes.filter((entry) => entry.origin === 'Source');
  const balances = [
    ['Spend', compiled.balances.Spend],
    ['Saving', compiled.balances.Saving],
    ['Investment', compiled.balances.Investment],
    ['Investment Return', compiled.balances.InvestmentReturn],
    ['Tithe Paid', compiled.balances.TithePaid],
    ['Given', compiled.balances.Given],
  ] as const;

  return (
    <section className="panel panel__body report-detail" aria-labelledby="report-detail-title">
      <div className="report-detail__header">
        <div>
          <p className="eyebrow">{report.period.label}</p>
          <h2 id="report-detail-title">{compiled.studentDisplayName}</h2>
          <span>Compiled {formatDate(compiled.compiledAt)}</span>
        </div>
        <Badge tone={reportStatusTone(report.status)}>{reportStatusLabel(report.status)}</Badge>
      </div>

      {hasSummaryMetrics ? (
        <div className="report-metric-grid" aria-label="Report summary">
          {compiled.sections.attendance ? (
            <ReportMetric
              detail={attendanceDetail}
              label="Attendance"
              value={`${String(compiled.attendance.attendancePct)}%`}
            />
          ) : null}
          {compiled.sections.behaviourSummary ? (
            <ReportMetric
              detail={`${formatNumber(compiled.behaviour.demeritsCount)} demerits`}
              label="Merits"
              value={formatNumber(compiled.behaviour.meritsEarned)}
            />
          ) : null}
          {compiled.sections.balances ? (
            <>
              <ReportMetric label="Spend" value={formatNumber(compiled.balances.Spend)} />
              <ReportMetric label="Saving" value={formatNumber(compiled.balances.Saving)} />
            </>
          ) : null}
        </div>
      ) : null}

      {compiled.sections.paceProgress ? (
        <section className="report-section" aria-labelledby="report-pace-title">
          <SectionHeading
            detail={`${formatNumber(compiled.paces.length)} subjects in this snapshot.`}
            id="report-pace-title"
            title="PACE Progress"
          />
          {compiled.paces.length === 0 ? (
            <div className="empty-state">No PACE progress recorded.</div>
          ) : (
            <div className="report-pace-list">
              {compiled.paces.map((pace) => (
                <article className="report-pace-row" key={pace.subjectCode}>
                  <div>
                    <strong>{pace.subjectName}</strong>
                    <span>{pace.subjectCode}</span>
                  </div>
                  <div>
                    <small>Current PACE</small>
                    <strong>{formatPaceIdentifier(pace.currentPace)}</strong>
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
                  {compiled.sections.paceStatus ? (
                    <Badge tone={pace.status.tone}>{pace.status.status}</Badge>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {compiled.sections.generalNotes || compiled.sections.behaviourNotes ? (
        <div className="report-two-column">
          {compiled.sections.generalNotes ? (
            <section className="report-section" aria-labelledby="report-notes-title">
              <SectionHeading
                detail="Sensitive source notes are excluded."
                id="report-notes-title"
                title="General Notes"
              />
              {editable ? (
                <ReportNoteEditor
                  allowCategory={false}
                  disabled={editorDisabled}
                  emptyLabel="No source general notes recorded."
                  label="General Note"
                  onChange={(entries) => onGeneralNotesChange?.(entries)}
                  reportEntries={generalNotes}
                  sourceEntries={generalSourceEntries}
                />
              ) : (
                <TextEntries emptyLabel="No general notes recorded." entries={compiled.notes} />
              )}
            </section>
          ) : null}

          {compiled.sections.behaviourNotes ? (
            <section className="report-section" aria-labelledby="report-behaviour-title">
              <SectionHeading
                detail="General source behaviour entries only."
                id="report-behaviour-title"
                title="Behaviour Notes"
              />
              {editable ? (
                <ReportNoteEditor
                  allowCategory
                  disabled={editorDisabled}
                  emptyLabel="No source behaviour notes recorded."
                  label="Behaviour Note"
                  onChange={(entries) => onBehaviourNotesChange?.(entries)}
                  reportEntries={behaviourNotes}
                  sourceEntries={behaviourSourceEntries}
                />
              ) : (
                <TextEntries
                  emptyLabel="No behaviour notes recorded."
                  entries={compiled.behaviour.generalEntries}
                />
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {compiled.sections.meritActivity ? (
        <section className="report-section" aria-labelledby="report-merits-title">
          <SectionHeading
            detail="Ledger activity included in the snapshot."
            id="report-merits-title"
            title="Merit Activity"
          />
          {compiled.meritActivity.length === 0 ? (
            <div className="empty-state">No merit activity recorded.</div>
          ) : (
            <div className="report-ledger-list">
              {compiled.meritActivity.map((activity) => (
                <article className="report-ledger-row" key={`${activity.createdAt}-${activity.reason}`}>
                  <span>{formatDate(activity.createdAt)}</span>
                  <strong>{activity.account}</strong>
                  <p>{activity.reason}</p>
                  <b>{formatSignedNumber(activity.delta)}</b>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {compiled.sections.balances ? (
        <section className="report-section" aria-labelledby="report-balances-title">
          <SectionHeading
            detail="Balances frozen in this report snapshot."
            id="report-balances-title"
            title="Balances"
          />
          <div className="report-balance-grid">
            {balances.map(([label, value]) => (
              <ReportMetric key={label} label={label} value={formatNumber(value)} />
            ))}
          </div>
        </section>
      ) : null}

      {compiled.sections.progressComment ? (
        <section className="report-section report-progress-comment" aria-labelledby="progress-comment-title">
          <SectionHeading
            detail={isSent ? 'Frozen in the sent report.' : 'Add a clear summary of progress.'}
            id="progress-comment-title"
            title="Progress Comment"
          />
          {editable ? (
            <Field label="Progress Comment">
              <textarea
                className="input textarea"
                disabled={editorDisabled}
                maxLength={5000}
                onChange={(event) => onProgressCommentChange?.(event.target.value)}
                value={progressComment}
              />
            </Field>
          ) : (
            <p className="report-progress-comment__text">
              {compiled.headSummary.trim() || 'No progress comment recorded.'}
            </p>
          )}
        </section>
      ) : null}

      {compiled.author ? (
        <footer className="report-author">
          <span>Prepared by</span>
          <strong>{compiled.author.name}</strong>
          <small>{compiled.author.role}</small>
        </footer>
      ) : null}
    </section>
  );
}
