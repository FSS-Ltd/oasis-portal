import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Field, MobileButton, MutedText } from '../core/mobile-ui';
import {
  availabilityLabel,
  firstDateForMonth,
  fromTimeValue,
  monthlyAvailabilityLabel,
  toTimeValue,
  weekdays,
  type AvailabilityDraft,
  type MonthlyAvailabilityDraft,
} from './staff-rota-utils';

const ALL_DAY_START_MINUTE = 0;
const ALL_DAY_END_MINUTE = 1440;
const DEFAULT_TIMED_START_MINUTE = 540;
const DEFAULT_TIMED_END_MINUTE = 1020;

export function AvailabilitySectionHeader({
  description,
  onAdd,
  title,
}: {
  description: string;
  onAdd: () => void;
  title: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.rowBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <MutedText>{description}</MutedText>
      </View>
      <MobileButton compact label="Add" onPress={onAdd} variant="blue" />
    </View>
  );
}

export function replaceWeeklyAvailability(
  rows: readonly AvailabilityDraft[],
  next: AvailabilityDraft,
): AvailabilityDraft[] {
  return rows.map((row) => (row.id === next.id ? next : row));
}

export function replaceMonthlyAvailability(
  rows: readonly MonthlyAvailabilityDraft[],
  next: MonthlyAvailabilityDraft,
): MonthlyAvailabilityDraft[] {
  return rows.map((row) => (row.id === next.id ? next : row));
}

export function removeAvailabilityWindow<T extends { id: string }>(
  rows: readonly T[],
  id: string,
): T[] {
  return rows.filter((row) => row.id !== id);
}

export function WeeklyAvailabilityRow({
  onChange,
  onRemove,
  window,
}: {
  onChange: (window: AvailabilityDraft) => void;
  onRemove: () => void;
  window: AvailabilityDraft;
}) {
  return (
    <View style={styles.editorRow}>
      <Text style={styles.editorTitle}>{availabilityLabel(window)}</Text>
      <View style={styles.weekdayRow}>
        {weekdays.map((day) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: window.dayOfWeek === day.value }}
            key={day.value}
            onPress={() => {
              onChange({ ...window, dayOfWeek: day.value });
            }}
            style={[
              styles.dayButton,
              window.dayOfWeek === day.value ? styles.dayButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.dayButtonText,
                window.dayOfWeek === day.value ? styles.dayButtonTextActive : null,
              ]}
            >
              {day.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inlineFields}>
        <Field
          label="Start"
          onChangeText={(value) => {
            onChange({ ...window, startMinute: fromTimeValue(value) });
          }}
          value={toTimeValue(window.startMinute)}
        />
        <Field
          label="End"
          onChangeText={(value) => {
            onChange({ ...window, endMinute: fromTimeValue(value) });
          }}
          value={toTimeValue(window.endMinute)}
        />
      </View>
      <MobileButton compact label="Remove" onPress={onRemove} variant="danger" />
    </View>
  );
}

export function MonthlyAvailabilityRow({
  month,
  onChange,
  onRemove,
  window,
}: {
  month: string;
  onChange: (window: MonthlyAvailabilityDraft) => void;
  onRemove: () => void;
  window: MonthlyAvailabilityDraft;
}) {
  const allDay =
    window.startMinute === ALL_DAY_START_MINUTE && window.endMinute === ALL_DAY_END_MINUTE;
  return (
    <View style={styles.editorRow}>
      <Text style={styles.editorTitle}>{monthlyAvailabilityLabel(window)}</Text>
      <Field
        label="Date"
        onChangeText={(value) => {
          onChange({ ...window, date: value || firstDateForMonth(month) });
        }}
        value={window.date}
      />
      <MobileButton
        compact
        label={allDay ? 'Set times' : 'All day'}
        onPress={() => {
          onChange(
            allDay
              ? {
                  ...window,
                  endMinute: DEFAULT_TIMED_END_MINUTE,
                  startMinute: DEFAULT_TIMED_START_MINUTE,
                }
              : { ...window, endMinute: ALL_DAY_END_MINUTE, startMinute: ALL_DAY_START_MINUTE },
          );
        }}
        variant={allDay ? 'success' : 'secondary'}
      />
      {!allDay ? (
        <View style={styles.inlineFields}>
          <Field
            label="Start"
            onChangeText={(value) => {
              onChange({ ...window, startMinute: fromTimeValue(value) });
            }}
            value={toTimeValue(window.startMinute)}
          />
          <Field
            label="End"
            onChangeText={(value) => {
              onChange({ ...window, endMinute: fromTimeValue(value) });
            }}
            value={toTimeValue(window.endMinute)}
          />
        </View>
      ) : null}
      <MobileButton compact label="Remove" onPress={onRemove} variant="danger" />
    </View>
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
  dayButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 40,
  },
  dayButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  dayButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  dayButtonTextActive: {
    color: C.surface,
  },
  editorRow: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  editorTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
