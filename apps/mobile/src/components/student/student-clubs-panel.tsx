import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  InlineSpinner,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import { StudentClubDetailPanel } from './student-club-detail-panel';
import {
  clubsFaithBlockedCopy,
  clubSpacesLabel,
  clubStatusVariant,
  type StudentClub,
  type StudentClubDetail,
} from './student-clubs-faith-utils';

interface StudentClubsPanelProps {
  clubs: readonly StudentClub[] | undefined;
  detail: StudentClubDetail | undefined;
  detailError: string | null;
  detailLoading: boolean;
  error: string | null;
  loading: boolean;
  selectedClubId: string | null;
  onRefreshClubs: () => Promise<void>;
  onSelectClub: (clubId: string) => void;
}

export function StudentClubsPanel({
  clubs,
  detail,
  detailError,
  detailLoading,
  error,
  loading,
  selectedClubId,
  onRefreshClubs,
  onSelectClub,
}: StudentClubsPanelProps) {
  const rows = clubs ?? [];
  const selectedClub = rows.find((club) => club.id === selectedClubId) ?? rows[0] ?? null;

  return (
    <View style={styles.stack}>
      <Card style={styles.listCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.eyebrow}>Club Noticeboard</Text>
            <SectionTitle>Active clubs</SectionTitle>
          </View>
          <Badge variant="blue">{String(rows.length)}</Badge>
        </View>
        {loading ? <InlineSpinner label="Loading clubs" /> : null}
        {error ? (
          <>
            <SectionTitle>Clubs unavailable</SectionTitle>
            <MutedText>This account cannot open student clubs right now.</MutedText>
            <MutedText>{clubsFaithBlockedCopy.join(' · ')}</MutedText>
            <ErrorText>{error}</ErrorText>
          </>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No active clubs</Text>
            <MutedText>Active clubs will appear here.</MutedText>
          </View>
        ) : null}
        {rows.map((club) => (
          <ClubRow
            club={club}
            key={club.id}
            onRefreshClubs={onRefreshClubs}
            onSelect={onSelectClub}
            selected={club.id === selectedClub?.id}
          />
        ))}
      </Card>

      <StudentClubDetailPanel
        detail={detail}
        error={detailError}
        fallbackClub={selectedClub}
        loading={detailLoading}
      />
    </View>
  );
}

function ClubRow({
  club,
  selected,
  onRefreshClubs,
  onSelect,
}: {
  club: StudentClub;
  selected: boolean;
  onRefreshClubs: () => Promise<void>;
  onSelect: (clubId: string) => void;
}) {
  const utils = api.useUtils();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expressInterest = api.club.studentExpressInterest.useMutation();
  const canSendInterest = club.status === 'Available' && !expressInterest.isPending;

  async function sendInterest() {
    setError(null);
    setStatus(null);
    try {
      const result = await expressInterest.mutateAsync({ clubId: club.id });
      setStatus(result.created ? 'Interest sent' : 'Interest sent');
      await Promise.all([
        utils.club.studentClubs.invalidate(),
        utils.club.studentClubDetail.invalidate({ clubId: club.id }),
        onRefreshClubs(),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Interest could not be sent.');
    }
  }

  return (
    <View style={[styles.clubRow, selected ? styles.clubRowSelected : null]}>
      <View style={styles.clubCopy}>
        <View style={styles.clubTitleRow}>
          <Text style={styles.clubTitle}>{club.name}</Text>
          <Badge variant={clubStatusVariant(club.status)}>{club.status}</Badge>
        </View>
        <Text style={styles.clubMeta}>
          {club.scheduleLabel ?? 'Schedule to be confirmed'} · {clubSpacesLabel(club)}
        </Text>
        {club.status === 'Interested' ? (
          <MutedText>Interest sent. A Centre Manager reviews club membership.</MutedText>
        ) : null}
        {status ? <MutedText>{status}</MutedText> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </View>
      <View style={styles.actions}>
        <MobileButton
          compact
          label={selected ? 'Open' : 'View'}
          onPress={() => {
            onSelect(club.id);
          }}
          variant={selected ? 'navy' : 'secondary'}
        />
        {club.status === 'Available' ? (
          <MobileButton
            compact
            disabled={!canSendInterest}
            label={expressInterest.isPending ? 'Sending...' : 'Send interest'}
            onPress={() => {
              void sendInterest();
            }}
            variant="primary"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'stretch',
    gap: 8,
  },
  clubCopy: {
    flex: 1,
    gap: 5,
  },
  clubMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  clubRow: {
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  clubRowSelected: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  clubTitle: {
    color: C.navy,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  clubTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyBlock: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  listCard: {
    gap: 12,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 3,
  },
  stack: {
    gap: 14,
  },
});
