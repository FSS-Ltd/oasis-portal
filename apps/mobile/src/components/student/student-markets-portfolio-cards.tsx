import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  InlineSpinner,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';
import {
  formatInvestmentMerits,
  formatInvestmentPercent,
  formatSignedInvestmentMerits,
  transactionLabel,
  type InvestmentHolding,
  type InvestmentTransaction,
} from './student-markets-utils';

export function HoldingsCard({
  holdings,
  loading,
  onSelectSell,
}: {
  holdings: readonly InvestmentHolding[];
  loading: boolean;
  onSelectSell: (holding: InvestmentHolding) => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.eyebrow}>Portfolio</Text>
          <SectionTitle>Your holdings</SectionTitle>
        </View>
        <Badge variant="blue">{holdings.length}</Badge>
      </View>
      {loading ? <InlineSpinner label="Loading holdings" /> : null}
      {!loading && holdings.length === 0 ? (
        <MutedText>No holdings yet. Fund cash, then use the next trading slice to buy.</MutedText>
      ) : null}
      {holdings.map((holding) => (
        <View key={holding.id} style={styles.listRow}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{holding.symbol}</Text>
            <Text style={styles.rowMeta}>
              {holding.displayName} · {holding.units.toFixed(4)} units
            </Text>
          </View>
          <View style={styles.rowValueGroup}>
            <Text style={styles.rowValue}>
              {formatInvestmentMerits(holding.currentValueMerits)}
            </Text>
            <Text
              style={[
                styles.rowMeta,
                holding.returnMerits >= 0 ? styles.positive : styles.negative,
              ]}
            >
              Today {formatSignedInvestmentMerits(holding.dayChangeMerits)} (
              {formatInvestmentPercent(holding.dayChangePct)})
            </Text>
            <Text
              style={[
                styles.rowMeta,
                holding.returnMerits >= 0 ? styles.positive : styles.negative,
              ]}
            >
              Total {formatSignedInvestmentMerits(holding.returnMerits)}
            </Text>
            <MobileButton
              compact
              disabled={holding.units <= 0}
              label="Sell"
              onPress={() => {
                onSelectSell(holding);
              }}
              variant="danger"
            />
          </View>
        </View>
      ))}
    </Card>
  );
}

export function ActivityCard({ transactions }: { transactions: readonly InvestmentTransaction[] }) {
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.eyebrow}>Activity</Text>
          <SectionTitle>Recent activity</SectionTitle>
        </View>
        <Badge variant="blue">{transactions.length}</Badge>
      </View>
      {transactions.length === 0 ? <MutedText>No market activity yet.</MutedText> : null}
      {transactions.slice(0, 8).map((transaction) => (
        <View key={transaction.id} style={styles.listRow}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{transactionLabel(transaction)}</Text>
            <Text style={styles.rowMeta}>
              {new Date(transaction.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </View>
          <Text style={styles.rowValue}>
            {formatInvestmentMerits(transaction.grossMerits ?? 0)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
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
  listRow: {
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
  rowMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  rowValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  rowValueGroup: {
    alignItems: 'flex-end',
    gap: 3,
  },
});
