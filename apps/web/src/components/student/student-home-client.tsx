'use client';

import { BookOpenCheck, CalendarDays, Clock, Sparkles, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentProfile = RouterOutputs['student']['me'];
type UsageStatus = RouterOutputs['student']['portalUsage']['usage'];

function firstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/).find(Boolean) ?? 'Student';
}

function yearLabel(yearGroup: string | null): string {
  return yearGroup ? `Year ${yearGroup}` : 'Student account';
}

function formatResetTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function nearestUsageWindow(usage: UsageStatus | undefined) {
  if (!usage) return null;
  const windows = [
    { label: 'Hour', status: usage.hourly },
    { label: 'Day', status: usage.daily },
    { label: 'Week', status: usage.weekly },
  ];

  return windows.find((window) => window.status.limitMinutes !== null) ?? null;
}

function StudentHero({
  profile,
  usage,
}: {
  profile: StudentProfile;
  usage: UsageStatus | undefined;
}) {
  const limitedWindow = nearestUsageWindow(usage);
  const firstName = firstNameFrom(profile.fullName);
  return (
    <section className="student-hero">
      <div className="student-hero__identity">
        <Avatar className="student-hero__avatar" name={firstName} />
        <div>
          <p>Student Portal</p>
          <h1>Hi, {firstName}</h1>
          <span>{yearLabel(profile.yearGroup)}</span>
        </div>
      </div>
      <div className="student-hero__meta">
        <span>Today</span>
        <strong>
          {new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(new Date())}
        </strong>
        {limitedWindow ? (
          <small>
            {limitedWindow.label} limit resets at {formatResetTime(limitedWindow.status.resetAt)}
          </small>
        ) : (
          <small>No portal time limit set</small>
        )}
      </div>
    </section>
  );
}

function StudentShellCard({
  body,
  icon: Icon,
  title,
}: {
  body: string;
  icon: typeof Wallet;
  title: string;
}) {
  return (
    <article className="student-shell-card">
      <span>
        <Icon aria-hidden="true" size={18} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}

export function StudentHomeClient() {
  const student = api.student.me.useQuery(undefined, { retry: false });
  const usage = api.student.portalUsage.useQuery(undefined, { retry: false });

  if (!student.data) {
    return <div className="student-inline-state">Loading student dashboard...</div>;
  }

  return (
    <div className="student-page">
      <StudentHero profile={student.data} usage={usage.data?.usage} />
      <section className="student-shell-grid" aria-label="Student portal preview">
        <StudentShellCard
          body="Your Spend, Saving, Investment, and shop-held merits will appear here in the wallet PR."
          icon={Wallet}
          title="Wallet"
        />
        <StudentShellCard
          body="Subject progress and recent PACE results will use the existing academic progress owner."
          icon={BookOpenCheck}
          title="PACE"
        />
        <StudentShellCard
          body="Faith Corner content is planned for a later managed-content PR."
          icon={Sparkles}
          title="Faith Corner"
        />
        <StudentShellCard
          body="Calendar, notices, and shop shortcuts will arrive as the student feature routes fill in."
          icon={CalendarDays}
          title="Coming Next"
        />
      </section>
      {usage.data?.usage ? (
        <section className="student-usage-strip">
          <Clock aria-hidden="true" size={16} />
          <span>
            Portal time used: {String(usage.data.usage.hourly.usedMinutes)} min this hour,{' '}
            {String(usage.data.usage.daily.usedMinutes)} min today.
          </span>
        </section>
      ) : null}
    </div>
  );
}
