import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, MutedText } from '../smoke/smoke-ui';
import { paceTestTypeLabel, scoreLabel, scoreTone } from './staff-pace-utils';

type PaceSubject = RouterOutputs['pace']['forStudent']['subjects'][number];
type ScoreTone = 'danger' | 'success' | 'warning';

export function StaffPaceSubjectPanel({
  error,
  loading,
  subjects,
}: {
  error: string | null;
  loading: boolean;
  subjects: PaceSubject[];
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Current PACE context</Text>
        <Badge variant="blue">{String(subjects.length)}</Badge>
      </View>
      {loading ? <MutedText>Loading subject progress...</MutedText> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && subjects.length === 0 ? (
        <MutedText>No active PACE subjects are assigned to this student.</MutedText>
      ) : null}
      {subjects.map((subject) => {
        const latest = subject.currentScoreRecord;
        const tone = scoreTone(latest?.score ?? null);
        return (
          <View key={subject.subjectId} style={styles.subjectRow}>
            <View style={styles.rowHeader}>
              <View style={styles.rowBody}>
                <Text style={styles.subjectName}>
                  {subject.code} · {subject.name}
                </Text>
                <Text style={styles.subjectMeta}>
                  Current PACE #{String(subject.currentPaceNumber)} · {subject.status.status}
                </Text>
              </View>
              <Badge variant={subject.status.tone === 'green' ? 'success' : 'blue'}>
                {String(subject.completedPaceCount)} done
              </Badge>
            </View>
            {latest ? (
              <View style={styles.latestRow}>
                <Badge variant={latest.testType === 'FinalTest' ? 'crimson' : 'blue'}>
                  {paceTestTypeLabel(latest.testType)}
                </Badge>
                <Text style={[styles.scoreText, scoreTextStyle(tone)]}>
                  {String(latest.score)}% · {scoreLabel(latest.score)}
                </Text>
              </View>
            ) : (
              <MutedText>No score recorded for the current PACE yet.</MutedText>
            )}
          </View>
        );
      })}
    </Card>
  );
}

function scoreTextStyle(tone: ScoreTone): StyleProp<TextStyle> {
  if (tone === 'success') return styles.scoreTextSuccess;
  if (tone === 'warning') return styles.scoreTextWarning;
  return styles.scoreTextDanger;
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  latestRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '900',
  },
  scoreTextDanger: {
    color: C.danger,
  },
  scoreTextSuccess: {
    color: C.success,
  },
  scoreTextWarning: {
    color: C.warning,
  },
  subjectMeta: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  subjectName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  subjectRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 10,
  },
});
