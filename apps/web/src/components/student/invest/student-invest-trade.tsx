'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatMerits,
  holdingValueMerits,
  toMerits,
  type Holding,
  type Instrument,
} from './student-invest-data';
import { MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

type TradeSide = 'buy' | 'sell';

interface TradePanelProps {
  cashMerits: number;
  holding: Holding | undefined;
  instrument: Instrument;
  onBuy: (ticker: string, merits: number) => void;
  onSell: (ticker: string, merits: number) => void;
  onTradeComplete: (side: TradeSide, merits: number) => void;
}

export function TradePanel({
  cashMerits,
  holding,
  instrument,
  onBuy,
  onSell,
  onTradeComplete,
}: TradePanelProps) {
  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('');
  const priceMerits = toMerits(instrument.price);
  const ownedValue = holding ? holdingValueMerits(holding) : 0;
  const maxAmount = side === 'buy' ? cashMerits : ownedValue;
  const merits = Number.parseFloat(amount) || 0;
  const units = merits / priceMerits;
  const valid = merits > 0.0999 && merits <= maxAmount + 0.0001;

  function setSideAndReset(nextSide: TradeSide) {
    setSide(nextSide);
    setAmount('');
  }

  function confirmTrade() {
    if (!valid) return;
    if (side === 'buy') onBuy(instrument.ticker, merits);
    else onSell(instrument.ticker, merits);
    setAmount('');
    onTradeComplete(side, merits);
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
          disabled={!holding}
          onClick={() => {
            setSideAndReset('sell');
          }}
          type="button"
        >
          Sell
        </button>
      </div>

      <label className={styles.fieldLabel} htmlFor={`trade-${instrument.ticker}`}>
        {side === 'buy' ? 'Merits to invest' : 'Merits to sell'}
      </label>
      <input
        className={styles.amountInput}
        id={`trade-${instrument.ticker}`}
        inputMode="decimal"
        onChange={(event) => {
          setAmount(event.target.value.replace(/[^0-9.]/g, ''));
        }}
        placeholder="0.0"
        type="text"
        value={amount}
      />
      <div className={styles.quickAmounts}>
        {(side === 'buy' ? [5, 10, 25] : [25, 50, 75]).map((chip) => {
          const nextValue = side === 'buy' ? chip : (maxAmount * chip) / 100;
          return (
            <button
              className={styles.chipButton}
              key={chip}
              onClick={() => {
                setAmount(String(Number(Math.min(nextValue, maxAmount).toFixed(1))));
              }}
              type="button"
            >
              {side === 'buy' ? chip : `${String(chip)}%`}
            </button>
          );
        })}
        <button
          className={styles.chipButton}
          onClick={() => {
            setAmount(String(Number(maxAmount.toFixed(1))));
          }}
          type="button"
        >
          Max
        </button>
      </div>

      <div className={styles.tradeSummary}>
        <SummaryRow
          label={`${instrument.ticker} price`}
          value={`${formatMerits(priceMerits, 2)} merits`}
        />
        <SummaryRow label="Units" value={units > 0 ? units.toFixed(4) : '-'} />
        <SummaryRow
          label={side === 'buy' ? 'Cash after' : 'Cash after'}
          strong
          value={`${formatMerits(side === 'buy' ? cashMerits - merits : cashMerits + merits, 1)} merits`}
        />
        <p className={styles.tradeHint}>
          {side === 'buy'
            ? 'Buying is fee-free in this prototype.'
            : 'Selling moves merits to investment cash. Withdrawal fees apply only when moving to Spend.'}
        </p>
      </div>

      <button
        className={cn(
          side === 'buy' ? styles.successButton : styles.dangerButton,
          styles.buttonFull,
        )}
        disabled={!valid}
        onClick={confirmTrade}
        type="button"
      >
        <MeritIcon size={15} />
        {side === 'buy' ? 'Confirm investment' : 'Confirm sale'}
      </button>
      {merits > maxAmount ? (
        <p className={styles.negativeText}>
          That is more than your available {side === 'buy' ? 'cash' : 'holding'}.
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
  value: string;
}) {
  return (
    <div className={styles.tradeSummaryRow}>
      <span className={styles.smallText}>{label}</span>
      {strong ? <strong>{value}</strong> : <span>{value}</span>}
    </div>
  );
}
