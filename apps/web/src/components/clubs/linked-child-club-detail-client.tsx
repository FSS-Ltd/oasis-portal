'use client';

import { useMemo, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { displaySchoolYearLabel } from '@oasis/domain';
import { ArrowLeft, Bell, ClipboardCheck, UploadCloud, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { clubAccentStyle, clubVisual } from './club-visuals';

type LinkedClubDetail = RouterOutputs['club']['linkedChildClubDetail'];
type AttendanceRow = LinkedClubDetail['attendance'][number];
type NoticeRow = LinkedClubDetail['notices'][number];
type LinkedClubDetailTab = 'attendance' | 'notices' | 'work';
type LinkedClub = LinkedClubDetail['club'];

const DETAIL_TABS = [
  ['attendance', 'Attendance'],
  ['notices', 'Notices'],
  ['work', 'Completed Work'],
] as const satisfies readonly [LinkedClubDetailTab, string][];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

function capacityText(club: LinkedClub): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} members`;
  return `${String(club.activeSignupCount)} / ${String(club.capacity)} members`;
}

function attendanceTone(status: AttendanceRow['status']): 'amber' | 'green' | 'red' {
  if (status === 'Absent') return 'red';
  if (status === 'Late') return 'amber';
  return 'green';
}

function AttendanceTab({
  attendance,
  signedUpChildren,
}: {
  attendance: readonly AttendanceRow[];
  signedUpChildren: LinkedClubDetail['signedUpChildren'];
}) {
  const counts = attendance.reduce(
    (totals, row) => {
      if (row.status === 'Present') totals.present += 1;
      else if (row.status === 'Late') totals.late += 1;
      else totals.absent += 1;
      return totals;
    },
    { absent: 0, late: 0, present: 0 },
  );

  if (signedUpChildren.length === 0) {
    return (
      <section className="club-modal-section linked-club-detail-panel" role="tabpanel">
        <EmptyState
          detail="Sign up a linked child to this club to see attendance here."
          title="No linked child signed up"
        />
      </section>
    );
  }

  return (
    <section className="club-modal-section linked-club-detail-panel" role="tabpanel">
      <div className="section-title">
        <div>
          <p className="muted">Club attendance</p>
          <h2>Linked Children</h2>
        </div>
        <Badge tone="blue">
          <UsersRound aria-hidden="true" size={14} />
          {String(signedUpChildren.length)}
        </Badge>
      </div>

      <div className="club-attendance-summary" aria-label="Attendance summary">
        <span className="club-attendance-summary__item club-attendance-summary__item--present">
          <strong>{String(counts.present)}</strong>
          <small>Present</small>
        </span>
        <span className="club-attendance-summary__item club-attendance-summary__item--late">
          <strong>{String(counts.late)}</strong>
          <small>Late</small>
        </span>
        <span className="club-attendance-summary__item club-attendance-summary__item--absent">
          <strong>{String(counts.absent)}</strong>
          <small>Absent</small>
        </span>
      </div>

      {attendance.length === 0 ? (
        <EmptyState
          detail="Attendance marked by the club lead will appear here."
          title="No attendance recorded"
        />
      ) : (
        <div className="linked-club-attendance-list">
          {attendance.map((row) => (
            <article className="linked-club-attendance-row" key={row.id}>
              <div className="student-row">
                <Avatar className="student-row__avatar" name={row.studentName} />
                <span className="student-row__text">
                  <strong>{row.studentName}</strong>
                  <span>{displaySchoolYearLabel(row.yearGroup)}</span>
                </span>
              </div>
              <span className="linked-club-attendance-row__date">
                {formatDate(row.sessionDate)}
              </span>
              <Badge tone={attendanceTone(row.status)}>{row.status}</Badge>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NoticesTab({ notices }: { notices: readonly NoticeRow[] }) {
  return (
    <section className="club-modal-section linked-club-detail-panel" role="tabpanel">
      <div className="section-title">
        <div>
          <p className="muted">Club lead notices</p>
          <h2>Latest Updates</h2>
        </div>
        <Badge tone="green">
          <Bell aria-hidden="true" size={14} />
          {String(notices.length)}
        </Badge>
      </div>

      {notices.length === 0 ? (
        <EmptyState detail="Notices posted by the club lead will appear here." title="No notices" />
      ) : (
        <div className="linked-child-club-notice-list">
          {notices.map((notice) => (
            <article className="linked-child-club-notice" key={notice.id}>
              <div className="linked-child-club-notice__head">
                <span>
                  <strong>{notice.title}</strong>
                  <small>
                    {notice.sentByName} - {formatDateTime(notice.sentAt)}
                  </small>
                </span>
                <Badge tone="green">Club</Badge>
              </div>
              <p>{notice.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CompletedWorkTab() {
  return (
    <section className="club-modal-section linked-club-detail-panel" role="tabpanel">
      <div className="section-title">
        <div>
          <p className="muted">Completed work</p>
          <h2>Upload Work</h2>
        </div>
        <Badge tone="grey">Placeholder</Badge>
      </div>
      <div className="linked-club-work-placeholder">
        <UploadCloud aria-hidden="true" size={30} />
        <span>
          <strong>Completed work uploads are coming soon.</strong>
          <small>This area is reserved for homework, worksheets, and club project evidence.</small>
        </span>
        <Button disabled type="button" variant="secondary">
          Upload disabled
        </Button>
      </div>
    </section>
  );
}

export function LinkedChildClubDetailClient({
  backHref,
  clubId,
  studentId,
}: {
  backHref: Route;
  clubId: string;
  studentId: string;
}) {
  const [activeTab, setActiveTab] = useState<LinkedClubDetailTab>('attendance');
  const detailQuery = api.club.linkedChildClubDetail.useQuery(
    { clubId, studentId },
    { retry: false },
  );
  const detail = detailQuery.data;
  const childSummary = useMemo(() => {
    if (!detail) return 'No linked child signed up';
    const count = detail.signedUpChildren.length;
    if (count === 0) return 'No linked child signed up';
    if (count === 1) return `${detail.signedUpChildren[0]?.fullName ?? '1 child'} signed up`;
    return `${String(count)} linked children signed up`;
  }, [detail]);

  if (detailQuery.isLoading) {
    return <div className="empty-state">Loading club details...</div>;
  }

  if (detailQuery.error || !detail) {
    return (
      <EmptyState
        detail={detailQuery.error ? friendlyErrorMessage(detailQuery.error) : 'Club not found.'}
        title="Club details unavailable"
      />
    );
  }

  const visual = clubVisual(detail.club);
  const ClubIcon = visual.Icon;

  return (
    <div className="admin-club-detail linked-club-detail">
      <Link className="button button--md button--ghost linked-club-detail__back" href={backHref}>
        <ArrowLeft aria-hidden="true" size={16} />
        Back to My Clubs
      </Link>

      <section className="admin-club-detail-hero" style={clubAccentStyle(detail.club)}>
        <span className="admin-club-detail-hero__icon">
          <ClubIcon aria-hidden="true" size={34} />
        </span>
        <div>
          <Badge tone={detail.signedUpChildren.length > 0 ? 'green' : 'grey'}>
            {detail.signedUpChildren.length > 0 ? 'In your family' : 'Available'}
          </Badge>
          <h1>{detail.club.name}</h1>
          <p>
            {detail.club.scheduleLabel ?? 'No schedule set'} - {capacityText(detail.club)}
          </p>
        </div>
        <div className="admin-club-detail-hero__actions linked-club-detail__children">
          <Badge tone="blue">
            <ClipboardCheck aria-hidden="true" size={14} />
            {childSummary}
          </Badge>
        </div>
      </section>

      <div className="admin-club-detail-tabs" role="tablist" aria-label="Club detail sections">
        {DETAIL_TABS.map(([tab, label]) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-selected' : ''}
            key={tab}
            onClick={() => {
              setActiveTab(tab);
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'attendance' ? (
        <AttendanceTab attendance={detail.attendance} signedUpChildren={detail.signedUpChildren} />
      ) : null}
      {activeTab === 'notices' ? <NoticesTab notices={detail.notices} /> : null}
      {activeTab === 'work' ? <CompletedWorkTab /> : null}
    </div>
  );
}
