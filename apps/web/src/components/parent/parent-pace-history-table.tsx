'use client';

import { formatPaceIdentifier } from '@oasis/domain';
import { type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

type ParentPaceHistory = RouterOutputs['pace']['parentHistory'];
type PaceHistoryRow = ParentPaceHistory['rows'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function assessmentLabel(testType: PaceHistoryRow['testType']): string {
  return testType === 'SelfTest' ? 'Self-Test' : 'PACE Test';
}

function resultLabel(result: PaceHistoryRow['result']): string {
  return result === 'Passed' ? 'Passed' : 'Below pass mark';
}

interface ParentPaceHistoryTableProps {
  error: { message: string } | null;
  history: ParentPaceHistory | undefined;
  isLoading: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

export function ParentPaceHistoryTable({
  error,
  history,
  isLoading,
  onNextPage,
  onPreviousPage,
}: ParentPaceHistoryTableProps) {
  const rows = history?.rows ?? [];
  const start = history && history.totalRows > 0 ? (history.page - 1) * history.pageSize + 1 : 0;
  const end = history ? Math.min(history.page * history.pageSize, history.totalRows) : 0;
  const hasPreviousPage = Boolean(history && history.page > 1);
  const hasNextPage = Boolean(history && history.page < history.totalPages);

  return (
    <section aria-label="PACE history" className="parent-pace-history">
      <DataTable<PaceHistoryRow>
        columns={[
          {
            header: 'Subject',
            id: 'subject',
            render: (row) => (
              <span className="parent-pace-history__subject">
                <strong>{row.subjectCode}</strong>
                <span>{row.subjectName}</span>
              </span>
            ),
          },
          {
            header: 'PACE',
            id: 'pace',
            render: (row) => `PACE ${formatPaceIdentifier(row.paceNumber)}`,
          },
          {
            header: 'Assessment',
            id: 'assessment',
            render: (row) => assessmentLabel(row.testType),
          },
          {
            header: 'Score',
            id: 'score',
            render: (row) => `${String(row.score)}%`,
          },
          {
            header: 'Result',
            id: 'result',
            render: (row) => (
              <Badge tone={row.result === 'Passed' ? 'green' : 'amber'}>
                {resultLabel(row.result)}
              </Badge>
            ),
          },
          {
            header: 'Date',
            id: 'date',
            render: (row) => dateFormatter.format(new Date(row.completedAt)),
          },
        ]}
        empty="No PACE assessments were recorded in this period."
        errorMessage={error?.message || (error ? 'PACE history could not be loaded.' : undefined)}
        getRowKey={(row) => row.id}
        loading={isLoading}
        loadingLabel="Loading PACE history…"
        rows={rows}
        tableClassName="parent-pace-history__table"
      />
      {history && !error && !isLoading ? (
        <div aria-live="polite" className="parent-pace-pagination">
          <p>
            Showing {String(start)}–{String(end)} of {String(history.totalRows)}
          </p>
          <div>
            <Button
              aria-label="Previous PACE history page"
              className="parent-pace-pagination__button"
              disabled={!hasPreviousPage}
              onClick={onPreviousPage}
              size="sm"
              type="button"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              aria-label="Next PACE history page"
              className="parent-pace-pagination__button"
              disabled={!hasNextPage}
              onClick={onNextPage}
              size="sm"
              type="button"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
