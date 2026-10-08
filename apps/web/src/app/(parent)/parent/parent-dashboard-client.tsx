'use client';

import Link from 'next/link';
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  FileText,
  Star,
} from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ParentChildSelector } from '@/components/parent/parent-child-selector';
import { StatCard } from '@/components/ui/stat-card';
import { SiblingAddModalButton } from './registration/sibling-add-modal';

type DashboardChild = RouterOutputs['childLog']['parentDashboard']['children'][number];
type AttendanceStatus = DashboardChild['attendance'][number]['status'];

const statusTone = {
  Absent: 'red',
  Late: 'amber',
  Present: 'green',
} as const satisfies Record<AttendanceStatus, 'amber' | 'green' | 'red'>;

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});
const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatDate(value: Date | string): string {
  return shortDateFormatter.format(new Date(value));
}

function formatLongDate(value: Date | string): string {
  return longDateFormatter.format(new Date(value));
}

function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

function attendanceSub(child: DashboardChild): string {
  const { attendanceRate, attendedDays, recordedAttendanceDays } = child.metrics;
  if (attendanceRate === null) return 'No attendance recorded';
  return `${String(attendedDays)}/${String(recordedAttendanceDays)} attended`;
}

function ChildHero({ child }: { child: DashboardChild }) {
  const totalMerits = child.metrics.totalMerits;

  return (
    <article className="parent-child-hero">
      <div className="parent-child-hero__identity">
        <Avatar className="parent-child-hero__avatar" name={child.student.fullName} />
        <div>
          <h2>{child.student.fullName}</h2>
          <p>{displaySchoolYearLabel(child.student.yearGroup)}</p>
        </div>
      </div>
      <div className="parent-child-hero__merits">
        <strong>{String(totalMerits)}</strong>
        <span>total merits</span>
      </div>
      <div className="parent-child-hero__stats">
        <div>
          <strong>{child.todayStatus.label}</strong>
          <span>Today</span>
        </div>
        <div>
          <strong>{String(child.metrics.pacesCompletedThisAcademicYear)}</strong>
          <span>PACEs</span>
        </div>
        <div>
          <strong>{String(child.metrics.meritBalances.TithePaid)}</strong>
          <span>Tithed</span>
        </div>
      </div>
      <Link
        className="button button--secondary button--sm"
        href={`/parent/children/${child.student.id}`}
      >
        Open child view
        <ArrowRight aria-hidden="true" size={14} />
      </Link>
    </article>
  );
}

function ParentHomeIntro({
  children,
  childrenCount,
  onSelectChild,
  parentName,
  rangeTo,
  selectedChild,
}: {
  children: readonly DashboardChild[];
  childrenCount: number;
  onSelectChild: (studentId: string) => void;
  parentName: string;
  rangeTo: Date | string;
  selectedChild: DashboardChild | undefined;
}) {
  return (
    <div className="parent-page-title-row">
      <div className="parent-home-intro">
        <p>{formatLongDate(rangeTo)}</p>
        <h1>Welcome, {parentName}</h1>
        <span>
          {selectedChild
            ? childrenCount === 1
              ? `Parent of ${selectedChild.student.fullName}`
              : `${String(childrenCount)} linked children`
            : 'Parent portal'}
        </span>
      </div>
      {selectedChild ? (
        <ParentChildSelector
          children={children.map((child) => ({
            fullName: child.student.fullName,
            id: child.student.id,
            yearGroup: child.student.yearGroup,
          }))}
          onSelect={onSelectChild}
          selectedChildId={selectedChild.student.id}
        />
      ) : null}
    </div>
  );
}

function ParentHomeMetricGrid({ child }: { child: DashboardChild }) {
  return (
    <section
      className="dashboard-grid parent-dashboard-metrics"
      aria-label={`${child.student.fullName} summary`}
    >
      <StatCard
        accent="#166534"
        className="head-stat-card"
        label="Oasis attendance"
        sub={attendanceSub(child)}
        value={
          child.metrics.attendanceRate === null ? '-' : `${String(child.metrics.attendanceRate)}%`
        }
      />
      <StatCard
        accent="#5B90C5"
        className="head-stat-card"
        label="PACE Progress"
        sub="passed this academic year"
        value={child.metrics.pacesCompletedThisAcademicYear}
      />
      <StatCard
        accent="#8B1E2D"
        className="head-stat-card"
        label="Merit Wallet"
        sub="Spend, saving, investment"
        value={child.metrics.totalMerits}
      />
      <StatCard
        accent="#92400E"
        className="head-stat-card"
        label="Visible Notes"
        sub="recent centre notes"
        value={child.notes.length}
      />
    </section>
  );
}

