import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, StatCard } from '../core/mobile-ui';
import {
  formatClubDateTime,
  formatYearGroup,
  type StaffClubBehaviourEntry,
  type StaffClubNotification,
  type StaffClubRosterRow,
  type StaffLeadClub,
} from './staff-club-lead-utils';

export function StaffClubLeadOverview({
  club,
  entries,
  notifications,
  roster,
}: {
  club: StaffLeadClub;
  entries: StaffClubBehaviourEntry[];
  notifications: StaffClubNotification[];
  roster: StaffClubRosterRow[];
}) {
  const latestNotice = notifications[0] ?? null;

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Club lead operations</Text>
        <Text style={styles.title}>{club.name}</Text>
        <MutedText>{club.scheduleLabel ?? 'Schedule not set'}</MutedText>
        {club.description ? <Text style={styles.description}>{club.description}</Text> : null}
      </Card>

      <View style={styles.metricGrid}>
        <StatCard accent={C.success} label="Members" value={String(roster.length)} />
        <StatCard
          accent={C.blue}
          label="Capacity"
          value={club.capacity ? String(club.capacity) : 'Open'}
        />
        <StatCard accent={C.crimson} label="Entries" value={String(entries.length)} />
        <StatCard accent={C.warning} label="Notices" value={String(notifications.length)} />
      </View>

      <Card style={styles.card}>
        <View style={styles.rowHeader}>
          <Text style={styles.cardTitle}>Roster preview</Text>
          <Badge variant="success">{String(roster.length)}</Badge>
        </View>
        {roster.length === 0 ? <MutedText>No roster available for this club yet.</MutedText> : null}
        {roster.slice(0, 5).map((student) => (
          <View key={student.studentId} style={styles.studentRow}>
            <View style={styles.rowBody}>
              <Text style={styles.studentName}>{student.studentName}</Text>
              <MutedText>{formatYearGroup(student.yearGroup)}</MutedText>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <View style={styles.rowHeader}>
          <Text style={styles.cardTitle}>Latest notice</Text>
          <Badge variant="blue">{latestNotice ? 'Live' : 'None'}</Badge>
        </View>
        {latestNotice ? (
          <View style={styles.noticeRow}>
            <Text style={styles.studentName}>{latestNotice.title}</Text>
            <MutedText>
              {formatClubDateTime(latestNotice.sentAt)} by {latestNotice.sentByName}
            </MutedText>
          </View>
        ) : (
          <MutedText>No notices have been posted for this club.</MutedText>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  description: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  eyebrow: {
    color: C.success,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    borderTopColor: C.success,
    borderTopWidth: 4,
    gap: 6,
    padding: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noticeRow: {
    gap: 3,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stack: {
    gap: 12,
  },
  studentName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  studentRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  title: {
    color: C.navy,
    fontSize: 24,
    fontWeight: '900',
  },
});
