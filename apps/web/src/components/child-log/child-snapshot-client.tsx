'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { avatarColour, getInitials, SNAPSHOT_AVATAR_COLOURS } from '@/lib/display';
import { api } from '@/lib/trpc';
import {
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

export function ChildSnapshotClient() {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset>('previous-day');
  const [from, setFrom] = useState(previousDay);
  const [to, setTo] = useState(previousDay);
  const [activeTab, setActiveTab] = useState<SnapshotTab>('overview');
  const [note, setNote] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  const studentsQuery = api.childLog.listSnapshotStudents.useQuery(undefined, { retry: false });
  const snapshotQuery = api.childLog.snapshot.useQuery(
    {
      studentId: selectedStudentId,
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T00:00:00.000Z`),
    },
    { enabled: selectedStudentId.length > 0, retry: false },
  );
  const utils = api.useUtils();
  const createNote = api.childNotes.create.useMutation({
    onSuccess: async () => {
      setNote('');
      setSensitive(false);
      setNoteStatus('Child note saved.');
      await utils.childLog.snapshot.invalidate();
    },
  });

  useEffect(() => {
    const firstStudent = studentsQuery.data?.[0];
    if (!selectedStudentId && firstStudent) setSelectedStudentId(firstStudent.id);
  }, [selectedStudentId, studentsQuery.data]);

  function applyRange(value: RangePreset) {
    setRangePreset(value);
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

  const students = studentsQuery.data ?? [];
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const snapshot = snapshotQuery.data;
  const attendance = snapshot?.attendance ?? [];
  const behaviour = snapshot?.behaviour ?? [];
  const pace = snapshot?.passedTests ?? [];
  const notes = snapshot?.notes ?? [];
  const presentDays = attendance.filter((row) => row.status === 'Present').length;
  const lateDays = attendance.filter((row) => row.status === 'Late').length;
  const absentDays = attendance.filter((row) => row.status === 'Absent').length;
  const meritsEarned = behaviour
    .filter((entry) => entry.meritDelta > 0)
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const demeritsTotal = behaviour
    .filter((entry) => entry.meritDelta < 0)
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const netMerits = meritsEarned + demeritsTotal;
  const avgPaceScore =
    pace.length > 0
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
        <p>Review a child&apos;s attendance, behaviour, PACE scores and notes for any period.</p>
      </div>

      <section className="panel panel__body snapshot-picker-panel">
        <h2>Select student</h2>
        {studentsQuery.error ? (
          <p className="status--error">{studentsQuery.error.message}</p>
        ) : null}
        {!studentsQuery.isLoading && students.length === 0 ? (
          <div className="empty-state">No active students found.</div>
        ) : null}
        <SnapshotStudentPicker
          onSelect={(studentId) => {
            setSelectedStudentId(studentId);
            setActiveTab('overview');
          }}
          selectedStudentId={selectedStudentId}
          students={students}
        />
      </section>

      <section className="snapshot-hero">
        <SnapshotHeroStudent
          colour={selectedColour}
          selectedStudent={selectedStudent}
          snapshotStudent={snapshot?.student}
        />
        <SnapshotRangePicker
          from={from}
          onFromChange={setFrom}
          onPresetChange={applyRange}
          onToChange={setTo}
          rangePreset={rangePreset}
          to={to}
        />
      </section>

      {snapshotQuery.isLoading ? <div className="empty-state">Loading snapshot...</div> : null}
      {snapshotQuery.error ? <p className="status--error">{snapshotQuery.error.message}</p> : null}

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
                    <strong>{latestNote.createdByName}</strong>
                    <span>{formatShortDate(latestNote.createdAt)}</span>
                  </footer>
                </>
              ) : (
                <p>No supervisor notes in this period.</p>
              )}
            </section>
          </div>

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
                  <h3>{item.subjectName}</h3>
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
                  <strong>{item.createdByName}</strong>
                  <small>{item.sensitive ? 'Sensitive note' : 'Supervisor note'}</small>
                </div>
              </div>
              <time>{formatShortDate(item.createdAt)}</time>
              <p>{item.note}</p>
            </article>
          ))}
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
            {createNote.error ? <p className="status--error">{createNote.error.message}</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
