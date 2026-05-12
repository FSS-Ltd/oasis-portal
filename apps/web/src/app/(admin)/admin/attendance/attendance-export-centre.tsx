'use client';

import { BarChart3, RefreshCw, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput, TextInput } from '@/components/ui/field';

const ALL_RECORDS = '__all';
const insightTabs = [
  { id: 'students', label: 'Students' },
  { id: 'staff', label: 'Supervisors' },
] as const;

type InsightKind = (typeof insightTabs)[number]['id'];
type AttendanceInsights = RouterOutputs['attendance']['insights'];
type TrendPoint = AttendanceInsights['trend'][number];
type BreakdownPoint = { label: string; count: number };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartKey(): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date || todayKey()}T00:00:00.000Z`);
}

function percentLabel(value: number | null): string {
  return value === null ? '-' : `${String(value)}%`;
}

function maxCount(points: readonly { count: number }[]): number {
  return Math.max(1, ...points.map((point) => point.count));
}

function TrendChart({ points }: { points: readonly TrendPoint[] }) {
  const maxTotal = Math.max(1, ...points.map((point) => point.total));
  if (points.length === 0) {
    return <EmptyState detail="No attendance records in this range." title="No trend data" />;
  }

  return (
    <div className="attendance-trend-chart" aria-label="Attendance rate trend">
      {points.map((point) => (
        <div className="attendance-trend-chart__column" key={point.date}>
          <span>{percentLabel(point.attendanceRate)}</span>
          <i style={{ height: `${String(Math.max(8, (point.present / maxTotal) * 100))}%` }} />
          <small>{point.date.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ points }: { points: readonly BreakdownPoint[] }) {
  const max = maxCount(points);
  return (
    <div className="attendance-breakdown-chart">
      {points.map((point) => (
        <div className="attendance-breakdown-chart__row" key={point.label}>
          <span>{point.label}</span>
          <div className="attendance-breakdown-chart__track">
            <i style={{ width: `${String((point.count / max) * 100)}%` }} />
          </div>
          <strong>{point.count}</strong>
        </div>
      ))}
    </div>
  );
}

function RecentRecords({ data }: { data: AttendanceInsights }) {
  if (data.records.length === 0) {
    return <EmptyState detail="No individual records match this range." title="No records" />;
  }

  return (
    <div className="attendance-insights-records">
      {data.records.slice(0, 12).map((record) => (
        <article className="attendance-insights-record" key={record.id}>
          <div>
            <strong>{record.subjectName}</strong>
            <span>
              {record.date} · {record.detail}
            </span>
          </div>
          <Badge
            tone={record.status === 'Absent' ? 'red' : record.status === 'Late' ? 'amber' : 'green'}
          >
            {record.status === 'Absent'
              ? `Absent · ${record.absenceReasonLabel ?? 'Unknown'}`
              : record.status}
          </Badge>
        </article>
      ))}
    </div>
  );
}

export function AttendanceExportCentre() {
  const [kind, setKind] = useState<InsightKind>('students');
  const [from, setFrom] = useState(monthStartKey);
  const [to, setTo] = useState(todayKey);
  const [selectedId, setSelectedId] = useState(ALL_RECORDS);
  const fromDate = useMemo(() => asDate(from), [from]);
  const toDate = useMemo(() => asDate(to), [to]);
  const selectedSubjectId = selectedId === ALL_RECORDS ? undefined : selectedId;

  const insightsQuery = api.attendance.insights.useQuery(
    { kind, from: fromDate, to: toDate, subjectId: selectedSubjectId },
    { retry: false },
  );

  const data = insightsQuery.data;
  const statusPoints = data
    ? [
        { label: 'Present', count: data.summary.present },
        { label: 'Late', count: data.summary.late },
        { label: 'Absent', count: data.summary.absent },
      ]
    : [];
  const reasonPoints =
    data?.absenceReasons
      .filter((reason) => reason.count > 0 || reason.reason !== 'Unknown')
      .map((reason) => ({ label: reason.label, count: reason.count })) ?? [];

  return (
    <section className="attendance-export-centre">
      <div className="section-title">
        <div>
          <h2>Visual attendance center</h2>
          <p className="muted">View trends, overviews, and individual records.</p>
        </div>
        <Button
          onClick={() => {
            void insightsQuery.refetch();
          }}
          pending={insightsQuery.isFetching}
          type="button"
          variant="secondary"
        >
          <RefreshCw aria-hidden="true" size={16} />
          Refresh
        </Button>
      </div>

      <div className="attendance-insights-tabs" role="tablist" aria-label="Attendance view">
        {insightTabs.map((tab) => (
          <button
            aria-selected={kind === tab.id}
            className={kind === tab.id ? 'is-active' : undefined}
            key={tab.id}
            onClick={() => {
              setKind(tab.id);
              setSelectedId(ALL_RECORDS);
            }}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel panel__body attendance-export-range">
        <label className="field">
          <span className="field__label">From</span>
          <TextInput
            onChange={(event) => {
              setFrom(event.target.value);
            }}
            type="date"
            value={from}
          />
        </label>
        <label className="field">
          <span className="field__label">To</span>
          <TextInput
            onChange={(event) => {
              setTo(event.target.value);
            }}
            type="date"
            value={to}
          />
        </label>
        <label className="field">
          <span className="field__label">{kind === 'students' ? 'Student' : 'Supervisor'}</span>
          <SelectInput
            onChange={(event) => {
              setSelectedId(event.target.value);
            }}
            value={selectedId}
          >
            <option value={ALL_RECORDS}>
              {kind === 'students' ? 'All students' : 'All supervisors'}
            </option>
            {(data?.people ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </SelectInput>
        </label>
      </div>

      {insightsQuery.error ? (
        <p className="status--error attendance-export-centre__error">
          {insightsQuery.error.message}
        </p>
      ) : null}
      {insightsQuery.isLoading ? (
        <div className="empty-state">Loading attendance center...</div>
      ) : null}

      {data ? (
        <>
          <div className="attendance-summary-grid attendance-insights-summary">
            <div className="attendance-summary attendance-summary--green">
              <strong>{percentLabel(data.summary.attendanceRate)}</strong>
              <span>Attendance rate</span>
            </div>
            <div className="attendance-summary attendance-summary--green">
              <strong>{data.summary.present}</strong>
              <span>Present</span>
            </div>
            <div className="attendance-summary attendance-summary--amber">
              <strong>{data.summary.late}</strong>
              <span>Late</span>
            </div>
            <div className="attendance-summary attendance-summary--red">
              <strong>{data.summary.absent}</strong>
              <span>Absent</span>
            </div>
          </div>

          <div className="attendance-insights-grid">
            <section className="panel panel__body">
              <div className="section-title">
                <h3>
                  <TrendingUp aria-hidden="true" size={18} />
                  Trend
                </h3>
              </div>
              <TrendChart points={data.trend} />
            </section>

            <section className="panel panel__body">
              <div className="section-title">
                <h3>
                  <BarChart3 aria-hidden="true" size={18} />
                  Status overview
                </h3>
              </div>
              <HorizontalBars points={statusPoints} />
            </section>

            <section className="panel panel__body">
              <div className="section-title">
                <h3>Absence reasons</h3>
              </div>
              <HorizontalBars points={reasonPoints} />
            </section>

            <section className="panel panel__body">
              <div className="section-title">
                <h3>{selectedSubjectId ? 'Individual records' : 'Recent records'}</h3>
              </div>
              <RecentRecords data={data} />
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
