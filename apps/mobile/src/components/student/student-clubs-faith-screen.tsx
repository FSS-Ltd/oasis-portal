import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { StudentClubsPanel } from './student-clubs-panel';
import { StudentFaithCornerPanel } from './student-faith-corner-panel';

export function StudentClubsFaithScreen() {
  const clubs = api.club.studentClubs.useQuery(undefined, { retry: false });
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const activeSelectedClubId = selectedClubId ?? clubs.data?.[0]?.id ?? null;
  const clubDetail = api.club.studentClubDetail.useQuery(
    { clubId: activeSelectedClubId ?? '' },
    { enabled: activeSelectedClubId !== null, retry: false },
  );
  const faith = api.faithCorner.currentForStudent.useQuery(undefined, { retry: false });
  const comments = api.faithCorner.listComments.useQuery(undefined, {
    enabled: faith.data?.ready === true,
    retry: false,
  });

  useEffect(() => {
    setSelectedClubId((current) => {
      if (current && clubs.data?.some((club) => club.id === current)) return current;
      return clubs.data?.[0]?.id ?? null;
    });
  }, [clubs.data]);

  async function refreshClubs() {
    await Promise.all([
      clubs.refetch(),
      activeSelectedClubId ? clubDetail.refetch() : Promise.resolve(),
    ]);
  }

  async function refreshFaith() {
    await Promise.all([
      faith.refetch(),
      faith.data?.ready === true ? comments.refetch() : Promise.resolve(),
    ]);
  }

  const loading = clubs.isLoading || faith.isLoading;
  const clubCount = clubs.data?.length ?? 0;
  const memberCount = useMemo(
    () => clubs.data?.filter((club) => club.status === 'Member').length ?? 0,
    [clubs.data],
  );

  return (
    <View style={styles.stack}>
      {loading ? (
        <Card style={styles.stateCard}>
          <InlineSpinner label="Loading clubs" />
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Clubs and Faith Corner</Text>
        <SectionTitle>Club Noticeboard</SectionTitle>
        <MutedText>Inspect active clubs, member notices, and weekly Faith Corner content.</MutedText>
        <View style={styles.heroStats}>
          <HeroStat label="Active clubs" value={String(clubCount)} />
          <HeroStat label="Memberships" value={String(memberCount)} />
        </View>
      </Card>

      <StudentClubsPanel
        clubs={clubs.data}
        detail={clubDetail.data}
        detailError={clubDetail.error?.message ?? null}
        detailLoading={clubDetail.isLoading}
        error={clubs.error?.message ?? null}
        loading={clubs.isLoading}
        onRefreshClubs={refreshClubs}
        onSelectClub={setSelectedClubId}
        selectedClubId={activeSelectedClubId}
      />

      <StudentFaithCornerPanel
        comments={comments.data}
        commentsError={comments.error?.message ?? null}
        commentsLoading={comments.isLoading}
        faith={faith.data}
        faithError={faith.error?.message ?? null}
        loading={faith.isLoading}
        onRefreshFaith={refreshFaith}
      />
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 14,
    padding: 16,
  },
  heroStat: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 116,
    padding: 10,
  },
  heroStatLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStatValue: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
});
