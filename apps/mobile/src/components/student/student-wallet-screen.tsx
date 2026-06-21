import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import {
  formatMerits,
  formatSignedMerits,
  formatWalletDate,
  parseTransferAmount,
  summarizeWalletActivity,
  walletTransferValidation,
  walletAccountRows,
  type StudentWallet,
  type TithePreferenceInput,
  type TitheStatus,
  type TransferAccount,
} from './student-wallet-utils';
import { StudentWalletCharityPanel } from './student-wallet-charity-panel';
import { StudentWalletTithePanel } from './student-wallet-tithe-panel';

interface StudentWalletScreenProps {
  charityError: string | null;
  charityPending: boolean;
  charityStatus: string | null;
  error: string | null;
  loading: boolean;
  onGiveToCharity: (amount: number) => void;
  onPayTitheDue: () => void;
  onSaveTithePreference: (input: TithePreferenceInput) => void;
  onTransfer: (from: TransferAccount, to: TransferAccount, amount: number) => void;
  titheError: string | null;
  titheLoading: boolean;
  tithePayError: string | null;
  tithePayPending: boolean;
  tithePayStatus: string | null;
  titheSaveError: string | null;
  titheSavePending: boolean;
  titheSaveStatus: string | null;
  titheStatus: TitheStatus | undefined;
  transferError: string | null;
  transferPending: boolean;
  transferStatus: string | null;
  wallet: StudentWallet | undefined;
}