function DashboardSection({
  children,
  empty,
  icon,
  title,
}: {
  children: ReactNode;
  empty: boolean;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="panel panel__body parent-dashboard-card">
      <h3>
        {icon}
        {title}
      </h3>
      {empty ? <div className="dashboard-empty-state">No recent records.</div> : children}
    </section>
  );
}

function MeritWalletPreview({ child }: { child: DashboardChild }) {
  const balances = child.metrics.meritBalances;
  const rows = [
    { label: 'Spend', value: balances.Spend, colour: '#7d1c2c' },
    { label: 'Saving', value: balances.Saving, colour: '#1b2b5e' },
    { label: 'Investment', value: balances.Investment, colour: '#5b90c5' },
    { label: 'Tithed', value: balances.TithePaid, colour: '#2f7d4f' },
    { label: 'Charity', value: balances.Given, colour: '#5b90c5' },
  ] as const;

  return (
    <section className="panel panel__body parent-dashboard-card parent-wallet-card">
      <h3>
        <Star aria-hidden="true" size={16} />
        Merit Wallet
      </h3>
      <div className="parent-wallet-list">
        {rows.map((row) => (
          <div className="parent-wallet-row" key={row.label}>
            <span>
              <i style={{ '--wallet-colour': row.colour } as CSSProperties} />
              {row.label} Account
            </span>
            <strong style={{ '--wallet-colour': row.colour } as CSSProperties}>
              {String(row.value)}
            </strong>
          </div>
        ))}
      </div>
      <div className="parent-wallet-total">
        <span>Total</span>
        <strong>{String(child.metrics.totalMerits)}</strong>
      </div>
      <Link
        className="button button--secondary button--sm parent-card-link"
        href={`/parent/children/${child.student.id}`}
      >
        Manage wallet
        <ArrowRight aria-hidden="true" size={14} />
      </Link>
    </section>
  );
}

