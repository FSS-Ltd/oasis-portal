'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Club, UsersRound } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { MyClubRotaPanel } from './my-club-rota-panel';
import { ParentClubCard, type ParentClub, type ParentClubCardHref } from './parent-club-card';

type SignupContext = RouterOutputs['club']['linkedChildSignupContext'];
type SignupChild = SignupContext['children'][number];
type ClubNotice = RouterOutputs['club']['myClubNotices'][number];
type ParentClubsTab = 'overview' | 'signups' | 'notices' | 'rota';
type MyClubsPortalVariant = 'admin' | 'parent' | 'supervisor';

interface ParentMyClubsClientProps {
  variant?: MyClubsPortalVariant;
}

const VARIANT_COPY = {
  admin: {
    eyebrow: 'Linked child clubs',
    title: 'My Clubs',
  },
  parent: {
    eyebrow: 'Parent portal',
    title: 'My Clubs',
  },
  supervisor: {
    eyebrow: 'Linked child clubs',
    title: 'My Clubs',
  },
} as const satisfies Record<MyClubsPortalVariant, { eyebrow: string; title: string }>;

const DETAIL_BASE_HREF = {
  admin: '/admin/my-clubs',
  parent: '/parent/clubs',
  supervisor: '/supervisor/clubs',
} as const satisfies Record<MyClubsPortalVariant, `/${string}`>;

type ClubDetailBaseHref = (typeof DETAIL_BASE_HREF)[MyClubsPortalVariant];
type ClubDetailHref = ParentClubCardHref;

function clubDetailHref(baseHref: ClubDetailBaseHref, clubId: string): ClubDetailHref {
  return `${baseHref}/${encodeURIComponent(clubId)}`;
}

const BASE_TABS = [
  ['overview', 'Overview'],
  ['signups', 'Signups'],
  ['notices', 'Notices'],
] as const satisfies readonly [ParentClubsTab, string][];

const noticeDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatNoticeDate(value: Date | string): string {
  return noticeDateFormatter.format(new Date(value));
}

function signedUpClubCount(clubs: readonly ParentClub[]): number {
  return clubs.filter((club) => club.signedUpStudentIds.length > 0).length;
}

