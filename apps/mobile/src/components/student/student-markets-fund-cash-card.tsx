import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';
import { parseMarketMeritAmount } from './student-markets-utils';

export function FundCashCard({
  error,
  onFundCash,
  pending,
  spendBalance,
  status,
  studentId,
}: {
  error: string | null;
  onFundCash: (merits: number) => void;
  pending: boolean;
  spendBalance: number;
  status: string | null;
  studentId: string | undefined;
}) {
  const [amountText, setAmountText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const parsedAmount = useMemo(() => parseMarketMeritAmount(amountText), [amountText]);
  const validation = useMemo(() => {
    if (amountText.trim().length === 0) return null;
    if (parsedAmount === null) return 'Enter a positive whole number of merits.';
    if (parsedAmount > spendBalance) return 'Not enough Spend merits.';
    return null;
  }, [amountText, parsedAmount, spendBalance]);
  const disabled = pending || parsedAmount === null || parsedAmount > spendBalance || !studentId;
  const visibleError = localError ?? validation ?? error;

  function submit() {
    if (!studentId) {
      setLocalError('Wallet data is still loading.');
      return;
    }
    if (validation !== null) {
      setLocalError(validation);
      return;
    }
    if (parsedAmount === null) {
      setLocalError('Enter a positive whole number of merits.');
      return;
    }
    setLocalError(null);
    onFundCash(parsedAmount);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Funding</Text>
          <SectionTitle>Fund Markets cash</SectionTitle>
        </View>
        {pending ? <Badge variant="blue">Funding pending</Badge> : null}
        {!pending && status ? <Badge variant="success">{status}</Badge> : null}
      </View>
      <MutedText>Move merits from Spend into Markets cash before buying investments.</MutedText>
      <Field
        keyboardType="numeric"
        label="Merits to fund"
        onChangeText={(value) => {
          setAmountText(value);
          setLocalError(null);
        }}
        placeholder="0"
        value={amountText}
      />
      <View style={styles.actions}>
        <MobileButton
          compact
          disabled={disabled}
          label={pending ? 'Funding...' : 'Fund balance'}
          onPress={submit}
          variant="navy"
        />
      </View>
      {visibleError ? <ErrorText>{visibleError}</ErrorText> : null}
    </Card>
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
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
});
