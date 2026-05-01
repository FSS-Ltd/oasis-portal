import type { RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { EmptyCard, SnapshotBadge } from '@/components/child-log/snapshot-widgets';
import { formatShortDate } from '@/components/child-log/snapshot-utils';

type DrillThrough = RouterOutputs['childLog']['drillThrough'];
type NoteEntry = DrillThrough['notes'][number];

export function NotesList({ notes }: { notes: readonly NoteEntry[] }) {
  if (notes.length === 0) {
    return <EmptyCard>No supervisor notes this academic year.</EmptyCard>;
  }

  return (
    <div className="snapshot-list-panel">
      {notes.map((note, index) => (
        <NoteCard index={index} key={note.id} note={note} />
      ))}
    </div>
  );
}

function NoteCard({ index, note }: { index: number; note: NoteEntry }) {
  return (
    <article className="panel panel__body student-note-card">
      <div className="student-note-card__header">
        <div className="student-note-card__author">
          <Avatar className="student-note-card__avatar" index={index} name={note.createdByName} />
          <div>
            <strong>{note.createdByName}</strong>
            <span>Supervisor note</span>
          </div>
        </div>
        <div className="student-note-card__meta">
          {note.sensitive ? <SnapshotBadge tone="amber">Sensitive</SnapshotBadge> : null}
          <time dateTime={new Date(note.createdAt).toISOString()}>{formatShortDate(note.createdAt)}</time>
        </div>
      </div>
      <p>{note.note}</p>
    </article>
  );
}
