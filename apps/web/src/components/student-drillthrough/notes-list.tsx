import type { RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyCard, SnapshotBadge } from '@/components/child-log/snapshot-widgets';
import { formatShortDate } from '@/components/child-log/snapshot-utils';
import { Edit3, Trash2 } from 'lucide-react';

type DrillThrough = RouterOutputs['childLog']['drillThrough'];
type NoteEntry = DrillThrough['notes'][number];

export function NotesList({
  canManageCorrections = false,
  notes,
  onDelete,
  onEdit,
}: {
  canManageCorrections?: boolean;
  notes: readonly NoteEntry[];
  onDelete?: ((note: NoteEntry) => void) | undefined;
  onEdit?: ((note: NoteEntry) => void) | undefined;
}) {
  if (notes.length === 0) {
    return <EmptyCard>No supervisor notes this academic year.</EmptyCard>;
  }

  return (
    <div className="snapshot-list-panel">
      {notes.map((note, index) => (
        <NoteCard
          canManageCorrections={canManageCorrections}
          index={index}
          key={note.id}
          note={note}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function NoteCard({
  canManageCorrections,
  index,
  note,
  onDelete,
  onEdit,
}: {
  canManageCorrections: boolean;
  index: number;
  note: NoteEntry;
  onDelete?: ((note: NoteEntry) => void) | undefined;
  onEdit?: ((note: NoteEntry) => void) | undefined;
}) {
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
          <time dateTime={new Date(note.createdAt).toISOString()}>
            {formatShortDate(note.createdAt)}
          </time>
        </div>
      </div>
      <p>{note.note}</p>
      {canManageCorrections ? (
        <div className="lifecycle-actions">
          <Button
            onClick={() => {
              onEdit?.(note);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Edit3 aria-hidden="true" size={14} />
            Edit
          </Button>
          <Button
            onClick={() => {
              onDelete?.(note);
            }}
            size="sm"
            type="button"
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={14} />
            Delete
          </Button>
        </div>
      ) : null}
    </article>
  );
}
