'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Download, Plus, Save, Send } from 'lucide-react';
import { TIMETABLE_DAYS, type TimetableDay } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import type { RouterOutputs } from '@/lib/trpc';
import { TimetableGrid, type TimetableGridEntry, type TimetableGridSlot } from './timetable-grid';
import { timetableCellKey } from './timetable-format';
import styles from './timetable.module.css';

type StudentDraft = RouterOutputs['timetable']['studentDraft'];

interface StudentTimetableEditorProps {
  draft: StudentDraft;
  onAddSubject: (name: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onSave: (
    entries: Array<{ day: TimetableDay; slotId: string; subjectId: string }>,
  ) => Promise<void>;
  pendingAction: 'subject' | 'save' | 'publish' | null;
  publicationId: string | null;
  slots: readonly TimetableGridSlot[];
}

export function StudentTimetableEditor({
  draft,
  onAddSubject,
  onPublish,
  onSave,
  pendingAction,
  publicationId,
  slots,
}: StudentTimetableEditorProps) {
  const [entries, setEntries] = useState<TimetableGridEntry[]>(draft.entries);
  const [subjectName, setSubjectName] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const busy = publishing || pendingAction !== null;
  const lessonCount = slots.filter((slot) => slot.kind === 'Lesson').length * TIMETABLE_DAYS.length;
  const assignedCellCount = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.subjectId)
          .map((entry) => timetableCellKey(entry.day, entry.slotId)),
      ).size,
    [entries],
  );
  const missingCount = Math.max(0, lessonCount - assignedCellCount);

  function updateSubject(day: TimetableDay, slotId: string, subjectId: string): void {
    setEntries((current) => {
      const key = timetableCellKey(day, slotId);
      const withoutCell = current.filter(
        (entry) => timetableCellKey(entry.day, entry.slotId) !== key,
      );
      return subjectId ? [...withoutCell, { day, slotId, subjectId }] : withoutCell;
    });
  }

  function addSubject(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const name = subjectName.trim();
    if (!name) {
      setSubjectError('Enter a subject name.');
      return;
    }
    setSubjectError(null);
    void onAddSubject(name)
      .then(() => {
        setSubjectName('');
      })
      .catch(() => undefined);
  }

  async function saveDraft(): Promise<void> {
    await onSave(
      entries.flatMap((entry) =>
        entry.subjectId
          ? [{ day: entry.day, slotId: entry.slotId, subjectId: entry.subjectId }]
          : [],
      ),
    );
  }

  async function publishCurrentDraft(): Promise<void> {
    if (busy) return;
    setPublishing(true);
    try {
      await saveDraft();
      await onPublish();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className={styles.editorPanel} aria-labelledby="student-timetable-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p>Individual timetable</p>
          <h2 id="student-timetable-heading">{draft.student.firstName}</h2>
          <span>
            Choose from this child’s subjects. Each timetable is saved and published separately.
          </span>
        </div>
        <span className={publicationId ? styles.savedBadge : styles.draftBadge}>
          {publicationId ? 'Published' : draft.timetableId ? 'Draft saved' : 'Not started'}
        </span>
      </div>

      <div className={styles.subjectLegend} aria-label="Assigned subject colours">
        {draft.subjects.map((subject) => (
          <span data-colour={subject.colour} key={subject.id}>
            <i aria-hidden="true" /> {subject.name}
          </span>
        ))}
      </div>

      <TimetableGrid
        editable
        entries={entries}
        {...(busy ? {} : { onSubjectChange: updateSubject })}
        slots={slots}
        subjects={draft.subjects}
      />

      <div className={styles.suggestionBar} data-complete={missingCount === 0}>
        <strong>
          {missingCount === 0
            ? 'Every lesson has a subject.'
            : `${String(missingCount)} lesson${missingCount === 1 ? '' : 's'} left open.`}
        </strong>
        <span>Missing lessons are suggestions only. You can still publish this timetable.</span>
      </div>

      <form className={styles.addSubjectForm} onSubmit={addSubject}>
        <Field
          error={subjectError ?? undefined}
          hint="Extra subjects are reusable and appear in grey."
          label="Add another subject"
        >
          <TextInput
            disabled={busy}
            aria-invalid={subjectError ? true : undefined}
            onChange={(event) => {
              setSubjectName(event.target.value);
            }}
            placeholder="e.g. French"
            value={subjectName}
          />
        </Field>
        <Button
          disabled={busy}
          pending={pendingAction === 'subject'}
          size="sm"
          type="submit"
          variant="secondary"
        >
          <Plus aria-hidden="true" size={15} /> Add subject
        </Button>
      </form>

      <div className={styles.editorActions}>
        <Button
          disabled={busy}
          onClick={() => {
            void saveDraft().catch(() => undefined);
          }}
          pending={pendingAction === 'save'}
          type="button"
          variant="secondary"
        >
          <Save aria-hidden="true" size={16} /> Save draft
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            void publishCurrentDraft().catch(() => undefined);
          }}
          pending={publishing || pendingAction === 'publish'}
          type="button"
        >
          <Send aria-hidden="true" size={16} /> Publish timetable
        </Button>
        {publicationId ? (
          <a className={styles.downloadButton} href={`/api/timetables/${publicationId}/pdf`}>
            <Download aria-hidden="true" size={16} /> Download PDF
          </a>
        ) : null}
      </div>
    </section>
  );
}
