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
  onUpdateScore: (subject: PaceSubject) => void;
  subjects: readonly PaceSubject[];
}

function ScoreValue({ score }: { score: number | null | undefined }) {
  return (
    <span className={`pace-score pace-score--${scoreTone(score)}`}>
      {formatScore(score)}
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
      render: (subject) => <ScoreValue score={subject.latestSelfTest?.score} />,
    },
    {
      id: 'final',
      header: 'PACE Test',
      render: (subject) => <ScoreValue score={subject.latestFinalTest?.score} />,
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
        render: (subject) => (
          <Button
            className="pace-update-button"
            disabled={!subject.active}
            onClick={() => {
              onUpdateScore(subject);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Edit3 aria-hidden="true" size={14} />
            Update Score
          </Button>
        ),
      },
    );
  }

  return (
    <div className="panel panel--scroll pace-table-panel">
      <DataTable
        columns={columns}
        empty={<EmptyState detail="Assign subjects before recording PACE scores." title="No subjects assigned" />}
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
