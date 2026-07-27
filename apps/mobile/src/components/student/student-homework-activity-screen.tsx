import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { StudentHomeworkActivityDetail } from './student-homework-activity-detail';
import { StudentHomeworkActivityList } from './student-homework-activity-list';
import {
  homeworkAccessBlockedCopy,
  type StudentHomeworkAssignment,
} from './student-homework-activity-utils';

interface StudentHomeworkActivityScreenProps {
  due: readonly StudentHomeworkAssignment[] | undefined;
  dueError: string | null;
  graded: readonly StudentHomeworkAssignment[] | undefined;
  gradedError: string | null;
  loading: boolean;
  onRefreshHomework: () => Promise<void>;
}

export function StudentHomeworkActivityScreen({
  due,
  dueError,
  graded,
  gradedError,
  loading,
  onRefreshHomework,
}: StudentHomeworkActivityScreenProps) {
  const dueRows = useMemo(() => due ?? [], [due]);
  const gradedRows = useMemo(() => graded ?? [], [graded]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const error = dueError ?? gradedError;

  useEffect(() => {
    const preferredId = dueRows[0]?.id ?? gradedRows[0]?.id ?? null;
    setSelectedId((current) => {
      if (
        current &&
        (dueRows.some((assignment) => assignment.id === current) ||
          gradedRows.some((assignment) => assignment.id === current))
      ) {
        return current;
      }
      return preferredId;
    });
  }, [dueRows, gradedRows]);

  const selectedAssignment =
    dueRows.find((assignment) => assignment.id === selectedId) ??
    gradedRows.find((assignment) => assignment.id === selectedId) ??
    null;

  if (loading && dueRows.length === 0 && gradedRows.length === 0) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading assigned work" />
      </Card>
    );
  }

  if (error && dueRows.length === 0 && gradedRows.length === 0) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Assigned work unavailable</SectionTitle>
        <MutedText>This account cannot open assigned work right now.</MutedText>
        <MutedText>{homeworkAccessBlockedCopy.join(' · ')}</MutedText>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      {loading ? (
        <Card style={styles.stateCard}>
          <InlineSpinner label="Loading assigned work" />
        </Card>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Assigned work unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Activity</Text>
        <SectionTitle>Assigned work</SectionTitle>
        <MutedText>
          Homework, submission state, and reviewed results for this student account.
        </MutedText>
        <View style={styles.heroStats}>
          <HeroStat label="Current assignments" value={String(dueRows.length)} />
          <HeroStat label="Graded homework" value={String(gradedRows.length)} />
        </View>
      </Card>

      <StudentHomeworkActivityList
        due={dueRows}
        graded={gradedRows}
        onSelect={(assignment) => {
          setSelectedId(assignment.id);
        }}
        selectedId={selectedId}
      />

      <StudentHomeworkActivityDetail
        assignment={selectedAssignment}
        onSubmitted={onRefreshHomework}
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
  errorCard: {
    borderColor: C.dangerMid,
    gap: 8,
    padding: 16,
  },
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
