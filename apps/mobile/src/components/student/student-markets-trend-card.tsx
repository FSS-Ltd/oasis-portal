import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, SectionTitle } from '../core/mobile-ui';
import {
  formatInvestmentMerits,
  formatInvestmentPercent,
  formatSignedInvestmentMerits,
  marketTrendOptions,
  portfolioTrendForRange,
  type InvestmentAccount,
  type MarketTrendRange,
} from './student-markets-utils';

export function MarketTrendCard({ account }: { account: InvestmentAccount | undefined }) {
  const [range, setRange] = useState<MarketTrendRange>('1D');
  const trend = useMemo(() => portfolioTrendForRange(account, range), [account, range]);
  const maxPoint = Math.max(...trend.points, 1);

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Net worth</Text>
          <SectionTitle>Portfolio trend</SectionTitle>
        </View>
        <Text style={styles.value}>{formatInvestmentMerits(trend.currentValue)}</Text>
      </View>
      <View style={styles.rangeRow}>
        {marketTrendOptions.map((option) => {
          const active = option.id === range;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => {
                setRange(option.id);
              }}
              style={[styles.rangeButton, active ? styles.rangeButtonActive : null]}
            >
              <Text style={[styles.rangeText, active ? styles.rangeTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sparkline} accessibilityLabel="Portfolio trend chart">
        {trend.points.map((point, index) => (
          <View
            key={`${String(index)}-${String(point)}`}
            style={[
              styles.sparklineBar,
              {
                height: Math.max(8, Math.round((point / maxPoint) * 52)),
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.change, trend.changeMerits >= 0 ? styles.positive : styles.negative]}>
          {formatSignedInvestmentMerits(trend.changeMerits)} (
          {formatInvestmentPercent(trend.changePct)})
        </Text>
        <Text style={styles.meta}>from {formatInvestmentMerits(trend.startValue)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  change: {
    fontSize: 13,
    fontWeight: '900',
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
  meta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  negative: {
    color: C.danger,
  },
  positive: {
    color: C.success,
  },
  rangeButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rangeButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  rangeTextActive: {
    color: C.navy,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sparkline: {
    alignItems: 'flex-end',
    borderBottomColor: C.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 3,
    height: 60,
  },
  sparklineBar: {
    backgroundColor: C.blue,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    flex: 1,
    opacity: 0.72,
  },
  value: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
});
