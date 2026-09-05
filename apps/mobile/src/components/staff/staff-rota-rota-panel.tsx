import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ErrorText, Field, InlineSpinner, MutedText } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import { formatDate, formatMonth, type RotaMode } from './staff-rota-utils';
import {
  parentVolunteerPlacementLabel,
  ShiftRow,
  TabButton,
  type CombinedRotaShift,
  type ParentVolunteer,
} from './staff-rota-common';

export function RotaPanel({
  error,
  loading,
  mode,
  month,
  onChangeMode,
  onChangeMonth,
  parentVolunteerError,
  parentVolunteerLoading,
  parentVolunteers,
  shifts,
}: {
  error: string | undefined;
  loading: boolean;
  mode: RotaMode;
  month: string;
  onChangeMode: (mode: RotaMode) => void;
  onChangeMonth: (month: string) => void;
  parentVolunteerError: string | undefined;
  parentVolunteerLoading: boolean;
  parentVolunteers: readonly ParentVolunteer[];
  shifts: readonly CombinedRotaShift[];
}) {
  return (
    <>
      <View style={styles.modeRow}>
        {(['today', 'week', 'month'] as const).map((item) => (
          <TabButton
            active={mode === item}
            key={item}
            label={item === 'today' ? 'Today' : item === 'week' ? 'Week' : 'Month'}
            onPress={() => {
              onChangeMode(item);
            }}
          />
        ))}
      </View>
      {mode === 'month' ? (
        <Field label="Month" onChangeText={onChangeMonth} placeholder="YYYY-MM" value={month} />
      ) : null}
      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <View style={styles.rowBody}>
            <Text style={styles.cardTitle}>
              {mode === 'month' ? formatMonth(month) : mode === 'week' ? 'This week' : 'Today'}
            </Text>
            <MutedText>{String(shifts.length)} scheduled shifts</MutedText>
          </View>
          <Badge variant={shifts.length > 0 ? 'blue' : 'neutral'}>{String(shifts.length)}</Badge>
        </View>
        {loading ? <InlineSpinner label="Loading rota" /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {!loading && !error && shifts.length === 0 ? (
          <MutedText>No shifts are scheduled for this view.</MutedText>
        ) : null}
        {shifts.map((shift) => (
          <ShiftRow key={shift.id} shift={shift} />
        ))}
        <View style={styles.parentVolunteerSection}>
          <Text style={styles.parentVolunteerTitle}>Parent volunteers</Text>
          {parentVolunteerLoading ? <InlineSpinner label="Loading parent volunteers" /> : null}
          {parentVolunteerError ? <ErrorText>{parentVolunteerError}</ErrorText> : null}
          {!parentVolunteerLoading && !parentVolunteerError && parentVolunteers.length === 0 ? (
            <MutedText>No parent volunteers selected for this view.</MutedText>
          ) : null}
          {parentVolunteers.map((volunteer) => (
            <View key={volunteer.id} style={styles.parentVolunteerRow}>
              <Text style={styles.parentVolunteerName}>{volunteer.parent.fullName}</Text>
              <MutedText>
                {formatDate(volunteer.date)} · {parentVolunteerPlacementLabel(volunteer.placement)}
              </MutedText>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  compactCard: {
    gap: 12,
    padding: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  parentVolunteerName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  parentVolunteerRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 2,
    paddingTop: 10,
  },
  parentVolunteerSection: {
    borderTopColor: C.border,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  parentVolunteerTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
