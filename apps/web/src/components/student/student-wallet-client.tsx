'use client';

import { ArrowDown, ArrowUp, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentWallet = RouterOutputs['student']['wallet'];
type WalletBalances = StudentWallet['balances'];

const balanceCards = [
  { field: 'Spend', label: 'Spend', detail: 'Ready to use' },
  { field: 'Saving', label: 'Saving', detail: 'Set aside' },
  { field: 'Investment', label: 'Investment', detail: 'Invested merits' },
  { field: 'ShopReserved', label: 'Held', detail: 'Shop reservations' },
] as const satisfies readonly {
  field: keyof WalletBalances;
  label: string;
  detail: string;
}[];

function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function formatSignedMerits(value: number): string {
  const formatted = formatMerits(Math.abs(value));
  if (value < 0) return `-${formatted}`;
  return `+${formatted}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function WalletBalanceGrid({ balances }: { balances: WalletBalances }) {
  return (
    <section className="student-wallet-grid" aria-label="Wallet account balances">
      {balanceCards.map((card) => (
        <article className="student-wallet-balance-card" key={card.field}>
          <small>{card.label}</small>
          <strong>{formatMerits(balances[card.field])}</strong>
          <span>{card.detail}</span>
        </article>
      ))}
    </section>
  );
}

function WalletHistory({ history }: { history: StudentWallet['history'] }) {
  if (history.length === 0) {
    return <div className="student-dashboard-empty">No merit activity has been recorded yet.</div>;
  }

  return (
    <div className="student-wallet-history" aria-label="Merit history">
      {history.map((entry) => {
        const positive = entry.amount >= 0;
        const Icon = positive ? ArrowUp : ArrowDown;
        return (
          <article
            className={positive ? 'student-wallet-row is-positive' : 'student-wallet-row is-negative'}
            key={entry.id}
          >
            <span aria-hidden="true">
              <Icon size={16} />
            </span>
            <time dateTime={entry.createdAt.toISOString()}>{formatDate(entry.createdAt)}</time>
            <strong>{formatSignedMerits(entry.amount)}</strong>
          </article>
        );
      })}
    </div>
  );
}

export function StudentWalletClient() {
  const wallet = api.student.wallet.useQuery(undefined, { retry: false });

  if (wallet.isLoading) {
    return <div className="student-inline-state">Loading wallet...</div>;
  }

  if (wallet.error) {
    return <EmptyState detail={friendlyErrorMessage(wallet.error)} title="Wallet unavailable" />;
  }

  if (!wallet.data) {
    return <EmptyState detail="No wallet data was returned." title="No wallet data" />;
  }

  return (
    <div className="student-page student-wallet-page">
      <section className="student-wallet-hero">
        <div>
          <p>Wallet</p>
          <h1>Merit balance</h1>
          <span>Only dates and merit amounts are shown in your history.</span>
        </div>
        <div className="student-wallet-total">
          <Wallet aria-hidden="true" size={18} />
          <small>Total</small>
          <strong>{formatMerits(wallet.data.totalMerits)}</strong>
        </div>
      </section>

      <WalletBalanceGrid balances={wallet.data.balances} />

      <section className="student-dashboard-panel" aria-labelledby="student-wallet-history-title">
        <div className="student-dashboard-panel__head">
          <div>
            <p>History</p>
            <h2 id="student-wallet-history-title">Recent merit changes</h2>
          </div>
        </div>
        <WalletHistory history={wallet.data.history} />
      </section>
    </div>
  );
}
