'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMeritsWithGbp, withdrawFeePct } from './student-invest-data';
import { MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

type TradeSide = 'buy' | 'sell';

interface TradePanelProps {
  isBuying: boolean;
  isSelling: boolean;
  latestNav: { nav: number; dailyReturn: number } | null;
  onBuy: (merits: number) => void;
  onSell: (units: number) => void;
  spendBalance: number;
  units: number;
}

export function TradePanel({
  isBuying,
  isSelling,
  latestNav,
  onBuy,
  onSell,
  spendBalance,
  units,
}: TradePanelProps) {
  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('');
  const nav = latestNav?.nav ?? 0;
  const parsedAmount = Number.parseFloat(amount) || 0;

  // Buy: integer merits → units. Sell: decimal units → merits minus fee.
  const intMerits = Math.floor(parsedAmount);
  const unitsBought = nav > 0 ? intMerits / nav : 0;
  const meritValueOfUnits = parsedAmount * nav;
  const fee = side === 'sell' ? (meritValueOfUnits * withdrawFeePct) / 100 : 0;
  const netMerits = meritValueOfUnits - fee;

  const maxBuy = Math.floor(spendBalance);
  const maxSell = units;
  const validBuy = intMerits >= 1 && intMerits <= maxBuy;
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
          Invest
        </button>
        <button
          className={side === 'sell' ? styles.sellActive : undefined}
          disabled={units <= 0.000001}
          onClick={() => {
            setSideAndReset('sell');
          }}
          type="button"
        >
          Withdraw
        </button>
      </div>

      <label className={styles.fieldLabel} htmlFor="fund-trade-amount">
        {side === 'buy' ? 'Merits to invest (whole number)' : 'Units to sell'}
      </label>
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
          onClick={() => {
            setAmount(
              side === 'buy' ? String(maxBuy) : String(Number(maxSell.toFixed(6))),
            );
          }}
          type="button"
        >
          Max
        </button>
      </div>

      <div className={styles.tradeSummary}>
        <SummaryRow
          label="Fund NAV"
          value={nav > 0 ? `${formatMeritsWithGbp(nav, 2)} / unit` : '—'}
        />
        {side === 'buy' ? (
          <SummaryRow
            label="Units you receive"
            value={intMerits >= 1 && nav > 0 ? unitsBought.toFixed(4) : '—'}
          />
        ) : (
          <>
            <SummaryRow
              label="Gross merit value"
              value={parsedAmount > 0 ? formatMeritsWithGbp(meritValueOfUnits, 1) : '—'}
            />
            <SummaryRow
              label={`Withdrawal fee (${String(withdrawFeePct)}%)`}
              value={parsedAmount > 0 ? formatMeritsWithGbp(-fee, 2) : '—'}
            />
          </>
        )}
        <SummaryRow
          label="Spend after"
          strong
          value={
            side === 'buy'
              ? formatMeritsWithGbp(spendBalance - intMerits, 1)
              : formatMeritsWithGbp(spendBalance + netMerits, 1)
          }
        />
        <p className={styles.tradeHint}>
          {side === 'buy'
            ? 'Merits are taken from your Spend wallet. Buying is fee-free.'
            : `A ${String(withdrawFeePct)}% fee is charged on the gross merit value when selling.`}
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
            ? 'Investing…'
            : 'Confirm investment'
          : isSelling
            ? 'Processing…'
            : 'Confirm withdrawal'}
      </button>
      {parsedAmount > 0 &&
      parsedAmount > (side === 'buy' ? maxBuy : maxSell) + 0.0001 ? (
        <p className={styles.negativeText}>
          Exceeds your available {side === 'buy' ? 'Spend balance' : 'units'}.
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
