import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, MutedText } from '../core/mobile-ui';

export type PaceRosterStudent = RouterOutputs['pace']['roster']['students'][number];

export function StaffPaceStudentPicker({
  error,
  loading,
  onSelect,
  rows,
  selectedStudentId,
}: {
  error: string | null;
  loading: boolean;
  onSelect: (studentId: string) => void;
  rows: PaceRosterStudent[];
  selectedStudentId: string;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Student</Text>
        <Text style={styles.countLabel}>{String(rows.length)} available</Text>
      </View>
      {loading ? <MutedText>Loading PACE roster...</MutedText> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && rows.length === 0 ? (
        <MutedText>No students are available for your current PACE scope.</MutedText>
      ) : null}
      <View style={styles.studentList}>
        {rows.map((row) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedStudentId === row.studentId }}
            key={row.studentId}
            onPress={() => {
              onSelect(row.studentId);
            }}
            style={[
              styles.studentRow,
              selectedStudentId === row.studentId ? styles.studentRowActive : null,
            ]}
          >
            <View
              style={[
                styles.avatar,
                row.band?.colour ? { backgroundColor: row.band.colour } : null,
              ]}
            >
              <Text style={styles.avatarText}>{row.studentName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.studentName}>{row.studentName}</Text>
              <Text style={styles.yearGroup}>{row.band?.name ?? 'Age band not set'}</Text>
            </View>
          </Pressable>
        ))}
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
    color: C.surface,
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
