import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  InlineSpinner,
  MutedText,
  SectionTitle,
  SmokeButton,
} from '../smoke/smoke-ui';
import { displaySchoolYearLabel, formatParentDateTime } from './parent-home-utils';

type SignupContext = RouterOutputs['club']['linkedChildSignupContext'];
type SignupChild = SignupContext['children'][number];
type SignupClub = SignupContext['clubs'][number];
type ClubNotice = RouterOutputs['club']['myClubNotices'][number];

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
  if (club.capacity === null) return `${String(club.activeSignupCount)} signed up`;
  return `${String(club.activeSignupCount)}/${String(club.capacity)} places`;
}

function isClubFull(club: SignupClub): boolean {
  return club.capacity !== null && club.activeSignupCount >= club.capacity;
}

function selectedSignupChild(
  rows: readonly SignupChild[],
  selectedChildId: string,
): SignupChild | null {
  return rows.find((child) => child.id === selectedChildId) ?? rows[0] ?? null;
}

function ParentClubChildSelector({
  rows,
  selectedChildId,
  onSelect,
}: {
  rows: readonly SignupChild[];
  selectedChildId: string;
  onSelect: (studentId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card style={styles.compactCard}>
        <SectionTitle>No linked children</SectionTitle>
        <MutedText>Club signups need an active linked child record.</MutedText>
      </Card>
    );
  }

  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Child</SectionTitle>
      <View style={styles.buttonColumn}>
        {rows.map((child) => (
          <SmokeButton
            compact
            key={child.id}
            label={`${child.fullName} · ${displaySchoolYearLabel(child.yearGroup)}`}
            onPress={() => {
              onSelect(child.id);
            }}
            variant={child.id === selectedChildId ? 'primary' : 'secondary'}
          />
        ))}
      </View>
    </Card>
  );
}

function ParentClubNoticeList({
  error,
  loading,
  notices,
}: {
  error: string | null;
  loading: boolean;
  notices: readonly ClubNotice[];
}) {
  return (
    <Card style={styles.noticeSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleGroup}>
          <SectionTitle>Linked child club notices</SectionTitle>
          <MutedText>Latest Club Updates</MutedText>
        </View>
        <Badge variant="success">{String(notices.length)}</Badge>
      </View>

      {loading ? <InlineSpinner label="Loading club notices" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!loading && !error && notices.length === 0 ? (
        <View style={styles.emptyNotice}>
          <Text style={styles.emptyTitle}>No club notices yet</Text>
          <MutedText>Club updates for linked children will appear here.</MutedText>
        </View>
      ) : null}

      {notices.map((notice) => (
        <View key={notice.id} style={styles.clubNoticeCard}>
          <View style={styles.noticeMetaRow}>
            <View style={styles.clubNoticeTitleGroup}>
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <Text style={styles.noticeMeta}>
                {notice.clubName} · {notice.studentName} · {formatParentDateTime(notice.sentAt)}
              </Text>
            </View>
            <Badge variant="success">Club</Badge>
          </View>
          <Text style={styles.clubDescription}>{notice.body}</Text>
        </View>
      ))}
    </Card>
  );
}