function RecentBehaviourPreview({ child }: { child: DashboardChild }) {
  return (
    <section className="panel panel__body parent-dashboard-card parent-behaviour-card">
      <h3>
        <Star aria-hidden="true" size={16} />
        Recent Behaviour
      </h3>
      {child.behaviour.length === 0 ? (
        <div className="dashboard-empty-state">No recent records.</div>
      ) : (
        <div className="parent-behaviour-list">
          {child.behaviour.map((entry) => (
            <div className="parent-behaviour-row" key={entry.id}>
              <span className={entry.meritDelta >= 0 ? 'is-positive' : 'is-negative'} />
              <div>
                <p>
                  <Badge tone={entry.meritDelta >= 0 ? 'green' : 'red'}>
                    {entry.meritDelta > 0 ? '+' : ''}
                    {String(entry.meritDelta)} merits
                  </Badge>
                  <small>{formatDateTime(entry.createdAt)}</small>
                </p>
                <strong>{entry.category}</strong>
                <em>{entry.note ?? entry.type}</em>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link
        className="button button--secondary button--sm parent-card-link"
        href={`/parent/children/${child.student.id}`}
      >
        Open child view
        <ArrowRight aria-hidden="true" size={14} />
      </Link>
    </section>
  );
}

function ChildDashboard({ child }: { child: DashboardChild }) {
  return (
    <section className="parent-child-dashboard" aria-label={`${child.student.fullName} dashboard`}>
      <ChildHero child={child} />
      <ParentHomeMetricGrid child={child} />

      <div className="parent-home-feature-grid">
        <RecentBehaviourPreview child={child} />
        <MeritWalletPreview child={child} />
      </div>

      <div className="parent-dashboard-panels">
        <DashboardSection
          empty={child.attendance.length === 0}
          icon={<CalendarCheck aria-hidden="true" size={16} />}
          title="Recent Oasis attendance"
        >
          <div className="supervisor-dashboard-list">
            {child.attendance.map((row) => (
              <div className="dashboard-list-row parent-dashboard-row" key={row.id}>
                <strong>{formatDate(row.date)}</strong>
                <Badge tone={statusTone[row.status]}>{row.status}</Badge>
              </div>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          empty={child.pace.length === 0}
          icon={<BookOpenCheck aria-hidden="true" size={16} />}
          title="PACE Progress"
        >
          <div className="supervisor-dashboard-list">
            {child.pace.map((record) => (
              <div className="dashboard-list-row" key={record.id}>
                <strong>
                  {record.subjectCode} PACE {String(record.paceNumber)}
                </strong>
                <span>
                  {record.testType} · {String(record.score)}% · {formatDate(record.date)}
                </span>
              </div>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          empty={child.notes.length === 0}
          icon={<FileText aria-hidden="true" size={16} />}
          title="Visible Notes"
        >
          <div className="supervisor-dashboard-list">
            {child.notes.map((note) => (
              <div className="dashboard-list-row" key={note.id}>
                <strong>{formatDateTime(note.createdAt)}</strong>
                <span>{note.note}</span>
              </div>
            ))}
          </div>
        </DashboardSection>
      </div>
    </section>
  );
}

function EmptyDashboard() {
  const registration = api.registration.status.useQuery(undefined, { retry: false });
  const status = registration.data;

  if (registration.isLoading) {
    return <div className="empty-state">Loading registration status...</div>;
  }

  if (status?.requiresRegistration) {
    return (
      <EmptyState>
        <strong>Child registration needed</strong>
        <span>
          Complete the initial child registration so Oasis can prepare linked child records for this
          account.
        </span>
        <span>
          <Link className="button button--primary" href="/registration">
            Open registration
          </Link>
        </span>
      </EmptyState>
    );
  }

  if (status?.registrationId && status.linkedChildrenCount === 0) {
    return (
      <EmptyState
        detail="Your registration has been submitted and is awaiting centre review before child records appear here."
        title="Registration submitted"
      />
    );
  }

  return (
    <EmptyState
      detail="Ask the Head of Centre to link your child records to this account."
      title="No linked children found"
    />
  );
}

export function ParentDashboardClient() {
  const profileQuery = api.profile.me.useQuery(undefined, { retry: false });
  const dashboardQuery = api.childLog.parentDashboard.useQuery(undefined, { retry: false });
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const children = useMemo(
    () => dashboardQuery.data?.children ?? [],
    [dashboardQuery.data?.children],
  );
  const selectedChild =
    children.find((child) => child.student.id === selectedChildId) ?? children[0];

  if (profileQuery.isLoading || dashboardQuery.isLoading) {
    return <div className="empty-state">Loading parent dashboard...</div>;
  }

  if (profileQuery.error || dashboardQuery.error) {
    return (
      <EmptyState
        detail={
          (profileQuery.error ? friendlyErrorMessage(profileQuery.error) : null) ??
          (dashboardQuery.error ? friendlyErrorMessage(dashboardQuery.error) : null) ??
          'Dashboard data could not be loaded.'
        }
        title="Parent dashboard unavailable"
      />
    );
  }

  return (
    <div className="parent-dashboard">
      <ParentHomeIntro
        children={children}
        childrenCount={children.length}
        onSelectChild={setSelectedChildId}
        parentName={profileQuery.data?.fullName ?? 'Parent'}
        rangeTo={dashboardQuery.data?.range.to ?? new Date()}
        selectedChild={selectedChild}
      />

      {selectedChild ? (
        <div className="parent-dashboard-stack">
          <ChildDashboard child={selectedChild} />
        </div>
      ) : (
        <EmptyDashboard />
      )}

      <section className="panel panel__body parent-profile-shortcut">
        <ClipboardList aria-hidden="true" size={18} />
        <div>
          <strong>Registration details</strong>
          <span>Keep household details current or add another linked child.</span>
        </div>
        <div className="parent-profile-shortcut__actions">
          <Link className="button button--secondary button--sm" href="/parent/registration">
            Registration
          </Link>
          <SiblingAddModalButton size="sm" />
        </div>
      </section>
    </div>
  );
}
