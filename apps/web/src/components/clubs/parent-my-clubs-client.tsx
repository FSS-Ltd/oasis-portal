'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { clubMatchesYearGroupBands, displaySchoolYearLabel } from '@oasis/domain';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { ParentChildSelector } from '@/components/parent/parent-child-selector';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { ParentClubCard, type ParentClub, type ParentClubCardHref } from './parent-club-card';

type SignupContext = RouterOutputs['club']['linkedChildSignupContext'];
type SignupChild = SignupContext['children'][number];
type ClubNotice = RouterOutputs['club']['myClubNotices'][number];
type ParentClubsTab = 'all-clubs' | 'my-clubs' | 'notices';
type MyClubsPortalVariant = 'admin' | 'parent' | 'supervisor';

interface ParentMyClubsClientProps {
  variant?: MyClubsPortalVariant;
}

const VARIANT_COPY = {
  admin: { eyebrow: 'Linked child clubs', title: 'Clubs' },
  parent: { eyebrow: 'Parent portal', title: 'Clubs' },
  supervisor: { eyebrow: 'Linked child clubs', title: 'Clubs' },
} as const satisfies Record<MyClubsPortalVariant, { eyebrow: string; title: string }>;

const DETAIL_BASE_HREF = {
  admin: '/admin/my-clubs',
  parent: '/parent/clubs',
  supervisor: '/supervisor/clubs',
} as const satisfies Record<MyClubsPortalVariant, `/${string}`>;

const TABS = [
  ['all-clubs', 'All Clubs'],
  ['my-clubs', 'My Clubs'],
  ['notices', 'Notices'],
] as const satisfies readonly [ParentClubsTab, string][];

const noticeDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function detailHref(
  variant: MyClubsPortalVariant,
  clubId: string,
  studentId: string,
): ParentClubCardHref {
  return `${DETAIL_BASE_HREF[variant]}/${encodeURIComponent(clubId)}?studentId=${encodeURIComponent(studentId)}`;
}

function ParentClubsTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ParentClubsTab;
  onTabChange: (tab: ParentClubsTab) => void;
}) {
  return (
    <div className="parent-clubs-tabs" role="tablist" aria-label="Club sections">
      {TABS.map(([tab, label]) => (
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

function ClubList({
  clubs,
  detailHrefForClub,
  disabled,
  emptyDetail,
  emptyTitle,
  hideWithdraw = false,
  onSignUp,
  onWithdraw,
  pendingClubId,
  selectedChildId,
}: {
  clubs: readonly ParentClub[];
  detailHrefForClub?: (clubId: string) => ParentClubCardHref;
  disabled: boolean;
  emptyDetail: string;
  emptyTitle: string;
  hideWithdraw?: boolean;
  onSignUp: (club: ParentClub) => void;
  onWithdraw: (club: ParentClub) => void;
  pendingClubId: string | null;
  selectedChildId: string | null;
}) {
  if (clubs.length === 0) return <EmptyState detail={emptyDetail} title={emptyTitle} />;
  return (
    <section className="parent-clubs-card-grid" aria-label="Clubs">
      {clubs.map((club) => (
        <ParentClubCard
          actionMode
          club={club}
          {...(detailHrefForClub ? { detailHref: detailHrefForClub(club.id) } : {})}
          disabled={disabled}
          hideWithdraw={hideWithdraw}
          key={club.id}
          onSignUp={onSignUp}
          onWithdraw={onWithdraw}
          pending={pendingClubId === club.id}
          selectedChildId={selectedChildId}
        />
      ))}
    </section>
  );
}

function NoticesTab({
  error,
  loading,
  notices,
  selectedChild,
}: {
  error: string | null;
  loading: boolean;
  notices: readonly ClubNotice[];
  selectedChild: SignupChild | null;
}) {
  return (
    <section className="panel panel__body linked-child-club-notices" role="tabpanel">
      <div className="section-title">
        <div>
          <p className="muted">
            {selectedChild ? `${selectedChild.fullName}'s club notices` : 'Club notices'}
          </p>
          <h2>Latest updates</h2>
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
          detail="Updates for this child’s clubs will appear here."
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
                    {notice.clubName} · {noticeDateFormatter.format(new Date(notice.sentAt))}
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
  const signUp = api.club.signUp.useMutation();
  const withdraw = api.club.withdraw.useMutation();
  const [activeTab, setActiveTab] = useState<ParentClubsTab>('all-clubs');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [withdrawalClub, setWithdrawalClub] = useState<ParentClub | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const children = contextQuery.data?.children ?? [];
  const clubs = contextQuery.data?.clubs ?? [];
  const selectedChild =
    children.find((child) => child.id === selectedChildId) ?? children[0] ?? null;
  const noticesQuery = api.club.myClubNotices.useQuery(
    { studentId: selectedChild?.id },
    { enabled: selectedChild !== null, retry: false },
  );
  const eligibleClubs = useMemo(
    () =>
      selectedChild
        ? clubs.filter((club) =>
            clubMatchesYearGroupBands(selectedChild.ageBandId, club.yearGroupBands),
          )
        : [],
    [clubs, selectedChild],
  );
  const myClubs = useMemo(
    () =>
      selectedChild
        ? clubs.filter((club) => club.signedUpStudentIds.includes(selectedChild.id))
        : [],
    [clubs, selectedChild],
  );

  useEffect(() => {
    if (!selectedChildId && children[0]) setSelectedChildId(children[0].id);
    else if (selectedChildId && !children.some((child) => child.id === selectedChildId))
      setSelectedChildId(children[0]?.id ?? null);
  }, [children, selectedChildId]);

  async function refresh() {
    await Promise.all([
      utils.club.linkedChildSignupContext.invalidate(),
      utils.club.myClubNotices.invalidate(),
    ]);
  }

  async function signChildUp(club: ParentClub) {
    if (!selectedChild) return;
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await signUp.mutateAsync({ clubId: club.id, studentId: selectedChild.id });
      showSuccessToast(`${selectedChild.fullName} signed up for ${club.name}.`);
      await refresh();
    } catch (error) {
      setOperationError(friendlyErrorMessage(error, 'Club signup failed.'));
      showErrorToast(error, 'Club signup failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  async function withdrawChild() {
    if (!selectedChild || !withdrawalClub) return;
    setOperationError(null);
    setPendingClubId(withdrawalClub.id);
    try {
      await withdraw.mutateAsync({ clubId: withdrawalClub.id, studentId: selectedChild.id });
      showSuccessToast(`${selectedChild.fullName} withdrawn from ${withdrawalClub.name}.`);
      setWithdrawalClub(null);
      await refresh();
    } catch (error) {
      setOperationError(friendlyErrorMessage(error, 'Club withdrawal failed.'));
      showErrorToast(error, 'Club withdrawal failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  if (contextQuery.isLoading) return <div className="empty-state">Loading clubs...</div>;
  if (contextQuery.error)
    return (
      <EmptyState detail={friendlyErrorMessage(contextQuery.error)} title="Clubs unavailable" />
    );

  return (
    <div className={`clubs-page parent-my-clubs-page parent-my-clubs-page--${variant}`}>
      <div className="dashboard-hero parent-clubs-hero">
        <p>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <span>{selectedChild ? `For ${selectedChild.fullName}` : 'Choose a linked child'}</span>
      </div>
      {children.length > 0 ? (
        <ParentChildSelector
          children={children}
          onSelect={setSelectedChildId}
          selectedChildId={selectedChild?.id ?? ''}
        />
      ) : null}
      <ParentClubsTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <section className="parent-clubs-tab-panel" role="tabpanel">
        {selectedChild ? (
          <p className="muted">
            {displaySchoolYearLabel(selectedChild.yearGroup)} · {eligibleClubs.length} clubs
            available
          </p>
        ) : null}
        {activeTab === 'all-clubs' ? (
          <ClubList
            clubs={eligibleClubs}
            disabled={!selectedChild}
            emptyDetail="No clubs are currently available for this child’s year group."
            emptyTitle="No eligible clubs"
            hideWithdraw
            onSignUp={(club) => void signChildUp(club)}
            onWithdraw={() => {}}
            pendingClubId={pendingClubId}
            selectedChildId={selectedChild?.id ?? null}
          />
        ) : null}
        {activeTab === 'my-clubs' && selectedChild ? (
          <ClubList
            clubs={myClubs}
            detailHrefForClub={(clubId) => detailHref(variant, clubId, selectedChild.id)}
            disabled={false}
            emptyDetail="This child has not joined a club yet."
            emptyTitle="No clubs yet"
            onSignUp={() => {}}
            onWithdraw={setWithdrawalClub}
            pendingClubId={pendingClubId}
            selectedChildId={selectedChild.id}
          />
        ) : null}
        {activeTab === 'notices' ? (
          <NoticesTab
            error={noticesQuery.error ? friendlyErrorMessage(noticesQuery.error) : null}
            loading={noticesQuery.isLoading}
            notices={noticesQuery.data ?? []}
            selectedChild={selectedChild}
          />
        ) : null}
        {operationError ? <p className="status--error">{operationError}</p> : null}
      </section>
      <ConfirmationDialog
        cancelLabel="Keep membership"
        confirmLabel="Withdraw"
        errorMessage={operationError}
        onCancel={() => {
          setWithdrawalClub(null);
        }}
        onConfirm={() => {
          void withdrawChild();
        }}
        open={withdrawalClub !== null}
        pending={pendingClubId === withdrawalClub?.id}
        title={`Withdraw ${selectedChild?.fullName ?? 'child'}?`}
      >
        {withdrawalClub
          ? `This will remove ${selectedChild?.fullName ?? 'this child'} from ${withdrawalClub.name}.`
          : null}
      </ConfirmationDialog>
    </div>
  );
}
