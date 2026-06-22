import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';
import { formatYearGroup, type StaffClubRosterRow } from './staff-club-manager-utils';

export function StaffClubManagerRoster({
  error,
  loading,
  roster,
}: {
  error: string | null;
  loading: boolean;
  roster: StaffClubRosterRow[];
}) {
  return (
    <View style={styles.stack}>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Roster</Text>
          <Badge variant="blue">{String(roster.length)}</Badge>
        </View>
        {loading ? <MutedText>Loading roster...</MutedText> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && roster.length === 0 ? (
          <MutedText>No students are signed up for this club.</MutedText>
        ) : null}
        {roster.map((row) => (
          <View key={row.studentId} style={styles.rosterRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{row.studentName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.studentName}>{row.studentName}</Text>
              <MutedText>{formatYearGroup(row.yearGroup)}</MutedText>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  card: {
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
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
  rosterRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  stack: {
    gap: 10,
  },
  studentName: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
});
