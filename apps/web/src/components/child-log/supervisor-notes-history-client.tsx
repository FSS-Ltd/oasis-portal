'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { api, type RouterOutputs } from '@/lib/trpc';
import { SnapshotCentrePickerCard, SnapshotStudentPicker } from './snapshot-controls';
import { SnapshotBadge } from './snapshot-widgets';

type HistoryStudent = RouterOutputs['childLog']['supervisorNotesHistory'][number];
type HistoryItem = HistoryStudent['notes'][number];

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function itemLabel(item: HistoryItem): string {
  if (item.kind === 'note') return item.sensitive ? 'Sensitive Note' : 'Supervisor Note';
  if (item.type === 'General') return 'Sensitive General Mark';
  if (item.type === 'Demerit') return 'Sensitive Demerit';
  return `Sensitive ${item.type}`;
}

function rowTone(item: HistoryItem): 'demerit' | 'merit' | 'note' {
  if (item.kind === 'note') return 'note';
  return item.meritDelta < 0 ? 'demerit' : 'merit';
}

function meritLabel(item: HistoryItem): string {
  if (item.kind === 'note') return 'Note';
  if (item.meritDelta > 0) return `+${String(item.meritDelta)}`;
  return String(item.meritDelta);
}

function HistoryTimeline({ student }: { student: HistoryStudent }) {
  return (
    <section className="panel panel__body notes-history-group">
      <header>
        <div>
          <h2>{student.fullName}</h2>
          <p>{student.yearGroup}</p>
        </div>
        <SnapshotBadge tone="blue">
          {student.notes.length === 1 ? '1 item' : `${String(student.notes.length)} items`}
        </SnapshotBadge>
      </header>
      <div className="notes-history-list">
        {student.notes.map((item) => (
          <article
            className={`notes-history-row is-${rowTone(item)}`}
            key={`${item.kind}-${item.id}`}
          >
            <div className="notes-history-row__value">{meritLabel(item)}</div>
            <div className="notes-history-row__content">
              <div className="notes-history-row__badges">
                <SnapshotBadge tone={item.seenAt ? 'green' : 'amber'}>
                  {item.seenAt ? 'Reviewed' : 'Pending Review'}
                </SnapshotBadge>
                <SnapshotBadge tone={item.kind === 'mark' && item.meritDelta < 0 ? 'red' : 'blue'}>
                  {itemLabel(item)}
                </SnapshotBadge>
                {item.kind === 'mark' ? (
                  <SnapshotBadge tone="blue">{item.category}</SnapshotBadge>
                ) : null}
                <SnapshotBadge tone={item.sensitive ? 'amber' : 'blue'}>
                  {item.sensitive ? 'Sensitive' : 'General'}
                </SnapshotBadge>
                {item.headComment ? <SnapshotBadge tone="green">Head Comment</SnapshotBadge> : null}
              </div>
              <p className="notes-history-row__body">{item.body ?? 'No note text recorded.'}</p>
              <p className="notes-history-row__meta">
                Recorded {formatDateTime(item.createdAt)} by <strong>{item.author.fullName}</strong>{' '}
                ({item.author.role})
              </p>
              {item.seenAt ? (
                <p className="notes-history-row__meta">
                  Reviewed {formatDateTime(item.seenAt)}
                  {item.seenByName ? ` by ${item.seenByName}` : ''}
                </p>
              ) : null}
              {item.headComment ? (
                <p className="notes-history-row__comment">Head: {item.headComment}</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SupervisorNotesHistoryClient() {
  const [selectedStudentId, setSelectedStudentId] = useState('all');
  const historyQuery = api.childLog.supervisorNotesHistory.useQuery(undefined, {
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  });
  const students = historyQuery.data ?? [];
  const pickerStudents = useMemo(
    () =>
      students.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        yearGroup: student.yearGroup,
      })),
    [students],
  );

  useEffect(() => {
    if (
      selectedStudentId !== 'all' &&
      !students.some((student) => student.id === selectedStudentId)
    ) {
      setSelectedStudentId('all');
    }
  }, [selectedStudentId, students]);

  const visibleStudents =
    selectedStudentId === 'all'
      ? students
      : students.filter((student) => student.id === selectedStudentId);

  return (
    <div className="snapshot-page notes-history-page">
      <div className="snapshot-page__header">
        <h1>Notes History</h1>
        <p>Review supervisor notes and sensitive marks recorded for each child.</p>
      </div>

      <section className="panel panel__body snapshot-picker-panel">
        <h2>Select view</h2>
        {historyQuery.error ? <p className="status--error">{historyQuery.error.message}</p> : null}
        {historyQuery.isLoading ? <EmptyState>Loading notes history...</EmptyState> : null}
        {!historyQuery.isLoading && students.length === 0 ? (
          <EmptyState>No notes or sensitive marks recorded yet.</EmptyState>
        ) : null}
        <div className="snapshot-view-picker">
          <SnapshotCentrePickerCard
            active={selectedStudentId === 'all'}
            onSelect={() => {
              setSelectedStudentId('all');
            }}
            studentCount={students.length}
          />
          <SnapshotStudentPicker
            onSelect={setSelectedStudentId}
            selectedStudentId={selectedStudentId === 'all' ? '' : selectedStudentId}
            students={pickerStudents}
          />
        </div>
      </section>

      <div className="snapshot-tab-panel snapshot-list-panel">
        {visibleStudents.map((student) => (
          <HistoryTimeline key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
}
