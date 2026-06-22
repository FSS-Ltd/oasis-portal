import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';
import {
  attendanceCounts,
  clubAttendanceStatuses,
  formatYearGroup,
  type StaffClubAttendanceRow,
  type StaffClubAttendanceStatus,
} from './staff-club-lead-utils';

export function StaffClubLeadAttendance({
  error,
  formattedDate,
  loading,
  onChangeDate,
  onMark,
  pendingStudentId,
  rows,
}: {
  error: string | null;
  formattedDate: string;
  loading: boolean;
  onChangeDate: (direction: 'next' | 'previous' | 'today') => void;
  onMark: (row: StaffClubAttendanceRow, status: StaffClubAttendanceStatus) => void;
  pendingStudentId: string | null;
  rows: StaffClubAttendanceRow[];
}) {
  const counts = attendanceCounts(rows);

  return (
    <View style={styles.stack}>
      <Card style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Club attendance</Text>
        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>Session date: {formattedDate}</Text>
          <View style={styles.dateActions}>
            <DateButton
              label="Prev"
              onPress={() => {
                onChangeDate('previous');
              }}
            />
            <DateButton
              label="Today"
              onPress={() => {
                onChangeDate('today');
              }}
            />
            <DateButton
              label="Next"
              onPress={() => {
                onChangeDate('next');
              }}
            />
          </View>
        </View>
        <View style={styles.countGrid}>
          <CountCell label="Present" tone="success" value={counts.present} />
          <CountCell label="Late" tone="warning" value={counts.late} />
          <CountCell label="Absent" tone="danger" value={counts.absent} />
          <CountCell label="Unmarked" tone="neutral" value={counts.unmarked} />
        </View>
        {loading ? <MutedText>Loading attendance...</MutedText> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Card>

      {!loading && rows.length === 0 ? (
        <Card style={styles.summaryCard}>
          <Text style={styles.cardTitle}>No roster available</Text>
          <MutedText>No signed-up students are available for this club session.</MutedText>
        </Card>
      ) : null}

      {rows.map((row) => {
        const pending = pendingStudentId === row.studentId;
        return (
          <Card key={row.studentId} style={styles.rowCard}>
            <View style={styles.rowHeader}>
              <View style={styles.rowBody}>
                <Text style={styles.studentName}>{row.studentName}</Text>
                <MutedText>{formatYearGroup(row.yearGroup)}</MutedText>
              </View>
              <Badge variant={statusVariant(row.status)}>{row.status ?? 'Unmarked'}</Badge>
            </View>
            <View style={styles.statusRow}>
              {clubAttendanceStatuses.map((status) => (
                <StatusButton
                  active={row.status === status}
                  disabled={pending}
                  key={status}
                  label={status}
                  onPress={() => {
                    onMark(row, status);
                  }}
                  status={status}
                />
              ))}
            </View>
            {pending ? <Text style={styles.savingText}>Saving attendance...</Text> : null}
          </Card>
        );
      })}
    </View>
  );
}

function statusVariant(
  status: StaffClubAttendanceRow['status'],
): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'Absent') return 'danger';
  if (status === 'Late') return 'warning';
  if (status === 'Present') return 'success';
  return 'neutral';
}

function CountCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
  value: number;
}) {
  const palette = {
    danger: { backgroundColor: C.dangerBg, color: C.danger },
    neutral: { backgroundColor: C.bg, color: C.textSecondary },
    success: { backgroundColor: C.successBg, color: C.success },
    warning: { backgroundColor: C.warningBg, color: C.warning },
  }[tone];

  return (
    <View style={[styles.countCell, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.countValue, { color: palette.color }]}>{String(value)}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function StatusButton({
  active,
  disabled,
  label,
  onPress,
  status,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  status: StaffClubAttendanceStatus;
}) {
  const palette = {
    Absent: { backgroundColor: C.dangerBg, borderColor: C.dangerMid, color: C.danger },
    Late: { backgroundColor: C.warningBg, borderColor: C.warningBg, color: C.warning },
    Present: { backgroundColor: C.successBg, borderColor: C.successMid, color: C.success },
  }[status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.statusButton,
        active
          ? { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }
          : styles.statusButtonInactive,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.statusButtonText, active ? { color: palette.color } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DateButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}>
      <Text style={styles.dateButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  countCell: {
    borderRadius: 10,
    flex: 1,
    minWidth: 120,
    padding: 10,
  },
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  countValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  dateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 9,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dateButtonText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  dateCard: {
    gap: 8,
  },
  dateLabel: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowCard: {
    gap: 12,
    padding: 16,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  savingText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  stack: {
    gap: 10,
  },
  statusButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statusButtonInactive: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  statusButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentName: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  summaryCard: {
    gap: 10,
    padding: 16,
  },
});
