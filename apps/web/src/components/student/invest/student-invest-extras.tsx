'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  capitalGainsTaxPct,
  formatMerits,
  holdingsCostMerits,
  netWorthMerits,
  spendWalletBalance,
  withdrawFeePct,
  type Holding,
  type InvestmentTransaction,
  type TransactionKind,
} from './student-invest-data';
import { InvestmentCard, MeritIcon, MeritValue } from './student-invest-ui';
import styles from './student-invest.module.css';

interface WithdrawProps {
  cashMerits: number;
  holdings: readonly Holding[];
  onBack: () => void;
  onToast: (message: string) => void;
  onWithdraw: (grossMerits: number, netMerits: number) => void;
}

interface ActivityProps {
  transactions: readonly InvestmentTransaction[];
}

type ActivityFilter = 'all' | 'buy' | 'income' | 'sell' | 'withdraw';

const activityFilters: readonly { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'buy', label: 'Buys' },
  { id: 'sell', label: 'Sells' },
  { id: 'income', label: 'Income' },
  { id: 'withdraw', label: 'Transfers' },
];

const transactionMeta: Record<
  TransactionKind,
  { color: string; background: string; icon: string; label: string }
> = {
  award: { background: '#fbf3d9', color: '#b8860b', icon: '+', label: 'Merit deposit' },
  buy: { background: '#eaf1fb', color: '#4a7db5', icon: 'B', label: 'Bought' },
  dividend: { background: '#e3f5ec', color: '#137a47', icon: '*', label: 'Dividend' },
  sell: { background: '#fbf1e3', color: '#9b6a2f', icon: 'S', label: 'Sold' },
  withdraw: { background: '#fce8ea', color: '#7d1c2c', icon: 'W', label: 'Withdrawal' },
};

export function InvestmentWithdraw({
  cashMerits,
  holdings,
  onBack,
  onToast,
  onWithdraw,
}: WithdrawProps) {
  const [amount, setAmount] = useState('');
  const liveHoldings = holdings.filter((holding) => holding.units > 0);
  const netWorth = netWorthMerits(liveHoldings, cashMerits);
  const cost = holdingsCostMerits(liveHoldings) + cashMerits;
  const totalGain = Math.max(0, netWorth - cost);
  const gainRatio = totalGain / (netWorth || 1);
  const gross = Math.min(Number.parseFloat(amount) || 0, netWorth);
  const fee = (gross * withdrawFeePct) / 100;
  const taxableGain = gross * gainRatio;
  const tax = (taxableGain * capitalGainsTaxPct) / 100;
  const net = Math.max(0, gross - fee - tax);
  const valid = gross >= 1;

  function submit() {
    if (!valid) return;
    onWithdraw(gross, net);
    onToast(`Withdrew ${formatMerits(gross, 1)} merits. ${formatMerits(net, 1)} landed in Spend.`);
    setAmount('');
    onBack();
  }

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <button className={styles.ghostButton} onClick={onBack} type="button">
            Back to overview
          </button>
          <h1>Withdraw to Spend wallet</h1>
          <p>Cash out investments to spend in the Merit Shop. A fee and profit tax apply.</p>
        </div>
      </section>

      <div className={styles.withdrawGrid}>
        <InvestmentCard>
          <span className={styles.sectionLabel}>From to</span>
          <div className={styles.withdrawRoute}>
            <div className={styles.walletBox}>
              <span className={styles.metaLabel}>Investment</span>
              <MeritValue value={netWorth} />
            </div>
            <span className={styles.strongValue}>to</span>
            <div className={styles.spendBox}>
              <span className={styles.metaLabel}>Spend wallet</span>
              <MeritValue value={spendWalletBalance} />
            </div>
          </div>
          <label className={styles.fieldLabel} htmlFor="withdraw-merits">
            Amount to withdraw
          </label>
          <input
            className={styles.amountInput}
            id="withdraw-merits"
            inputMode="decimal"
            onChange={(event) => {
              setAmount(event.target.value.replace(/[^0-9.]/g, ''));
            }}
            placeholder="0.0"
            type="text"
            value={amount}
          />
          <div className={styles.quickAmounts}>
            {[5, 10, 25].map((chip) => (
              <button
                className={styles.chipButton}
                key={chip}
                onClick={() => {
                  setAmount(String(chip));
                }}
                type="button"
              >
                {chip}
              </button>
            ))}
            <button
              className={styles.chipButton}
              onClick={() => {
                setAmount(String(Number(netWorth.toFixed(1))));
              }}
              type="button"
            >
              Max
            </button>
          </div>
        </InvestmentCard>

        <InvestmentCard>
          <span className={styles.sectionLabel}>Breakdown</span>
          <div className={styles.tradeSummary}>
            <BreakdownRow label="You withdraw" value={formatMerits(gross, 2)} />
            <BreakdownRow
              label={`Withdrawal fee (${String(withdrawFeePct)}%)`}
              negative
              value={`-${formatMerits(fee, 2)}`}
            />
            <BreakdownRow
              label={`Capital-gains tax (${String(capitalGainsTaxPct)}%)`}
              negative
              value={`-${formatMerits(tax, 2)}`}
            />
            <div className={styles.tradeSummaryRow}>
              <strong>Lands in Spend wallet</strong>
              <MeritValue colorClass={styles.positiveText} value={net} />
            </div>
            <p className={styles.tradeHint}>
              Profit tax is charged only on growth, not on the merits originally invested.
            </p>
          </div>
          <button
            className={cn(styles.button, styles.buttonFull)}
            disabled={!valid}
            onClick={submit}
            type="button"
          >
            Withdraw {valid ? formatMerits(gross, 1) : ''} merits
          </button>
        </InvestmentCard>
      </div>

      <section className={styles.noticeCard}>
        <strong>Note</strong>
        <p>
          Withdrawing sells a proportional slice of every holding. If you only need a little, the
          rest can stay invested.
        </p>
      </section>
    </>
  );
}

