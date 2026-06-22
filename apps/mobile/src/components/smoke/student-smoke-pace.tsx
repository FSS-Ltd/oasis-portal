import { StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';

type PaceDetail = RouterOutputs['pace']['forStudent'];
type PaceSubject = PaceDetail['subjects'][number];
type PaceRecord = PaceSubject['recentRecords'][number];
type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'blue' | 'crimson';

function formatDate(value: Date | string | null): string {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(value),
  );
}

function statusVariant(tone: PaceSubject['status']['tone']): BadgeVariant {
  if (tone === 'green') return 'success';
  if (tone === 'amber') return 'warning';
  if (tone === 'blue') return 'blue';
  return 'neutral';
}

function passVariant(record: PaceRecord): BadgeVariant {
  if (record.passed) return 'success';
  return record.testType === 'FinalTest' ? 'warning' : 'blue';
}

function RecordRow({ record }: { record: PaceRecord }) {
  return (
    <View style={styles.recordRow}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>
          {record.testType === 'FinalTest' ? 'PACE Test' : 'Self-Test'} {String(record.score)}%
        </Text>
        <MutedText>
          PACE {String(record.paceNumber)} | {formatDate(record.completedAt ?? record.createdAt)}
        </MutedText>
      </View>
      <Badge variant={passVariant(record)}>{record.passed ? 'Passed' : 'Review'}</Badge>
    </View>
  );
}

function PaceSubjectCard({ subject }: { subject: PaceSubject }) {
  const latest = subject.currentScoreRecord ?? subject.recentRecords[0] ?? null;

  return (
    <Card style={styles.compactCard}>
      <View style={styles.subjectHeader}>
        <View style={styles.rowBody}>
          <Text style={styles.subjectCode}>{subject.code}</Text>
          <Text style={styles.subjectName}>{subject.name}</Text>
        </View>
        <Badge variant={statusVariant(subject.status.tone)}>{subject.status.status}</Badge>
      </View>
      <View style={styles.paceStats}>
        <PaceStat label="Current" value={`PACE ${String(subject.currentPaceNumber)}`} />
        <PaceStat label="Completed" value={String(subject.completedPaceCount)} />
        <PaceStat
          label="Attempts"
          value={String(subject.currentFinalTestAttempts)}
        />
      </View>
      <MutedText>{subject.status.detail}</MutedText>
      {latest ? (
        <View style={styles.latestBox}>
          <Text style={styles.latestLabel}>Latest result</Text>
          <Text style={styles.latestValue}>
            {latest.testType === 'FinalTest' ? 'PACE Test' : 'Self-Test'} {String(latest.score)}%
          </Text>
          <MutedText>{formatDate(latest.completedAt ?? latest.createdAt)}</MutedText>
        </View>
      ) : (
        <MutedText>No recent PACE records returned.</MutedText>
      )}
      {subject.recentRecords.slice(0, 3).map((record) => (
        <RecordRow key={record.id} record={record} />
      ))}
    </Card>
  );
}

function PaceStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.paceStat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function StudentPacePanel({
  loading,
  pace,
}: {
  loading: boolean;
  pace: PaceDetail | undefined;
}) {
  return (
    <View style={styles.stack}>
      {loading ? <InlineSpinner label="Loading PACE results" /> : null}
      <Card style={styles.compactCard}>
        <View style={styles.subjectHeader}>
          <SectionTitle>PACE results</SectionTitle>
          <Badge variant="blue">
            {pace ? `${String(pace.today.testCount)} today` : 'Loading'}
          </Badge>
        </View>
        <MutedText>
          Passing threshold is {String(pace?.policy.passThreshold ?? 80)}%.
        </MutedText>
      </Card>
      {pace?.subjects.length === 0 ? (
        <Card style={styles.compactCard}>
          <SectionTitle>No subjects</SectionTitle>
          <MutedText>No assigned PACE subjects were returned for this student.</MutedText>
        </Card>
      ) : null}
      {(pace?.subjects ?? []).map((subject) => (
        <PaceSubjectCard key={subject.subjectId} subject={subject} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    gap: 10,
    padding: 16,
  },
  latestBox: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  latestLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  latestValue: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  paceStat: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    padding: 10,
  },
  paceStats: {
    flexDirection: 'row',
    gap: 8,
  },
  recordRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  rowBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  stack: {
    gap: 14,
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statValue: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  subjectCode: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
  },
  subjectHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  subjectName: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
