'use client';

import { Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  formatScore,
  formatShortDate,
  scoreTone,
  statusTone,
  type PaceSubject,
} from './pace-workflow-utils';

interface PaceProgressTableProps {
  loading: boolean;
  canManageProgress: boolean;
  errorMessage?: string | undefined;
  onRecordScore: (subject: PaceSubject) => void;
  onUpdateScore: (
    subject: PaceSubject,
    record: NonNullable<PaceSubject['currentScoreRecord']>,
  ) => void;
  subjects: readonly PaceSubject[];
}

function ScoreValue({
  canManageProgress,
  label,
  onUpdateScore,
  record,
  subject,
}: {
  canManageProgress: boolean;
  label: string;
  onUpdateScore: (
    subject: PaceSubject,
    record: NonNullable<PaceSubject['currentScoreRecord']>,
  ) => void;
  record: NonNullable<PaceSubject['currentScoreRecord']> | null | undefined;
  subject: PaceSubject;
}) {
  return (
    <span className="pace-score-cell">
      <span className={`pace-score pace-score--${scoreTone(record?.score)}`}>
        {formatScore(record?.score)}
      </span>
      {canManageProgress && record ? (
        <Button
          aria-label={`Update ${label} score for ${subject.name}`}
          className="pace-score-edit-button"
          disabled={!subject.active}
          onClick={() => {
            onUpdateScore(subject, record);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Edit3 aria-hidden="true" size={14} />
          <span className="sr-only">Update {label} score</span>
        </Button>
      ) : null}
    </span>
  );
}

function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${String(value)} day${value === 1 ? '' : 's'}`;
}

function PaceTiming({ subject }: { subject: PaceSubject }) {
  const attempts = subject.currentFinalTestAttempts;
  return (
    <span className="pace-timing-cell">
      <strong>{formatDays(subject.currentPaceDays)}</strong>
      <span>
        {String(attempts)} PACE test attempt{attempts === 1 ? '' : 's'} · avg{' '}
        {formatDays(subject.averagePaceCompletionDays)}
      </span>
    </span>
  );
}

export function PaceProgressTable({
  canManageProgress,
  errorMessage,
  loading,
  onRecordScore,
  onUpdateScore,
  subjects,
}: PaceProgressTableProps) {
  const columns: DataTableColumn<PaceSubject>[] = [
    {
      id: 'subject',
      header: 'Subject',
      render: (subject) => (
        <span className="pace-subject-cell">
          <strong>{subject.name}</strong>
        </span>
      ),
    },
    {
      id: 'pace',
      header: 'PACE #',
      render: (subject) => (
        <strong className="pace-number">#{String(subject.currentPaceNumber)}</strong>
      ),
    },
    {
      id: 'started',
      header: 'Started',
      render: (subject) => (
        <span className="muted">{formatShortDate(subject.currentPaceStartedAt)}</span>
      ),
    },
    {
      id: 'self',
      header: 'Self-Test',
      render: (subject) => (
        <ScoreValue
          canManageProgress={canManageProgress}
          label="Self-Test"
          onUpdateScore={onUpdateScore}
          record={subject.latestSelfTest}
          subject={subject}
        />
      ),
    },
    {
      id: 'final',
      header: 'PACE Test',
      render: (subject) => (
        <ScoreValue
          canManageProgress={canManageProgress}
          label="PACE Test"
          onUpdateScore={onUpdateScore}
          record={subject.latestFinalTest}
          subject={subject}
        />
      ),
    },
    {
      id: 'completed',
      header: 'Completed',
      render: (subject) => (
        <span className="muted">{formatShortDate(subject.latestCompletedAt)}</span>
      ),
    },
    {
      id: 'pace-time',
      header: 'Pace Time',
      render: (subject) => <PaceTiming subject={subject} />,
    },
  ];

  if (canManageProgress) {
    columns.push(
      {
        id: 'status',
        header: 'Status',
        render: (subject) => (
          <span className="pace-status-cell">
            <Badge tone={statusTone(subject.status.tone)}>{subject.status.status}</Badge>
            <span>{subject.status.detail}</span>
          </span>
        ),
      },
      {
        id: 'actions',
        className: 'pace-action-cell',
        header: <span className="sr-only">Update score</span>,
        headerClassName: 'pace-action-heading',
        render: (subject) => {
          const hasBothTestTypes =
            subject.latestSelfTest !== null && subject.latestFinalTest !== null;
          if (hasBothTestTypes) {
            return <span className="sr-only">Both scores recorded</span>;
          }

          return (
            <Button
              className="pace-update-button"
              disabled={!subject.active}
              onClick={() => {
                onRecordScore(subject);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Edit3 aria-hidden="true" size={14} />
              Record Score
            </Button>
          );
        },
      },
    );
  }

  return (
    <div className="panel panel--scroll pace-table-panel">
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            detail="Assign subjects before recording PACE scores."
            title="No subjects assigned"
          />
        }
        errorMessage={errorMessage}
        getRowKey={(subject) => subject.subjectId}
        loading={loading}
        loadingLabel="Loading PACE progress..."
        rows={subjects}
        tableClassName="pace-progress-table"
      />
    </div>
  );
}
