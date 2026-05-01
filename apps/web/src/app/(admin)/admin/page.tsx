import Link from 'next/link';
import type { Route } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@oasis/db';
import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';

function todayBounds(): { start: Date; end: Date } {
  const key = new Date().toISOString().slice(0, 10);
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function decrypt(value: string | null | undefined): string {
  return prisma.$enc.decrypt(value) ?? 'Unknown';
}

export default async function AdminIndexPage() {
  const user = await getFullAdminUser();
  const { start, end } = todayBounds();
  const [
    currentUser,
    activeStudentCount,
    attendanceRows,
    activityRows,
    unreadMessages,
    reportsDue,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { fullNameEnc: true },
    }),
    prisma.student.count({ where: { active: true } }),
    prisma.attendance.findMany({
      where: { date: start },
      select: { status: true },
    }),
    prisma.behaviourEntry.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: {
        student: { select: { fullNameEnc: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.message.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.termReport.count({ where: { status: { in: ['Draft', 'UnderReview'] } } }),
  ]);

  const present = attendanceRows.filter((row) => row.status === 'Present').length;
  const absent = attendanceRows.filter((row) => row.status === 'Absent').length;
  const late = attendanceRows.filter((row) => row.status === 'Late').length;
  const meritTotal = activityRows
    .filter((entry) => entry.type === 'Merit')
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const headName = currentUser ? decrypt(currentUser.fullNameEnc) : 'Head of Centre';

  return (
    <MotionPage>
      <div className="dashboard-hero">
        <p>{formatLongDate(start)} · Spring Term 2</p>
        <h1>Good morning, {headName}</h1>
        <span>Head of Centre · Oasis Learning Centre</span>
      </div>

      <section className="dashboard-grid dashboard-grid--hero" aria-label="Head dashboard summary">
        <StatCard
          accent="#166534"
          label="Present today"
          sub={`${String(absent)} absent · ${String(late)} late`}
          value={`${String(present)}/${String(activeStudentCount)}`}
        />
        <StatCard
          accent="#5B90C5"
          label="Merits awarded"
          sub="today across all students"
          value={`+${String(meritTotal)}`}
        />
        <StatCard
          accent="#92400E"
          label="Unread messages"
          sub="from parents"
          value={String(unreadMessages)}
        />
        <StatCard
          accent="#8B1E2D"
          label="Reports due"
          sub="end of term deadline"
          value={String(reportsDue)}
        />
      </section>

      <div className="head-dashboard-layout">
        <section className="panel panel__body head-activity-panel">
          <div className="section-title">
            <h2>Today&apos;s Activity</h2>
          </div>
          <div className="head-activity-list">
            {activityRows.length === 0 ? (
              <div className="empty-state">No behaviour activity recorded today.</div>
            ) : (
              activityRows.map((entry, index) => {
                const studentName = decrypt(entry.student.fullNameEnc);
                return (
                  <div className="head-activity-row" key={entry.id}>
                    <span
                      className="head-activity-avatar"
                      style={{ backgroundColor: avatarColour(index) }}
                    >
                      {initials(studentName)}
                    </span>
                    <div>
                      <strong>{studentName}</strong>
                      <span
                        className={
                          entry.meritDelta >= 0
                            ? 'head-merit-pill head-merit-pill--plus'
                            : 'head-merit-pill head-merit-pill--minus'
                        }
                      >
                        {entry.meritDelta >= 0
                          ? `+${String(entry.meritDelta)}`
                          : String(entry.meritDelta)}{' '}
                        merits
                      </span>
                      {entry.visibility === 'Sensitive' ? (
                        <span className="head-merit-pill head-merit-pill--sensitive">
                          Sensitive
                        </span>
                      ) : null}
                      <p>
                        {entry.category}
                        {entry.noteEnc ? ` · ${decrypt(entry.noteEnc)}` : null}
                      </p>
                    </div>
                    <time>{formatTime(entry.createdAt)}</time>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="head-dashboard-side">
          <section className="panel panel__body">
            <div className="section-title">
              <h2>Quick Actions</h2>
            </div>
            <div className="head-action-list">
              <QuickAction href="/admin/attendance" label="Mark Attendance" />
              <QuickAction href="/admin/behaviour" label="Log Behaviour" />
              <QuickAction href="/supervisor/pace" label="Record PACE Score" />
              <QuickAction href="/admin/snapshot" label="Generate Report" />
            </div>
          </section>

          <section className="panel panel__body">
            <div className="section-title">
              <h2>Attendance Today</h2>
            </div>
            <div className="attendance-summary-grid">
              <AttendanceSummary label="Present" tone="green" value={present} />
              <AttendanceSummary label="Absent" tone="red" value={absent} />
              <AttendanceSummary label="Late" tone="amber" value={late} />
            </div>
          </section>
        </aside>
      </div>
    </MotionPage>
  );
}

function StatCard({
  accent,
  label,
  value,
  sub,
}: {
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="panel panel__body stat-card head-stat-card"
      style={{ '--accent': accent } as CSSProperties}
    >
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__sub">{sub}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: Route; label: string }) {
  return (
    <Link className="head-action" href={href}>
      <span>{label}</span>
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

function AttendanceSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'red' | 'amber';
}) {
  return (
    <div className={`attendance-summary attendance-summary--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
