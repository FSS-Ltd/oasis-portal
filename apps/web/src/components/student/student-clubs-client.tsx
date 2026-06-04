'use client';

import { useMemo, useState } from 'react';
import { Bell, CalendarDays, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  friendlyErrorMessage,
  showErrorToast,
  showSuccessToast,
} from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentClub = RouterOutputs['club']['studentClubs'][number];
type ClubStatus = StudentClub['status'];

function statusTone(status: ClubStatus): 'amber' | 'blue' | 'green' | 'grey' {
  if (status === 'Member') return 'green';
  if (status === 'Interested') return 'amber';
  if (status === 'Full') return 'grey';
  return 'blue';
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function clubSpaces(club: StudentClub): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} members`;
  const spaces = Math.max(club.capacity - club.activeSignupCount, 0);
  return `${String(spaces)} spaces left`;
}

function leadLabel(names: readonly string[]): string {
  if (names.length === 0) return 'Supervisor to be assigned';
  return names.join(', ');
}

function ClubCard({
  active,
  club,
  onSelect,
}: {
  active: boolean;
  club: StudentClub;
  onSelect: (clubId: string) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={active ? 'student-club-card is-active' : 'student-club-card'}
      onClick={() => {
        onSelect(club.id);
      }}
      type="button"
    >
      <span className="student-club-card__icon" style={{ backgroundColor: club.accentColor ?? undefined }}>
        <UsersRound aria-hidden="true" size={18} />
      </span>
      <span>
        <strong>{club.name}</strong>
        <small>{club.scheduleLabel ?? 'Schedule to be confirmed'}</small>
      </span>
      <Badge tone={statusTone(club.status)}>{club.status}</Badge>
    </button>
  );
}

export function StudentClubsClient() {
  const utils = api.useUtils();
  const clubs = api.club.studentClubs.useQuery(undefined, { retry: false });
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const selectedId = selectedClubId ?? clubs.data?.[0]?.id ?? null;
  const detail = api.club.studentClubDetail.useQuery(
    { clubId: selectedId ?? '' },
    { enabled: selectedId !== null, retry: false },
  );
  const interest = api.club.studentExpressInterest.useMutation({
    async onSuccess(result) {
      showSuccessToast(
        result.created ? 'Interest sent for Centre Manager approval.' : 'Interest is already recorded.',
      );
      await Promise.all([
        utils.club.studentClubs.invalidate(),
        selectedId ? utils.club.studentClubDetail.invalidate({ clubId: selectedId }) : Promise.resolve(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Interest could not be sent.');
    },
  });

  const selectedClub = useMemo(
    () => clubs.data?.find((club) => club.id === selectedId) ?? clubs.data?.[0] ?? null,
    [clubs.data, selectedId],
  );

  if (clubs.isLoading) {
    return <div className="student-inline-state">Loading clubs...</div>;
  }

  if (clubs.error) {
    return <EmptyState detail={friendlyErrorMessage(clubs.error)} title="Clubs unavailable" />;
  }

  if (!clubs.data || clubs.data.length === 0) {
    return <EmptyState detail="Active clubs will appear here." title="No active clubs" />;
  }

  const detailClub = detail.data?.club ?? selectedClub;
  const canExpressInterest = detailClub?.status === 'Available' && !interest.isPending;

  return (
    <div className="student-page student-clubs-page">
      <section className="student-wallet-hero student-clubs-hero">
        <div>
          <p>Clubs</p>
          <h1>Club Noticeboard</h1>
          <span>Browse clubs, send interest, and read notices for clubs you are a member of.</span>
        </div>
        <div className="student-clubs-hero__meta">
          <UsersRound aria-hidden="true" size={18} />
          <small>Active clubs</small>
          <strong>{String(clubs.data.length)}</strong>
        </div>
      </section>

      <div className="student-clubs-layout">
        <aside className="student-clubs-list" aria-label="Active clubs">
          {clubs.data.map((club) => (
            <ClubCard
              active={club.id === selectedId}
              club={club}
              key={club.id}
              onSelect={setSelectedClubId}
            />
          ))}
        </aside>

        <section className="student-club-detail" aria-label="Selected club">
          {detail.isLoading ? <div className="student-inline-state">Loading club...</div> : null}
          {detail.error ? <p className="status--error">{friendlyErrorMessage(detail.error)}</p> : null}
          {detailClub ? (
            <>
              <div className="student-club-detail__head">
                <div>
                  <p>{detailClub.scheduleLabel ?? 'Schedule to be confirmed'}</p>
                  <h2>{detailClub.name}</h2>
                  <span>{detailClub.description ?? 'More details will be added by the Learning Centre.'}</span>
                </div>
                <Badge tone={statusTone(detailClub.status)}>{detailClub.status}</Badge>
              </div>

              <div className="student-club-facts">
                <span>
                  <CalendarDays aria-hidden="true" size={16} />
                  {clubSpaces(detailClub)}
                </span>
                <span>
                  <UsersRound aria-hidden="true" size={16} />
                  {leadLabel(detailClub.supervisorNames)}
                </span>
              </div>

              {detailClub.status === 'Available' ? (
                <Button
                  disabled={!canExpressInterest}
                  onClick={() => {
                    interest.mutate({ clubId: detailClub.id });
                  }}
                  pending={interest.isPending}
                  type="button"
                >
                  Send interest
                </Button>
              ) : null}

              {detailClub.status === 'Interested' ? (
                <p className="student-club-note">Interest sent. A Centre Manager reviews club membership.</p>
              ) : null}

              <section className="student-dashboard-panel" aria-labelledby="student-club-notices-title">
                <div className="student-dashboard-panel__head">
                  <div>
                    <p>Noticeboard</p>
                    <h2 id="student-club-notices-title">Club notices</h2>
                  </div>
                </div>
                {detailClub.status !== 'Member' ? (
                  <EmptyState
                    detail="Join this club to see member notices."
                    title="Member notices locked"
                  />
                ) : detail.data?.notices.length === 0 ? (
                  <EmptyState detail="No notices have been posted yet." title="No club notices" />
                ) : (
                  <div className="student-club-notices">
                    {detail.data?.notices.map((notice) => (
                      <article className="student-club-notice" key={notice.id}>
                        <Bell aria-hidden="true" size={16} />
                        <div>
                          <strong>{notice.title}</strong>
                          <p>{notice.body}</p>
                          <time dateTime={notice.sentAt.toISOString()}>{formatDate(notice.sentAt)}</time>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
