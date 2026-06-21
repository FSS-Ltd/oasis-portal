import { useEffect, useMemo, useState } from 'react';
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
import {
  estimateGrossSaleMerits,
  estimateUnitsBought,
  formatInvestmentMerits,
  parseMarketMeritAmount,
  parseMarketUnits,
  type InvestmentHolding,
  type InvestmentInstrument,
  type InvestmentMarketData,
  type InvestmentSnapshot,
  type MarketBuyInput,
  type MarketSellInput,
  type MarketTradeSide,
} from './student-markets-utils';

export type MarketTradeDraft =
  | {
      instrument: InvestmentInstrument;
      side: 'buy';
      snapshot: InvestmentSnapshot | undefined;
    }
  | {
      holding: InvestmentHolding;
      side: 'sell';
      snapshot: InvestmentSnapshot | undefined;
    };

interface MarketTradeTicketProps {
  cashBalanceMerits: number;
  draft: MarketTradeDraft | null;
  error: string | null;
  freshness: InvestmentMarketData['freshness'] | undefined;
  onBuyHolding: (input: MarketBuyInput) => void;
  onClear: () => void;
  onSellHolding: (input: MarketSellInput) => void;
  pendingSide: MarketTradeSide | null;
  status: string | null;
  studentId: string | undefined;
}

export function MarketTradeTicket({
  cashBalanceMerits,
  draft,
  error,
  freshness,
  onBuyHolding,
  onClear,
  onSellHolding,
  pendingSide,
  status,
  studentId,
}: MarketTradeTicketProps) {
  const [amountText, setAmountText] = useState('');
  const [reviewedAmount, setReviewedAmount] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const draftKey =
    draft?.side === 'buy'
      ? `buy:${draft.instrument.id}`
      : draft?.side === 'sell'
        ? `sell:${draft.holding.instrumentId}`
        : 'none';

  const side = draft?.side ?? 'buy';
  const priceMerits = draft?.snapshot?.priceMerits ?? 0;
  const pending = pendingSide === side;
  const parsedAmount = useMemo(
    () => (side === 'buy' ? parseMarketMeritAmount(amountText) : parseMarketUnits(amountText)),
    [amountText, side],
  );
  const holdingUnits = draft?.side === 'sell' ? draft.holding.units : 0;
  const validation = useMemo(
    () =>
      validateTrade({
        amountText,
        cashBalanceMerits,
        freshness,
        holdingUnits,
        parsedAmount,
        priceMerits,
        side,
        studentId,
      }),
    [
      amountText,
      cashBalanceMerits,
      freshness,
      holdingUnits,
      parsedAmount,
      priceMerits,
      side,
      studentId,
    ],
  );
  const visibleError = localError ?? validation ?? error;
  const readyToConfirm = reviewedAmount !== null && reviewedAmount === parsedAmount;
  const disabled = pending || parsedAmount === null || validation !== null;
  const title = draft
    ? draft.side === 'buy'
      ? `Buy ${draft.instrument.symbol}`
      : `Sell ${draft.holding.symbol}`
    : 'Select a trade';

  useEffect(() => {
    setAmountText('');
    setReviewedAmount(null);
    setLocalError(null);
  }, [draftKey]);

  function resetAmount(nextValue = '') {
    setAmountText(nextValue);
    setReviewedAmount(null);
    setLocalError(null);
  }

  function reviewOrConfirm() {
    if (!draft) {
      setLocalError('Choose an investment before trading.');
      return;
    }
    if (validation !== null) {
      setLocalError(validation);
      return;
    }
    if (parsedAmount === null) {
      setLocalError(
        side === 'buy'
          ? 'Enter a positive whole number of merits.'
          : 'Enter units using up to six decimals.',
      );
      return;
    }
    if (!readyToConfirm) {
      setReviewedAmount(parsedAmount);
      setLocalError(null);
      return;
    }

    if (draft.side === 'buy') {
      onBuyHolding({ instrumentId: draft.instrument.id, merits: parsedAmount });
    } else {
      onSellHolding({ instrumentId: draft.holding.instrumentId, units: parsedAmount });
    }
    resetAmount();
  }

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Trade ticket</Text>
          <SectionTitle>{title}</SectionTitle>
        </View>
        {pending ? <Badge variant="blue">{side === 'buy' ? 'Buying' : 'Selling'}</Badge> : null}
        {!pending && status ? <Badge variant="success">{status}</Badge> : null}
      </View>

      {draft ? (
        <>
          <MutedText>
            {draft.side === 'buy'
              ? 'Review the cash impact before confirming a buy.'
              : 'Review the estimated cash return before confirming a sell.'}
          </MutedText>
          <Field
            keyboardType="numeric"
            label={draft.side === 'buy' ? 'Merits to invest' : 'Units to sell'}
            onChangeText={(value) => {
              resetAmount(value.replace(/[^0-9.]/g, ''));
            }}
            placeholder="0"
            value={amountText}
          />
          <TradeSummary
            cashBalanceMerits={cashBalanceMerits}
            draft={draft}
            parsedAmount={parsedAmount}
            priceMerits={priceMerits}
          />
          {readyToConfirm ? (
            <Badge variant="warning">Review ready. Tap confirm to place this trade.</Badge>
          ) : null}
          <View style={styles.actions}>
            <MobileButton
              compact
              disabled={disabled}
              label={
                pending
                  ? draft.side === 'buy'
                    ? 'Buying...'
                    : 'Selling...'
                  : readyToConfirm
                    ? draft.side === 'buy'
                      ? 'Confirm buy'
                      : 'Confirm sell'
                    : draft.side === 'buy'
                      ? 'Review buy'
                      : 'Review sell'
              }
              onPress={reviewOrConfirm}
              variant={draft.side === 'buy' ? 'success' : 'danger'}
            />
            <MobileButton compact label="Clear" onPress={onClear} variant="secondary" />
          </View>
        </>
      ) : (
        <MutedText>
          Select Buy from the market list or Sell from a holding to open a ticket.
        </MutedText>
      )}

      {visibleError ? <ErrorText>{visibleError}</ErrorText> : null}
    </Card>
  );
}

