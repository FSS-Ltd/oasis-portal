'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { BookOpenCheck, Clock, FileText, Medal, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { api } from '@/lib/trpc';

type RangePreset = 'previous-day' | 'previous-week' | 'custom';

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousDay(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

function previousWeekStart(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return dateKey(date);
}

function formatDateTime(value: Date | string | null): string {
  if (!value) return 'Not dated';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ChildSnapshotClient() {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset>('previous-day');
  const [from, setFrom] = useState(previousDay);
  const [to, setTo] = useState(previousDay);
  const [note, setNote] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  const studentsQuery = api.student.list.useQuery(undefined, { retry: false });
  const snapshotQuery = api.childLog.snapshot.useQuery(
    { studentId: selectedStudentId, from: new Date(`${from}T00:00:00.000Z`), to: new Date(`${to}T00:00:00.000Z`) },
    { enabled: selectedStudentId.length > 0, retry: false },
  );
  const utils = api.useUtils();
  const createNote = api.childNotes.create.useMutation({
    onSuccess: async () => {
      setNote('');
      setSensitive(false);
      setNoteStatus('Child note saved.');
      await utils.childLog.snapshot.invalidate();
      await utils.childNotes.listForStudent.invalidate();
    },
  });

  const selectedStudent = useMemo(
    () => studentsQuery.data?.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, studentsQuery.data],
  );

  function applyRange(value: RangePreset) {
    setRangePreset(value);
    if (value === 'previous-day') {
      const day = previousDay();
      setFrom(day);
      setTo(day);
    }
    if (value === 'previous-week') {
      setFrom(previousWeekStart());
      setTo(previousDay());
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoteStatus(null);
    if (!selectedStudentId || !note.trim()) return;
    await createNote.mutateAsync({ studentId: selectedStudentId, note, sensitive });
  }

  const snapshot = snapshotQuery.data;

  return (
    <div className="grid">
      <section className="panel panel__body">
        <div className="form-grid form-grid--two">
          <Field label="Child">
            <SelectInput
              aria-label="Snapshot child"
              disabled={studentsQuery.isLoading}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              value={selectedStudentId}
            >
              <option value="">Select a child</option>
              {(studentsQuery.data ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName} · {student.yearGroup}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Range">
            <SelectInput
              aria-label="Snapshot range"
              onChange={(event) => applyRange(event.target.value as RangePreset)}
              value={rangePreset}
            >
              <option value="previous-day">Previous day</option>
              <option value="previous-week">Previous week</option>
              <option value="custom">Custom</option>
            </SelectInput>
          </Field>
          <Field label="From">
            <TextInput
              disabled={rangePreset !== 'custom'}
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </Field>
          <Field label="To">
            <TextInput
              disabled={rangePreset !== 'custom'}
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </Field>
        </div>
        {studentsQuery.error ? <p className="status--error">{studentsQuery.error.message}</p> : null}
        {!studentsQuery.isLoading && (studentsQuery.data ?? []).length === 0 ? (
          <div className="empty-state">No active children found.</div>
        ) : null}
      </section>

      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <h2>Child note</h2>
            <p className="muted">
              {selectedStudent ? `Add a note for ${selectedStudent.fullName}.` : 'Select a child before adding a note.'}
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={submitNote}>
          <Field label="Note">
            <textarea
              aria-label="Child note"
              className="input textarea"
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </Field>
          <div aria-label="Note visibility" className="segmented-actions" role="group">
            <Button
              onClick={() => setSensitive(false)}
              type="button"
              variant={sensitive ? 'secondary' : 'primary'}
            >
              Normal
            </Button>
            <Button
              onClick={() => setSensitive(true)}
              type="button"
              variant={sensitive ? 'primary' : 'secondary'}
            >
              Sensitive
            </Button>
          </div>
          <Button disabled={!selectedStudentId || !note.trim()} pending={createNote.isPending} type="submit">
            Save note
          </Button>
          {noteStatus ? <p className="status--success">{noteStatus}</p> : null}
          {createNote.error ? <p className="status--error">{createNote.error.message}</p> : null}
        </form>
      </section>

      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <h2>Snapshot</h2>
            <p className="muted">
              {snapshot ? `${snapshot.student.fullName} · ${snapshot.range.from} to ${snapshot.range.to}` : 'Choose a child to load the log.'}
            </p>
          </div>
        </div>
        {snapshotQuery.isLoading ? <div className="empty-state">Loading snapshot...</div> : null}
        {snapshotQuery.error ? <p className="status--error">{snapshotQuery.error.message}</p> : null}
        {snapshot ? (
          <div className="snapshot-grid">
            <SnapshotSection icon={<BookOpenCheck size={16} />} title="Passed tests">
              {snapshot.passedTests.length === 0 ? <p>No passed final PACE tests.</p> : null}
              {snapshot.passedTests.map((test) => (
                <p key={test.id}>
                  {test.date}: {test.subjectCode} PACE {test.paceNumber} · {test.score}%
                </p>
              ))}
            </SnapshotSection>
            <SnapshotSection icon={<Medal size={16} />} title="Merits and demerits">
              {snapshot.behaviour.length === 0 ? <p>No behaviour entries.</p> : null}
              {snapshot.behaviour.map((entry) => (
                <p key={entry.id}>
                  {formatDateTime(entry.createdAt)}: {entry.type} {entry.meritDelta > 0 ? `+${entry.meritDelta}` : entry.meritDelta} ·{' '}
                  {entry.category}
                </p>
              ))}
            </SnapshotSection>
            <SnapshotSection icon={<Clock size={16} />} title="Tardiness">
              {snapshot.tardiness.length === 0 ? <p>No late attendance recorded.</p> : null}
              {snapshot.tardiness.map((row) => (
                <p key={row.id}>{row.date}: Late</p>
              ))}
            </SnapshotSection>
            <SnapshotSection icon={<StickyNote size={16} />} title="Notes">
              {snapshot.notes.length === 0 ? <p>No visible notes.</p> : null}
              {snapshot.notes.map((row) => (
                <div className="activity-row" key={row.id}>
                  <FileText aria-hidden="true" size={16} />
                  <div>
                    <strong>
                      {row.sensitive ? 'Sensitive' : 'General'} · {row.createdByName}
                    </strong>
                    <span>{formatDateTime(row.createdAt)}</span>
                    <p>{row.note}</p>
                  </div>
                </div>
              ))}
            </SnapshotSection>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SnapshotSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="snapshot-section">
      <h3>
        {icon}
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}
