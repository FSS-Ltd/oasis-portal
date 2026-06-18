import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Card } from '../smoke/smoke-ui';
import { type AttendanceCounts } from './staff-attendance-utils';

export function AttendanceSummaryCard({ counts }: { counts: AttendanceCounts }) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>Register progress</Text>
          <Text style={styles.value}>
            {String(counts.marked)}/{String(counts.total)} marked
          </Text>
        </View>
        <View
          style={[
            styles.unmarkedBadge,
            counts.unmarked === 0 ? styles.completeBadge : styles.pendingBadge,
          ]}
        >
          <Text style={counts.unmarked === 0 ? styles.completeText : styles.pendingText}>
            {counts.unmarked === 0 ? 'Complete' : `${String(counts.unmarked)} open`}
          </Text>
        </View>
      </View>
      <View style={styles.grid}>
        <SummaryCell label="Present" tone="success" value={counts.present} />
        <SummaryCell label="Late" tone="warning" value={counts.late} />
        <SummaryCell label="Absent" tone="danger" value={counts.absent} />
      </View>
    </Card>
  );
}

function SummaryCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'danger' | 'success' | 'warning';
  value: number;
}) {
  const palette = {
    danger: { backgroundColor: C.dangerBg, color: C.danger },
    success: { backgroundColor: C.successBg, color: C.success },
    warning: { backgroundColor: C.warningBg, color: C.warning },
  }[tone];

  return (
    <View style={[styles.cell, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.cellValue, { color: palette.color }]}>{String(value)}</Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  cell: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  cellLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cellValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  completeBadge: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  completeText: {
    color: C.success,
    fontSize: 11,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: C.warningBg,
    borderColor: C.warningBg,
  },
  pendingText: {
    color: C.warning,
    fontSize: 11,
    fontWeight: '900',
  },
  unmarkedBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  value: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
});
