'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  FileText,
  Star,
} from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';

type DashboardChild = RouterOutputs['childLog']['parentDashboard']['children'][number];
type AttendanceStatus = DashboardChild['attendance'][number]['status'];

const statusTone = {
  Absent: 'red',
  Late: 'amber',
  Present: 'green',
} as const satisfies Record<AttendanceStatus, 'amber' | 'green' | 'red'>;

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function attendanceLabel(status: AttendanceStatus | undefined): string {
  if (!status) return 'No mark';
  return status;
}

function attendanceSub(child: DashboardChild): string {
  const { attendanceRate, presentDays, recordedAttendanceDays } = child.metrics;
  if (attendanceRate === null) return 'No attendance recorded';
  return `${String(presentDays)}/${String(recordedAttendanceDays)} marked present`;
}

function ChildHero({ child }: { child: DashboardChild }) {
  const latestAttendance = child.attendance[0];

  return (
    <article className="parent-child-hero">
      <div className="parent-child-hero__identity">
        <Avatar className="parent-child-hero__avatar" name={child.student.fullName} />
        <div>
          <h2>{child.student.fullName}</h2>
          <p>{displaySchoolYearLabel(child.student.yearGroup)}</p>
        </div>
      </div>
      <div className="parent-child-hero__stats">
        <div>
          <strong>{String(child.metrics.totalMerits)}</strong>
          <span>Total merits</span>
        </div>
        <div>
          <strong>{attendanceLabel(latestAttendance?.status)}</strong>
          <span>{latestAttendance ? formatDate(latestAttendance.date) : 'Today'}</span>
        </div>
        <div>
          <strong>{String(child.metrics.pacesCompletedThisAcademicYear)}</strong>
          <span>PACEs passed</span>
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

function MetricGrid({ child }: { child: DashboardChild }) {
  return (
    <section
      className="dashboard-grid parent-dashboard-metrics"
      aria-label={`${child.student.fullName} summary`}
    >
      <StatCard
        accent="#166534"
        className="head-stat-card"
        label="Attendance"
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

function DashboardList({
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

function ChildDashboard({ child }: { child: DashboardChild }) {
  return (
    <section className="parent-child-dashboard" aria-label={`${child.student.fullName} dashboard`}>
      <ChildHero child={child} />
      <MetricGrid child={child} />

      <div className="parent-dashboard-panels">
        <DashboardList
          empty={child.attendance.length === 0}
          icon={<CalendarCheck aria-hidden="true" size={16} />}
          title="Recent Attendance"
        >
          <div className="supervisor-dashboard-list">
            {child.attendance.map((row) => (
              <div className="dashboard-list-row parent-dashboard-row" key={row.id}>
                <strong>{formatDate(row.date)}</strong>
                <Badge tone={statusTone[row.status]}>{row.status}</Badge>
              </div>
            ))}
          </div>
        </DashboardList>

        <DashboardList
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
        </DashboardList>

        <DashboardList
          empty={child.behaviour.length === 0}
          icon={<Star aria-hidden="true" size={16} />}
          title="Recent Behaviour"
        >
          <div className="supervisor-dashboard-list">
            {child.behaviour.map((entry) => (
              <div className="dashboard-list-row" key={entry.id}>
                <strong>
                  {entry.category} · {entry.meritDelta > 0 ? '+' : ''}
                  {String(entry.meritDelta)}
                </strong>
                <span>{entry.note ?? entry.type}</span>
                <small>{formatDateTime(entry.createdAt)}</small>
              </div>
            ))}
          </div>
        </DashboardList>

        <DashboardList
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
        </DashboardList>
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
  const children = dashboardQuery.data?.children ?? [];
  const primaryChild = children[0];

  if (profileQuery.isLoading || dashboardQuery.isLoading) {
    return <div className="empty-state">Loading parent dashboard...</div>;
  }

  if (profileQuery.error || dashboardQuery.error) {
    return (
      <EmptyState
        detail={
          profileQuery.error?.message ??
          dashboardQuery.error?.message ??
          'Dashboard data could not be loaded.'
        }
        title="Parent dashboard unavailable"
      />
    );
  }

  return (
    <div className="parent-dashboard">
      <div className="dashboard-hero parent-dashboard-hero">
        <p>Parent portal</p>
        <h1>Welcome, {profileQuery.data?.fullName ?? 'Parent'}</h1>
        <span>
          {children.length === 1
            ? `Parent of ${children[0]?.student.fullName ?? 'linked child'}`
            : `${String(children.length)} linked children`}
        </span>
      </div>

      {primaryChild ? (
        <div className="parent-dashboard-stack">
          <ChildDashboard child={primaryChild} />
          {children.length > 1 ? (
            <section className="panel panel__body parent-linked-panel">
              <div className="section-title">
                <div>
                  <h2>Linked Children</h2>
                  <p className="muted">Open each child record for the full read-only view.</p>
                </div>
              </div>
              <div className="parent-linked-grid">
                {children.map((child) => (
                  <Link
                    className="parent-linked-card"
                    href={`/parent/children/${child.student.id}`}
                    key={child.student.id}
                  >
                    <Avatar name={child.student.fullName} />
                    <span>
                      <strong>{child.student.fullName}</strong>
                      <small>{displaySchoolYearLabel(child.student.yearGroup)}</small>
                    </span>
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyDashboard />
      )}

      <section className="panel panel__body parent-profile-shortcut">
        <ClipboardList aria-hidden="true" size={18} />
        <div>
          <strong>Profile details</strong>
          <span>Keep contact details current for centre communication.</span>
        </div>
        <Link className="button button--secondary button--sm" href="/parent/profile">
          My Profile
        </Link>
      </section>
    </div>
  );
}
