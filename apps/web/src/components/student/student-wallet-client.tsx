'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Gift, Landmark, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentWallet = RouterOutputs['student']['wallet'];
type WalletBalances = StudentWallet['balances'];
type TitheStatus = RouterOutputs['tithe']['getStatus'];

const balanceCards = [
  { field: 'Spend', label: 'Spend', detail: 'Ready to use' },
  { field: 'Saving', label: 'Saving', detail: 'Set aside' },
  { field: 'Investment', label: 'Investment', detail: 'Invested merits' },
  { field: 'ShopReserved', label: 'Held', detail: 'Shop reservations' },
  { field: 'TithePaid', label: 'Tithed', detail: 'Given as tithe' },
  { field: 'Given', label: 'Charity', detail: 'Given to the pot' },
] as const satisfies readonly {
  field: keyof WalletBalances;
  label: string;
  detail: string;
}[];

const weeklyDayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const meritFormatter = new Intl.NumberFormat('en-GB');
const walletDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatMerits(value: number): string {
  return meritFormatter.format(value);
}

function formatSignedMerits(value: number): string {
  const formatted = formatMerits(Math.abs(value));
  if (value < 0) return `-${formatted}`;
  return `+${formatted}`;
}

function formatDate(value: Date): string {
  return walletDateFormatter.format(value);
}

function accountLabel(account: StudentWallet['history'][number]['account']): string {
  switch (account) {
    case 'Spend':
      return 'Spend';
    case 'Saving':
      return 'Saving';
    case 'Investment':
      return 'Investment';
    case 'InvestmentReturn':
      return 'Investment return';
    case 'TithePaid':
      return 'Tithe';
    case 'Given':
      return 'Charity';
    case 'FeeSink':
      return 'Fee';
    case 'TaxSink':
      return 'Tax';
    case 'ShopReserved':
      return 'Held';
  }
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
            className={
              positive ? 'student-wallet-row is-positive' : 'student-wallet-row is-negative'
            }
            key={entry.id}
          >
            <span aria-hidden="true">
              <Icon size={16} />
            </span>
            <div>
              <time dateTime={entry.createdAt.toISOString()}>{formatDate(entry.createdAt)}</time>
              <small>
                {accountLabel(entry.account)} · {entry.reason.replaceAll(':', ' ')}
              </small>
            </div>
            <strong>{formatSignedMerits(entry.amount)}</strong>
          </article>
        );
      })}
    </div>
  );
}

function NumberInput({
  label,
  max,
  min = 1,
  onChange,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="student-wallet-field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        max={max}
        min={min}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        type="number"
        value={value}
      />
    </label>
  );
}

function amountFromInput(value: string): number | null {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}

function SavingsPanel({ balances, studentId }: { balances: WalletBalances; studentId: string }) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState('');
  const transfer = api.meritLedger.transfer.useMutation({
    async onSuccess() {
      setAmount('');
      showSuccessToast('Savings transfer complete.');
      await utils.student.wallet.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Savings transfer failed.');
    },
  });
  const parsedAmount = amountFromInput(amount);
  const interestPreview = Math.max(0, Math.round(balances.Saving * (0.06 / 12)));

  function move(direction: 'Deposit' | 'Withdraw'): void {
    if (!parsedAmount) return;
    transfer.mutate({
      studentId,
      from: direction === 'Deposit' ? 'Spend' : 'Saving',
      to: direction === 'Deposit' ? 'Saving' : 'Spend',
      amount: parsedAmount,
    });
  }

  return (
    <section className="student-dashboard-panel" aria-labelledby="student-savings-title">
      <div className="student-dashboard-panel__head">
        <div>
          <p>Savings</p>
          <h2 id="student-savings-title">Savings account</h2>
        </div>
        <Landmark aria-hidden="true" size={20} />
      </div>
      <p className="student-dashboard-panel__copy">
        Monthly interest is paid at 6% APR. Next estimated payout: {formatMerits(interestPreview)}.
      </p>
      <div className="student-wallet-action-row">
        <NumberInput label="Merits" onChange={setAmount} value={amount} />
        <button
          disabled={!parsedAmount || transfer.isPending || balances.Spend < parsedAmount}
          onClick={() => {
            move('Deposit');
          }}
          type="button"
        >
          Deposit
        </button>
        <button
          disabled={!parsedAmount || transfer.isPending || balances.Saving < parsedAmount}
          onClick={() => {
            move('Withdraw');
          }}
          type="button"
        >
          Withdraw
        </button>
      </div>
    </section>
  );
}