export function StudentWalletScreen({
  charityError,
  charityPending,
  charityStatus,
  error,
  loading,
  onGiveToCharity,
  onPayTitheDue,
  onSaveTithePreference,
  onTransfer,
  titheError,
  titheLoading,
  tithePayError,
  tithePayPending,
  tithePayStatus,
  titheSaveError,
  titheSavePending,
  titheSaveStatus,
  titheStatus,
  transferError,
  transferPending,
  transferStatus,
  wallet,
}: StudentWalletScreenProps) {
  if (loading && !wallet) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading student dashboard" />
      </Card>
    );
  }

  if (error && !wallet) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Wallet unavailable</SectionTitle>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Wallet unavailable</SectionTitle>
        <MutedText>No active student profile is linked to this account.</MutedText>
      </Card>
    );
  }

  const week = summarizeWalletActivity(wallet.history, 7);
  const month = summarizeWalletActivity(wallet.history, 30);

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Merit wallet</Text>
        <SectionTitle>Total merits</SectionTitle>
        <Text style={styles.total}>{formatMerits(wallet.totalMerits)}</Text>
        <MutedText>Read-only balances for this signed-in student.</MutedText>
      </Card>

      <View style={styles.activityGrid}>
        <ActivityCard label="This week" summary={week} />
        <ActivityCard label="This month" summary={month} />
      </View>

      <Card style={styles.balanceCard}>
        <SectionTitle>Wallet</SectionTitle>
        {walletAccountRows.map((row) => (
          <View key={row.account} style={styles.accountRow}>
            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>{row.label}</Text>
              <Text style={styles.accountDetail}>{row.detail}</Text>
            </View>
            <Text style={styles.accountValue}>{formatMerits(wallet.balances[row.account])}</Text>
          </View>
        ))}
        <MutedText>
          Investment remains read-only until server-backed buy and sell actions open.
        </MutedText>
      </Card>

      <TransferCard
        onTransfer={onTransfer}
        transferError={transferError}
        transferPending={transferPending}
        transferStatus={transferStatus}
        wallet={wallet}
      />

      <StudentWalletTithePanel
        error={titheError}
        loading={titheLoading}
        onPayDue={onPayTitheDue}
        onSavePreference={onSaveTithePreference}
        payError={tithePayError}
        payPending={tithePayPending}
        payStatus={tithePayStatus}
        saveError={titheSaveError}
        savePending={titheSavePending}
        saveStatus={titheSaveStatus}
        status={titheStatus}
      />

      <StudentWalletCharityPanel
        error={charityError}
        onGiveToCharity={onGiveToCharity}
        pending={charityPending}
        status={charityStatus}
        wallet={wallet}
      />

      <Card style={styles.historyCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>Recent activity</Text>
            <SectionTitle>Recent activity</SectionTitle>
          </View>
          <Badge variant="blue">{wallet.history.length}</Badge>
        </View>
        {wallet.history.length === 0 ? (
          <MutedText>No wallet activity yet.</MutedText>
        ) : (
          wallet.history.slice(0, 8).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={styles.historyCopy}>
                <Text style={styles.historyReason}>{entry.reason}</Text>
                <Text style={styles.historyMeta}>
                  {formatWalletDate(entry.createdAt)} · {entry.account}
                </Text>
              </View>
              <Text
                style={[
                  styles.historyAmount,
                  entry.amount >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {formatSignedMerits(entry.amount)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function TransferCard({
  onTransfer,
  transferError,
  transferPending,
  transferStatus,
  wallet,
}: {
  onTransfer: (from: TransferAccount, to: TransferAccount, amount: number) => void;
  transferError: string | null;
  transferPending: boolean;
  transferStatus: string | null;
  wallet: StudentWallet;
}) {
  const [amountText, setAmountText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const parsedAmount = useMemo(() => parseTransferAmount(amountText), [amountText]);

  function submitTransfer(from: TransferAccount, to: TransferAccount) {
    const validation = walletTransferValidation({
      amount: parsedAmount,
      balances: wallet.balances,
      from,
    });

    setLocalError(validation);
    if (validation !== null || parsedAmount === null) return;
    onTransfer(from, to, parsedAmount);
  }

  const visibleError = localError ?? transferError;

  return (
    <Card style={styles.transferCard}>
      <View style={styles.rowBetween}>
        <View style={styles.transferCopy}>
          <Text style={styles.eyebrow}>Wallet actions</Text>
          <SectionTitle>Move merits</SectionTitle>
        </View>
        {transferPending ? <Badge variant="blue">Transfer pending</Badge> : null}
        {!transferPending && transferStatus ? (
          <Badge variant="success">{transferStatus}</Badge>
        ) : null}
      </View>
      <MutedText>Move merits between Spend and Saving. Investment remains read-only.</MutedText>
      <Field
        keyboardType="numeric"
        label="Amount"
        onChangeText={(value) => {
          setAmountText(value);
          setLocalError(null);
        }}
        placeholder="0"
        value={amountText}
      />
      <View style={styles.transferActions}>
        <MobileButton
          compact
          disabled={transferPending}
          label="Move to Saving"
          onPress={() => {
            submitTransfer('Spend', 'Saving');
          }}
          variant="navy"
        />
        <MobileButton
          compact
          disabled={transferPending}
          label="Move to Spend"
          onPress={() => {
            submitTransfer('Saving', 'Spend');
          }}
          variant="secondary"
        />
      </View>
      {visibleError ? <ErrorText>{visibleError}</ErrorText> : null}
    </Card>
  );
}

function ActivityCard({
  label,
  summary,
}: {
  label: 'This week' | 'This month';
  summary: ReturnType<typeof summarizeWalletActivity>;
}) {
  return (
    <Card style={styles.activityCard}>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={styles.activityNet}>{formatSignedMerits(summary.net)}</Text>
      <Text style={styles.activityMeta}>
        Earned {formatMerits(summary.earned)} · Spent {formatMerits(summary.spent)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountDetail: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  accountLabel: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  accountRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  accountValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  activityCard: {
    flex: 1,
    gap: 6,
    minWidth: 140,
    padding: 14,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  activityNet: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '900',
  },
  balanceCard: {
    gap: 12,
    padding: 16,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 8,
    padding: 16,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  historyCard: {
    gap: 12,
    padding: 16,
  },
  historyCopy: {
    flex: 1,
    gap: 3,
  },
  historyMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  historyReason: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  historyRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  negative: {
    color: C.danger,
  },
  positive: {
    color: C.success,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
  total: {
    color: C.navy,
    fontSize: 28,
    fontWeight: '900',
  },
  transferActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transferCard: {
    gap: 12,
    padding: 16,
  },
  transferCopy: {
    flex: 1,
    gap: 3,
  },
});