function ParentClubsTabs({
  activeTab,
  onTabChange,
  showRota,
}: {
  activeTab: ParentClubsTab;
  onTabChange: (tab: ParentClubsTab) => void;
  showRota: boolean;
}) {
  const tabs = showRota ? [...BASE_TABS, ['rota', 'Rota'] as const] : BASE_TABS;

  return (
    <div className="parent-clubs-tabs" role="tablist" aria-label="My Clubs sections">
      {tabs.map(([tab, label]) => (
        <button
          aria-selected={activeTab === tab}
          className={activeTab === tab ? 'is-selected' : ''}
          key={tab}
          onClick={() => {
            onTabChange(tab);
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
      aria-labelledby="parent-clubs-child-title"
    >
      <div className="section-title">
        <div>
          <p className="muted">Linked children</p>
          <h2 id="parent-clubs-child-title">Select Child</h2>
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

function OverviewTab({
  childCount,
  clubs,
  detailBaseHref,
  rotaClubCount,
}: {
  childCount: number;
  clubs: readonly ParentClub[];
  detailBaseHref: ClubDetailBaseHref;
  rotaClubCount: number;
}) {
  return (
    <div className="parent-clubs-tab-panel" role="tabpanel">
      <section className="parent-clubs-summary-grid" aria-label="My Clubs summary">
        <article>
          <Club aria-hidden="true" size={18} />
          <span>Active clubs</span>
          <strong>{String(clubs.length)}</strong>
          <small>Available for linked children</small>
        </article>
        <article>
          <UsersRound aria-hidden="true" size={18} />
          <span>Family signups</span>
          <strong>{String(signedUpClubCount(clubs))}</strong>
          <small>Clubs with linked children signed up</small>
        </article>
        <article>
          <CalendarDays aria-hidden="true" size={18} />
          <span>Rota access</span>
          <strong>{rotaClubCount > 0 ? 'Active' : 'Hidden'}</strong>
          <small>{rotaClubCount > 0 ? 'Volunteer rota team' : 'Not on rota team'}</small>
        </article>
        <article>
          <UsersRound aria-hidden="true" size={18} />
          <span>Linked children</span>
          <strong>{String(childCount)}</strong>
          <small>{childCount === 0 ? 'Signup controls hidden' : 'Can manage signups'}</small>
        </article>
      </section>

      {clubs.length === 0 ? (
        <EmptyState detail="Active clubs will appear here." title="No active clubs" />
      ) : (
        <section className="parent-clubs-card-grid" aria-label="Active clubs">
          {clubs.map((club) => (
            <ParentClubCard
              club={club}
              href={clubDetailHref(detailBaseHref, club.id)}
              key={club.id}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function SignupsTab({
  children,
  clubs,
  disabled,
  onSelectChild,
  onSignUp,
  onWithdraw,
  operationError,
  pendingClubId,
  selectedChild,
}: {
  children: readonly SignupChild[];
  clubs: readonly ParentClub[];
  disabled: boolean;
  onSelectChild: (studentId: string) => void;
  onSignUp: (club: ParentClub) => void;
  onWithdraw: (club: ParentClub) => void;
  operationError: string | null;
  pendingClubId: string | null;
  selectedChild: SignupChild | null;
}) {
  if (children.length === 0) {
    return (
      <div className="parent-clubs-tab-panel" role="tabpanel">
        <EmptyState
          detail="Club signups need linked child records. Rota access remains available when you are added to a rota team."
          title="No linked children found"
        />
      </div>
    );
  }

  return (
    <div className="parent-clubs-tab-panel linked-clubs-layout" role="tabpanel">
      <ChildPicker
        children={children}
        onSelect={onSelectChild}
        selectedChildId={selectedChild?.id ?? null}
      />

      <section
        className="panel panel__body linked-clubs-list-panel"
        aria-labelledby="parent-clubs-signups-title"
      >
        <div className="section-title">
          <div>
            <p className="muted">Available clubs</p>
            <h2 id="parent-clubs-signups-title">Signups</h2>
          </div>
          <Badge tone="blue">
            <Club aria-hidden="true" size={14} />
            {String(clubs.length)}
          </Badge>
        </div>

        {clubs.length === 0 ? (
          <EmptyState detail="Active clubs will appear here." title="No active clubs" />
        ) : (
          <div className="parent-clubs-card-grid parent-clubs-card-grid--compact linked-clubs-list">
            {clubs.map((club) => (
              <ParentClubCard
                actionMode
                club={club}
                disabled={disabled}
                key={club.id}
                onSignUp={onSignUp}
                onWithdraw={onWithdraw}
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

        {operationError ? <p className="status--error">{operationError}</p> : null}
      </section>
    </div>
  );
}

function NoticesTab({
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
      className="parent-clubs-tab-panel panel panel__body linked-child-club-notices"
      role="tabpanel"
      aria-labelledby="parent-clubs-notices-title"
    >
      <div className="section-title">
        <div>
          <p className="muted">Linked child club notices</p>
          <h2 id="parent-clubs-notices-title">Latest Club Updates</h2>
        </div>
        <Badge tone="green">
          <Bell aria-hidden="true" size={14} />
          {String(notices.length)}
        </Badge>
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

export function ParentMyClubsClient({ variant = 'parent' }: ParentMyClubsClientProps) {
  const copy = VARIANT_COPY[variant];
  const utils = api.useUtils();
  const contextQuery = api.club.linkedChildSignupContext.useQuery(undefined, { retry: false });
  const noticesQuery = api.club.myClubNotices.useQuery(undefined, { retry: false });
  const rotaAccessQuery = api.club.myClubRotaAccess.useQuery(undefined, { retry: false });
  const signUp = api.club.signUp.useMutation();
  const withdraw = api.club.withdraw.useMutation();
  const [activeTab, setActiveTab] = useState<ParentClubsTab>('overview');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const children = useMemo(() => contextQuery.data?.children ?? [], [contextQuery.data?.children]);
  const clubs = useMemo(() => contextQuery.data?.clubs ?? [], [contextQuery.data?.clubs]);
  const rotaClubs = rotaAccessQuery.data ?? [];
  const showRota = rotaClubs.length > 0;
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

  useEffect(() => {
    if (activeTab === 'rota' && !showRota) {
      setActiveTab('overview');
    }
  }, [activeTab, showRota]);

  async function refreshSignupContext() {
    await utils.club.linkedChildSignupContext.invalidate();
  }

  async function signChildUp(club: ParentClub) {
    if (!selectedChild) return;
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await signUp.mutateAsync({ clubId: club.id, studentId: selectedChild.id });
      showSuccessToast(`${selectedChild.fullName} signed up for ${club.name}.`);
      await refreshSignupContext();
    } catch (error) {
      setOperationError(friendlyErrorMessage(error, 'Club signup failed.'));
      showErrorToast(error, 'Club signup failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  async function withdrawChild(club: ParentClub) {
    if (!selectedChild) return;
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await withdraw.mutateAsync({ clubId: club.id, studentId: selectedChild.id });
      showSuccessToast(`${selectedChild.fullName} withdrawn from ${club.name}.`);
      await refreshSignupContext();
    } catch (error) {
      setOperationError(friendlyErrorMessage(error, 'Club withdrawal failed.'));
      showErrorToast(error, 'Club withdrawal failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  if (contextQuery.isLoading) {
    return <div className="empty-state">Loading clubs...</div>;
  }

  if (contextQuery.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(contextQuery.error)}
        title="Club signups unavailable"
      />
    );
  }

  return (
    <div className={`clubs-page parent-my-clubs-page parent-my-clubs-page--${variant}`}>
      <div className="dashboard-hero parent-clubs-hero">
        <p>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <span>{clubs.length === 1 ? '1 active club' : `${String(clubs.length)} active clubs`}</span>
      </div>

      <ParentClubsTabs activeTab={activeTab} onTabChange={setActiveTab} showRota={showRota} />

      {rotaAccessQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(rotaAccessQuery.error)}</p>
      ) : null}

      {activeTab === 'overview' ? (
        <OverviewTab
          childCount={children.length}
          clubs={clubs}
          detailBaseHref={DETAIL_BASE_HREF[variant]}
          rotaClubCount={rotaClubs.length}
        />
      ) : null}
      {activeTab === 'signups' ? (
        <SignupsTab
          children={children}
          clubs={clubs}
          disabled={!selectedChild}
          onSelectChild={setSelectedChildId}
          onSignUp={(club) => {
            void signChildUp(club);
          }}
          onWithdraw={(club) => {
            void withdrawChild(club);
          }}
          operationError={operationError}
          pendingClubId={pendingClubId}
          selectedChild={selectedChild}
        />
      ) : null}
      {activeTab === 'notices' ? (
        <NoticesTab
          error={noticesQuery.error ? friendlyErrorMessage(noticesQuery.error) : null}
          loading={noticesQuery.isLoading}
          notices={noticesQuery.data ?? []}
        />
      ) : null}
      {activeTab === 'rota' && showRota ? (
        <div className="parent-clubs-tab-panel" role="tabpanel">
          <MyClubRotaPanel accessClubs={rotaClubs} />
        </div>
      ) : null}
    </div>
  );
}