function TithePanel({ status }: { status: TitheStatus }) {
  const utils = api.useUtils();
  const [cadence, setCadence] = useState(status.config.cadence);
  const [mode, setMode] = useState(status.config.mode);
  const [percentage, setPercentage] = useState(String(status.config.percentage));
  const [fixedAmount, setFixedAmount] = useState(String(status.config.fixedAmount ?? ''));
  const [weeklyDay, setWeeklyDay] = useState(String(status.config.weeklyDay));
  const [monthlyDate, setMonthlyDate] = useState(String(status.config.monthlyDate));

  const updatePreference = api.tithe.updatePreference.useMutation({
    async onSuccess() {
      showSuccessToast('Tithe preference saved.');
      await utils.tithe.getStatus.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Tithe preference could not be saved.');
    },
  });
  const payDue = api.tithe.payDue.useMutation({
    async onSuccess() {
      showSuccessToast('Tithe paid.');
      await Promise.all([utils.tithe.getStatus.invalidate(), utils.student.wallet.invalidate()]);
    },
    onError(error) {
      showErrorToast(error, 'Tithe could not be paid.');
    },
  });

  function savePreference(): void {
    const nextPercentage = Number(percentage);
    const nextFixedAmount = Number(fixedAmount);
    updatePreference.mutate({
      cadence,
      mode,
      percentage: mode === 'Percentage' ? nextPercentage : undefined,
      fixedAmount: mode === 'FixedAmount' ? nextFixedAmount : undefined,
      weeklyDay: Number(weeklyDay),
      monthlyDate: Number(monthlyDate),
    });
  }

  return (
    <section className="student-dashboard-panel" aria-labelledby="student-tithe-title">
      <div className="student-dashboard-panel__head">
        <div>
          <p>Tithe</p>
          <h2 id="student-tithe-title">Manual tithe</h2>
        </div>
      </div>
      <div className={status.shopBlocked ? 'student-tithe-status is-due' : 'student-tithe-status'}>
        <strong>{status.paid || !status.shopBlocked ? 'Up to date' : 'Tithe due'}</strong>
        <span>
          Earned {formatMerits(status.grossMerits)} this period. Minimum tithe:{' '}
          {formatMerits(status.minimumAmount)}.
        </span>
      </div>
      <div className="student-wallet-preference-grid">
        <label className="student-wallet-field">
          <span>Cadence</span>
          <select
            onChange={(event) => {
              setCadence(event.target.value as TitheStatus['config']['cadence']);
            }}
            value={cadence}
          >
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </label>
        <label className="student-wallet-field">
          <span>Type</span>
          <select
            onChange={(event) => {
              setMode(event.target.value as TitheStatus['config']['mode']);
            }}
            value={mode}
          >
            <option value="Percentage">Percentage</option>
            <option value="FixedAmount">Amount</option>
          </select>
        </label>
        {mode === 'Percentage' ? (
          <NumberInput label="Percent" min={10} onChange={setPercentage} value={percentage} />
        ) : (
          <NumberInput label="Amount" onChange={setFixedAmount} value={fixedAmount} />
        )}
        {cadence === 'Weekly' ? (
          <label className="student-wallet-field">
            <span>Tithe day</span>
            <select
              onChange={(event) => {
                setWeeklyDay(event.target.value);
              }}
              value={weeklyDay}
            >
              {weeklyDayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <NumberInput
            label="Tithe date"
            max={31}
            min={1}
            onChange={setMonthlyDate}
            value={monthlyDate}
          />
        )}
      </div>
      <div className="student-wallet-action-row">
        <button disabled={updatePreference.isPending} onClick={savePreference} type="button">
          Save tithe
        </button>
        <button
          disabled={!status.canPay || payDue.isPending}
          onClick={() => {
            payDue.mutate();
          }}
          type="button"
        >
          Pay {formatMerits(status.selectedAmount)}
        </button>
      </div>
      {!status.paymentValid ? (
        <p className="status--error">Chosen amount is below this period&apos;s 10% minimum.</p>
      ) : null}
    </section>
  );
}

function CharityPanel({ balances, studentId }: { balances: WalletBalances; studentId: string }) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState('');
  const give = api.meritLedger.giveToCharity.useMutation({
    async onSuccess() {
      setAmount('');
      showSuccessToast('Charity gift added.');
      await Promise.all([
        utils.student.wallet.invalidate(),
        utils.leaderboard.charityPot.get.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Charity gift failed.');
    },
  });
  const parsedAmount = amountFromInput(amount);

  return (
    <section className="student-dashboard-panel" aria-labelledby="student-charity-title">
      <div className="student-dashboard-panel__head">
        <div>
          <p>Charity</p>
          <h2 id="student-charity-title">Charity pot</h2>
        </div>
        <Gift aria-hidden="true" size={20} />
      </div>
      <p className="student-dashboard-panel__copy">
        Give Spend merits to the shared charity pot. You have given {formatMerits(balances.Given)}.
      </p>
      <div className="student-wallet-action-row">
        <NumberInput label="Merits" onChange={setAmount} value={amount} />
        <button
          disabled={!parsedAmount || give.isPending || balances.Spend < parsedAmount}
          onClick={() => {
            if (parsedAmount) give.mutate({ studentId, amount: parsedAmount });
          }}
          type="button"
        >
          Give
        </button>
      </div>
    </section>
  );
}

export function StudentWalletClient() {
  const wallet = api.student.wallet.useQuery(undefined, { retry: false });
  const titheStatus = api.tithe.getStatus.useQuery(undefined, { retry: false });

  if (wallet.isLoading || titheStatus.isLoading) {
    return <div className="student-inline-state">Loading wallet...</div>;
  }

  if (wallet.error || titheStatus.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(wallet.error ?? titheStatus.error)}
        title="Wallet unavailable"
      />
    );
  }

  if (!wallet.data || !titheStatus.data) {
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

      <div className="student-wallet-management-grid">
        <SavingsPanel balances={wallet.data.balances} studentId={wallet.data.studentId} />
        <TithePanel status={titheStatus.data} />
        <CharityPanel balances={wallet.data.balances} studentId={wallet.data.studentId} />
      </div>

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
