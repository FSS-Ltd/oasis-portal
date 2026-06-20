import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ErrorText, Field, InlineSpinner, MutedText } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import { formatMonth, type RotaMode } from './staff-rota-utils';
import { ShiftRow, TabButton, type RotaShift } from './staff-rota-common';

export function RotaPanel({
  error,
  loading,
  mode,
  month,
  onChangeMode,
  onChangeMonth,
  shifts,
}: {
  error: string | undefined;
  loading: boolean;
  mode: RotaMode;
  month: string;
  onChangeMode: (mode: RotaMode) => void;
  onChangeMonth: (month: string) => void;
  shifts: readonly RotaShift[];
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
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
