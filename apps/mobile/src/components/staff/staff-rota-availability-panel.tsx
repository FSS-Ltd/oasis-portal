import { StyleSheet } from 'react-native';
import { Card, ErrorText, Field, InlineSpinner, MutedText, MobileButton } from '../core/mobile-ui';
import {
  AvailabilitySectionHeader,
  MonthlyAvailabilityRow,
  removeAvailabilityWindow,
  replaceMonthlyAvailability,
  replaceWeeklyAvailability,
  WeeklyAvailabilityRow,
} from './staff-rota-availability-editor';
import {
  formatMonth,
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
        <AvailabilitySectionHeader
          description="Set repeat windows when you can be scheduled."
          onAdd={onAddWeekly}
          title="Weekly availability"
        />
        {weeklyLoading ? <InlineSpinner label="Loading weekly availability" /> : null}
        {weeklyError ? <ErrorText>{weeklyError}</ErrorText> : null}
        {weeklyDraft.length === 0 ? <MutedText>No weekly availability set.</MutedText> : null}
        {weeklyDraft.map((window) => (
          <WeeklyAvailabilityRow
            key={window.id}
            onChange={(next) => {
              onChangeWeekly(replaceWeeklyAvailability(weeklyDraft, next));
            }}
            onRemove={() => {
              onChangeWeekly(removeAvailabilityWindow(weeklyDraft, window.id));
            }}
            window={window}
          />
        ))}
        <MobileButton
          disabled={savingWeekly}
          label={savingWeekly ? 'Saving...' : 'Save weekly availability'}
          onPress={onSaveWeekly}
          variant="navy"
        />
      </Card>

      <Card style={styles.compactCard}>
        <AvailabilitySectionHeader
          description="Block dates or times when you cannot be scheduled."
          onAdd={onAddMonthly}
          title="Monthly unavailability"
        />
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
              onChangeMonthly(replaceMonthlyAvailability(monthlyDraft, next));
            }}
            onRemove={() => {
              onChangeMonthly(removeAvailabilityWindow(monthlyDraft, window.id));
            }}
            window={window}
          />
        ))}
        <MobileButton
          disabled={savingMonthly}
          label={savingMonthly ? 'Saving...' : 'Save monthly unavailability'}
          onPress={onSaveMonthly}
          variant="navy"
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    gap: 12,
    padding: 16,
  },
});