export function InvestmentActivity({ transactions }: ActivityProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const filteredTransactions = transactions.filter((transaction) => {
    if (filter === 'all') return true;
    if (filter === 'income') return transaction.kind === 'award' || transaction.kind === 'dividend';
    return transaction.kind === filter;
  });

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <p className={styles.eyebrow}>Activity</p>
          <h1>Investment history</h1>
          <p>Every trade, deposit, dividend, and withdrawal in the prototype account.</p>
        </div>
      </section>

      <div className={styles.activityFilters}>
        {activityFilters.map((item) => (
          <button
            className={cn(
              styles.tabButton,
              filter === item.id ? styles.tabButtonActive : undefined,
            )}
            key={item.id}
            onClick={() => {
              setFilter(item.id);
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <InvestmentCard flush>
        {filteredTransactions.map((transaction, index) => {
          const meta = transactionMeta[transaction.kind];
          const sign =
            transaction.kind === 'buy' ? '' : transaction.kind === 'withdraw' ? '-' : '+';
          return (
            <article className={styles.activityRow} key={transaction.id}>
              <span
                aria-hidden="true"
                className={styles.activityIcon}
                style={{ backgroundColor: meta.background, color: meta.color }}
              >
                {meta.icon}
              </span>
              <span className={styles.activityMain}>
                <strong>
                  {meta.label}
                  {transaction.ticker ? ` - ${transaction.ticker}` : ''}
                </strong>
                <span>
                  {transaction.date}
                  {transaction.note ? ` - ${transaction.note}` : ''}
                  {transaction.units ? ` - ${transaction.units.toFixed(2)} units` : ''}
                </span>
              </span>
              <strong
                className={
                  transaction.kind === 'withdraw' || transaction.kind === 'buy'
                    ? undefined
                    : styles.positiveText
                }
              >
                {sign}
                <MeritIcon size={13} /> {formatMerits(Math.abs(transaction.merits), 1)}
              </strong>
              {index === filteredTransactions.length - 1 ? null : null}
            </article>
          );
        })}
        {filteredTransactions.length === 0 ? (
          <p className={styles.emptyState}>No {filter} activity yet.</p>
        ) : null}
      </InvestmentCard>
    </>
  );
}

function BreakdownRow({
  label,
  negative = false,
  value,
}: {
  label: string;
  negative?: boolean;
  value: string;
}) {
  return (
    <div className={styles.tradeSummaryRow}>
      <span className={styles.smallText}>{label}</span>
      <strong className={negative ? styles.negativeText : undefined}>{value}</strong>
    </div>
  );
}

export function proportionalWithdrawalScale(
  holdings: readonly Holding[],
  cashMerits: number,
  grossMerits: number,
): number {
  const netWorth = netWorthMerits(holdings, cashMerits);
  if (netWorth <= 0) return 0;
  return Math.max(0, (netWorth - grossMerits) / netWorth);
}
