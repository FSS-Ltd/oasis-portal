import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';
import {
  formatMerits,
  parsePositiveMeritAmount,
  weeklyDayOptions,
  type TitheCadence,
  type TithePaymentMode,
  type TithePreferenceInput,
  type TitheStatus,
} from './student-wallet-utils';

interface StudentWalletTithePanelProps {
  error: string | null;
  loading: boolean;
  onPayDue: () => void;
  onSavePreference: (input: TithePreferenceInput) => void;
  payError: string | null;
  payPending: boolean;
  payStatus: string | null;
  saveError: string | null;
  savePending: boolean;
  saveStatus: string | null;
  status: TitheStatus | undefined;
}

export function StudentWalletTithePanel({
  error,
  loading,
  onPayDue,
  onSavePreference,
  payError,
  payPending,
  payStatus,
  saveError,
  savePending,
  saveStatus,
  status,
}: StudentWalletTithePanelProps) {
  if (loading && !status) {
    return (
      <Card style={styles.card}>
        <InlineSpinner label="Loading tithe status" />
      </Card>
    );
  }

  if (error && !status) {
    return (
      <Card style={styles.card}>
        <SectionTitle>Tithe unavailable</SectionTitle>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card style={styles.card}>
        <SectionTitle>Tithe unavailable</SectionTitle>
        <MutedText>No tithe status was returned for this wallet.</MutedText>
      </Card>
    );
  }

  return (
    <LoadedTithePanel
      onPayDue={onPayDue}
      onSavePreference={onSavePreference}
      payError={payError}
      payPending={payPending}
      payStatus={payStatus}
      saveError={saveError}
      savePending={savePending}
      saveStatus={saveStatus}
      status={status}
    />
  );
}

