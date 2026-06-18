import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, ErrorText, Field, InlineSpinner, MutedText, SmokeButton } from '../smoke/smoke-ui';
import { C } from '../smoke/mobile-theme';
import {
  availabilityLabel,
  firstDateForMonth,
  formatMonth,
  fromTimeValue,
  monthlyAvailabilityLabel,
  toTimeValue,
  weekdays,
  type AvailabilityDraft,
  type MonthlyAvailabilityDraft,
} from './staff-rota-utils';

export function AvailabilityPanel({
  monthlyDraft,
  monthlyError,
  monthlyLoading,
  month,
  onAddMonthly,
  onAddWeekly,
  onChangeMonthly,
  onChangeMonth,
  onChangeWeekly,
  onSaveMonthly,
  onSaveWeekly,
  savingMonthly,
  savingWeekly,
  weeklyDraft,
  weeklyError,
  weeklyLoading,
}: {
  monthlyDraft: readonly MonthlyAvailabilityDraft[];
  monthlyError: string | undefined;
  monthlyLoading: boolean;
  month: string;
  onAddMonthly: () => void;
  onAddWeekly: () => void;
  onChangeMonthly: (rows: MonthlyAvailabilityDraft[]) => void;
  onChangeMonth: (month: string) => void;
  onChangeWeekly: (rows: AvailabilityDraft[]) => void;
  onSaveMonthly: () => void;
  onSaveWeekly: () => void;
  savingMonthly: boolean;
  savingWeekly: boolean;
  weeklyDraft: readonly AvailabilityDraft[];
  weeklyError: string | undefined;
  weeklyLoading: boolean;
}) {
  return (
    <>
      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <View style={styles.rowBody}>
            <Text style={styles.cardTitle}>Weekly availability</Text>
            <MutedText>Set repeat windows when you can be scheduled.</MutedText>
          </View>
          <SmokeButton compact label="Add" onPress={onAddWeekly} variant="blue" />
        </View>
        {weeklyLoading ? <InlineSpinner label="Loading weekly availability" /> : null}
        {weeklyError ? <ErrorText>{weeklyError}</ErrorText> : null}
        {weeklyDraft.length === 0 ? <MutedText>No weekly availability set.</MutedText> : null}
        {weeklyDraft.map((window) => (
          <WeeklyAvailabilityRow
            key={window.id}
            onChange={(next) => {
              onChangeWeekly(weeklyDraft.map((row) => (row.id === next.id ? next : row)));
            }}
            onRemove={() => {
              onChangeWeekly(weeklyDraft.filter((row) => row.id !== window.id));
            }}
            window={window}
          />
        ))}
        <SmokeButton
          disabled={savingWeekly}
          label={savingWeekly ? 'Saving...' : 'Save weekly availability'}
          onPress={onSaveWeekly}
          variant="navy"
        />
      </Card>

      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <View style={styles.rowBody}>
            <Text style={styles.cardTitle}>Monthly unavailability</Text>
            <MutedText>Block dates or times when you cannot be scheduled.</MutedText>
          </View>
          <SmokeButton compact label="Add" onPress={onAddMonthly} variant="blue" />
        </View>
        <Field label="Month" onChangeText={onChangeMonth} placeholder="YYYY-MM" value={month} />
        {monthlyLoading ? <InlineSpinner label="Loading monthly unavailability" /> : null}
        {monthlyError ? <ErrorText>{monthlyError}</ErrorText> : null}
        {monthlyDraft.length === 0 ? (
          <MutedText>No monthly unavailability set for {formatMonth(month)}.</MutedText>
        ) : null}
        {monthlyDraft.map((window) => (
          <MonthlyAvailabilityRow
            key={window.id}
            month={month}
            onChange={(next) => {
              onChangeMonthly(monthlyDraft.map((row) => (row.id === next.id ? next : row)));
            }}
            onRemove={() => {
              onChangeMonthly(monthlyDraft.filter((row) => row.id !== window.id));
            }}
            window={window}
          />
        ))}
        <SmokeButton
          disabled={savingMonthly}
          label={savingMonthly ? 'Saving...' : 'Save monthly unavailability'}
          onPress={onSaveMonthly}
          variant="navy"
        />
      </Card>
    </>
  );
}

function WeeklyAvailabilityRow({
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
      <SmokeButton compact label="Remove" onPress={onRemove} variant="danger" />
    </View>
  );
}

function MonthlyAvailabilityRow({
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
  const allDay = window.startMinute === 0 && window.endMinute === 1440;
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
      <SmokeButton
        compact
        label={allDay ? 'Set times' : 'All day'}
        onPress={() => {
          onChange(
            allDay
              ? { ...window, endMinute: 1020, startMinute: 540 }
              : { ...window, endMinute: 1440, startMinute: 0 },
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
      <SmokeButton compact label="Remove" onPress={onRemove} variant="danger" />
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
  compactCard: {
    gap: 12,
    padding: 16,
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
