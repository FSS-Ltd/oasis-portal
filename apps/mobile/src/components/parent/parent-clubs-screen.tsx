import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { clubMatchesYearGroupBands, displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  InlineSpinner,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';
import { formatParentDateTime } from './parent-home-utils';
import { ParentChildSwitcher } from './parent-child-switcher';

type SignupContext = RouterOutputs['club']['linkedChildSignupContext'];
type SignupChild = SignupContext['children'][number];
type SignupClub = SignupContext['clubs'][number];
type ClubNotice = RouterOutputs['club']['myClubNotices'][number];
type ClubTab = 'all' | 'mine' | 'notices';

interface ParentClubsScreenProps {
  childrenRows: readonly SignupChild[];
  clubNotices: readonly ClubNotice[];
  clubNoticesError: string | null;
  clubs: readonly SignupClub[];
  loading: boolean;
  loadingClubNotices: boolean;
  selectedChildId: string;
  onSelectChild: (studentId: string) => void;
}

function capacityLabel(club: SignupClub): string {
  return club.capacity === null
    ? `${String(club.activeSignupCount)} signed up`
    : `${String(club.activeSignupCount)}/${String(club.capacity)} places`;
}

function ClubCard({
  club,
  child,
  mode,
  onOpen,
  onSignUp,
  onWithdraw,
  pending,
}: {
  club: SignupClub;
  child: SignupChild;
  mode: 'all' | 'mine';
  onOpen: (club: SignupClub) => void;
  onSignUp: (club: SignupClub) => void;
  onWithdraw: (club: SignupClub) => void;
  pending: boolean;
}) {
  const signedUp = club.signedUpStudentIds.includes(child.id);
  const full = club.capacity !== null && club.activeSignupCount >= club.capacity;
  return (
    <Card style={styles.clubCard}>
      <View style={styles.clubHeader}>
        <View style={styles.clubTitleGroup}>
          <Text style={styles.clubTitle}>{club.name}</Text>
          <MutedText>{club.scheduleLabel ?? 'No schedule set'}</MutedText>
        </View>
        <Badge variant={signedUp ? 'success' : full ? 'warning' : 'blue'}>
          {signedUp ? 'Joined' : full ? 'Full' : 'Open'}
        </Badge>
      </View>
      {club.description ? <Text style={styles.clubDescription}>{club.description}</Text> : null}
      <Text style={styles.capacityText}>{capacityLabel(club)}</Text>
      <View style={styles.actions}>
        {mode === 'mine' ? (
          <MobileButton
            compact
            label="View details"
            onPress={() => {
              onOpen(club);
            }}
            variant="secondary"
          />
        ) : null}
        {mode === 'mine' ? (
          <MobileButton
            compact
            disabled={pending}
            label={pending ? 'Saving…' : 'Withdraw'}
            onPress={() => {
              onWithdraw(club);
            }}
            variant="danger"
          />
        ) : !signedUp ? (
          <MobileButton
            compact
            disabled={pending || full}
            label={pending ? 'Saving…' : full ? 'Full' : 'Sign up'}
            onPress={() => {
              onSignUp(club);
            }}
            variant={full ? 'secondary' : 'primary'}
          />
        ) : null}
      </View>
    </Card>
  );
}

function ClubDetails({
  club,
  child,
  onBack,
}: {
  club: SignupClub;
  child: SignupChild;
  onBack: () => void;
}) {
  const detail = api.club.linkedChildClubDetail.useQuery(
    { clubId: club.id, studentId: child.id },
    { retry: false },
  );
  return (
    <View style={styles.detail}>
      <MobileButton compact label="Back to My Clubs" onPress={onBack} variant="secondary" />
      <Card style={styles.clubCard}>
        <SectionTitle>{club.name}</SectionTitle>
        <MutedText>{club.scheduleLabel ?? 'No schedule set'}</MutedText>
        {club.description ? <Text style={styles.clubDescription}>{club.description}</Text> : null}
      </Card>
      {detail.isLoading ? <InlineSpinner label="Loading club details" /> : null}
      {detail.error ? <ErrorText>{detail.error.message}</ErrorText> : null}
      {detail.data ? (
        <>
          <Card style={styles.clubCard}>
            <SectionTitle>Attendance</SectionTitle>
            {detail.data.attendance.length === 0 ? (
              <MutedText>No attendance recorded yet.</MutedText>
            ) : (
              detail.data.attendance.map((row) => (
                <Text key={row.id} style={styles.detailRow}>
                  {row.sessionDate} · {row.status}
                </Text>
              ))
            )}
          </Card>
          <Card style={styles.clubCard}>
            <SectionTitle>Notices</SectionTitle>
            {detail.data.notices.length === 0 ? (
              <MutedText>No notices yet.</MutedText>
            ) : (
              detail.data.notices.map((notice) => (
                <View key={notice.id} style={styles.notice}>
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                  <Text style={styles.clubDescription}>{notice.body}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </View>
  );
}

export function ParentClubsScreen({
  childrenRows,
  clubNotices,
  clubNoticesError,
  clubs,
  loading,
  loadingClubNotices,
  selectedChildId,
  onSelectChild,
}: ParentClubsScreenProps) {
  const utils = api.useUtils();
  const signUp = api.club.signUp.useMutation();
  const withdraw = api.club.withdraw.useMutation();
  const [tab, setTab] = useState<ClubTab>('all');
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<SignupClub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const child = childrenRows.find((row) => row.id === selectedChildId) ?? childrenRows[0] ?? null;
  const eligibleClubs = useMemo(
    () =>
      child
        ? clubs.filter((club) => clubMatchesYearGroupBands(child.yearGroup, club.yearGroupBands))
        : [],
    [child, clubs],
  );
  const myClubs = useMemo(
    () => (child ? clubs.filter((club) => club.signedUpStudentIds.includes(child.id)) : []),
    [child, clubs],
  );

  async function refresh() {
    await Promise.all([
      utils.club.linkedChildSignupContext.invalidate(),
      utils.club.myClubNotices.invalidate(),
    ]);
  }
  async function join(club: SignupClub) {
    if (!child) return;
    setError(null);
    setPendingClubId(club.id);
    try {
      await signUp.mutateAsync({ clubId: club.id, studentId: child.id });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Club signup failed.');
    } finally {
      setPendingClubId(null);
    }
  }
  function confirmWithdraw(club: SignupClub) {
    if (!child) return;
    Alert.alert('Withdraw from club?', `Remove ${child.fullName} from ${club.name}?`, [
      { text: 'Keep membership', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => {
          void leave(club);
        },
      },
    ]);
  }
  async function leave(club: SignupClub) {
    if (!child) return;
    setError(null);
    setPendingClubId(club.id);
    try {
      await withdraw.mutateAsync({ clubId: club.id, studentId: child.id });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Club withdrawal failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  if (selectedClub && child)
    return (
      <ClubDetails
        child={child}
        club={selectedClub}
        onBack={() => {
          setSelectedClub(null);
        }}
      />
    );
  return (
    <>
      <View style={styles.screenIntro}>
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.subtitle}>
          {child ? `For ${child.fullName}` : 'Choose a linked child'}
        </Text>
      </View>
      {childrenRows.length > 0 ? (
        <ParentChildSwitcher
          children={childrenRows}
          onSelect={onSelectChild}
          selectedChildId={child?.id ?? ''}
        />
      ) : (
        <Card style={styles.clubCard}>
          <SectionTitle>No linked children</SectionTitle>
          <MutedText>Club signups need an active linked child record.</MutedText>
        </Card>
      )}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ['all', 'All Clubs'],
            ['mine', 'My Clubs'],
            ['notices', 'Notices'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            key={id}
            onPress={() => {
              setTab(id);
            }}
            style={[styles.tab, tab === id ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, tab === id ? styles.tabTextActive : null]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {child ? (
        <MutedText>
          {displaySchoolYearLabel(child.yearGroup)} · {String(eligibleClubs.length)} clubs available
        </MutedText>
      ) : null}
      {loading ? <InlineSpinner label="Loading clubs" /> : null}
      {tab === 'all' && child ? (
        <View style={styles.list}>
          {eligibleClubs.length === 0 ? (
            <Card style={styles.clubCard}>
              <SectionTitle>No eligible clubs</SectionTitle>
              <MutedText>No clubs are currently available for this child’s year group.</MutedText>
            </Card>
          ) : (
            eligibleClubs.map((club) => (
              <ClubCard
                child={child}
                club={club}
                key={club.id}
                mode="all"
                onOpen={setSelectedClub}
                onSignUp={(nextClub) => void join(nextClub)}
                onWithdraw={confirmWithdraw}
                pending={pendingClubId === club.id}
              />
            ))
          )}
        </View>
      ) : null}
      {tab === 'mine' && child ? (
        <View style={styles.list}>
          {myClubs.length === 0 ? (
            <Card style={styles.clubCard}>
              <SectionTitle>No clubs yet</SectionTitle>
              <MutedText>This child has not joined a club yet.</MutedText>
            </Card>
          ) : (
            myClubs.map((club) => (
              <ClubCard
                child={child}
                club={club}
                key={club.id}
                mode="mine"
                onOpen={setSelectedClub}
                onSignUp={() => undefined}
                onWithdraw={confirmWithdraw}
                pending={pendingClubId === club.id}
              />
            ))
          )}
        </View>
      ) : null}
      {tab === 'notices' ? (
        <Card style={styles.clubCard}>
          <SectionTitle>Latest updates</SectionTitle>
          {loadingClubNotices ? <InlineSpinner label="Loading club notices" /> : null}
          {clubNoticesError ? <ErrorText>{clubNoticesError}</ErrorText> : null}
          {!loadingClubNotices && !clubNoticesError && clubNotices.length === 0 ? (
            <MutedText>No notices yet.</MutedText>
          ) : (
            clubNotices.map((notice) => (
              <View key={notice.id} style={styles.notice}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <MutedText>
                  {notice.clubName} · {formatParentDateTime(notice.sentAt)}
                </MutedText>
                <Text style={styles.clubDescription}>{notice.body}</Text>
              </View>
            ))
          )}
        </Card>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  capacityText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  clubCard: { gap: 10, padding: 16 },
  clubDescription: { color: C.textSecondary, fontSize: 12, lineHeight: 18 },
  clubHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  clubTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  clubTitleGroup: { flex: 1, gap: 3 },
  detail: { gap: 10 },
  detailRow: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  list: { gap: 10 },
  notice: { borderTopColor: C.border, borderTopWidth: 1, gap: 5, paddingTop: 10 },
  noticeTitle: { color: C.navy, fontSize: 14, fontWeight: '800' },
  screenIntro: { gap: 2 },
  subtitle: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  tab: { borderRadius: 10, flex: 1, paddingHorizontal: 8, paddingVertical: 10 },
  tabActive: { backgroundColor: C.navy },
  tabText: { color: C.textSecondary, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  tabTextActive: { color: C.surface },
  tabs: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  title: { color: C.navy, fontSize: 25, fontWeight: '900' },
});
