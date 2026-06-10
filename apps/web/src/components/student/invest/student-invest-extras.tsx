'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDate, formatMerits, type AccountTransaction } from './student-invest-data';
import { InvestmentCard, MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

interface ActivityProps {
  transactions: readonly AccountTransaction[];
}

type ActivityFilter = 'all' | 'buy' | 'sell';

const activityFilters: readonly { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'buy', label: 'Investments' },
  { id: 'sell', label: 'Withdrawals' },
];

const transactionMeta: Record<
  'Buy' | 'Sell',
  { color: string; background: string; icon: string; label: string }
> = {
  Buy: { background: '#eaf1fb', color: '#4a7db5', icon: 'B', label: 'Invested' },
  Sell: { background: '#fce8ea', color: '#7d1c2c', icon: 'W', label: 'Withdrawn' },
};

export function InvestmentActivity({ transactions }: ActivityProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const filteredTransactions = transactions.filter((transaction) => {
    if (filter === 'all') return true;
    if (filter === 'buy') return transaction.type === 'Buy';
    return transaction.type === 'Sell';
  });

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <p className={styles.eyebrow}>Activity</p>
          <h1>Investment history</h1>
          <p>Every investment and withdrawal in your fund account.</p>
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
        {filteredTransactions.map((transaction) => {
          const meta = transactionMeta[transaction.type];
          const meritValue = transaction.units * transaction.nav;
          const isBuy = transaction.type === 'Buy';
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
                <strong>{meta.label}</strong>
                <span>
                  {formatDate(new Date(transaction.createdAt))} —{' '}
                  {transaction.units.toFixed(4)} units @ {formatMerits(transaction.nav, 2)} merits
                  {!isBuy && transaction.feeMerits > 0
                    ? ` (fee: ${formatMerits(transaction.feeMerits, 2)})`
                    : ''}
                </span>
              </span>
              <strong className={isBuy ? undefined : styles.positiveText}>
                {isBuy ? '' : '+'}
                <MeritIcon size={13} />
                {' '}
                {formatMerits(isBuy ? meritValue : meritValue - transaction.feeMerits, 1)}
              </strong>
            </article>
          );
        })}
        {filteredTransactions.length === 0 ? (
          <p className={styles.emptyState}>
            {transactions.length === 0
              ? 'No transactions yet. Invest some merits to get started.'
              : `No ${filter === 'buy' ? 'investment' : 'withdrawal'} activity yet.`}
          </p>
        ) : null}
      </InvestmentCard>
    </>
  );
}
