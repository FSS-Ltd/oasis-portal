'use client';

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/trpc';

type RangePreset = 'previous-day' | 'previous-week' | 'custom';
type SnapshotTab = 'overview' | 'behaviour' | 'pace' | 'notes';

const shortMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
  date.setDate(date.getDate() - 6);
  return dateKey(date);
}

function formatShortDate(value: Date | string | null): string {
  if (!value) return 'Not dated';
  const date = new Date(value);
  return `${shortWeekdays[date.getUTCDay()] ?? ''} ${String(date.getUTCDate()).padStart(2, '0')} ${
    shortMonths[date.getUTCMonth()] ?? ''
  }`;
}

function formatRange(from: string, to: string, preset: RangePreset): string {
  if (preset === 'previous-day') return `Yesterday — ${formatShortDate(from)}`;
  if (preset === 'previous-week')
    return `Last 7 days — ${formatShortDate(from)}-${formatShortDate(to)}`;
  return `${formatShortDate(from)}-${formatShortDate(to)}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function firstName(name: string): string {
  return name.split(' ').filter(Boolean)[0] ?? name;
}

function avatarColour(index: number): string {
  return (
    [
      '#5B90C5',
      '#7C3F98',
      '#16784F',
      '#B45309',
      '#8B1E2D',
      '#0E7892',
      '#4F46E5',
      '#C2185B',
      '#006B4A',
    ][index % 9] ?? '#5B90C5'
  );
}

function scoreTone(score: number | null): 'amber' | 'blue' | 'green' | 'red' {
  if (score === null) return 'blue';
  if (score >= 90) return 'green';
  if (score >= 80) return 'amber';
  return 'red';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Satisfactory';
  return 'Needs support';
}

export function ChildSnapshotClient() {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset>('previous-day');
  const [from, setFrom] = useState(previousDay);
  const [to, setTo] = useState(previousDay);
  const [activeTab, setActiveTab] = useState<SnapshotTab>('overview');
  const [note, setNote] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  const studentsQuery = api.student.list.useQuery(undefined, { retry: false });
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
  const selectedColour = avatarColour(selectedIndex);

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
        <div className="snapshot-student-picker" aria-label="Select student">
          {students.map((student, index) => {
            const colour = avatarColour(index);
            const selected = selectedStudentId === student.id;
            return (
              <button
                className={selected ? 'snapshot-student-card is-selected' : 'snapshot-student-card'}
                key={student.id}
                onClick={() => {
                  setSelectedStudentId(student.id);
                  setActiveTab('overview');
                }}
                style={{ '--student-colour': colour } as CSSProperties}
                type="button"
              >
                <span>{initials(student.fullName)}</span>
                <strong>{firstName(student.fullName)}</strong>
                <small>{student.yearGroup}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="snapshot-hero">
        <div className="snapshot-hero__student">
          <span className="snapshot-hero__avatar" style={{ backgroundColor: selectedColour }}>
            {snapshot
              ? initials(snapshot.student.fullName)
              : selectedStudent
                ? initials(selectedStudent.fullName)
                : '--'}
          </span>
          <div>
            <h2>{snapshot?.student.fullName ?? selectedStudent?.fullName ?? 'Select a student'}</h2>
            <p>
              {snapshot?.student.yearGroup ?? selectedStudent?.yearGroup ?? 'Year group'} ·
              Supervisor: {snapshot?.student.supervisorName ?? 'Not assigned'}
            </p>
          </div>
          <div className="snapshot-hero__merits">
            <strong>{snapshot?.student.totalMerits ?? 0}</strong>
            <span>total merits</span>
          </div>
        </div>
        <div className="snapshot-range">
          <h3>Viewing period</h3>
          <div className="snapshot-range__controls">
            {[
              ['previous-day', 'Yesterday'],
              ['previous-week', 'Last 7 days'],
              ['custom', 'Custom'],
            ].map(([value, label]) => (
              <button
                className={rangePreset === value ? 'is-selected' : undefined}
                key={value}
                onClick={() => {
                  applyRange(value as RangePreset);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {rangePreset === 'custom' ? (
            <div className="snapshot-range__custom">
              <input
                aria-label="Snapshot from"
                onChange={(event) => {
                  setFrom(event.target.value);
                }}
                type="date"
                value={from}
              />
              <span>to</span>
              <input
                aria-label="Snapshot to"
                onChange={(event) => {
                  setTo(event.target.value);
                }}
                type="date"
                value={to}
              />
            </div>
          ) : null}
          <p>{formatRange(from, to, rangePreset)}</p>
        </div>
      </section>

      {snapshotQuery.isLoading ? <div className="empty-state">Loading snapshot...</div> : null}
      {snapshotQuery.error ? <p className="status--error">{snapshotQuery.error.message}</p> : null}

      <div className="snapshot-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-selected' : undefined}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.count > 0 ? <span>{tab.count}</span> : null}
          </button>
        ))}
      </div>

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
            <StatCard
              accent="green"
              label="Merits earned"
              sub={`across ${String(behaviour.filter((entry) => entry.meritDelta > 0).length)} entries`}
              value={`+${String(meritsEarned)}`}
            />
            <StatCard
              accent={demeritsTotal < 0 ? 'red' : 'blue'}
              label="Demerits"
              sub={`net: ${netMerits >= 0 ? '+' : ''}${String(netMerits)} this period`}
              value={demeritsTotal ? String(demeritsTotal) : '—'}
            />
            <StatCard
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
                entry.meritDelta > 0
                  ? 'panel panel__body snapshot-behaviour-row is-merit'
                  : 'panel panel__body snapshot-behaviour-row is-demerit'
              }
              key={entry.id}
            >
              <span>
                {entry.meritDelta > 0 ? `+${String(entry.meritDelta)}` : entry.meritDelta}
              </span>
              <div>
                <div>
                  <Badge tone={entry.meritDelta > 0 ? 'green' : 'red'}>{entry.type}</Badge>
                  <Badge tone="blue">{entry.category}</Badge>
                  {entry.visibility === 'Sensitive' ? <Badge tone="amber">Sensitive</Badge> : null}
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
                  <Badge tone="blue">{item.testType}</Badge>
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
                <span className="snapshot-note-avatar">{initials(item.createdByName)}</span>
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

function AttendanceRing({
  absent,
  late,
  present,
}: {
  absent: number;
  late: number;
  present: number;
}) {
  const total = Math.max(1, absent + late + present);
  const presentDeg = (present / total) * 360;
  const lateDeg = presentDeg + (late / total) * 360;
  return (
    <div
      className="snapshot-attendance-ring"
      style={{
        background: `conic-gradient(#166534 0deg ${String(presentDeg)}deg, #92400e ${String(presentDeg)}deg ${String(lateDeg)}deg, #991b1b ${String(lateDeg)}deg 360deg)`,
      }}
    >
      <span>
        <strong>{total === 1 && present + late + absent === 0 ? 0 : total}</strong>
        days
      </span>
    </div>
  );
}

function LegendRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'amber' | 'green' | 'red';
  value: number;
}) {
  return (
    <div className={`snapshot-legend-row is-${tone}`}>
      <span />
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function StatCard({
  accent,
  label,
  sub,
  value,
}: {
  accent: 'amber' | 'blue' | 'green' | 'red';
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <section className={`panel panel__body snapshot-stat-card is-${accent}`}>
      <h3>{label}</h3>
      <strong>{value}</strong>
      <p>{sub}</p>
    </section>
  );
}

function MeritSparkline({
  entries,
}: {
  entries: Array<{ createdAt: Date | string; meritDelta: number }>;
}) {
  const buckets = new Map<string, number>();
  for (const entry of entries) {
    const key = formatShortDate(entry.createdAt);
    buckets.set(key, (buckets.get(key) ?? 0) + entry.meritDelta);
  }
  const rows = [...buckets.entries()].slice(-7);
  const max = Math.max(5, ...rows.map(([, value]) => Math.abs(value)));
  return (
    <div className="snapshot-sparkline">
      {rows.length === 0 ? <span>No behaviour activity in this range.</span> : null}
      {rows.map(([label, value]) => (
        <div key={label}>
          <i
            className={value >= 0 ? 'is-positive' : 'is-negative'}
            style={{ height: `${String(Math.max(12, (Math.abs(value) / max) * 64))}px` }}
          />
          <span>{label.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryTotal({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'blue' | 'green' | 'navy' | 'red';
  value: string;
}) {
  return (
    <div className={`snapshot-summary-total is-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'amber' | 'blue' | 'green' | 'red';
}) {
  return <span className={`snapshot-badge is-${tone}`}>{children}</span>;
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="panel panel__body snapshot-empty-card">
      <p>{children}</p>
    </div>
  );
}

function ScoreDonut({ score }: { score: number }) {
  return (
    <div className={`snapshot-score-donut is-${scoreTone(score)}`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" />
        <circle
          cx="32"
          cy="32"
          r="26"
          style={{ strokeDasharray: `${String((score / 100) * 163.4)} 163.4` }}
        />
      </svg>
      <strong>{score}</strong>
    </div>
  );
}
