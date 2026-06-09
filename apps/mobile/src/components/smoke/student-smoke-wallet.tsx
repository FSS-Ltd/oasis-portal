import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  SmokeButton,
} from './smoke-ui';

type MeritBalances = RouterOutputs['meritLedger']['balances'];
type MeritActivity = RouterOutputs['meritLedger']['activity'];
type InvestmentAccount = RouterOutputs['investment']['account'];
type WalletAccount = keyof MeritBalances['balances'];
type TransferAccount = Extract<WalletAccount, 'Spend' | 'Saving'>;

interface StudentWalletPanelProps {
  balances: MeritBalances | undefined;
  investment: InvestmentAccount | undefined;
  loading: boolean;
  monthActivity: MeritActivity | undefined;
  transferError: string | null;
  transferPending: boolean;
  transferStatus: string | null;
  weekActivity: MeritActivity | undefined;
  onTransfer: (from: TransferAccount, to: TransferAccount, amount: number) => void;
}

const walletRows: Array<{ account: WalletAccount; label: string; color: string }> = [
  { account: 'Spend', label: 'Spend Account', color: C.crimson },
  { account: 'ShopReserved', label: 'Shop Holds', color: C.warning },
  { account: 'Saving', label: 'Saving Account', color: C.navy },
  { account: 'Investment', label: 'Investment Account', color: C.blue },
];
const titheOptionLabels = ['10%', '15%', '20%'] as const;

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function parseAmount(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function balanceValue(balances: MeritBalances | undefined, account: WalletAccount): number {
  return balances?.balances[account] ?? 0;
}

function totalBalance(balances: MeritBalances | undefined): number {
  if (!balances) return 0;
  return (
    balances.balances.Spend +
    balances.balances.ShopReserved +
    balances.balances.Saving +
    balances.balances.Investment
  );
}

function ActivitySummaryCard({
  activity,
  title,
}: {
  activity: MeritActivity | undefined;
  title: string;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>{title}</SectionTitle>
        <Badge variant={activity ? 'blue' : 'neutral'}>{activity?.range ?? 'Loading'}</Badge>
      </View>
      <View style={styles.activityGrid}>
        <ActivityStat label="Earned" value={activity?.activity.meritsEarned ?? 0} />
        <ActivityStat label="Demerits" value={activity?.activity.demeritsCount ?? 0} />
        <ActivityStat label="Net" value={activity?.activity.net ?? 0} signedValue />
      </View>
    </Card>
  );
}

function ActivityStat({
  label,
  signedValue = false,
  value,
}: {
  label: string;
  signedValue?: boolean;
  value: number;
}) {
  const positive = value >= 0;
  return (
    <View style={styles.activityStat}>
      <Text style={styles.activityLabel}>{label}</Text>
      <Text style={[styles.activityValue, positive ? styles.positiveText : styles.negativeText]}>
        {signedValue ? signed(value) : String(value)}
      </Text>
    </View>
  );
}

function WalletCard({
  balances,
  investment,
}: {
  balances: MeritBalances | undefined;
  investment: InvestmentAccount | undefined;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Merit wallet</SectionTitle>
        <Badge variant="crimson">{String(totalBalance(balances))} total</Badge>
      </View>
      {walletRows.map((row) => (
        <View key={row.account} style={styles.walletRow}>
          <View style={styles.walletLabelGroup}>
            <View style={[styles.walletSwatch, { backgroundColor: row.color }]} />
            <Text style={styles.walletLabel}>{row.label}</Text>
          </View>
          <Text style={[styles.walletValue, { color: row.color }]}>
            {String(balanceValue(balances, row.account))}
          </Text>
        </View>
      ))}
      <View style={styles.investmentDetail}>
        <MutedText>
          {investment
            ? `${investment.units.toFixed(2)} units | ${String(investment.currentValueMerits)} current value`
            : 'Investment account loading.'}
        </MutedText>
      </View>
    </Card>
  );
}

function TransferCard({
  balances,
  transferError,
  transferPending,
  transferStatus,
  onTransfer,
}: {
  balances: MeritBalances | undefined;
  transferError: string | null;
  transferPending: boolean;
  transferStatus: string | null;
  onTransfer: (from: TransferAccount, to: TransferAccount, amount: number) => void;
}) {
  const [amountText, setAmountText] = useState('');
  const amount = useMemo(() => parseAmount(amountText), [amountText]);
  const spendBalance = balanceValue(balances, 'Spend');
  const savingBalance = balanceValue(balances, 'Saving');
  const canMoveToSaving = amount !== null && amount <= spendBalance && !transferPending;
  const canMoveToSpend = amount !== null && amount <= savingBalance && !transferPending;

  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Transfers</SectionTitle>
      <Field
        keyboardType="numeric"
        label="Amount"
        onChangeText={setAmountText}
        placeholder="Merits"
        value={amountText}
      />
      {amount !== null && amount > spendBalance && amount > savingBalance ? (
        <ErrorText>Amount is above both Spend and Saving balances.</ErrorText>
      ) : null}
      {transferError ? <ErrorText>{transferError}</ErrorText> : null}
      {transferStatus ? <Badge variant="success">{transferStatus}</Badge> : null}
      <View style={styles.transferButtons}>
        <SmokeButton
          compact
          disabled={!canMoveToSaving}
          label="Move to Saving"
          onPress={() => {
            if (amount !== null) onTransfer('Spend', 'Saving', amount);
          }}
          variant="blue"
        />
        <SmokeButton
          compact
          disabled={!canMoveToSpend}
          label="Move to Spend"
          onPress={() => {
            if (amount !== null) onTransfer('Saving', 'Spend', amount);
          }}
          variant="secondary"
        />
      </View>
    </Card>
  );
}

function TithePolicyCard() {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Tithe</SectionTitle>
        <Badge variant="neutral">Parent/admin controlled</Badge>
      </View>
      <MutedText>
        Tithe percentages are managed by a linked parent or full-admin account under the current
        policy.
      </MutedText>
      <View style={styles.titheOptions}>
        {titheOptionLabels.map((label) => (
          <Badge key={label} variant="blue">
            {label}
          </Badge>
        ))}
      </View>
    </Card>
  );
}

export function StudentWalletPanel({
  balances,
  investment,
  loading,
  monthActivity,
  transferError,
  transferPending,
  transferStatus,
  weekActivity,
  onTransfer,
}: StudentWalletPanelProps) {
  return (
    <View style={styles.stack}>
      {loading ? <InlineSpinner label="Loading wallet" /> : null}
      <WalletCard balances={balances} investment={investment} />
      <View style={styles.activityCards}>
        <ActivitySummaryCard activity={weekActivity} title="This week" />
        <ActivitySummaryCard activity={monthActivity} title="This month" />
      </View>
      <TransferCard
        balances={balances}
        transferError={transferError}
        transferPending={transferPending}
        transferStatus={transferStatus}
        onTransfer={onTransfer}
      />
      <TithePolicyCard />
    </View>
  );
}

const styles = StyleSheet.create({
  activityCards: {
    gap: 12,
  },
  activityGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  activityLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activityStat: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 10,
  },
  activityValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  investmentDetail: {
    paddingTop: 2,
  },
  negativeText: {
    color: C.danger,
  },
  positiveText: {
    color: C.success,
  },
  stack: {
    gap: 14,
  },
  titheOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transferButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  walletLabelGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  walletRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  walletSwatch: {
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  walletValue: {
    fontSize: 16,
    fontWeight: '900',
  },
});
