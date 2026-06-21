import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { MarketBrowseCard } from './student-markets-browse-card';
import { FundCashCard } from './student-markets-fund-cash-card';
import { ActivityCard, HoldingsCard } from './student-markets-portfolio-cards';
import { MarketSummary } from './student-markets-summary';
import {
  formatInvestmentMerits,
  marketInstrumentRows,
  totalMarketNetWorth,
  type InvestmentAccount,
  type InvestmentMarketData,
  type MarketFilter,
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
  onFundCash: (merits: number) => void;
  spendBalance: number;
  studentId: string | undefined;
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
  onFundCash,
  spendBalance,
  studentId,
}: StudentMarketsScreenProps) {
  const [filter, setFilter] = useState<MarketFilter>('All');
  const instrumentRows = useMemo(
    () => marketInstrumentRows(marketData, filter).slice(0, 12),
    [filter, marketData],
  );
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
          Browse the educational market, fund cash from Spend, and review holdings. Buying and
          selling open in the next mobile slice.
        </MutedText>
      </Card>

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
        rows={instrumentRows}
        setFilter={setFilter}
      />

      <HoldingsCard holdings={account?.holdings ?? []} loading={accountLoading} />
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
