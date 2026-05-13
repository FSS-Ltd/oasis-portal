import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Send,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { avatarColour, getInitials } from '@/lib/display';
import { StatCard } from '@/components/ui/stat-card';
import {
  asDate,
  dateKey,
  dayLabel,
  dayNumber,
  formatDate,
  formatShortDateTime,
  formatTime,
  isSameDay,
  todayKey,
  type DashboardMessageSummary,
  type DashboardNoticeSummary,
} from './supervisor-utils';

type SupervisorShift = {
  bandColour: string | null;
  bandName: string | null;
  date: string;
  endsAt: Date;
  id: string;
  startsAt: Date;
};

type DashboardActivityEntry = {
  category: string;
  createdAt: Date;
  id: string;
  meritDelta: number;
  note: string | null;
  recordedByName: string;
  studentName: string;
  type: 'Merit' | 'Demerit' | 'General';
};

type SwapRequestSummary = {
  createdAt: Date;
  direction: 'Incoming' | 'Requested';
  fromShift: Pick<SupervisorShift, 'date' | 'startsAt'>;
  id: string;
  requester: { fullName: string };
  targetUser: { fullName: string };
  toShift: Pick<SupervisorShift, 'date' | 'startsAt'>;
};

interface SupervisorDashboardOverviewProps {
  absentCount: number;
  attendanceError?: string | undefined;
  dashboardActivity: readonly DashboardActivityEntry[];
  dashboardActivityError?: string | undefined;
  dashboardActivityLoading: boolean;
  dashboardMessages: readonly DashboardMessageSummary[];
  dashboardNotices: readonly DashboardNoticeSummary[];
  dashboardNoticesError?: string | undefined;
  dashboardNoticesLoading: boolean;
  date: Date;
  lateCount: number;
  mySwapRequests: readonly SwapRequestSummary[];
  mySwapRequestsError?: string | undefined;
  mySwapRequestsLoading: boolean;
  openItems: number;
  presentCount: number;
  todayShifts: readonly SupervisorShift[];
  totalStudents: number;
  unreadNotices: number;
  weekDays: readonly Date[];
  weekEnd: Date;
  weekRotaError?: string | undefined;
  weekShifts: readonly SupervisorShift[];
  weekStart: Date;
}

