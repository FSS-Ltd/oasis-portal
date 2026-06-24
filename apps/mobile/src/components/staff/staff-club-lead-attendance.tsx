import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, MutedText } from '../core/mobile-ui';
import {
  AttendanceRosterRow,
  AttendanceSummaryCard,
} from './staff-club-lead-attendance-components';
import {
  attendanceCounts,
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
      <AttendanceSummaryCard
        counts={counts}
        error={error}
        formattedDate={formattedDate}
        loading={loading}
        onChangeDate={onChangeDate}
      />

      {!loading && rows.length === 0 ? (
        <Card style={styles.summaryCard}>
          <Text style={styles.cardTitle}>No roster available</Text>
          <MutedText>No signed-up students are available for this club session.</MutedText>
        </Card>
      ) : null}

      {rows.map((row) => (
        <AttendanceRosterRow
          key={row.studentId}
          onMark={onMark}
          pending={pendingStudentId === row.studentId}
          row={row}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  stack: {
    gap: 10,
  },
  summaryCard: {
    gap: 10,
    padding: 16,
  },
});
