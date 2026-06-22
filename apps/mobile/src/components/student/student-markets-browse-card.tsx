import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import {
  formatInvestmentMerits,
  formatInvestmentPercent,
  type InvestmentMarketData,
  type MarketFilter,
  type MarketInstrumentRow,
} from './student-markets-utils';

const marketFilters: readonly MarketFilter[] = ['All', 'Stocks', 'ETFs', 'Crypto'];

export function MarketBrowseCard({
  filter,
  marketData,
  onSelectBuy,
  rows,
  setFilter,
}: {
  filter: MarketFilter;
  marketData: InvestmentMarketData | undefined;
  onSelectBuy: (row: MarketInstrumentRow) => void;
  rows: readonly MarketInstrumentRow[];
  setFilter: (filter: MarketFilter) => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Market</Text>
          <SectionTitle>Browse market</SectionTitle>
        </View>
        {marketData?.freshness === 'stale' ? <Badge variant="warning">Prices delayed</Badge> : null}
      </View>
      <View style={styles.filterRow}>
        {marketFilters.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item }}
            key={item}
            onPress={() => {
              setFilter(item);
            }}
            style={[styles.filterButton, filter === item ? styles.filterButtonActive : null]}
          >
            <Text style={[styles.filterText, filter === item ? styles.filterTextActive : null]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      {marketData?.freshness === 'empty' ? (
        <MutedText>Market data is unavailable. Cached prices will appear after refresh.</MutedText>
      ) : null}
      {rows.length === 0 ? <MutedText>No market instruments match this filter.</MutedText> : null}
      {rows.map((row) => (
        <MarketInstrumentRowView key={row.instrument.id} onSelectBuy={onSelectBuy} row={row} />
      ))}
      <MutedText>Buy opens a review ticket before the trade is placed.</MutedText>
    </Card>
  );
}

function MarketInstrumentRowView({
  onSelectBuy,
  row,
}: {
  onSelectBuy: (row: MarketInstrumentRow) => void;
  row: MarketInstrumentRow;
}) {
  const priceMerits = row.snapshot?.priceMerits ?? 0;
  const change = row.snapshot?.dayChangePct ?? 0;

  return (
    <View style={styles.listRow}>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{row.instrument.symbol}</Text>
        <Text style={styles.rowMeta}>
          {row.instrument.displayName} · {row.instrument.kind.toUpperCase()} ·{' '}
          {row.instrument.riskBand} risk
        </Text>
      </View>
      <View style={styles.rowValueGroup}>
        <Text style={styles.rowValue}>
          {priceMerits > 0 ? formatInvestmentMerits(priceMerits) : 'Awaiting price'}
        </Text>
        <Text style={[styles.rowMeta, change >= 0 ? styles.positive : styles.negative]}>
          {formatInvestmentPercent(change)}
        </Text>
        <MobileButton
          compact
          disabled={!row.snapshot}
          label="Buy"
          onPress={() => {
            onSelectBuy(row);
          }}
          variant="success"
        />
      </View>
    </View>
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
  filterButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  filterTextActive: {
    color: C.navy,
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