function TradeSummary({
  cashBalanceMerits,
  draft,
  parsedAmount,
  priceMerits,
}: {
  cashBalanceMerits: number;
  draft: MarketTradeDraft;
  parsedAmount: number | null;
  priceMerits: number;
}) {
  const amount = parsedAmount ?? 0;
  const unitsBought = draft.side === 'buy' ? estimateUnitsBought(amount, priceMerits) : 0;
  const grossSaleMerits = draft.side === 'sell' ? estimateGrossSaleMerits(amount, priceMerits) : 0;
  const cashAfter =
    draft.side === 'buy'
      ? cashBalanceMerits - Math.floor(amount)
      : cashBalanceMerits + grossSaleMerits;

  return (
    <View style={styles.summary}>
      <SummaryRow
        label="Price"
        value={priceMerits > 0 ? `${formatInvestmentMerits(priceMerits)} / unit` : 'Awaiting price'}
      />
      {draft.side === 'buy' ? (
        <SummaryRow
          label="Estimated units"
          value={unitsBought > 0 ? unitsBought.toFixed(4) : '-'}
        />
      ) : (
        <SummaryRow
          label="Cash returned"
          value={grossSaleMerits > 0 ? formatInvestmentMerits(grossSaleMerits) : '-'}
        />
      )}
      <SummaryRow
        label="Markets cash after"
        value={cashAfter >= 0 ? formatInvestmentMerits(cashAfter) : '-'}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function validateTrade({
  amountText,
  cashBalanceMerits,
  freshness,
  holdingUnits,
  parsedAmount,
  priceMerits,
  side,
  studentId,
}: {
  amountText: string;
  cashBalanceMerits: number;
  freshness: InvestmentMarketData['freshness'] | undefined;
  holdingUnits: number;
  parsedAmount: number | null;
  priceMerits: number;
  side: MarketTradeSide;
  studentId: string | undefined;
}): string | null {
  if (!studentId) return 'Wallet data is still loading.';
  if (freshness !== 'fresh') return 'Trading paused until fresh prices are available.';
  if (priceMerits <= 0) return 'This investment does not have a tradeable price yet.';
  if (amountText.trim().length === 0) return null;
  if (parsedAmount === null) {
    return side === 'buy'
      ? 'Enter a positive whole number of merits.'
      : 'Enter units using up to six decimals.';
  }
  if (side === 'buy' && parsedAmount > cashBalanceMerits) {
    return 'Not enough Markets cash.';
  }
  if (side === 'sell' && parsedAmount > holdingUnits + 0.000001) {
    return 'Not enough units.';
  }
  return null;
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
  summary: {
    borderColor: C.borderLight,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  summaryLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
});
