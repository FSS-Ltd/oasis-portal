'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Edit3, Trash2, X } from 'lucide-react';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';
import { avatarColour, getInitials, SNAPSHOT_AVATAR_COLOURS } from '@/lib/display';
import { api, type RouterOutputs } from '@/lib/trpc';
import {
  SnapshotCentrePickerCard,
  SnapshotHeroCentre,
  SnapshotHeroStudent,
  SnapshotRangePicker,
  SnapshotStudentPicker,
  SnapshotTabs,
} from './snapshot-controls';
import {
  dateKey,
  formatShortDate,
  previousDay,
  previousWeekStart,
  scoreLabel,
  scoreTone,
  todayDate,
  type RangePreset,
  type SnapshotTab,
} from './snapshot-utils';
import {
  AttendanceRing,
  EmptyCard,
  LegendRow,
  MeritSparkline,
  ScoreDonut,
  SnapshotBadge,
  SnapshotStatCard,
  SummaryTotal,
} from './snapshot-widgets';

type SnapshotResult = RouterOutputs['childLog']['snapshot'];
type SnapshotBehaviourEntry = SnapshotResult['behaviour'][number];
type SnapshotNoteEntry = SnapshotResult['notes'][number];
type SnapshotViewMode = 'centre' | 'student';
type SnapshotStudentIdentity = { student: { fullName: string } };

interface EditingBehaviourForm {
  id: string;
  type: SnapshotBehaviourEntry['type'];
  category: string;
  note: string;
  visibility: SnapshotBehaviourEntry['visibility'];
  amount: string;
}

interface EditingNoteForm {
  id: string;
  note: string;
  sensitive: boolean;
}

function hasSnapshotStudent(value: unknown): value is SnapshotStudentIdentity {
  if (!value || typeof value !== 'object' || !('student' in value)) return false;
  const student = (value as { student?: { fullName?: unknown } }).student;
  return typeof student?.fullName === 'string';
}

interface ChildSnapshotClientProps {
  canManageCorrections: boolean;
  defaultView?: SnapshotViewMode;
  enableCentreOverview?: boolean;
}

