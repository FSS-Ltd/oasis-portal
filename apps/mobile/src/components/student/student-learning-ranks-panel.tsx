import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, MutedText, SectionTitle } from '../core/mobile-ui';
import {
  formatLearningMerits,
  leaderboardOptions,
  leaderboardScoreLabel,
  type PublicLeaderboardKind,
  type StudentLeaderboard,
} from './student-learning-utils';

interface StudentRanksPanelProps {
  error: string | null;
  leaderboard: StudentLeaderboard | undefined;
  leaderboardKind: PublicLeaderboardKind;
  onSelectLeaderboardKind: (kind: PublicLeaderboardKind) => void;
}

export function StudentRanksPanel({
  error,
  leaderboard,
  leaderboardKind,
  onSelectLeaderboardKind,
}: StudentRanksPanelProps) {
  const scoreKindLabel = leaderboardScoreLabel(leaderboardKind);
  const viewerRank = leaderboard?.viewerRows[0] ?? null;

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.rowBetween}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>Positive ranks</Text>
          <SectionTitle>Your rank</SectionTitle>
        </View>
        {viewerRank ? <Badge variant="success">#{String(viewerRank.rank)}</Badge> : null}
      </View>
      <View style={styles.segmentRow}>
        {leaderboardOptions.map((option) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: leaderboardKind === option.kind }}
            key={option.kind}
            onPress={() => {
              onSelectLeaderboardKind(option.kind);
            }}
            style={[
              styles.segmentButton,
              leaderboardKind === option.kind ? styles.segmentButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.segmentButtonText,
                leaderboardKind === option.kind ? styles.segmentButtonTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {error && !leaderboard ? <ErrorText>{error}</ErrorText> : null}
      {!leaderboard && !error ? <MutedText>Loading leaderboard...</MutedText> : null}
      {leaderboard && leaderboard.rows.length === 0 ? (
        <MutedText>No rankings are available for this category yet.</MutedText>
      ) : null}
      {(leaderboard?.rows ?? []).slice(0, 5).map((row) => (
        <View key={row.studentId} style={styles.recordRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{String(row.rank)}</Text>
          </View>
          <View style={styles.headingCopy}>
            <Text style={styles.rowTitle}>{row.displayName}</Text>
            <MutedText>{row.yearGroup}</MutedText>
          </View>
          <Text style={styles.scoreText}>
            {formatLearningMerits(row.score)} {scoreKindLabel}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headingCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 16,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  rankBadgeText: {
    color: C.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  recordRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  scoreText: {
    color: C.navy,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  sectionCard: {
    gap: 12,
    padding: 16,
  },
  segmentButton: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  segmentButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentButtonTextActive: {
    color: C.surface,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