function DashboardAction({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link className="head-action" href={{ pathname: href }}>
      <span className="head-action__content">
        {icon}
        <span>{label}</span>
      </span>
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

function AttendanceSummary({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'amber' | 'green' | 'red';
  value: number;
}) {
  return (
    <div className={`attendance-summary attendance-summary--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function SupervisorDashboardOverview({
  absentCount,
  attendanceError,
  dashboardActivity,
  dashboardActivityError,
  dashboardActivityLoading,
  dashboardMessages,
  dashboardNotices,
  dashboardNoticesError,
  dashboardNoticesLoading,
  date,
  lateCount,
  mySwapRequests,
  mySwapRequestsError,
  mySwapRequestsLoading,
  openItems,
  presentCount,
  todayShifts,
  totalStudents,
  unreadNotices,
  weekDays,
  weekEnd,
  weekRotaError,
  weekShifts,
  weekStart,
}: SupervisorDashboardOverviewProps) {
  return (
    <div className="supervisor-dashboard-home" aria-label="Supervisor daily overview">
      <div className="dashboard-hero">
        <p>{formatDate(date)} · Daily overview</p>
        <h1>Good morning, Supervisor</h1>
        <span>Oasis Learning Centre</span>
      </div>

      <section
        className="dashboard-grid dashboard-grid--hero"
        aria-label="Supervisor dashboard summary"
      >
        <StatCard
          accent="#166534"
          className="head-stat-card"
          label="Present today"
          sub={`${String(absentCount)} absent · ${String(lateCount)} late`}
          value={`${String(presentCount)}/${String(totalStudents)}`}
        />
        <StatCard
          accent="#5B90C5"
          className="head-stat-card"
          label="Today's shifts"
          sub="assigned to you"
          value={todayShifts.length}
        />
        <StatCard
          accent="#92400E"
          className="head-stat-card"
          label="Open items"
          sub="messages and swaps"
          value={openItems}
        />
        <StatCard
          accent="#8B1E2D"
          className="head-stat-card"
          label="Notices"
          sub="unread notices"
          value={unreadNotices}
        />
      </section>

      <div className="head-dashboard-layout">
        <div className="supervisor-dashboard-main">
          <section className="panel panel__body supervisor-week-panel">
            <div className="section-title">
              <div>
                <h2>This week</h2>
                <p className="muted">
                  {dateKey(weekStart)} to {dateKey(weekEnd)}
                </p>
              </div>
              <Link className="button button--secondary button--sm" href="/supervisor/rota">
                Open rota
              </Link>
            </div>

            {weekRotaError ? <p className="status--error">{weekRotaError}</p> : null}
            <div className="supervisor-week-grid">
              {weekDays.map((dayItem) => {
                const dayKey = dateKey(dayItem);
                const shiftsForDay = weekShifts.filter((shift) => shift.date === dayKey);
                const isToday = isSameDay(dayItem, date);
                const isPast = dayItem.getTime() < asDate(todayKey()).getTime();
                const className = [
                  'supervisor-day-card',
                  isToday ? 'is-today' : undefined,
                  isPast ? 'is-past' : undefined,
                  shiftsForDay.length === 0 ? 'is-unscheduled' : undefined,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <article className={className} key={dayKey}>
                    <div className="supervisor-day-card__head">
                      <span>{dayLabel(dayItem)}</span>
                      <strong>{dayNumber(dayItem)}</strong>
                    </div>
                    {shiftsForDay.length === 0 ? (
                      <p className="supervisor-day-card__empty">No shift scheduled</p>
                    ) : (
                      <div className="supervisor-day-card__shifts">
                        {shiftsForDay.map((shift) => (
                          <div className="supervisor-day-shift" key={shift.id}>
                            <span
                              aria-hidden="true"
                              className="supervisor-day-shift__swatch"
                              style={{ backgroundColor: shift.bandColour ?? undefined }}
                            />
                            <div>
                              <strong>
                                {formatTime(shift.startsAt)}-{formatTime(shift.endsAt)}
                              </strong>
                              <span>{shift.bandName ?? 'Unassigned band'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel panel__body head-activity-panel">
            <div className="section-title">
              <h2>Today&apos;s Activity</h2>
            </div>
            {dashboardActivityError ? (
              <p className="status--error">{dashboardActivityError}</p>
            ) : null}
            <div className="head-activity-list">
              {dashboardActivityLoading ? (
                <div className="empty-state">Loading today&apos;s activity...</div>
              ) : null}
              {!dashboardActivityLoading && dashboardActivity.length === 0 ? (
                <div className="empty-state">No behaviour activity recorded today.</div>
              ) : null}
              {dashboardActivity.map((entry, index) => (
                <div className="head-activity-row" key={entry.id}>
                  <span
                    className="head-activity-avatar"
                    style={{ backgroundColor: avatarColour(index) }}
                  >
                    {getInitials(entry.studentName)}
                  </span>
                  <div>
                    <strong>{entry.studentName}</strong>
                    <span
                      className={
                        entry.type === 'General'
                          ? 'head-merit-pill head-merit-pill--sensitive'
                          : entry.meritDelta >= 0
                            ? 'head-merit-pill head-merit-pill--plus'
                            : 'head-merit-pill head-merit-pill--minus'
                      }
                    >
                      {entry.type === 'General'
                        ? 'No merit value'
                        : `${entry.meritDelta >= 0 ? `+${String(entry.meritDelta)}` : String(entry.meritDelta)} merits`}
                    </span>
                    <p>
                      {entry.category}
                      {entry.note ? ` · ${entry.note}` : null}
                    </p>
                    <p>Recorded by {entry.recordedByName}</p>
                  </div>
                  <time>{formatTime(entry.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="head-dashboard-side">
          <section className="panel panel__body">
            <div className="section-title">
              <h2>Quick Actions</h2>
            </div>
            <div className="head-action-list">
              <DashboardAction
                href="/supervisor/attendance"
                icon={<ClipboardCheck size={16} />}
                label="Mark Attendance"
              />
              <DashboardAction
                href="/supervisor/behaviour"
                icon={<Star size={16} />}
                label="Log Behaviour"
              />
              <DashboardAction
                href="/supervisor/pace"
                icon={<BookOpenCheck size={16} />}
                label="Record PACE Score"
              />
              <DashboardAction
                href="/supervisor/snapshot"
                icon={<FileText size={16} />}
                label="Child Snapshot"
              />
            </div>
          </section>

          <section className="panel panel__body supervisor-dashboard-card supervisor-dashboard-card--rail">
            <div className="section-title">
              <div>
                <h2>Pending</h2>
                <p className="muted">Messages and shift swap requests needing attention.</p>
              </div>
              <span className="badge badge--blue">
                {dashboardMessages.length + mySwapRequests.length} open
              </span>
            </div>

            <div className="supervisor-dashboard-list">
              <h3>
                <MessageSquare aria-hidden="true" size={15} />
                Messages
              </h3>
              {dashboardMessages.length === 0 ? (
                <div className="dashboard-empty-state">
                  Messages will appear here when the messaging API is connected.
                </div>
              ) : (
                dashboardMessages.map((message) => (
                  <article className="dashboard-list-row" key={message.id}>
                    <strong>{message.subject}</strong>
                    <span>{message.latestPreview}</span>
                    {message.updatedAt ? (
                      <small>{formatShortDateTime(message.updatedAt)}</small>
                    ) : null}
                  </article>
                ))
              )}
            </div>

            <div className="supervisor-dashboard-list">
              <h3>
                <Send aria-hidden="true" size={15} />
                Swap requests
              </h3>
              {mySwapRequestsError ? <p className="status--error">{mySwapRequestsError}</p> : null}
              {!mySwapRequestsLoading && mySwapRequests.length === 0 ? (
                <div className="dashboard-empty-state">No pending shift swap requests.</div>
              ) : null}
              {mySwapRequests.map((request) => {
                const otherPerson =
                  request.direction === 'Requested'
                    ? request.targetUser.fullName
                    : request.requester.fullName;
                return (
                  <article className="dashboard-list-row" key={request.id}>
                    <strong>
                      {request.direction === 'Requested'
                        ? 'Awaiting Head review'
                        : 'Incoming request'}{' '}
                      with {otherPerson}
                    </strong>
                    <span>
                      {request.fromShift.date} {formatTime(request.fromShift.startsAt)} →{' '}
                      {request.toShift.date} {formatTime(request.toShift.startsAt)}
                    </span>
                    <small>{formatShortDateTime(request.createdAt)}</small>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel panel__body supervisor-dashboard-card supervisor-dashboard-card--rail">
            <div className="section-title">
              <div>
                <h2>Notices</h2>
                <p className="muted">Admin notices for supervisors.</p>
              </div>
              <Link
                className="button button--secondary button--sm"
                href={{ pathname: '/supervisor/noticeboard' }}
              >
                Open
              </Link>
            </div>
            {dashboardNoticesError ? (
              <p className="status--error">{dashboardNoticesError}</p>
            ) : null}
            {dashboardNoticesLoading ? (
              <div className="dashboard-empty-state">Loading notices...</div>
            ) : null}
            {!dashboardNoticesLoading && dashboardNotices.length === 0 ? (
              <div className="dashboard-empty-state">No active staff notices.</div>
            ) : null}
            <div className="supervisor-dashboard-list">
              {dashboardNotices.map((notice) => (
                <article
                  className={notice.read ? 'dashboard-list-row' : 'dashboard-list-row is-unread'}
                  key={notice.id}
                >
                  <strong>{notice.title}</strong>
                  <span>{notice.bodyPreview}</span>
                  {notice.postedAt ? <small>{formatShortDateTime(notice.postedAt)}</small> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel panel__body">
            <div className="section-title">
              <h2>Attendance Today</h2>
            </div>
            <div className="attendance-summary-grid">
              <AttendanceSummary label="Present" tone="green" value={presentCount} />
              <AttendanceSummary label="Absent" tone="red" value={absentCount} />
              <AttendanceSummary label="Late" tone="amber" value={lateCount} />
            </div>
            {attendanceError ? <p className="status--error">{attendanceError}</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
