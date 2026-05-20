'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Club, UsersRound, XCircle } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MyClubRotaPanel } from './my-club-rota-panel';

type SignupContext = RouterOutputs['club']['linkedChildSignupContext'];
type SignupClub = SignupContext['clubs'][number];
type SignupChild = SignupContext['children'][number];
type ClubNotice = RouterOutputs['club']['myClubNotices'][number];
type ClubSignupVariant = 'admin' | 'parent' | 'supervisor';

interface LinkedChildClubSignupClientProps {
  variant: ClubSignupVariant;
}

const VARIANT_COPY = {
  admin: {
    eyebrow: 'Linked child clubs',
    title: 'My Clubs',
  },
  parent: {
    eyebrow: 'Parent portal',
    title: 'Clubs',
  },
  supervisor: {
    eyebrow: 'Linked child clubs',
    title: 'Clubs',
  },
} as const satisfies Record<ClubSignupVariant, { eyebrow: string; title: string }>;

function capacityLabel(club: SignupClub): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} signed up`;
  return `${String(club.activeSignupCount)}/${String(club.capacity)} places`;
}

function isClubFull(club: SignupClub): boolean {
  return club.capacity !== null && club.activeSignupCount >= club.capacity;
}

function statusLabel(club: SignupClub, selectedChildId: string | null): string {
  if (selectedChildId && club.signedUpStudentIds.includes(selectedChildId)) return 'Signed up';
  if (isClubFull(club)) return 'Full';
  return 'Open';
}

function statusTone(club: SignupClub, selectedChildId: string | null): 'amber' | 'green' | 'grey' {
  if (selectedChildId && club.signedUpStudentIds.includes(selectedChildId)) return 'green';
  if (isClubFull(club)) return 'grey';
  return 'amber';
}

function formatNoticeDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function LinkedChildClubNotices({
  error,
  loading,
  notices,
}: {
  error: string | null;
  loading: boolean;
  notices: readonly ClubNotice[];
}) {
  return (
    <section
      className="panel panel__body linked-child-club-notices"
      aria-labelledby="linked-child-club-notices-title"
    >
      <div className="section-title">
        <div>
          <p className="muted">Linked child club notices</p>
          <h2 id="linked-child-club-notices-title">Latest Club Updates</h2>
        </div>
        <span className="badge badge--green">
          <Bell aria-hidden="true" size={14} />
          {String(notices.length)}
        </span>
      </div>

      {loading ? <div className="empty-state">Loading club notices...</div> : null}
      {error ? <p className="status--error">{error}</p> : null}
      {!loading && !error && notices.length === 0 ? (
        <EmptyState
          detail="Club updates for linked children will appear here."
          title="No notices yet"
        />
      ) : null}

      {notices.length > 0 ? (
        <div className="linked-child-club-notice-list">
          {notices.map((notice) => (
            <article className="linked-child-club-notice" key={notice.id}>
              <div className="linked-child-club-notice__head">
                <span>
                  <strong>{notice.title}</strong>
                  <small>
                    {notice.clubName} - {notice.studentName} - {formatNoticeDate(notice.sentAt)}
                  </small>
                </span>
                <Badge tone="green">Club</Badge>
              </div>
              <p>{notice.body}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ChildPicker({
  children,
  onSelect,
  selectedChildId,
}: {
  children: readonly SignupChild[];
  onSelect: (studentId: string) => void;
  selectedChildId: string | null;
}) {
  return (
    <section
      className="panel panel__body linked-clubs-child-panel"
      aria-labelledby="clubs-child-title"
    >
      <div className="section-title">
        <div>
          <p className="muted">Linked children</p>
          <h2 id="clubs-child-title">Select Child</h2>
        </div>
        <Badge tone="blue">{String(children.length)}</Badge>
      </div>
      <div className="linked-clubs-child-list" aria-label="Select child for club signup">
        {children.map((child) => {
          const selected = child.id === selectedChildId;

          return (
            <button
              aria-pressed={selected}
              className={selected ? 'linked-clubs-child is-selected' : 'linked-clubs-child'}
              key={child.id}
              onClick={() => {
                onSelect(child.id);
              }}
              type="button"
            >
              <Avatar name={child.fullName} />
              <span>
                <strong>{child.fullName}</strong>
                <small>{displaySchoolYearLabel(child.yearGroup)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ClubSignupCard({
  club,
  disabled,
  onSignUp,
  onWithdraw,
  pending,
  selectedChildId,
}: {
  club: SignupClub;
  disabled: boolean;
  onSignUp: (club: SignupClub) => void;
  onWithdraw: (club: SignupClub) => void;
  pending: boolean;
  selectedChildId: string | null;
}) {
  const signedUp = selectedChildId ? club.signedUpStudentIds.includes(selectedChildId) : false;
  const full = isClubFull(club);
  const cannotSignUp = disabled || full;

  return (
    <article className="club-card linked-club-card">
      <div className="club-card__main">
        <span className="badge-list">
          <Badge tone={statusTone(club, selectedChildId)}>
            {statusLabel(club, selectedChildId)}
          </Badge>
          <Badge tone="blue">{capacityLabel(club)}</Badge>
        </span>
        <strong>{club.name}</strong>
        <span>{club.scheduleLabel ?? 'No schedule set'}</span>
        {club.description ? <p>{club.description}</p> : null}
      </div>
      <div className="club-card__actions">
        {signedUp ? (
          <Button
            onClick={() => {
              onWithdraw(club);
            }}
            pending={pending}
            type="button"
            variant="danger"
          >
            <XCircle aria-hidden="true" size={16} />
            Withdraw
          </Button>
        ) : (
          <Button
            disabled={cannotSignUp}
            onClick={() => {
              onSignUp(club);
            }}
            pending={pending}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" size={16} />
            Sign Up
          </Button>
        )}
      </div>
    </article>
  );
}

export function LinkedChildClubSignupClient({ variant }: LinkedChildClubSignupClientProps) {
  const copy = VARIANT_COPY[variant];
  const utils = api.useUtils();
  const contextQuery = api.club.linkedChildSignupContext.useQuery(undefined, { retry: false });
  const noticesQuery = api.club.myClubNotices.useQuery(undefined, { retry: false });
  const signUp = api.club.signUp.useMutation();
  const withdraw = api.club.withdraw.useMutation();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const children = useMemo(() => contextQuery.data?.children ?? [], [contextQuery.data?.children]);
  const clubs = useMemo(() => contextQuery.data?.clubs ?? [], [contextQuery.data?.clubs]);
  const selectedChild =
    children.find((child) => child.id === selectedChildId) ?? children[0] ?? null;

  useEffect(() => {
    if (!selectedChildId && children[0]) {
      setSelectedChildId(children[0].id);
      return;
    }
    if (selectedChildId && !children.some((child) => child.id === selectedChildId)) {
      setSelectedChildId(children[0]?.id ?? null);
    }
  }, [children, selectedChildId]);

  async function refreshSignupContext() {
    await utils.club.linkedChildSignupContext.invalidate();
  }

  async function signChildUp(club: SignupClub) {
    if (!selectedChild) return;
    setStatus(null);
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await signUp.mutateAsync({ clubId: club.id, studentId: selectedChild.id });
      setStatus(`${selectedChild.fullName} signed up for ${club.name}.`);
      await refreshSignupContext();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Club signup failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  async function withdrawChild(club: SignupClub) {
    if (!selectedChild) return;
    setStatus(null);
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await withdraw.mutateAsync({ clubId: club.id, studentId: selectedChild.id });
      setStatus(`${selectedChild.fullName} withdrawn from ${club.name}.`);
      await refreshSignupContext();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Club withdrawal failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  if (contextQuery.isLoading) {
    return <div className="empty-state">Loading clubs...</div>;
  }

  if (contextQuery.error) {
    return <EmptyState detail={contextQuery.error.message} title="Club signups unavailable" />;
  }

  return (
    <div className={`clubs-page linked-clubs-page linked-clubs-page--${variant}`}>
      <div className="dashboard-hero">
        <p>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <span>{clubs.length === 1 ? '1 active club' : `${String(clubs.length)} active clubs`}</span>
      </div>

      <LinkedChildClubNotices
        error={noticesQuery.error?.message ?? null}
        loading={noticesQuery.isLoading}
        notices={noticesQuery.data ?? []}
      />

      {children.length === 0 ? (
        <EmptyState
          detail="Club signups need linked child records. Volunteer rota access appears below when available."
          title="No linked children found"
        />
      ) : (
        <div className="linked-clubs-layout">
          <ChildPicker
            children={children}
            onSelect={setSelectedChildId}
            selectedChildId={selectedChild?.id ?? null}
          />

          <section
            className="panel panel__body linked-clubs-list-panel"
            aria-labelledby="clubs-list-title"
          >
            <div className="section-title">
              <div>
                <p className="muted">Available clubs</p>
                <h2 id="clubs-list-title">Active Clubs</h2>
              </div>
              <span className="badge badge--blue">
                <Club aria-hidden="true" size={14} />
                {String(clubs.length)}
              </span>
            </div>

            {clubs.length === 0 ? (
              <EmptyState detail="Active clubs will appear here." title="No active clubs" />
            ) : (
              <div className="linked-clubs-list">
                {clubs.map((club) => (
                  <ClubSignupCard
                    club={club}
                    disabled={!selectedChild}
                    key={club.id}
                    onSignUp={(nextClub) => {
                      void signChildUp(nextClub);
                    }}
                    onWithdraw={(nextClub) => {
                      void withdrawChild(nextClub);
                    }}
                    pending={pendingClubId === club.id}
                    selectedChildId={selectedChild?.id ?? null}
                  />
                ))}
              </div>
            )}

            <div className="club-roster-summary">
              <UsersRound aria-hidden="true" size={18} />
              <span>
                <strong>{selectedChild?.fullName ?? 'No child selected'}</strong>
                <small>
                  {selectedChild
                    ? displaySchoolYearLabel(selectedChild.yearGroup)
                    : 'Select a linked child'}
                </small>
              </span>
            </div>

            {status ? <p className="status--success">{status}</p> : null}
            {operationError ? <p className="status--error">{operationError}</p> : null}
          </section>
        </div>
      )}
      <MyClubRotaPanel />
    </div>
  );
}
