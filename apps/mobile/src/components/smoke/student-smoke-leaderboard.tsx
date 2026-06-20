import { StyleSheet, Text, View } from 'react-native';
import type { RouterInputs, RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';

type LeaderboardInput = NonNullable<Exclude<RouterInputs['leaderboard']['get'], void>>;
type LeaderboardKind = Exclude<NonNullable<LeaderboardInput['kind']>, 'HighestDemerits'>;
type LeaderboardRow = RouterOutputs['leaderboard']['get']['rows'][number];

interface StudentLeaderboardPanelProps {
  kind: LeaderboardKind;
  loading: boolean;
  rows: LeaderboardRow[];
  onKindChange: (kind: LeaderboardKind) => void;
}

const leaderboardKinds: Array<{ kind: LeaderboardKind; label: string; scoreLabel: string }> = [
  { kind: 'TopSavers', label: 'Savers', scoreLabel: 'saved merits' },
  { kind: 'TopInvestors', label: 'Investors', scoreLabel: 'investment value' },
  { kind: 'TopTithers', label: 'Tithers', scoreLabel: 'tithed merits' },
];

function scoreLabel(kind: LeaderboardKind): string {
  return leaderboardKinds.find((option) => option.kind === kind)?.scoreLabel ?? 'merits';
}

function LeaderboardRowItem({
  kind,
  row,
}: {
  kind: LeaderboardKind;
  row: LeaderboardRow;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{String(row.rank)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.name}>
          {row.displayName}
        </Text>
        <MutedText>{row.yearGroup}</MutedText>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{String(row.score)}</Text>
        <Text style={styles.scoreMeta}>{scoreLabel(kind)}</Text>
      </View>
    </View>
  );
}

export function StudentLeaderboardPanel({
  kind,
  loading,
  rows,
  onKindChange,
}: StudentLeaderboardPanelProps) {
  return (
    <View style={styles.stack}>
      <Card style={styles.compactCard}>
        <View style={styles.header}>
          <SectionTitle>Leaderboards</SectionTitle>
          <Badge variant="blue">Top 10</Badge>
        </View>
        <View style={styles.filterRow}>
          {leaderboardKinds.map((option) => (
            <MobileButton
              compact
              key={option.kind}
              label={option.label}
              onPress={() => {
                onKindChange(option.kind);
              }}
              variant={kind === option.kind ? 'primary' : 'secondary'}
            />
          ))}
        </View>
      </Card>
      {loading ? <InlineSpinner label="Loading leaderboard" /> : null}
      <Card style={styles.compactCard}>
        {rows.length === 0 ? <MutedText>No leaderboard rows returned.</MutedText> : null}
        {rows.map((row) => (
          <LeaderboardRowItem key={row.studentId} kind={kind} row={row} />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    gap: 10,
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rankText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  score: {
    color: C.crimson,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  scoreBox: {
    alignItems: 'flex-end',
    minWidth: 86,
  },
  scoreMeta: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
  },
  stack: {
    gap: 14,
  },
});