export function ChildSnapshotClient({
  canManageCorrections,
  defaultView = 'student',
  enableCentreOverview = false,
}: ChildSnapshotClientProps) {
  const [viewMode, setViewMode] = useState<SnapshotViewMode>(
    enableCentreOverview ? defaultView : 'student',
  );
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset>('today');
  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(todayDate);
  const [activeTab, setActiveTab] = useState<SnapshotTab>('overview');
  const [note, setNote] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const [editingBehaviour, setEditingBehaviour] = useState<EditingBehaviourForm | null>(null);
  const [deletingBehaviour, setDeletingBehaviour] = useState<SnapshotBehaviourEntry | null>(null);
  const [editingNote, setEditingNote] = useState<EditingNoteForm | null>(null);
  const [deletingNote, setDeletingNote] = useState<SnapshotNoteEntry | null>(null);

  const studentsQuery = api.childLog.listSnapshotStudents.useQuery(undefined, { retry: false });
  const snapshotQuery = api.childLog.snapshot.useQuery(
    {
      studentId: selectedStudentId,
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T00:00:00.000Z`),
    },
    { enabled: viewMode === 'student' && selectedStudentId.length > 0, retry: false },
  );
  const centreSnapshotQuery = api.childLog.centreSnapshot.useQuery(
    {
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T00:00:00.000Z`),
    },
    { enabled: enableCentreOverview && viewMode === 'centre', retry: false },
  );
  const utils = api.useUtils();
  const createNote = api.childNotes.create.useMutation({
    onSuccess: async () => {
      setNote('');
      setSensitive(false);
      setNoteStatus('Child note saved.');
      await utils.childLog.snapshot.invalidate();
      await utils.childLog.centreSnapshot.invalidate();
    },
  });
  const updateBehaviour = api.behaviour.updateEntry.useMutation({
    onSuccess: async () => {
      setEditingBehaviour(null);
      await utils.childLog.snapshot.invalidate();
      await utils.childLog.centreSnapshot.invalidate();
    },
  });
  const deleteBehaviour = api.behaviour.deleteEntry.useMutation({
    onSuccess: async () => {
      setDeletingBehaviour(null);
      await utils.childLog.snapshot.invalidate();
      await utils.childLog.centreSnapshot.invalidate();
    },
  });
  const updateNote = api.childNotes.update.useMutation({
    onSuccess: async () => {
      setEditingNote(null);
      await utils.childLog.snapshot.invalidate();
      await utils.childLog.centreSnapshot.invalidate();
    },
  });
  const deleteNote = api.childNotes.delete.useMutation({
    onSuccess: async () => {
      setDeletingNote(null);
      await utils.childLog.snapshot.invalidate();
      await utils.childLog.centreSnapshot.invalidate();
    },
  });

  useEffect(() => {
    const firstStudent = studentsQuery.data?.[0];
    if (viewMode === 'student' && !selectedStudentId && firstStudent) {
      setSelectedStudentId(firstStudent.id);
    }
  }, [selectedStudentId, studentsQuery.data, viewMode]);

  function applyRange(value: RangePreset) {
    setRangePreset(value);
    if (value === 'today') {
      const day = todayDate();
      setFrom(day);
      setTo(day);
    }
    if (value === 'previous-day') {
      const day = previousDay();
      setFrom(day);
      setTo(day);
    }
    if (value === 'previous-week') {
      setFrom(previousWeekStart());
      setTo(dateKey(new Date()));
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoteStatus(null);
    if (!selectedStudentId || !note.trim()) return;
    await createNote.mutateAsync({ studentId: selectedStudentId, note, sensitive });
  }

  async function submitBehaviourEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingBehaviour) return;
    await updateBehaviour.mutateAsync({
      id: editingBehaviour.id,
      category: editingBehaviour.category,
      note: editingBehaviour.note.trim() ? editingBehaviour.note : null,
      visibility: editingBehaviour.visibility,
      ...(editingBehaviour.type === 'Merit' ? { amount: Number(editingBehaviour.amount) } : {}),
    });
  }

  async function submitNoteEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingNote) return;
    await updateNote.mutateAsync({
      id: editingNote.id,
      note: editingNote.note,
      sensitive: editingNote.sensitive,
    });
  }

  const students = studentsQuery.data ?? [];
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const isCentreMode = enableCentreOverview && viewMode === 'centre';
  const snapshot = snapshotQuery.data;
  const centreSnapshot = centreSnapshotQuery.data;
  const attendance = isCentreMode
    ? (centreSnapshot?.attendance ?? [])
    : (snapshot?.attendance ?? []);
  const behaviour = isCentreMode ? (centreSnapshot?.behaviour ?? []) : (snapshot?.behaviour ?? []);
  const pace = isCentreMode ? (centreSnapshot?.passedTests ?? []) : (snapshot?.passedTests ?? []);
  const notes = isCentreMode ? (centreSnapshot?.notes ?? []) : (snapshot?.notes ?? []);
  const presentDays = isCentreMode
    ? (centreSnapshot?.summary.attendance.present ?? 0)
    : attendance.filter((row) => row.status === 'Present').length;
  const lateDays = isCentreMode
    ? (centreSnapshot?.summary.attendance.late ?? 0)
    : attendance.filter((row) => row.status === 'Late').length;
  const absentDays = isCentreMode
    ? (centreSnapshot?.summary.attendance.absent ?? 0)
    : attendance.filter((row) => row.status === 'Absent').length;
  const meritsEarned = isCentreMode
    ? (centreSnapshot?.summary.meritsEarned ?? 0)
    : behaviour
        .filter((entry) => entry.meritDelta > 0)
        .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const demeritsTotal = isCentreMode
    ? (centreSnapshot?.summary.demeritsTotal ?? 0)
    : behaviour
        .filter((entry) => entry.meritDelta < 0)
        .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const netMerits = isCentreMode
    ? (centreSnapshot?.summary.netMerits ?? 0)
    : meritsEarned + demeritsTotal;
  const avgPaceScore = isCentreMode
    ? (centreSnapshot?.summary.averagePaceScore ?? null)
    : pace.length > 0
      ? Math.round(pace.reduce((sum, item) => sum + item.score, 0) / pace.length)
      : null;
  const latestNote = notes[0] ?? null;
  const selectedIndex = Math.max(
    0,
    students.findIndex((student) => student.id === selectedStudentId),
  );
  const selectedColour = avatarColour(selectedIndex, SNAPSHOT_AVATAR_COLOURS);

  const tabs = useMemo(
    () => [
      { id: 'overview' as const, label: 'Overview', count: 0 },
      { id: 'behaviour' as const, label: 'Behaviour', count: behaviour.length },
      { id: 'pace' as const, label: 'Pace', count: pace.length },
      { id: 'notes' as const, label: 'Notes', count: notes.length },
    ],
    [behaviour.length, notes.length, pace.length],
  );

  return (
    <div className="snapshot-page">
      <div className="snapshot-page__header">
        <h1>Student Progress Snapshot</h1>
        <p>Review attendance, behaviour, PACE scores and notes for any period.</p>
      </div>

      <section className="panel panel__body snapshot-picker-panel">
        <h2>{enableCentreOverview ? 'Select view' : 'Select student'}</h2>
        {studentsQuery.error ? (
          <p className="status--error">{studentsQuery.error.message}</p>
        ) : null}
        {!studentsQuery.isLoading && students.length === 0 ? (
          <div className="empty-state">No active students found.</div>
        ) : null}
        <div className="snapshot-view-picker">
          {enableCentreOverview ? (
            <SnapshotCentrePickerCard
              active={isCentreMode}
              onSelect={() => {
                setViewMode('centre');
                setActiveTab('overview');
              }}
              studentCount={centreSnapshot?.summary.activeStudentCount ?? students.length}
            />
          ) : null}
          <SnapshotStudentPicker
            onSelect={(studentId) => {
              setViewMode('student');
              setSelectedStudentId(studentId);
              setActiveTab('overview');
            }}
            selectedStudentId={isCentreMode ? '' : selectedStudentId}
            students={students}
          />
        </div>
      </section>

      <section className="snapshot-hero">
        {isCentreMode ? (
          <SnapshotHeroCentre
            activeStudentCount={centreSnapshot?.summary.activeStudentCount ?? students.length}
            netMerits={netMerits}
          />
        ) : (
          <SnapshotHeroStudent
            colour={selectedColour}
            selectedStudent={selectedStudent}
            snapshotStudent={snapshot?.student}
          />
        )}
        <SnapshotRangePicker
          from={from}
          onFromChange={setFrom}
          onPresetChange={applyRange}
          onToChange={setTo}
          rangePreset={rangePreset}
          to={to}
        />
      </section>

      {snapshotQuery.isLoading || centreSnapshotQuery.isLoading ? (
        <div className="empty-state">Loading snapshot...</div>
      ) : null}
      {snapshotQuery.error ? <p className="status--error">{snapshotQuery.error.message}</p> : null}
      {centreSnapshotQuery.error ? (
        <p className="status--error">{centreSnapshotQuery.error.message}</p>
      ) : null}

      <SnapshotTabs activeTab={activeTab} onSelect={setActiveTab} tabs={tabs} />

      {activeTab === 'overview' ? (
        <div className="snapshot-tab-panel">
          <div className="snapshot-stat-grid">
            <section className="panel panel__body snapshot-attendance-card">
              <h3>Attendance</h3>
              <div>
                <AttendanceRing absent={absentDays} late={lateDays} present={presentDays} />
                <div className="snapshot-attendance-card__legend">
                  <LegendRow label="Present" tone="green" value={presentDays} />
                  <LegendRow label="Late" tone="amber" value={lateDays} />
                  <LegendRow label="Absent" tone="red" value={absentDays} />
                </div>
              </div>
            </section>
            <SnapshotStatCard
              accent="green"
              label="Merits earned"
              sub={`across ${String(behaviour.filter((entry) => entry.meritDelta > 0).length)} entries`}
              value={`+${String(meritsEarned)}`}
            />
            <SnapshotStatCard
              accent={demeritsTotal < 0 ? 'red' : 'blue'}
              label="Demerits"
              sub={`net: ${netMerits >= 0 ? '+' : ''}${String(netMerits)} this period`}
              value={demeritsTotal ? String(demeritsTotal) : '—'}
            />
            <SnapshotStatCard
              accent={scoreTone(avgPaceScore)}
              label="Avg PACE score"
              sub={`${String(pace.length)} test${pace.length === 1 ? '' : 's'} this period`}
              value={avgPaceScore === null ? '—' : `${String(avgPaceScore)}%`}
            />
          </div>

          <div className="snapshot-overview-grid">
            <section className="panel panel__body snapshot-merit-chart">
              <h3>Merit Activity (last 7 days)</h3>
              <MeritSparkline entries={behaviour} />
              <div className="snapshot-merit-chart__totals">
                <SummaryTotal
                  label="Merits"
                  tone="green"
                  value={meritsEarned > 0 ? `+${String(meritsEarned)}` : '0'}
                />
                <SummaryTotal
                  label="Demerits"
                  tone="blue"
                  value={demeritsTotal ? String(demeritsTotal) : '0'}
                />
                <SummaryTotal
                  label="Net"
                  tone={netMerits >= 0 ? 'navy' : 'red'}
                  value={`${netMerits >= 0 ? '+' : ''}${String(netMerits)}`}
                />
              </div>
            </section>
            <section className="panel panel__body snapshot-latest-note">
              <h3>Latest Supervisor Note</h3>
              {latestNote ? (
                <>
                  <p>{latestNote.note}</p>
                  <footer>
                    <strong>
                      {hasSnapshotStudent(latestNote)
                        ? `${latestNote.student.fullName} · ${latestNote.createdByName}`
                        : latestNote.createdByName}
                    </strong>
                    <span>{formatShortDate(latestNote.createdAt)}</span>
                  </footer>
                </>
              ) : (
                <p>No supervisor notes in this period.</p>
              )}
            </section>
          </div>

          {isCentreMode ? (
            <section className="panel panel__body snapshot-centre-table-panel">
              <h3>All students</h3>
              {centreSnapshot?.students.length ? (
                <div className="snapshot-centre-table-wrap">
                  <table className="snapshot-centre-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Year</th>
                        <th>Attendance</th>
                        <th>Net merits</th>
                        <th>PACE</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {centreSnapshot.students.map((row) => (
                        <tr key={row.student.id}>
                          <td>
                            <strong>{row.student.fullName}</strong>
                          </td>
                          <td>{row.student.yearGroup}</td>
                          <td>
                            {row.metrics.attendance.recorded
                              ? `${String(row.metrics.attendance.present)} present · ${String(
                                  row.metrics.attendance.late,
                                )} late · ${String(row.metrics.attendance.absent)} absent`
                              : 'No mark'}
                          </td>
                          <td>
                            {row.metrics.netMerits >= 0 ? '+' : ''}
                            {row.metrics.netMerits}
                          </td>
                          <td>
                            {row.metrics.paceCount
                              ? `${String(row.metrics.paceCount)} test${
                                  row.metrics.paceCount === 1 ? '' : 's'
                                } · ${
                                  row.metrics.averagePaceScore === null
                                    ? 'no average'
                                    : `${String(row.metrics.averagePaceScore)}% avg`
                                }`
                              : 'No tests'}
                          </td>
                          <td>{row.metrics.notesCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No active students found.</p>
              )}
            </section>
          ) : null}

          {pace.length > 0 ? (
            <section className="panel panel__body snapshot-pace-compact">
              <h3>PACE Tests this period</h3>
              {pace.map((item) => (
                <div key={item.id}>
                  <span className={`snapshot-score-pill is-${scoreTone(item.score)}`}>
                    {item.score}%
                  </span>
                  <div>
                    <strong>
                      {item.subjectName} <span>#{item.paceNumber}</span>
                    </strong>
                    <p>
                      {item.testType} · {formatShortDate(item.completedAt ?? item.createdAt)} ·{' '}
                      {item.recordedByName}
                    </p>
                  </div>
                  <span>{item.testType}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'behaviour' ? (
        <div className="snapshot-tab-panel snapshot-list-panel">
          {behaviour.length === 0 ? (
            <EmptyCard>No behaviour entries in this period.</EmptyCard>
          ) : null}
          {behaviour.map((entry) => (
            <article
              className={
                entry.type === 'General'
                  ? 'panel panel__body snapshot-behaviour-row'
                  : entry.meritDelta > 0
                    ? 'panel panel__body snapshot-behaviour-row is-merit'
                    : 'panel panel__body snapshot-behaviour-row is-demerit'
              }
              key={entry.id}
            >
              <span>
                {entry.type === 'General'
                  ? 'No merit value'
                  : entry.meritDelta > 0
                    ? `+${String(entry.meritDelta)}`
                    : entry.meritDelta}
              </span>
              <div>
                <div>
                  {hasSnapshotStudent(entry) ? (
                    <SnapshotBadge tone="blue">{entry.student.fullName}</SnapshotBadge>
                  ) : null}
                  <SnapshotBadge
                    tone={
                      entry.type === 'General' ? 'blue' : entry.meritDelta > 0 ? 'green' : 'red'
                    }
                  >
                    {entry.type === 'General' ? 'General mark' : entry.type}
                  </SnapshotBadge>
                  <SnapshotBadge tone="blue">{entry.category}</SnapshotBadge>
                  {entry.visibility === 'Sensitive' ? (
                    <SnapshotBadge tone="amber">Sensitive</SnapshotBadge>
                  ) : null}
                </div>
                {entry.note ? <p>{entry.note}</p> : null}
                <small>
                  Recorded by <strong>{entry.recordedByName}</strong>
                </small>
                {canManageCorrections ? (
                  <div className="lifecycle-actions">
                    <Button
                      onClick={() => {
                        setEditingBehaviour({
                          id: entry.id,
                          type: entry.type,
                          category: entry.category,
                          note: entry.note ?? '',
                          visibility: entry.visibility,
                          amount: String(Math.max(entry.meritDelta, 1)),
                        });
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
                        setDeletingBehaviour(entry);
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
              </div>
              <time>{formatShortDate(entry.createdAt)}</time>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === 'pace' ? (
        <div className="snapshot-tab-panel snapshot-list-panel">
          {pace.length === 0 ? (
            <EmptyCard>No PACE scores recorded in this period.</EmptyCard>
          ) : null}
          {pace.map((item) => (
            <article className="panel panel__body snapshot-pace-row" key={item.id}>
              <ScoreDonut score={item.score} />
              <div className="snapshot-pace-row__main">
                <div>
                  <h3>
                    {hasSnapshotStudent(item) ? `${item.student.fullName} · ` : ''}
                    {item.subjectName}
                  </h3>
                  <SnapshotBadge tone="blue">{item.testType}</SnapshotBadge>
                </div>
                <p>PACE #{item.paceNumber}</p>
                <span>
                  Date: <strong>{formatShortDate(item.completedAt ?? item.createdAt)}</strong> ·
                  Supervisor: <strong>{item.recordedByName}</strong>
                </span>
              </div>
              <div className="snapshot-score-bar">
                <div>
                  <span>Score</span>
                  <strong>
                    {item.score}/{item.maxScore}
                  </strong>
                </div>
                <span>
                  <i style={{ width: `${String(item.score)}%` }} />
                </span>
                <small>{scoreLabel(item.score)}</small>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === 'notes' ? (
        <div className="snapshot-tab-panel snapshot-list-panel">
          {notes.length === 0 ? <EmptyCard>No supervisor notes in this period.</EmptyCard> : null}
          {notes.map((item) => (
            <article className="panel panel__body snapshot-note-row" key={item.id}>
              <div>
                <span className="snapshot-note-avatar">{getInitials(item.createdByName)}</span>
                <div>
                  <strong>
                    {hasSnapshotStudent(item) ? item.student.fullName : item.createdByName}
                  </strong>
                  <small>
                    {hasSnapshotStudent(item) ? `${item.createdByName} · ` : ''}
                    {item.sensitive ? 'Sensitive note' : 'Supervisor note'}
                  </small>
                </div>
              </div>
              <time>{formatShortDate(item.createdAt)}</time>
              <p>{item.note}</p>
              {canManageCorrections ? (
                <div className="lifecycle-actions">
                  <Button
                    onClick={() => {
                      setEditingNote({ id: item.id, note: item.note, sensitive: item.sensitive });
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
                      setDeletingNote(item);
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
          ))}
          {!isCentreMode ? (
            <form
              className="panel panel__body snapshot-note-form"
              onSubmit={(event) => {
                void submitNote(event);
              }}
            >
              <h3>Add supervisor note</h3>
              <textarea
                aria-label="Child note"
                className="input textarea"
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="Write a note for this child..."
                value={note}
              />
              <div className="behaviour-visibility-toggle" role="group">
                <button
                  className={sensitive ? undefined : 'is-selected'}
                  onClick={() => {
                    setSensitive(false);
                  }}
                  type="button"
                >
                  General
                </button>
                <button
                  className={sensitive ? 'is-selected' : undefined}
                  onClick={() => {
                    setSensitive(true);
                  }}
                  type="button"
                >
                  Sensitive
                </button>
              </div>
              <Button
                disabled={!selectedStudentId || !note.trim()}
                pending={createNote.isPending}
                type="submit"
              >
                Save note
              </Button>
              {noteStatus ? <p className="status--success">{noteStatus}</p> : null}
              {createNote.error ? (
                <p className="status--error">{createNote.error.message}</p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}
      {editingBehaviour ? (
        <CorrectionModal
          errorMessage={updateBehaviour.error?.message}
          onClose={() => {
            setEditingBehaviour(null);
          }}
          pending={updateBehaviour.isPending}
          title="Edit behaviour entry"
        >
          <form
            className="form-grid snapshot-note-form"
            onSubmit={(event) => {
              void submitBehaviourEdit(event);
            }}
          >
            <TextInput
              aria-label="Behaviour category"
              onChange={(event) => {
                setEditingBehaviour((current) =>
                  current ? { ...current, category: event.target.value } : current,
                );
              }}
              required
              value={editingBehaviour.category}
            />
            <textarea
              aria-label="Behaviour note"
              className="input textarea"
              maxLength={2000}
              onChange={(event) => {
                setEditingBehaviour((current) =>
                  current ? { ...current, note: event.target.value } : current,
                );
              }}
              required={editingBehaviour.type === 'General'}
              rows={3}
              value={editingBehaviour.note}
            />
            <div className="behaviour-visibility-toggle" role="group">
              {(['General', 'Sensitive'] as const).map((item) => (
                <button
                  className={editingBehaviour.visibility === item ? 'is-selected' : undefined}
                  key={item}
                  onClick={() => {
                    setEditingBehaviour((current) =>
                      current ? { ...current, visibility: item } : current,
                    );
                  }}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
            {editingBehaviour.type === 'Merit' ? (
              <TextInput
                aria-label="Merit amount"
                min={1}
                onChange={(event) => {
                  setEditingBehaviour((current) =>
                    current ? { ...current, amount: event.target.value } : current,
                  );
                }}
                required
                type="number"
                value={editingBehaviour.amount}
              />
            ) : null}
            <div className="lifecycle-actions">
              <Button pending={updateBehaviour.isPending} size="sm" type="submit">
                Save
              </Button>
              <Button
                disabled={updateBehaviour.isPending}
                onClick={() => {
                  setEditingBehaviour(null);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CorrectionModal>
      ) : null}
      {editingNote ? (
        <CorrectionModal
          errorMessage={updateNote.error?.message}
          onClose={() => {
            setEditingNote(null);
          }}
          pending={updateNote.isPending}
          title="Edit note"
        >
          <form
            className="form-grid snapshot-note-form"
            onSubmit={(event) => {
              void submitNoteEdit(event);
            }}
          >
            <textarea
              aria-label="Edit child note"
              className="input textarea"
              maxLength={3000}
              onChange={(event) => {
                setEditingNote((current) =>
                  current ? { ...current, note: event.target.value } : current,
                );
              }}
              required
              rows={3}
              value={editingNote.note}
            />
            <div className="behaviour-visibility-toggle" role="group">
              <button
                className={editingNote.sensitive ? undefined : 'is-selected'}
                onClick={() => {
                  setEditingNote((current) =>
                    current ? { ...current, sensitive: false } : current,
                  );
                }}
                type="button"
              >
                General
              </button>
              <button
                className={editingNote.sensitive ? 'is-selected' : undefined}
                onClick={() => {
                  setEditingNote((current) =>
                    current ? { ...current, sensitive: true } : current,
                  );
                }}
                type="button"
              >
                Sensitive
              </button>
            </div>
            <div className="lifecycle-actions">
              <Button pending={updateNote.isPending} size="sm" type="submit">
                Save
              </Button>
              <Button
                disabled={updateNote.isPending}
                onClick={() => {
                  setEditingNote(null);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CorrectionModal>
      ) : null}
      <ConfirmationDialog
        confirmLabel="Delete entry"
        errorMessage={deleteBehaviour.error?.message}
        onCancel={() => {
          if (!deleteBehaviour.isPending) setDeletingBehaviour(null);
        }}
        onConfirm={() => {
          if (deletingBehaviour) void deleteBehaviour.mutateAsync({ id: deletingBehaviour.id });
        }}
        open={deletingBehaviour !== null}
        pending={deleteBehaviour.isPending}
        title="Delete behaviour entry?"
      >
        <p>This removes the entry from snapshot views and applies any merit correction rows.</p>
      </ConfirmationDialog>
      <ConfirmationDialog
        confirmLabel="Delete note"
        errorMessage={deleteNote.error?.message}
        onCancel={() => {
          if (!deleteNote.isPending) setDeletingNote(null);
        }}
        onConfirm={() => {
          if (deletingNote) void deleteNote.mutateAsync({ id: deletingNote.id });
        }}
        open={deletingNote !== null}
        pending={deleteNote.isPending}
        title="Delete note?"
      >
        <p>This removes the note from snapshot views while keeping an audit trail.</p>
      </ConfirmationDialog>
    </div>
  );
}

function CorrectionModal({
  children,
  errorMessage,
  onClose,
  pending,
  title,
}: {
  children: ReactNode;
  errorMessage?: string | undefined;
  onClose: () => void;
  pending: boolean;
  title: string;
}) {
  return (
    <div className="admin-confirmation-backdrop">
      <section aria-modal="true" className="admin-confirmation-dialog" role="dialog">
        <header className="admin-confirmation-dialog__header">
          <div>
            <h2>{title}</h2>
          </div>
          <Button
            aria-label="Close"
            disabled={pending}
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        {children}
      </section>
    </div>
  );
}
