import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';
import { formatClubDate, formatTime, type StaffClubRotaShift } from './staff-club-manager-utils';

export function StaffClubManagerRota({
  error,
  formattedWeek,
  loading,
  onChangeWeek,
  shifts,
}: {
  error: string | null;
  formattedWeek: string;
  loading: boolean;
  onChangeWeek: (direction: 'next' | 'previous' | 'today') => void;
  shifts: StaffClubRotaShift[];
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.rowBody}>
          <Text style={styles.cardTitle}>Rota inspection</Text>
          <MutedText>{formattedWeek}</MutedText>
        </View>
        <Badge variant="blue">{String(shifts.length)}</Badge>
      </View>
      <View style={styles.weekActions}>
        <WeekButton
          label="Prev"
          onPress={() => {
            onChangeWeek('previous');
          }}
        />
        <WeekButton
          label="This week"
          onPress={() => {
            onChangeWeek('today');
          }}
        />
        <WeekButton
          label="Next"
          onPress={() => {
            onChangeWeek('next');
          }}
        />
      </View>
      {loading ? <MutedText>Loading rota...</MutedText> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && shifts.length === 0 ? (
        <MutedText>No rota shifts are scheduled for this club week.</MutedText>
      ) : null}
      {shifts.map((shift) => (
        <View key={shift.id} style={styles.shiftRow}>
          <View style={styles.shiftDot} />
          <View style={styles.rowBody}>
            <Text style={styles.shiftTitle}>{formatClubDate(shift.date)}</Text>
            <MutedText>
              {formatTime(shift.startsAt)}-{formatTime(shift.endsAt)}
              {shift.participant ? ` · ${shift.participant.fullName}` : ''}
            </MutedText>
            {shift.notes ? <Text style={styles.note}>{shift.notes}</Text> : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

function WeekButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.weekButton}>
      <Text style={styles.weekButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    gap: 10,
    justifyContent: 'space-between',
  },
  note: {
    color: C.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  shiftDot: {
    backgroundColor: C.blue,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  shiftRow: {
    alignItems: 'flex-start',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  shiftTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  weekActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 9,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  weekButtonText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
  },
});
