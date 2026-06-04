'use client';

import Link from 'next/link';
import {
  BookOpenCheck,
  CalendarDays,
  Clock,
  type LucideIcon,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentDashboard = RouterOutputs['student']['dashboard'];
type UsageStatus = RouterOutputs['student']['portalUsage']['usage'];

function formatResetTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function nearestUsageWindow(usage: UsageStatus | undefined) {
  if (!usage) return null;
  if (usage.daily.limitMinutes === null) return null;
  return { label: 'Daily', status: usage.daily };
}

function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function StudentHero({
  dashboard,
  usage,
}: {
  dashboard: StudentDashboard;
  usage: UsageStatus | undefined;
}) {
  const limitedWindow = nearestUsageWindow(usage);
  const { profile } = dashboard;
  return (
    <section className="student-hero">
      <div className="student-hero__identity">
        {profile.childIconPhotoUrl ? (
          <span
            aria-hidden="true"
            className="student-hero__photo"
            style={{ backgroundImage: `url("${profile.childIconPhotoUrl}")` }}
          />
        ) : (
          <span className="student-hero__icon" aria-hidden="true">
            {profile.iconInitials}
          </span>
        )}
        <div>
          <p>Student Portal</p>
          <h1>Hi, {profile.firstName}</h1>
          <span>
            {profile.yearGroupLabel} · Age band {profile.ageBand}
          </span>
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
          <small>No daily portal time limit set</small>
        )}
      </div>
    </section>
  );
}

function StudentMetricCard({
  detail,
  icon: Icon,
  meta,
  title,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  meta?: string;
  title: string;
  value: string;
}) {
  return (
    <article className="student-metric-card">
      <span>
        <Icon aria-hidden="true" size={18} />
      </span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
        {meta ? <em>{meta}</em> : null}
      </div>
    </article>
  );
}

function PacePanel({ pace }: { pace: StudentDashboard['pace'] }) {
  return (
    <section className="student-dashboard-panel" aria-labelledby="student-pace-title">
      <div className="student-dashboard-panel__head">
        <div>
          <p>PACE</p>
          <h2 id="student-pace-title">Current work</h2>
        </div>
        <Link className="button button--secondary button--sm" href="/student/pace">
          Open PACE
        </Link>
      </div>
      {pace.currentPaces.length === 0 ? (
        <div className="student-dashboard-empty">No active PACE subjects yet.</div>
      ) : (
        <div className="student-pace-list">
          {pace.currentPaces.map((item) => (
            <article className="student-pace-row" key={item.subjectCode}>
              <span>{item.subjectCode}</span>
              <div>
                <strong>{item.subjectName}</strong>
                <small>Current PACE {String(item.currentPaceNumber)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FaithPanel({ faithCorner }: { faithCorner: StudentDashboard['faithCorner'] }) {
  return (
    <section className="student-dashboard-panel" aria-labelledby="student-faith-title">
      <div className="student-dashboard-panel__head">
        <div>
          <p>Faith Corner</p>
          <h2 id="student-faith-title">{faithCorner.weeklyTheme}</h2>
        </div>
        <Sparkles aria-hidden="true" size={20} />
      </div>
      {faithCorner.memoryVerse ? (
        <div className="student-faith-preview">
          <strong>{faithCorner.memoryVerse.reference}</strong>
          <p>{faithCorner.memoryVerse.text}</p>
          <small>{faithCorner.memoryVerse.translation}</small>
        </div>
      ) : null}
      {faithCorner.reflectionPrompt ? (
        <p className="student-dashboard-panel__copy">{faithCorner.reflectionPrompt}</p>
      ) : null}
      {!faithCorner.ready ? (
        <span className="student-dashboard-muted">
          Managed content will appear here when ready.
        </span>
      ) : null}
    </section>
  );
}

export function StudentHomeClient() {
  const dashboard = api.student.dashboard.useQuery(undefined, { retry: false });
  const usage = api.student.portalUsage.useQuery(undefined, { retry: false });

  if (dashboard.isLoading) {
    return <div className="student-inline-state">Loading student dashboard...</div>;
  }

  if (dashboard.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(dashboard.error)}
        title="Student dashboard unavailable"
      />
    );
  }

  if (!dashboard.data) {
    return (
      <EmptyState detail="No student dashboard data was returned." title="No dashboard data" />
    );
  }

  const attendance = dashboard.data.attendance;
  const attendanceValue =
    attendance.attendanceRate === null ? 'No records' : `${String(attendance.attendanceRate)}%`;
  const paceMeta =
    dashboard.data.pace.assignedSubjectCount === 0
      ? 'No active subjects'
      : `${String(dashboard.data.pace.assignedSubjectCount)} active subjects`;

  return (
    <div className="student-page">
      <StudentHero dashboard={dashboard.data} usage={usage.data?.usage} />
      <section className="student-dashboard-grid" aria-label="Student dashboard summary">
        <StudentMetricCard
          detail={
            dashboard.data.merits.hasActivity
              ? 'Across Spend, Saving, Investment, and shop-held merits.'
              : 'No merit activity has been recorded yet.'
          }
          icon={Wallet}
          meta={`Spend ${formatMerits(dashboard.data.merits.balances.Spend)}`}
          title="Merits"
          value={formatMerits(dashboard.data.merits.totalMerits)}
        />
        <StudentMetricCard
          detail={`${String(dashboard.data.pace.completedPaceCount)} completed PACEs recorded.`}
          icon={BookOpenCheck}
          meta={paceMeta}
          title="PACE"
          value={String(dashboard.data.pace.completedPaceCount)}
        />
        <StudentMetricCard
          detail={`${String(attendance.Present)} present, ${String(attendance.Late)} late, ${String(
            attendance.Absent,
          )} absent in the last ${String(attendance.days)} days.`}
          icon={CalendarDays}
          title="Attendance"
          value={attendanceValue}
        />
        <StudentMetricCard
          detail={`${String(dashboard.data.shortcuts.activeClubCount)} active clubs and ${String(
            dashboard.data.shortcuts.activeShopItemCount,
          )} shop items available.`}
          icon={Trophy}
          title="Shortcuts"
          value={String(
            dashboard.data.shortcuts.activeClubCount + dashboard.data.shortcuts.activeShopItemCount,
          )}
        />
      </section>
      <div className="student-dashboard-main">
        <PacePanel pace={dashboard.data.pace} />
        <FaithPanel faithCorner={dashboard.data.faithCorner} />
        <section className="student-dashboard-panel" aria-labelledby="student-notifications-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Notifications</p>
              <h2 id="student-notifications-title">Latest updates</h2>
            </div>
            <Link
              className="button button--secondary button--sm"
              href={{ pathname: '/student/notifications' }}
            >
              Open updates
            </Link>
          </div>
          {dashboard.data.notifications.unreadCount > 0 ? (
            <p className="student-dashboard-panel__copy">
              {String(dashboard.data.notifications.unreadCount)} unread updates.
            </p>
          ) : null}
          {dashboard.data.notifications.latest.length === 0 ? (
            <div className="student-dashboard-empty">No student notifications yet.</div>
          ) : (
            <div className="student-notification-list">
              {dashboard.data.notifications.latest.map((item) => (
                <article className="student-notification-row" key={item.id}>
                  <strong>{item.title}</strong>
                  <small>{item.read ? 'Read' : 'Unread'}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {usage.data?.usage ? (
        <section className="student-usage-strip">
          <Clock aria-hidden="true" size={16} />
          <span>Portal time used: {String(usage.data.usage.daily.usedMinutes)} min today.</span>
        </section>
      ) : null}
    </div>
  );
}