function LoadedTithePanel({
  onPayDue,
  onSavePreference,
  payError,
  payPending,
  payStatus,
  saveError,
  savePending,
  saveStatus,
  status,
}: Omit<StudentWalletTithePanelProps, 'error' | 'loading' | 'status'> & {
  status: TitheStatus;
}) {
  const [cadence, setCadence] = useState<TitheCadence>(status.config.cadence);
  const [mode, setMode] = useState<TithePaymentMode>(status.config.mode);
  const [percentage, setPercentage] = useState(String(status.config.percentage));
  const [fixedAmount, setFixedAmount] = useState(String(status.config.fixedAmount ?? ''));
  const [weeklyDay, setWeeklyDay] = useState(String(status.config.weeklyDay));
  const [monthlyDate, setMonthlyDate] = useState(String(status.config.monthlyDate));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setCadence(status.config.cadence);
    setMode(status.config.mode);
    setPercentage(String(status.config.percentage));
    setFixedAmount(String(status.config.fixedAmount ?? ''));
    setWeeklyDay(String(status.config.weeklyDay));
    setMonthlyDate(String(status.config.monthlyDate));
    setLocalError(null);
  }, [status.config]);

  const selectedWeeklyDayLabel = useMemo(() => {
    return (
      weeklyDayOptions.find((option) => String(option.value) === weeklyDay)?.label ?? 'Select day'
    );
  }, [weeklyDay]);

  function savePreference() {
    const parsedWeeklyDay = Number(weeklyDay);
    const parsedMonthlyDate = Number(monthlyDate);
    const input: TithePreferenceInput = {
      cadence,
      mode,
      weeklyDay: parsedWeeklyDay,
      monthlyDate: parsedMonthlyDate,
    };

    if (!Number.isInteger(parsedWeeklyDay) || parsedWeeklyDay < 0 || parsedWeeklyDay > 6) {
      setLocalError('Choose a valid weekly tithe day.');
      return;
    }
    if (!Number.isInteger(parsedMonthlyDate) || parsedMonthlyDate < 1 || parsedMonthlyDate > 31) {
      setLocalError('Monthly tithe date must be between 1 and 31.');
      return;
    }

    if (mode === 'Percentage') {
      const parsedPercentage = Number(percentage);
      if (!Number.isInteger(parsedPercentage) || parsedPercentage < 10 || parsedPercentage > 100) {
        setLocalError('Percentage must be a whole number from 10 to 100.');
        return;
      }
      input.percentage = parsedPercentage;
    } else {
      const parsedFixedAmount = parsePositiveMeritAmount(fixedAmount);
      if (parsedFixedAmount === null) {
        setLocalError('Fixed amount must be a positive whole number of merits.');
        return;
      }
      input.fixedAmount = parsedFixedAmount;
    }

    setLocalError(null);
    onSavePreference(input);
  }

  const visibleError = localError ?? saveError ?? payError;

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Tithe</Text>
          <SectionTitle>Manual tithe</SectionTitle>
        </View>
        {status.shopBlocked ? <Badge variant="warning">Tithe due</Badge> : null}
        {!status.shopBlocked ? <Badge variant="success">Up to date</Badge> : null}
      </View>

      <View style={status.shopBlocked ? styles.titheStatusDue : styles.titheStatus}>
        <Text style={styles.statusTitle}>
          {status.paid || !status.shopBlocked ? 'Up to date' : 'Tithe due'}
        </Text>
        <Text style={styles.statusText}>
          Earned {formatMerits(status.grossMerits)} this period. Minimum tithe:{' '}
          {formatMerits(status.minimumAmount)}.
        </Text>
      </View>

      <View style={styles.formGrid}>
        <OptionGroup
          label="Cadence"
          options={[
            { label: 'Weekly', value: 'Weekly' },
            { label: 'Monthly', value: 'Monthly' },
          ]}
          selectedValue={cadence}
          onSelect={(value) => {
            setCadence(value);
            setLocalError(null);
          }}
        />
        <OptionGroup
          label="Type"
          options={[
            { label: 'Percentage', value: 'Percentage' },
            { label: 'Amount', value: 'FixedAmount' },
          ]}
          selectedValue={mode}
          onSelect={(value) => {
            setMode(value);
            setLocalError(null);
          }}
        />
        {mode === 'Percentage' ? (
          <Field
            keyboardType="numeric"
            label="Percent"
            onChangeText={(value) => {
              setPercentage(value);
              setLocalError(null);
            }}
            value={percentage}
          />
        ) : (
          <Field
            keyboardType="numeric"
            label="Fixed amount"
            onChangeText={(value) => {
              setFixedAmount(value);
              setLocalError(null);
            }}
            value={fixedAmount}
          />
        )}
        {cadence === 'Weekly' ? (
          <OptionGroup
            label={`Tithe day: ${selectedWeeklyDayLabel}`}
            options={weeklyDayOptions.map((option) => ({
              label: option.label.slice(0, 3),
              value: String(option.value),
            }))}
            selectedValue={weeklyDay}
            onSelect={(value) => {
              setWeeklyDay(value);
              setLocalError(null);
            }}
          />
        ) : (
          <Field
            keyboardType="numeric"
            label="Tithe date"
            onChangeText={(value) => {
              setMonthlyDate(value);
              setLocalError(null);
            }}
            value={monthlyDate}
          />
        )}
      </View>

      <View style={styles.actions}>
        <MobileButton
          compact
          disabled={savePending}
          label={savePending ? 'Saving tithe...' : 'Save tithe'}
          onPress={savePreference}
          variant="navy"
        />
        <MobileButton
          compact
          disabled={!status.canPay || payPending}
          label={payPending ? 'Paying...' : `Pay ${formatMerits(status.selectedAmount)}`}
          onPress={onPayDue}
          variant="secondary"
        />
      </View>

      {!status.paymentValid ? (
        <ErrorText>Chosen amount is below this period's 10% minimum.</ErrorText>
      ) : null}
      {visibleError ? <ErrorText>{visibleError}</ErrorText> : null}
      {!savePending && saveStatus ? <Badge variant="success">{saveStatus}</Badge> : null}
      {!payPending && payStatus ? <Badge variant="success">{payStatus}</Badge> : null}
    </Card>
  );
}

function OptionGroup<TValue extends string>({
  label,
  onSelect,
  options,
  selectedValue,
}: {
  label: string;
  onSelect: (value: TValue) => void;
  options: readonly { label: string; value: TValue }[];
  selectedValue: TValue;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: option.value === selectedValue }}
            key={option.value}
            onPress={() => {
              onSelect(option.value);
            }}
            style={[
              styles.optionButton,
              option.value === selectedValue ? styles.optionButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.optionButtonText,
                option.value === selectedValue ? styles.optionButtonTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    gap: 12,
    padding: 16,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  formGrid: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  optionButtonText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  optionButtonTextActive: {
    color: C.navy,
  },
  optionGroup: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  statusText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  statusTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  titheStatus: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  titheStatusDue: {
    backgroundColor: C.warningBg,
    borderColor: C.warning,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
});
