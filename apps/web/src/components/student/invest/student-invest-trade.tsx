'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMeritsWithGbp, type Instrument } from './student-invest-data';
import { MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

type TradeSide = 'buy' | 'sell';

interface TradePanelProps {
  cashBalanceMerits: number;
  holdingUnits: number;
  initialSide?: TradeSide;
  instrument: Instrument;
  isBuying: boolean;
  isSelling: boolean;
  onAfterSubmit?: () => void;
  onBuy: (merits: number) => void;
  onSell: (units: number) => void;
}

export function TradePanel({
  cashBalanceMerits,
  holdingUnits,
  initialSide = 'buy',
  instrument,
  isBuying,
  isSelling,
  onAfterSubmit,
  onBuy,
  onSell,
}: TradePanelProps) {
  const [side, setSide] = useState<TradeSide>(initialSide);
  const [amount, setAmount] = useState('');
  const priceMerits = instrument.priceMerits ?? 0;
  const parsedAmount = Number.parseFloat(amount) || 0;

  const intMerits = Math.floor(parsedAmount);
  const unitsBought = priceMerits > 0 ? intMerits / priceMerits : 0;
  const grossSaleMerits = Math.floor(parsedAmount * priceMerits);

  const maxBuy = Math.floor(cashBalanceMerits);
  const maxSell = holdingUnits;
  const validBuy = priceMerits > 0 && intMerits >= 1 && intMerits <= maxBuy;
  const validSell = parsedAmount > 0.000001 && parsedAmount <= maxSell + 0.000001;
  const valid = side === 'buy' ? validBuy : validSell;

  function setSideAndReset(nextSide: TradeSide) {
    setSide(nextSide);
    setAmount('');
  }

  function confirmTrade() {
    if (!valid) return;
    if (side === 'buy') {
      onBuy(intMerits);
    } else {
      onSell(parsedAmount);
    }
    setAmount('');
    onAfterSubmit?.();
  }

  return (
    <div className={styles.tradePanel}>
      <div className={styles.tradeSwitch}>
        <button
          className={side === 'buy' ? styles.buyActive : undefined}
          onClick={() => {
            setSideAndReset('buy');
          }}
          type="button"
        >
          Buy
        </button>
        <button
          className={side === 'sell' ? styles.sellActive : undefined}
          disabled={holdingUnits <= 0.000001}
          onClick={() => {
            setSideAndReset('sell');
          }}
          type="button"
        >
          Sell
        </button>
      </div>

      <label className={styles.fieldLabel} htmlFor="fund-trade-amount">
        {side === 'buy' ? 'Merits to invest' : 'Units to sell'}
      </label>
      <div className={styles.formRow}>
        <span className={styles.smallText}>
          {side === 'buy'
            ? `Cash: ${formatMeritsWithGbp(cashBalanceMerits, 1)}`
            : `Owned: ${holdingUnits.toFixed(4)} units`}
        </span>
      </div>
      <input
        className={styles.amountInput}
        id="fund-trade-amount"
        inputMode="decimal"
        onChange={(event) => {
          setAmount(event.target.value.replace(/[^0-9.]/g, ''));
        }}
        placeholder="0"
        type="text"
        value={amount}
      />

      <div className={styles.quickAmounts}>
        {side === 'buy'
          ? [5, 10, 25].map((chip) => (
              <button
                className={styles.chipButton}
                disabled={chip > maxBuy}
                key={chip}
                onClick={() => {
                  setAmount(String(chip));
                }}
                type="button"
              >
                {chip}
              </button>
            ))
          : [25, 50, 75].map((chip) => (
              <button
                className={styles.chipButton}
                disabled={maxSell <= 0}
                key={chip}
                onClick={() => {
                  setAmount(String(Number(((maxSell * chip) / 100).toFixed(6))));
                }}
                type="button"
              >
                {chip}%
              </button>
            ))}
        <button
          className={styles.chipButton}
          disabled={side === 'buy' ? maxBuy <= 0 : maxSell <= 0}
          onClick={() => {
            setAmount(side === 'buy' ? String(maxBuy) : String(Number(maxSell.toFixed(6))));
          }}
          type="button"
        >
          Max
        </button>
      </div>

      <div className={styles.tradeSummary}>
        <SummaryRow
          label={`${instrument.ticker} price`}
          value={priceMerits > 0 ? `${formatMeritsWithGbp(priceMerits, 2)} / unit` : '—'}
        />
        {side === 'buy' ? (
          <SummaryRow
            label="Units"
            value={intMerits >= 1 && priceMerits > 0 ? unitsBought.toFixed(4) : '—'}
          />
        ) : (
          <>
            <SummaryRow
              label="Cash returned"
              value={parsedAmount > 0 ? formatMeritsWithGbp(grossSaleMerits, 1) : '—'}
            />
          </>
        )}
        <SummaryRow
          label="Cash after"
          strong
          value={
            side === 'buy'
              ? formatMeritsWithGbp(cashBalanceMerits - intMerits, 1)
              : formatMeritsWithGbp(cashBalanceMerits + grossSaleMerits, 1)
          }
        />
        <p className={styles.tradeHint}>
          {side === 'buy'
            ? 'Buying is free and uses your Merit Markets cash balance.'
            : 'Selling returns merits to your cash balance. Fees and tax only apply when you withdraw to Spend.'}
        </p>
      </div>

      <button
        className={cn(
          side === 'buy' ? styles.successButton : styles.dangerButton,
          styles.buttonFull,
        )}
        disabled={!valid || (side === 'buy' ? isBuying : isSelling)}
        onClick={confirmTrade}
        type="button"
      >
        <MeritIcon size={15} />
        {side === 'buy'
          ? isBuying
            ? 'Buying'
            : 'Confirm buy'
          : isSelling
            ? 'Selling'
            : 'Confirm sell'}
      </button>
      {parsedAmount > 0 && parsedAmount > (side === 'buy' ? maxBuy : maxSell) + 0.0001 ? (
        <p className={styles.negativeText}>
          Exceeds your available {side === 'buy' ? 'cash balance' : 'units'}.
        </p>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: ReactNode;
}) {
  return (
    <div className={styles.tradeSummaryRow}>
      <span className={styles.smallText}>{label}</span>
      {strong ? <strong>{value}</strong> : <span>{value}</span>}
    </div>
  );
}
