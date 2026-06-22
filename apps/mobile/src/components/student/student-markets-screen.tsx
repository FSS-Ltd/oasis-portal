import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { MarketBrowseCard } from './student-markets-browse-card';
import { FundCashCard } from './student-markets-fund-cash-card';
import { ActivityCard, HoldingsCard } from './student-markets-portfolio-cards';
import { MarketSummary } from './student-markets-summary';
import { MarketTradeTicket, type MarketTradeDraft } from './student-markets-trade-ticket';
import { MarketTrendCard } from './student-markets-trend-card';
import {
  formatInvestmentMerits,
  marketInstrumentRows,
  totalMarketNetWorth,
  type InvestmentAccount,
  type InvestmentMarketData,
  type MarketBuyInput,
  type MarketFilter,
  type MarketSellInput,
  type MarketTradeSide,
} from './student-markets-utils';

interface StudentMarketsScreenProps {
  account: InvestmentAccount | undefined;
  accountError: string | null;
  accountLoading: boolean;
  fundCashError: string | null;
  fundCashPending: boolean;
  fundCashStatus: string | null;
  marketData: InvestmentMarketData | undefined;
  marketError: string | null;
  marketLoading: boolean;
  onBuyHolding: (input: MarketBuyInput) => void;
  onFundCash: (merits: number) => void;
  onSellHolding: (input: MarketSellInput) => void;
  spendBalance: number;
  studentId: string | undefined;
  tradeError: string | null;
  tradePendingSide: MarketTradeSide | null;
  tradeStatus: string | null;
}

export function StudentMarketsScreen({
  account,
  accountError,
  accountLoading,
  fundCashError,
  fundCashPending,
  fundCashStatus,
  marketData,
  marketError,
  marketLoading,
  onBuyHolding,
  onFundCash,
  onSellHolding,
  spendBalance,
  studentId,
  tradeError,
  tradePendingSide,
  tradeStatus,
}: StudentMarketsScreenProps) {
  const [filter, setFilter] = useState<MarketFilter>('All');
  const [selectedTrade, setSelectedTrade] = useState<{
    instrumentId: string;
    side: MarketTradeSide;
  } | null>(null);
  const instrumentRows = useMemo(
    () => marketInstrumentRows(marketData, filter).slice(0, 12),
    [filter, marketData],
  );
  const selectedTradeDraft = useMemo<MarketTradeDraft | null>(() => {
    if (!selectedTrade) return null;
    if (selectedTrade.side === 'buy') {
      const row = instrumentRows.find(
        (candidate) => candidate.instrument.id === selectedTrade.instrumentId,
      );
      return row ? { instrument: row.instrument, side: 'buy', snapshot: row.snapshot } : null;
    }

    const holding = account?.holdings.find(
      (candidate) => candidate.instrumentId === selectedTrade.instrumentId,
    );
    const snapshot = marketData?.snapshots.find(
      (candidate) => candidate.instrumentId === selectedTrade.instrumentId,
    );
    return holding ? { holding, side: 'sell', snapshot } : null;
  }, [account?.holdings, instrumentRows, marketData?.snapshots, selectedTrade]);
  const loading = accountLoading || marketLoading;
  const error = accountError ?? marketError;

  if (loading && !account && !marketData) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading Merit Markets" />
      </Card>
    );
  }

  if (error && !account && !marketData) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Markets unavailable</SectionTitle>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Merit Markets</Text>
            <SectionTitle>Investment account</SectionTitle>
          </View>
          <Badge variant="blue">{formatInvestmentMerits(totalMarketNetWorth(account))}</Badge>
        </View>
        <MutedText>
          Browse the educational market, fund cash from Spend, and place reviewed buy or sell
          trades.
        </MutedText>
      </Card>

      <MarketTrendCard account={account} />
      <MarketSummary account={account} spendBalance={spendBalance} />

      <FundCashCard
        error={fundCashError}
        onFundCash={onFundCash}
        pending={fundCashPending}
        spendBalance={spendBalance}
        status={fundCashStatus}
        studentId={studentId}
      />

      <MarketBrowseCard
        filter={filter}
        marketData={marketData}
        onSelectBuy={(row) => {
          setSelectedTrade({ instrumentId: row.instrument.id, side: 'buy' });
        }}
        rows={instrumentRows}
        setFilter={setFilter}
      />

      <MarketTradeTicket
        cashBalanceMerits={account?.investmentCashMerits ?? 0}
        draft={selectedTradeDraft}
        error={tradeError}
        freshness={marketData?.freshness}
        onBuyHolding={onBuyHolding}
        onClear={() => {
          setSelectedTrade(null);
        }}
        onSellHolding={onSellHolding}
        pendingSide={tradePendingSide}
        status={tradeStatus}
        studentId={studentId}
      />

      <HoldingsCard
        holdings={account?.holdings ?? []}
        loading={accountLoading}
        onSelectSell={(holding) => {
          setSelectedTrade({ instrumentId: holding.instrumentId, side: 'sell' });
        }}
      />
      <ActivityCard transactions={account?.transactions ?? []} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  heroCard: {
    gap: 10,
    padding: 16,
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
});
