import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, MutedText } from '../core/mobile-ui';

export type IncidentStudentRow = Pick<
  RouterOutputs['attendance']['forDate'][number],
  'studentId' | 'studentName' | 'yearGroup'
>;

export function StaffIncidentStudentPicker({
  error,
  loading,
  onToggle,
  rows,
  selectedStudentIds,
}: {
  error: string | null;
  loading: boolean;
  onToggle: (studentId: string) => void;
  rows: IncidentStudentRow[];
  selectedStudentIds: string[];
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Children involved</Text>
        <Text style={styles.countLabel}>{String(selectedStudentIds.length)} selected</Text>
      </View>
      {loading ? <MutedText>Loading scoped students...</MutedText> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && rows.length === 0 ? (
        <MutedText>No students are available for your current scope.</MutedText>
      ) : null}
      <View style={styles.studentList}>
        {rows.map((row) => {
          const selected = selectedStudentIds.includes(row.studentId);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={row.studentId}
              onPress={() => {
                onToggle(row.studentId);
              }}
              style={[styles.studentRow, selected ? styles.studentRowActive : null]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{row.studentName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.studentName}>{row.studentName}</Text>
                <Text style={styles.yearGroup}>{row.yearGroup}</Text>
              </View>
              <Text style={[styles.stateText, selected ? styles.stateTextActive : null]}>
                {selected ? 'Added' : 'Add'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  avatarText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  card: {
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  countLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
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
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  stateText: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '900',
  },
  stateTextActive: {
    color: C.success,
  },
  studentList: {
    gap: 8,
  },
  studentName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  studentRow: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  studentRowActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  yearGroup: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});
