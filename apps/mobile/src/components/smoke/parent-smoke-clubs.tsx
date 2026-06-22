import { StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { displaySchoolYearLabel } from './parent-smoke-children';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';

type SignupContext = RouterOutputs['club']['linkedChildSignupContext'];
type SignupChild = SignupContext['children'][number];
type SignupClub = SignupContext['clubs'][number];

interface ParentClubsPanelProps {
  childrenRows: readonly SignupChild[];
  clubs: readonly SignupClub[];
  loading: boolean;
  operationError: string | null;
  pendingClubId: string | null;
  selectedChildId: string;
  status: string | null;
  onSelectChild: (studentId: string) => void;
  onSignUp: (club: SignupClub, child: SignupChild) => void;
  onWithdraw: (club: SignupClub, child: SignupChild) => void;
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

function ChildSelector({
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
          <MobileButton
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

function ClubSignupCard({
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
        <MobileButton
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

export function ParentClubsPanel({
  childrenRows,
  clubs,
  loading,
  operationError,
  pendingClubId,
  selectedChildId,
  status,
  onSelectChild,
  onSignUp,
  onWithdraw,
}: ParentClubsPanelProps) {
  const selectedChild = selectedSignupChild(childrenRows, selectedChildId);
  const activeSelectedChildId = selectedChild?.id ?? '';

  return (
    <>
      <View style={styles.screenIntro}>
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.subtitle}>Sign up linked children and check current places.</Text>
      </View>

      <ChildSelector
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
          <Badge variant={selectedChild ? 'blue' : 'neutral'}>
            {selectedChild?.fullName ?? 'No child selected'}
          </Badge>
        </View>
      </Card>

      {loading ? <InlineSpinner label="Loading clubs" /> : null}
      {clubs.length === 0 && !loading ? (
        <Card style={styles.compactCard}>
          <SectionTitle>No active clubs</SectionTitle>
          <MutedText>Active club signups will appear here.</MutedText>
        </Card>
      ) : null}

      <View style={styles.clubList}>
        {clubs.map((club) => (
          <ClubSignupCard
            club={club}
            disabled={!selectedChild}
            key={club.id}
            pending={pendingClubId === club.id}
            selectedChild={selectedChild}
            onSignUp={onSignUp}
            onWithdraw={onWithdraw}
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
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  screenIntro: {
    gap: 2,
    paddingTop: 2,
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
