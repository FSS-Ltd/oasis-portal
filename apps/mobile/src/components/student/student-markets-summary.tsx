import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card } from '../core/mobile-ui';
import {
  formatInvestmentMerits,
  formatSignedInvestmentMerits,
  type InvestmentAccount,
} from './student-markets-utils';

export function MarketSummary({
  account,
  spendBalance,
}: {
  account: InvestmentAccount | undefined;
  spendBalance: number;
}) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell label="Spend" value={formatInvestmentMerits(spendBalance)} />
      <SummaryCell
        label="Markets cash"
        value={formatInvestmentMerits(account?.investmentCashMerits ?? 0)}
      />
      <SummaryCell
        label="Portfolio"
        value={formatInvestmentMerits(account?.portfolioValueMerits ?? 0)}
      />
      <SummaryCell
        label="Return"
        tone={(account?.portfolioReturnMerits ?? 0) >= 0 ? 'success' : 'danger'}
        value={formatSignedInvestmentMerits(account?.portfolioReturnMerits ?? 0)}
      />
    </View>
  );
}

function SummaryCell({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'danger' | 'default' | 'success';
  value: string;
}) {
  return (
    <Card style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'success' ? styles.positive : null,
          tone === 'danger' ? styles.negative : null,
        ]}
      >
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  negative: {
    color: C.danger,
  },
  positive: {
    color: C.success,
  },
  summaryCell: {
    flex: 1,
    gap: 5,
    minWidth: 130,
    padding: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  summaryValue: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
});
