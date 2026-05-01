'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BarChart3, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { api } from '@/lib/trpc';

type BehaviourType = 'Merit' | 'Demerit';
type BehaviourVisibility = 'General' | 'Sensitive';
type TrendBucket = 'daily' | 'weekly' | 'monthly';

const meritCategories = [
  'Scripture Memory',
  'Academic Excellence',
  'Helpfulness',
  'Character',
  'Leadership',
  'Punctuality',
  'Creativity',
] as const;

const demeritCategories = [
  'Punctuality',
  'Conduct',
  'Disrespect',
  'Negligence',
  'Dishonesty',
] as const;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return dateKey(date);
}

function formatTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function avatarColour(index: number): string {
  return ['#7C3F98', '#8B1E2D', '#0E7892', '#5B90C5', '#006B4A', '#B45309'][index % 6] ?? '#5B90C5';
}

export function BehaviourLogClient({
  canCreateSensitive,
  canLogBehaviour,
  showTrends = false,
}: {
  canCreateSensitive: boolean;
  canLogBehaviour: boolean;
  showTrends?: boolean;
}) {
  const [type, setType] = useState<BehaviourType>('Merit');
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState<string>(meritCategories[0]);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<BehaviourVisibility>('General');
  const [amount, setAmount] = useState('5');
  const [status, setStatus] = useState<string | null>(null);
  const [date, setDate] = useState(dateKey(new Date()));

  const studentsQuery = api.student.list.useQuery(undefined, { retry: false });
  const recentQuery = api.behaviour.recentEntries.useQuery(
    { date: new Date(`${date}T00:00:00.000Z`) },
    { retry: false },
  );
  const utils = api.useUtils();
  const logBehaviour = api.behaviour.log.useMutation({
    onSuccess: async (_result, input) => {
      setStatus(input.type === 'Merit' ? 'Merit recorded.' : 'Demerit recorded.');
      setNote('');
      setVisibility('General');
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: new Date(`${date}T00:00:00.000Z`) }),
        utils.behaviour.trends.invalidate(),
      ]);
    },
  });

  const categories = type === 'Merit' ? meritCategories : demeritCategories;
  const entries = recentQuery.data?.entries ?? [];

  useEffect(() => {
    const firstStudent = studentsQuery.data?.[0];
    if (!studentId && firstStudent) setStudentId(firstStudent.id);
  }, [studentId, studentsQuery.data]);

  useEffect(() => {
    setCategory((current) => (categories.includes(current as never) ? current : categories[0]));
  }, [categories]);

  function chooseVisibility(next: BehaviourVisibility): void {
    if (next === 'Sensitive' && !canCreateSensitive) return;
    setVisibility(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canLogBehaviour || !studentId) return;
    setStatus(null);
    await logBehaviour.mutateAsync({
      studentId,
      type,
      category,
      note: note.trim() ? note : undefined,
      visibility,
      ...(type === 'Merit' ? { amount: Number(amount) } : {}),
    });
  }

  return (
    <div className="behaviour-log-page">
      <h1>Behaviour Log</h1>

      <div className="behaviour-log-layout">
        <section className="panel panel__body behaviour-log-form-card">
          <h2>Log New Entry</h2>
          {!canLogBehaviour ? (
            <div className="workflow-alert">
              Behaviour reporting access is enabled for this account. Recording new entries still
              requires Head/full-admin or Supervisor access.
            </div>
          ) : null}
          <form
            className="behaviour-log-form"
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <div aria-label="Behaviour type" className="behaviour-toggle" role="group">
              {(['Merit', 'Demerit'] as const).map((item) => (
                <button
                  className={item === type ? `is-selected is-${item.toLowerCase()}` : undefined}
                  disabled={!canLogBehaviour}
                  key={item}
                  onClick={() => {
                    setType(item);
                    setCategory(item === 'Merit' ? meritCategories[0] : demeritCategories[0]);
                  }}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            <Field label="Student">
              <SelectInput
                aria-label="Student"
                disabled={!canLogBehaviour || studentsQuery.isLoading}
                onChange={(event) => {
                  setStudentId(event.target.value);
                }}
                value={studentId}
              >
                <option value="">Select a student</option>
                {(studentsQuery.data ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Category">
              <SelectInput
                aria-label="Category"
                disabled={!canLogBehaviour}
                onChange={(event) => {
                  setCategory(event.target.value);
                }}
                value={category}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Notes">
              <textarea
                aria-label="Notes"
                className="input textarea"
                disabled={!canLogBehaviour}
                maxLength={2000}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="Describe the behaviour..."
                rows={4}
                value={note}
              />
            </Field>

            <Field label="Visibility">
              <div aria-label="Visibility" className="behaviour-visibility-toggle" role="group">
                {(['General', 'Sensitive'] as const).map((item) => (
                  <button
                    className={item === visibility ? 'is-selected' : undefined}
                    disabled={!canLogBehaviour || (item === 'Sensitive' && !canCreateSensitive)}
                    key={item}
                    onClick={() => {
                      chooseVisibility(item);
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </Field>
            {visibility === 'Sensitive' ? (
              <p className="behaviour-sensitive-note">
                <Lock aria-hidden="true" size={13} />
                Sensitive entries are only visible to full admin roles.
              </p>
            ) : null}
            {!canCreateSensitive && canLogBehaviour ? (
              <p className="field__hint">Sensitive behaviour entries are Head/full-admin only.</p>
            ) : null}

            {type === 'Merit' ? (
              <Field label="Merit amount">
                <TextInput
                  aria-label="Merit amount"
                  disabled={!canLogBehaviour}
                  min={1}
                  onChange={(event) => {
                    setAmount(event.target.value);
                  }}
                  required
                  type="number"
                  value={amount}
                />
              </Field>
            ) : null}

            <Button
              disabled={!canLogBehaviour || !studentId}
              pending={logBehaviour.isPending}
              type="submit"
            >
              {type === 'Merit' ? `Record +${amount || '0'} Merit` : 'Record -5 Demerit'}
            </Button>
            {status ? <p className="status--success">{status}</p> : null}
            {studentsQuery.error ? (
              <p className="status--error">{studentsQuery.error.message}</p>
            ) : null}
            {logBehaviour.error ? (
              <p className="status--error">{logBehaviour.error.message}</p>
            ) : null}
          </form>
        </section>

        <section className="behaviour-recent-panel">
          <div className="section-title">
            <h2>Recent Entries</h2>
            <TextInput
              aria-label="Recent behaviour date"
              onChange={(event) => {
                setDate(event.target.value);
              }}
              style={{ width: 'auto' }}
              type="date"
              value={date}
            />
          </div>
          {recentQuery.isLoading ? (
            <div className="empty-state">Loading recent entries...</div>
          ) : null}
          {recentQuery.error ? <p className="status--error">{recentQuery.error.message}</p> : null}
          {!recentQuery.isLoading && entries.length === 0 ? (
            <div className="empty-state">No behaviour entries today.</div>
          ) : null}
          <div className="behaviour-entry-list">
            {entries.map((entry, index) => (
              <article className="panel panel__body behaviour-entry-card" key={entry.id}>
                <span className="behaviour-avatar" style={{ backgroundColor: avatarColour(index) }}>
                  {initials(entry.studentName)}
                </span>
                <div>
                  <div className="behaviour-entry-card__head">
                    <strong>{entry.studentName}</strong>
                    <span
                      className={
                        entry.meritDelta >= 0
                          ? 'head-merit-pill head-merit-pill--plus'
                          : 'head-merit-pill head-merit-pill--minus'
                      }
                    >
                      {entry.meritDelta >= 0 ? `+${String(entry.meritDelta)}` : entry.meritDelta}{' '}
                      merits
                    </span>
                    <span className="behaviour-category-pill">{entry.category}</span>
                    {entry.visibility === 'Sensitive' ? (
                      <span className="head-merit-pill head-merit-pill--sensitive">Sensitive</span>
                    ) : null}
                  </div>
                  {entry.note ? <p>{entry.note}</p> : null}
                  <span>
                    by {entry.recordedByName} · {formatTime(entry.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {showTrends ? <BehaviourTrendsPanel /> : null}
    </div>
  );
}

function BehaviourTrendsPanel() {
  const [bucket, setBucket] = useState<TrendBucket>('daily');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(dateKey(new Date()));

  const trendsQuery = api.behaviour.trends.useQuery(
    {
      bucket,
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T00:00:00.000Z`),
    },
    { retry: false },
  );

  const maxTotal = useMemo(() => {
    return Math.max(
      1,
      ...(trendsQuery.data?.points ?? []).map((point) => point.meritTotal + point.demeritTotal),
    );
  }, [trendsQuery.data?.points]);

  return (
    <section className="panel panel__body behaviour-trends-panel">
      <div className="section-title">
        <div>
          <h2>Behaviour trends</h2>
          <p className="muted">Toggle daily, weekly, and monthly behaviour totals.</p>
        </div>
        <BarChart3 aria-hidden="true" size={20} />
      </div>
      <div className="form-grid form-grid--two behaviour-report-controls">
        <SelectInput
          aria-label="Trend bucket"
          onChange={(event) => {
            setBucket(event.target.value as TrendBucket);
          }}
          value={bucket}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </SelectInput>
        <TextInput
          aria-label="Trend from"
          onChange={(event) => {
            setFrom(event.target.value);
          }}
          type="date"
          value={from}
        />
        <TextInput
          aria-label="Trend to"
          onChange={(event) => {
            setTo(event.target.value);
          }}
          type="date"
          value={to}
        />
      </div>
      {trendsQuery.isLoading ? <div className="empty-state">Loading trends...</div> : null}
      {trendsQuery.error ? <p className="status--error">{trendsQuery.error.message}</p> : null}
      <div className="behaviour-chart" aria-label="Behaviour trend chart">
        {(trendsQuery.data?.points ?? []).map((point) => {
          const total = point.meritTotal + point.demeritTotal;
          return (
            <div className="behaviour-chart__row" key={point.bucket}>
              <span>{point.bucket}</span>
              <div className="behaviour-chart__track">
                <div
                  className="behaviour-chart__bar"
                  style={{ width: `${String(Math.max(6, Math.round((total / maxTotal) * 100)))}%` }}
                />
              </div>
              <strong>
                +{point.meritTotal} / -{point.demeritTotal}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
