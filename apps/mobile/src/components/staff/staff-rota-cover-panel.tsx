import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MobileButton, MutedText } from '../core/mobile-ui';
import { formatDate } from './staff-rota-utils';

function datesInWindow(from: string, to: string): string[] {
  const current = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const dates: string[] = [];
  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function StaffRotaCoverPanel({
  error,
  loading,
  onSave,
  onToggle,
  saving,
  selectedDates,
  slots,
}: {
  error: string | undefined;
  loading: boolean;
  onSave: () => void;
  onToggle: (date: string) => void;
  saving: boolean;
  selectedDates: ReadonlySet<string>;
  slots: { from: string; to: string } | undefined;
}) {
  const days = slots ? datesInWindow(slots.from, slots.to) : [];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Rolling two weeks</Text>
          <Text style={styles.title}>Lunch + Clubs cover</Text>
          <MutedText>Choose the days you can cover both lunch and clubs.</MutedText>
        </View>
        <Badge variant="neutral">{String(selectedDates.size)} selected</Badge>
      </View>

      {loading ? <InlineSpinner label="Loading cover days" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {days.length > 0 ? (
        <View style={styles.daysGrid}>
          {days.map((date) => {
            const selected = selectedDates.has(date);
            return (
              <Pressable
                accessibilityLabel={`${selected ? 'Remove' : 'Select'} ${formatDate(date)} for Lunch and Clubs cover`}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, selected }}
                disabled={saving}
                key={date}
                onPress={() => {
                  onToggle(date);
                }}
                style={[styles.day, selected ? styles.daySelected : null]}
              >
                <Text style={styles.dayDate}>{formatDate(date)}</Text>
                <Text style={[styles.dayStatus, selected ? styles.dayStatusSelected : null]}>
                  {selected ? 'Covering' : 'Available'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <MobileButton
        disabled={saving || loading}
        label={saving ? 'Saving cover days...' : 'Save cover days'}
        onPress={onSave}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 16,
  },
  day: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    minHeight: 66,
    padding: 10,
    width: '48.5%',
  },
  dayDate: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  daySelected: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  dayStatus: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  dayStatusSelected: {
    color: C.success,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  title: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
  },
});
