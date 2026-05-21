'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Medal } from 'lucide-react';
import { SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api } from '@/lib/trpc';

type TrendBucket = 'daily' | 'weekly' | 'monthly';

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return dateKey(date);
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function BehaviourReportClient() {
  const [date, setDate] = useState(dateKey(new Date()));
  const [bucket, setBucket] = useState<TrendBucket>('daily');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(dateKey(new Date()));

  const meritsQuery = api.behaviour.dailyMerits.useQuery(
    { date: new Date(`${date}T00:00:00.000Z`) },
    { retry: false },
  );
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
    <div className="grid">
      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <h2>Daily merits</h2>
            <p className="muted">All merits recorded on the selected day.</p>
          </div>
          <TextInput
            aria-label="Merit report date"
            onChange={(event) => {
              setDate(event.target.value);
            }}
            type="date"
            value={date}
          />
        </div>
        {meritsQuery.isLoading ? <div className="empty-state">Loading merits...</div> : null}
        {meritsQuery.error ? (
          <p className="status--error">{friendlyErrorMessage(meritsQuery.error)}</p>
        ) : null}
        {!meritsQuery.isLoading && (meritsQuery.data?.merits ?? []).length === 0 ? (
          <div className="empty-state">No merits recorded for this day.</div>
        ) : null}
        <div className="activity-list">
          {(meritsQuery.data?.merits ?? []).map((merit) => (
            <div className="activity-row" key={merit.id}>
              <Medal aria-hidden="true" size={16} />
              <div>
                <strong>
                  {merit.studentName} · +{merit.meritDelta}
                </strong>
                <span>
                  {merit.category} · {merit.visibility} · {merit.recordedByName} ·{' '}
                  {formatDateTime(merit.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel__body">
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
        {trendsQuery.error ? (
          <p className="status--error">{friendlyErrorMessage(trendsQuery.error)}</p>
        ) : null}
        <div className="behaviour-chart" aria-label="Behaviour trend chart">
          {(trendsQuery.data?.points ?? []).map((point) => {
            const total = point.meritTotal + point.demeritTotal;
            return (
              <div className="behaviour-chart__row" key={point.bucket}>
                <span>{point.bucket}</span>
                <div className="behaviour-chart__track">
                  <div
                    className="behaviour-chart__bar"
                    style={{
                      width: `${String(Math.max(6, Math.round((total / maxTotal) * 100)))}%`,
                    }}
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
    </div>
  );
}
