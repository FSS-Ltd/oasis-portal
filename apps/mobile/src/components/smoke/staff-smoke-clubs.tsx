import { StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';

type ClubListItem = RouterOutputs['club']['list'][number];
type RosterSignup = RouterOutputs['club']['roster']['signups'][number];

interface StaffClubsPanelProps {
  clubs: readonly ClubListItem[];
  listError: string | null;
  listLoading: boolean;
  rosterError: string | null;
  rosterLoading: boolean;
  rosterSignups: readonly RosterSignup[];
  selectedClubId: string;
  onSelectClub: (clubId: string) => void;
}

function capacityLabel(club: ClubListItem): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} signed up`;
  return `${String(club.activeSignupCount)}/${String(club.capacity)} places`;
}

function formatSignedUpAt(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function StaffClubsPanel({
  clubs,
  listError,
  listLoading,
  rosterError,
  rosterLoading,
  rosterSignups,
  selectedClubId,
  onSelectClub,
}: StaffClubsPanelProps) {
  const selectedClub =
    clubs.find((club) => club.id === selectedClubId) ??
    clubs.find((club) => club.active) ??
    clubs[0] ??
    null;

  return (
    <>
      <View style={styles.screenIntro}>
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.subtitle}>Read club lists and roster rows through the typed API.</Text>
      </View>

      {listError ? (
        <Card style={styles.compactCard}>
          <SectionTitle>Club access unavailable</SectionTitle>
          <Text style={styles.errorText}>{listError}</Text>
        </Card>
      ) : null}

      <Card style={styles.compactCard}>
        <View style={styles.sectionHeader}>
          <View>
            <SectionTitle>Club List</SectionTitle>
            <MutedText>Active and inactive clubs visible to this staff account.</MutedText>
          </View>
          <Badge variant="blue">{String(clubs.length)}</Badge>
        </View>
        {listLoading ? <InlineSpinner label="Loading clubs" /> : null}
        {clubs.length === 0 && !listLoading && !listError ? (
          <MutedText>No clubs were returned.</MutedText>
        ) : null}
        <View style={styles.buttonColumn}>
          {clubs.map((club) => (
            <MobileButton
              compact
              key={club.id}
              label={`${club.name} · ${capacityLabel(club)}`}
              onPress={() => {
                onSelectClub(club.id);
              }}
              variant={club.id === selectedClub?.id ? 'primary' : 'secondary'}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.compactCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerText}>
            <SectionTitle>{selectedClub?.name ?? 'Select a club'}</SectionTitle>
            <MutedText>{selectedClub?.scheduleLabel ?? 'No schedule set'}</MutedText>
          </View>
          {selectedClub ? (
            <Badge variant={selectedClub.active ? 'success' : 'neutral'}>
              {selectedClub.active ? 'Active' : 'Inactive'}
            </Badge>
          ) : null}
        </View>

        {selectedClub ? (
          <View style={styles.rosterSummary}>
            <Text style={styles.summaryValue}>{String(selectedClub.activeSignupCount)}</Text>
            <MutedText>{capacityLabel(selectedClub)}</MutedText>
          </View>
        ) : null}

        {rosterLoading ? <InlineSpinner label="Loading roster" /> : null}
        {rosterError ? <Text style={styles.errorText}>{rosterError}</Text> : null}
        {selectedClub && rosterSignups.length === 0 && !rosterLoading && !rosterError ? (
          <MutedText>No active signups for this club.</MutedText>
        ) : null}

        <View style={styles.rosterList}>
          {rosterSignups.map((signup) => (
            <View key={signup.id} style={styles.rosterRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{signup.studentName}</Text>
                <MutedText>
                  {signup.yearGroup} · Signed up {formatSignedUpAt(signup.signedUpAt)}
                </MutedText>
              </View>
              <Badge variant="blue">Roster</Badge>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  buttonColumn: {
    gap: 8,
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  headerText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rosterList: {
    gap: 10,
  },
  rosterRow: {
    alignItems: 'flex-start',
    borderTopColor: C.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  rosterSummary: {
    backgroundColor: C.bg,
    borderRadius: 8,
    gap: 2,
    padding: 12,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
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