function ParentClubSignupCard({
  club,
  disabled,
  pending,
  selectedChild,
  onSignUp,
  onWithdraw,
}: {
  club: SignupClub;
  disabled: boolean;
  pending: boolean;
  selectedChild: SignupChild | null;
  onSignUp: (club: SignupClub, child: SignupChild) => void;
  onWithdraw: (club: SignupClub, child: SignupChild) => void;
}) {
  const signedUp = selectedChild ? club.signedUpStudentIds.includes(selectedChild.id) : false;
  const full = isClubFull(club);
  const buttonLabel = pending ? 'Saving...' : signedUp ? 'Withdraw' : full ? 'Full' : 'Sign up';
  const buttonVariant = signedUp ? 'danger' : full ? 'secondary' : 'primary';
  const buttonDisabled = disabled || pending || (!signedUp && full) || !selectedChild;

  return (
    <Card style={styles.clubCard}>
      <View style={styles.clubHeader}>
        <View style={styles.clubTitleGroup}>
          <Text style={styles.clubTitle}>{club.name}</Text>
          <MutedText>{club.scheduleLabel ?? 'No schedule set'}</MutedText>
        </View>
        <Badge variant={signedUp ? 'success' : full ? 'warning' : 'blue'}>
          {signedUp ? 'Signed up' : full ? 'Full' : 'Open'}
        </Badge>
      </View>
      {club.description ? <Text style={styles.clubDescription}>{club.description}</Text> : null}
      <View style={styles.clubFooter}>
        <Text style={styles.capacityText}>{capacityLabel(club)}</Text>
        <SmokeButton
          compact
          disabled={buttonDisabled}
          label={buttonLabel}
          onPress={() => {
            if (!selectedChild) return;
            if (signedUp) {
              onWithdraw(club, selectedChild);
              return;
            }
            onSignUp(club, selectedChild);
          }}
          variant={buttonVariant}
        />
      </View>
    </Card>
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
  const signUpForClub = api.club.signUp.useMutation();
  const withdrawFromClub = api.club.withdraw.useMutation();
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const selectedChild = selectedSignupChild(childrenRows, selectedChildId);
  const activeSelectedChildId = selectedChild?.id ?? '';
  const familySignupCount = useMemo(
    () =>
      clubs.reduce(
        (count, club) =>
          count +
          childrenRows.filter((child) => club.signedUpStudentIds.includes(child.id)).length,
        0,
      ),
    [childrenRows, clubs],
  );

  async function invalidateClubData() {
    await Promise.all([
      utils.club.linkedChildSignupContext.invalidate(),
      utils.club.myClubNotices.invalidate(),
    ]);
  }

  async function signChildUp(club: SignupClub, child: SignupChild) {
    setStatus(null);
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await signUpForClub.mutateAsync({ clubId: club.id, studentId: child.id });
      setStatus(`${child.fullName} signed up for ${club.name}.`);
      await invalidateClubData();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Club signup failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  async function withdrawChild(club: SignupClub, child: SignupChild) {
    setStatus(null);
    setOperationError(null);
    setPendingClubId(club.id);
    try {
      await withdrawFromClub.mutateAsync({ clubId: club.id, studentId: child.id });
      setStatus(`${child.fullName} withdrawn from ${club.name}.`);
      await invalidateClubData();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Club withdrawal failed.');
    } finally {
      setPendingClubId(null);
    }
  }

  return (
    <>
      <View style={styles.screenIntro}>
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.subtitle}>Sign up linked children and check current places.</Text>
      </View>

      <ParentClubChildSelector
        rows={childrenRows}
        selectedChildId={activeSelectedChildId}
        onSelect={onSelectChild}
      />

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryValue}>{String(clubs.length)}</Text>
            <MutedText>active clubs</MutedText>
          </View>
          <View>
            <Text style={styles.summaryValue}>{String(familySignupCount)}</Text>
            <MutedText>family signups</MutedText>
          </View>
          <Badge variant={selectedChild ? 'blue' : 'neutral'}>
            {selectedChild?.fullName ?? 'No child selected'}
          </Badge>
        </View>
      </Card>

      <ParentClubNoticeList
        error={clubNoticesError}
        loading={loadingClubNotices}
        notices={clubNotices}
      />

      {loading ? <InlineSpinner label="Loading clubs" /> : null}
      {clubs.length === 0 && !loading ? (
        <Card style={styles.compactCard}>
          <SectionTitle>No active clubs</SectionTitle>
          <MutedText>Active club signups will appear here.</MutedText>
        </Card>
      ) : null}

      <View style={styles.clubList}>
        {clubs.map((club) => (
          <ParentClubSignupCard
            club={club}
            disabled={!selectedChild}
            key={club.id}
            pending={pendingClubId === club.id}
            selectedChild={selectedChild}
            onSignUp={(nextClub, child) => {
              void signChildUp(nextClub, child);
            }}
            onWithdraw={(nextClub, child) => {
              void withdrawChild(nextClub, child);
            }}
          />
        ))}
      </View>

      {status ? <Text style={styles.successText}>{status}</Text> : null}
      {operationError ? <Text style={styles.errorText}>{operationError}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  buttonColumn: {
    gap: 8,
  },
  capacityText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  clubCard: {
    gap: 10,
    padding: 16,
  },
  clubDescription: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  clubFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  clubHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  clubList: {
    gap: 10,
  },
  clubNoticeCard: {
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  clubNoticeTitleGroup: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  clubTitle: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  clubTitleGroup: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  emptyNotice: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeMeta: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  noticeMetaRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  noticeSection: {
    gap: 12,
    padding: 16,
  },
  noticeTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  screenIntro: {
    gap: 2,
    paddingTop: 2,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  successText: {
    color: C.success,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    padding: 16,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: C.navy,
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
});
