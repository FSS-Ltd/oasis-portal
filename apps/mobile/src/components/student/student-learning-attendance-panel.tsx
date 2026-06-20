import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, MutedText, SectionTitle } from '../smoke/smoke-ui';
import {
  attendanceStatusVariant,
  formatAttendanceRate,
  formatLearningDate,
  type StudentAttendance,
} from './student-learning-utils';

interface StudentAttendancePanelProps {
  attendance: StudentAttendance | undefined;
  error: string | null;
  loading: boolean;
}

export function StudentAttendancePanel({
  attendance,
  error,
  loading,
}: StudentAttendancePanelProps) {
  if (error && !attendance) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Attendance summary</SectionTitle>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.rowBetween}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>Attendance summary</Text>
          <SectionTitle>
            {formatAttendanceRate(attendance?.summary.attendanceRate ?? null)}
          </SectionTitle>
        </View>
        <Badge variant="blue">{String(attendance?.summary.total ?? 0)} days</Badge>
      </View>
      <View style={styles.statGrid}>
        <AttendanceStat label="Present" value={String(attendance?.summary.present ?? 0)} />
        <AttendanceStat label="Late" value={String(attendance?.summary.late ?? 0)} />
        <AttendanceStat label="Absent" value={String(attendance?.summary.absent ?? 0)} />
      </View>
      {!attendance && !loading ? <MutedText>No attendance recorded</MutedText> : null}
      {attendance?.records.length === 0 ? (
        <MutedText>
          No attendance recorded. Attendance will appear here after the Learning Centre records it.
        </MutedText>
      ) : null}
      {(attendance?.records ?? []).slice(0, 4).map((record) => (
        <View key={record.id} style={styles.recordRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.rowTitle}>{formatLearningDate(record.date)}</Text>
            <MutedText>
              {record.status === 'Absent'
                ? (record.absenceReasonLabel ?? 'No absence reason recorded')
                : 'Recorded by the Learning Centre'}
            </MutedText>
          </View>
          <Badge variant={attendanceStatusVariant(record.status)}>{record.status}</Badge>
        </View>
      ))}
    </Card>
  );
}

function AttendanceStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  headingCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
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
  sectionCard: {
    gap: 12,
    padding: 16,
  },
  statCard: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 96,
    padding: 10,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
  statValue: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
});
