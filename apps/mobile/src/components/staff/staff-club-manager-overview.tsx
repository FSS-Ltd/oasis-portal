import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';
import {
  capacityLabel,
  leadLabel,
  type StaffClubAttendanceRow,
  type StaffClubNotification,
  type StaffClubRotaShift,
  type StaffClubRosterRow,
  type StaffManagedClub,
} from './staff-club-manager-utils';

export function StaffClubManagerOverview({
  attendanceRows,
  club,
  clubs,
  notifications,
  roster,
  shifts,
}: {
  attendanceRows: StaffClubAttendanceRow[];
  club: StaffManagedClub;
  clubs: StaffManagedClub[];
  notifications: StaffClubNotification[];
  roster: StaffClubRosterRow[];
  shifts: StaffClubRotaShift[];
}) {
  const activeClubs = clubs.filter((item) => item.active).length;
  const totalMembers = clubs.reduce((total, item) => total + item.activeSignupCount, 0);
  const clubsAwaitingLead = clubs.filter((item) => item.active && item.assignedLeads.length === 0);
  const markedAttendance = attendanceRows.filter((row) => row.status !== null).length;

  return (
    <View style={styles.stack}>
      <View style={styles.grid}>
        <StatCell label="Active clubs" tone="navy" value={activeClubs} />
        <StatCell label="Members" tone="blue" value={totalMembers} />
        <StatCell label="Awaiting lead" tone="warning" value={clubsAwaitingLead.length} />
        <StatCell label="Week shifts" tone="success" value={shifts.length} />
      </View>

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.cardTitle}>{club.name}</Text>
            <MutedText>{club.scheduleLabel ?? 'No schedule set'}</MutedText>
          </View>
          <Badge variant={club.active ? 'success' : 'neutral'}>
            {club.active ? 'Active' : 'Off'}
          </Badge>
        </View>
        <View style={styles.detailGrid}>
          <DetailItem label="Capacity" value={capacityLabel(club)} />
          <DetailItem label="Lead" value={leadLabel(club)} />
          <DetailItem label="Roster" value={`${String(roster.length)} signed up`} />
          <DetailItem
            label="Attendance"
            value={`${String(markedAttendance)}/${String(attendanceRows.length)} marked`}
          />
        </View>
        {notifications[0] ? (
          <View style={styles.noticePreview}>
            <Text style={styles.noticeTitle}>{notifications[0].title}</Text>
            <MutedText>Latest notice</MutedText>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function StatCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'blue' | 'navy' | 'success' | 'warning';
  value: number;
}) {
  const color = {
    blue: C.blue,
    navy: C.navy,
    success: C.success,
    warning: C.warning,
  }[tone];

  return (
    <View style={[styles.statCell, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{String(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    minWidth: 128,
    padding: 10,
  },
  detailLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  noticePreview: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 2,
    paddingTop: 10,
  },
  noticeTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  stack: {
    gap: 10,
  },
  statCell: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderTopWidth: 4,
    borderWidth: 1,
    flex: 1,
    minWidth: 132,
    padding: 12,
  },
  statLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  statValue: {
    fontSize: 23,
    fontWeight: '900',
  },
  titleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
