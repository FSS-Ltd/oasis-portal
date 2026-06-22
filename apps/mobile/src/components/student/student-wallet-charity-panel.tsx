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
import { formatMerits, parsePositiveMeritAmount, type StudentWallet } from './student-wallet-utils';

interface StudentWalletCharityPanelProps {
  error: string | null;
  onGiveToCharity: (amount: number) => void;
  pending: boolean;
  status: string | null;
  wallet: StudentWallet;
}

export function StudentWalletCharityPanel({
  error,
  onGiveToCharity,
  pending,
  status,
  wallet,
}: StudentWalletCharityPanelProps) {
  const [amountText, setAmountText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const parsedAmount = useMemo(() => parsePositiveMeritAmount(amountText), [amountText]);
  const amountValidation = useMemo(() => {
    if (amountText.trim().length === 0) return null;
    if (parsedAmount === null) return 'Enter a positive whole number of merits.';
    if (parsedAmount > wallet.balances.Spend) return 'Not enough Spend merits.';
    return null;
  }, [amountText, parsedAmount, wallet.balances.Spend]);
  const disabled = pending || parsedAmount === null || parsedAmount > wallet.balances.Spend;
  const visibleError = localError ?? amountValidation ?? error;

  function submitGift() {
    if (amountValidation !== null) {
      setLocalError(amountValidation);
      return;
    }
    if (parsedAmount === null) {
      setLocalError('Enter a positive whole number of merits.');
      return;
    }
    setLocalError(null);
    onGiveToCharity(parsedAmount);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Charity</Text>
          <SectionTitle>Charity pot</SectionTitle>
        </View>
        {pending ? <Badge variant="blue">Gift pending</Badge> : null}
        {!pending && status ? <Badge variant="success">{status}</Badge> : null}
      </View>
      <MutedText>
        Give Spend merits to the shared charity pot. You have given{' '}
        {formatMerits(wallet.balances.Given)}.
      </MutedText>
      <Field
        keyboardType="numeric"
        label="Charity merits"
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
          label={pending ? 'Giving...' : 'Give to charity'}
          onPress={submitGift}
          variant="success"
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
