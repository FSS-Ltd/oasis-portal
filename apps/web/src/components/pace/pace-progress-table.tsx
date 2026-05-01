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

export function PaceProgressTable({
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
  ];

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
