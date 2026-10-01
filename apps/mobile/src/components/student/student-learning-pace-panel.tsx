import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, MutedText, SectionTitle } from '../core/mobile-ui';
import { paceStatusVariant, scoreLabel, type StudentPace } from './student-learning-utils';

interface StudentPacePanelProps {
  error: string | null;
  loading: boolean;
  pace: StudentPace | undefined;
}

export function StudentPacePanel({ error, loading, pace }: StudentPacePanelProps) {
  if (error && !pace) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>PACE progress</SectionTitle>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.rowBetween}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>PACE progress</Text>
          <SectionTitle>Current work</SectionTitle>
        </View>
        <Badge variant="blue">{pace ? `${String(pace.today.testCount)} today` : 'Loading'}</Badge>
      </View>
      <MutedText>Passing threshold is {String(pace?.policy.passThreshold ?? 80)}%.</MutedText>
      {pace?.subjects.length === 0 ? (
        <MutedText>No PACE subjects are assigned to your student account yet.</MutedText>
      ) : null}
      {!pace && !loading ? <MutedText>No PACE subjects</MutedText> : null}
      {pace?.subjects.slice(0, 4).map((subject) => {
        const latest = subject.latestFinalTest ?? subject.latestSelfTest;
        return (
          <View key={subject.subjectId} style={styles.subjectRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.rowTitle}>{subject.name}</Text>
              <View style={styles.paceMeta}>
                <MutedText>
                  {subject.code} · PACE {String(subject.currentPaceNumber)}
                </MutedText>
                {subject.gapContext ? (
                  <MutedText>
                    Gap PACE · Jump to {String(subject.gapContext.jumpToPaceNumber)}
                  </MutedText>
                ) : null}
                {subject.gapReviewRequired ? (
                  <MutedText>Needs Head review · Advancement paused</MutedText>
                ) : null}
                {subject.status.testingLevel !== null ? (
                  <Badge variant="blue">Level {String(subject.status.testingLevel)}</Badge>
                ) : null}
              </View>
            </View>
            <View style={styles.rowMeta}>
              {pace.paceStatusVisible ? (
                <>
                  <Badge variant={paceStatusVariant(subject.status.tone)}>
                    {subject.status.status}
                  </Badge>
                </>
              ) : null}
              <Text style={styles.scoreText}>{scoreLabel(latest?.score)}</Text>
            </View>
          </View>
        );
      })}
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
  paceMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 5,
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
  stateCard: {
    gap: 10,
    padding: 16,
  },
  subjectRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
});
