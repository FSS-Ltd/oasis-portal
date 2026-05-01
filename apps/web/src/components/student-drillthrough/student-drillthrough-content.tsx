'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AttendanceRing,
  EmptyCard,
  LegendRow,
  MeritSparkline,
  ScoreDonut,
  SnapshotBadge,
  SnapshotStatCard,
  SummaryTotal,
} from '@/components/child-log/snapshot-widgets';
import { formatShortDate, scoreLabel, scoreTone } from '@/components/child-log/snapshot-utils';
import { AttendanceCalendar } from './attendance-calendar';
import { NotesList } from './notes-list';

type DrillThrough = RouterOutputs['childLog']['drillThrough'];
type DrillThroughTab = 'overview' | 'attendance' | 'behaviour' | 'pace' | 'merits' | 'notes';

const DRILL_THROUGH_TABS = [
  ['overview', 'Overview'],
  ['attendance', 'Attendance'],
  ['behaviour', 'Behaviour'],
  ['pace', 'Pace'],
  ['merits', 'Merits'],
  ['notes', 'Notes'],
] as const satisfies readonly (readonly [DrillThroughTab, string])[];

interface StudentDrillThroughContentProps {
  backHref: Route;
  backLabel: string;
  onEdit?: (() => void) | undefined;
  studentId: string;
}

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function formatLongDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function StudentHero({
  backHref,
  backLabel,
  data,
  onEdit,
}: {
  backHref: Route;
  backLabel: string;
  data: DrillThrough;
  onEdit?: (() => void) | undefined;
}) {
  return (
    <div className="student-drillthrough__top">
      <Link className="student-drillthrough__back" href={backHref}>
        <ArrowLeft aria-hidden="true" size={14} />
        {backLabel}
      </Link>
      <section className="panel panel__body student-detail-hero">
        <div className="student-detail-hero__identity">
          <Avatar className="student-detail-hero__avatar" name={data.student.fullName} />
          <div>
            <h1>{data.student.fullName}</h1>
            <p>
              {data.student.yearGroup} · Enrolled {formatLongDate(data.student.enrolmentDate)}
            </p>
          </div>
        </div>
        <div className="student-detail-hero__actions">
          <Badge tone={data.student.active ? 'green' : 'amber'}>
            {data.student.active ? 'Active' : 'Inactive'}
          </Badge>
          {onEdit ? (
            <Button onClick={onEdit} size="sm" type="button" variant="secondary">
              <Edit3 aria-hidden="true" size={14} />
              Edit Profile
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StudentTabs({
  activeTab,
  onSelect,
}: {
  activeTab: DrillThroughTab;
  onSelect: (tab: DrillThroughTab) => void;
}) {
  return (
    <div className="student-detail-tabs" role="tablist">
      {DRILL_THROUGH_TABS.map(([id, label]) => (
        <button
          aria-selected={activeTab === id}
          className={activeTab === id ? 'is-selected' : undefined}
          key={id}
          onClick={() => {
            onSelect(id);
          }}
          role="tab"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({ data }: { data: DrillThrough }) {
  const presentDays = data.attendance.filter((row) => row.status === 'Present').length;
  const lateDays = data.attendance.filter((row) => row.status === 'Late').length;
  const absentDays = data.attendance.filter((row) => row.status === 'Absent').length;
  const meritsEarned = data.behaviour
    .filter((entry) => entry.meritDelta > 0)
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const demeritsTotal = data.behaviour
    .filter((entry) => entry.meritDelta < 0)
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const netMerits = meritsEarned + demeritsTotal;
  const avgPaceScore =
    data.pace.length > 0
      ? Math.round(data.pace.reduce((sum, item) => sum + item.score, 0) / data.pace.length)
      : null;

  return (
    <div className="snapshot-tab-panel">
      <div className="student-detail-summary-grid">
        <SnapshotStatCard
          accent="blue"
          label="Total Merit Balance"
          sub={`Spend: ${String(data.metrics.meritBalances.Spend)} · Saving: ${String(
            data.metrics.meritBalances.Saving,
          )}`}
          value={String(data.metrics.totalMerits)}
        />
        <SnapshotStatCard
          accent="blue"
          label="PACEs Completed"
          sub="this academic year"
          value={String(data.metrics.pacesCompletedThisAcademicYear)}
        />
        <SnapshotStatCard
          accent={data.metrics.attendanceRate === null ? 'amber' : 'green'}
          label="Attendance Rate"
          sub={`${String(data.metrics.presentDays)}/${String(
            data.metrics.recordedAttendanceDays,
          )} days this year`}
          value={data.metrics.attendanceRate === null ? '—' : `${String(data.metrics.attendanceRate)}%`}
        />
      </div>

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
          sub={`across ${String(data.behaviour.filter((entry) => entry.meritDelta > 0).length)} entries`}
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
          sub={`${String(data.pace.length)} test${data.pace.length === 1 ? '' : 's'} this year`}
          value={avgPaceScore === null ? '—' : `${String(avgPaceScore)}%`}
        />
      </div>

      <div className="snapshot-overview-grid">
        <section className="panel panel__body snapshot-merit-chart">
          <h3>Merit Activity</h3>
          <MeritSparkline entries={data.behaviour} />
          <div className="snapshot-merit-chart__totals">
            <SummaryTotal
              label="Merits"
              tone="green"
              value={meritsEarned > 0 ? `+${String(meritsEarned)}` : '0'}
            />
            <SummaryTotal
              label="Demerits"
              tone="red"
              value={demeritsTotal ? String(demeritsTotal) : '0'}
            />
            <SummaryTotal
              label="Net"
              tone={netMerits >= 0 ? 'navy' : 'red'}
              value={`${netMerits >= 0 ? '+' : ''}${String(netMerits)}`}
            />
          </div>
        </section>
        <section className="panel panel__body snapshot-pace-compact">
          <h3>Assigned subjects</h3>
          {data.student.subjects.length === 0 ? <p className="muted">No subjects assigned.</p> : null}
          {data.student.subjects.map((subject) => (
            <div key={subject.subjectId}>
              <SnapshotBadge tone="blue">{subject.code}</SnapshotBadge>
              <div>
                <strong>
                  {subject.name} <span>PACE {subject.currentPaceNumber}</span>
                </strong>
                <p>Current assignment</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function AttendanceTab({ data }: { data: DrillThrough }) {
  return <AttendanceCalendar attendance={data.attendance} fallbackDateKey={data.range.to} />;
}

function BehaviourTab({ data }: { data: DrillThrough }) {
  return (
    <div className="snapshot-tab-panel snapshot-list-panel">
      {data.behaviour.length === 0 ? <EmptyCard>No behaviour entries this academic year.</EmptyCard> : null}
      {data.behaviour.map((entry) => (
        <article
          className={
            entry.meritDelta > 0
              ? 'panel panel__body snapshot-behaviour-row is-merit'
              : 'panel panel__body snapshot-behaviour-row is-demerit'
          }
          key={entry.id}
        >
          <span>{signed(entry.meritDelta)}</span>
          <div>
            <div>
              <SnapshotBadge tone={entry.meritDelta > 0 ? 'green' : 'red'}>{entry.type}</SnapshotBadge>
              <SnapshotBadge tone="blue">{entry.category}</SnapshotBadge>
              {entry.visibility === 'Sensitive' ? <SnapshotBadge tone="amber">Sensitive</SnapshotBadge> : null}
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
  );
}

function PaceTab({ data }: { data: DrillThrough }) {
  return (
    <div className="snapshot-tab-panel snapshot-list-panel">
      {data.pace.length === 0 ? <EmptyCard>No PACE scores recorded this academic year.</EmptyCard> : null}
      {data.pace.map((item) => (
        <article className="panel panel__body snapshot-pace-row" key={item.id}>
          <ScoreDonut score={item.score} />
          <div className="snapshot-pace-row__main">
            <div>
              <h3>{item.subjectName}</h3>
              <SnapshotBadge tone={item.testType === 'PACE Test' ? 'green' : 'blue'}>
                {item.testType}
              </SnapshotBadge>
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
  );
}

function MeritsTab({ data }: { data: DrillThrough }) {
  const accounts = [
    ['Spend Account', data.metrics.meritBalances.Spend, 'red', 'Available to spend in Merit Shop'],
    ['Saving Account', data.metrics.meritBalances.Saving, 'blue', 'Transferred from Spend'],
    ['Investment Account', data.metrics.meritBalances.Investment, 'green', 'Investment balance'],
  ] as const;

  return (
    <div className="student-merit-grid">
      {accounts.map(([label, value, tone, description]) => (
        <SnapshotStatCard
          accent={tone}
          key={label}
          label={label}
          sub={description}
          value={String(value)}
        />
      ))}
    </div>
  );
}

function NotesTab({ data }: { data: DrillThrough }) {
  return <NotesList notes={data.notes} />;
}

export function StudentDrillThroughContent({
  backHref,
  backLabel,
  onEdit,
  studentId,
}: StudentDrillThroughContentProps) {
  const [activeTab, setActiveTab] = useState<DrillThroughTab>('overview');
  const drillThroughQuery = api.childLog.drillThrough.useQuery({ studentId }, { retry: false });
  const data = drillThroughQuery.data;

  if (drillThroughQuery.isLoading) {
    return <div className="empty-state">Loading student record...</div>;
  }

  if (drillThroughQuery.error || !data) {
    return (
      <div className="empty-state status--error">
        {drillThroughQuery.error?.message ?? 'Student record not found'}
      </div>
    );
  }

  return (
    <div className="student-drillthrough">
      <StudentHero backHref={backHref} backLabel={backLabel} data={data} onEdit={onEdit} />
      <StudentTabs activeTab={activeTab} onSelect={setActiveTab} />
      {activeTab === 'overview' ? <OverviewTab data={data} /> : null}
      {activeTab === 'attendance' ? <AttendanceTab data={data} /> : null}
      {activeTab === 'behaviour' ? <BehaviourTab data={data} /> : null}
      {activeTab === 'pace' ? <PaceTab data={data} /> : null}
      {activeTab === 'merits' ? <MeritsTab data={data} /> : null}
      {activeTab === 'notes' ? <NotesTab data={data} /> : null}
    </div>
  );
}
