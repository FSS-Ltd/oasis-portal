'use client';

import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  capitalGainsTaxPct,
  formatMerits,
  formatSignedMerits,
  withdrawFeePct,
  type AccountHolding,
  type ChartSeries,
  type Instrument,
  type RangeId,
} from './student-invest-data';
import { AreaChart, InvestmentCard, MeritIcon, RangeTabs } from './student-invest-ui';
import styles from './student-invest.module.css';

interface PortfolioPageProps {
  holdings: readonly AccountHolding[];
  loading: boolean;
  navSeries: ChartSeries;
  portfolioCostBasisMerits: number;
  portfolioReturnMerits: number;
  portfolioValueMerits: number;
}

interface InvestPageProps {
  investmentBalanceMerits: number;
  instruments: readonly Instrument[];
  isBuying: boolean;
  onBuyHolding: (input: { instrumentId: string; merits: number }) => void;
  spendBalance: number;
}

interface WithdrawPageProps {
  holdings: readonly AccountHolding[];
  isWithdrawing: boolean;
  loading: boolean;
  onWithdrawPortfolio: (grossMerits: number) => void;
  portfolioCostBasisMerits: number;
  portfolioValueMerits: number;
  spendBalance: number;
}

export function InvestmentPortfolioPage({
  holdings,
  loading,
  navSeries,
  portfolioCostBasisMerits,
  portfolioReturnMerits,
  portfolioValueMerits,
}: PortfolioPageProps) {
  const [range, setRange] = useState<RangeId>('1M');

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <Link className={styles.backLink} href={{ pathname: '/student/invest' }}>
            ‹ Overview
          </Link>
          <h1>Portfolio growth</h1>
        </div>
      </section>

      <InvestmentCard>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.heroValue}>
              <MeritIcon size={30} />
              {formatMerits(portfolioValueMerits, 1)}
            </div>
            <div className={styles.valueMeta}>
              <span
                className={portfolioReturnMerits >= 0 ? styles.positiveText : styles.negativeText}
              >
                {formatSignedMerits(portfolioReturnMerits, 1)} (
                {portfolioCostBasisMerits > 0
                  ? `${((portfolioReturnMerits / portfolioCostBasisMerits) * 100).toFixed(2)}%`
                  : '+0.00%'}
                )
              </span>
              <span className={styles.smallText}>all time</span>
            </div>
          </div>
          <RangeTabs onCustom={() => {}} onRange={setRange} value={range} />
        </div>
        {navSeries.points.length > 0 ? (
          <AreaChart height={300} series={navSeries} />
        ) : (
          <p className={styles.emptyState}>Portfolio growth appears after market history loads.</p>
        )}
      </InvestmentCard>

      <InvestmentCard flush>
        <div className={styles.tableToolbar}>
          <span className={styles.sectionLabel}>Your holdings · {holdings.length}</span>
          <Link className={styles.secondaryButton} href={{ pathname: '/student/invest/invest' }}>
            Browse market
          </Link>
        </div>
        {loading ? <PortfolioSkeleton /> : null}
        {!loading && holdings.length > 0 ? <HoldingsTable holdings={holdings} /> : null}
        {!loading && holdings.length === 0 ? <EmptyPortfolio /> : null}
      </InvestmentCard>
    </>
  );
}

export function InvestmentInvestPage({
  investmentBalanceMerits,
  instruments,
  isBuying,
  onBuyHolding,
  spendBalance,
}: InvestPageProps) {
  const priced = instruments.filter((instrument) => instrument.instrumentId && instrument.priceMerits);
  const [instrumentId, setInstrumentId] = useState(priced[0]?.instrumentId ?? '');
  const selectedInstrumentId = instrumentId || priced[0]?.instrumentId || '';
  const [amount, setAmount] = useState('');
  const selected = priced.find((instrument) => instrument.instrumentId === selectedInstrumentId);
  const merits = Math.floor(Number.parseFloat(amount) || 0);
  const priceMerits = selected?.priceMerits ?? 0;
  const units = merits > 0 && priceMerits > 0 ? merits / priceMerits : 0;
  const valid = Boolean(selected?.instrumentId) && merits > 0 && merits <= Math.floor(spendBalance);

  function submit() {
    if (!valid || !selected?.instrumentId) return;
    onBuyHolding({ instrumentId: selected.instrumentId, merits });
    setAmount('');
  }

  return (
    <>
      <TransferHeader
        description="Move merits from Spend into a stock or ETF. Investing has no fees or taxes."
        title="Invest merits"
      />
      <div className={styles.transferGrid}>
        <InvestmentCard>
          <span className={styles.sectionLabel}>From → To</span>
          <RouteBoxes
            leftLabel="Spend wallet"
            leftValue={spendBalance}
            rightLabel="Investment"
            rightValue={investmentBalanceMerits}
          />
          <label className={styles.fieldLabel} htmlFor="investment-instrument">
            Choose investment
          </label>
          <select
            className={styles.selectInput}
            id="investment-instrument"
            onChange={(event) => {
              setInstrumentId(event.target.value);
            }}
            value={selectedInstrumentId}
          >
            {priced.map((instrument) => (
              <option key={instrument.instrumentId} value={instrument.instrumentId}>
                {instrument.ticker} · {instrument.name}
              </option>
            ))}
          </select>
          <AmountInput
            amount={amount}
            id="invest-amount"
            label="Amount to invest"
            max={Math.floor(spendBalance)}
            onAmount={setAmount}
          />
        </InvestmentCard>

        <InvestmentCard>
          <span className={styles.sectionLabel}>Breakdown</span>
          <SummaryLine label="You invest" value={merits} />
          <SummaryLine label="Fees" muted value={0} />
          <SummaryLine label="Taxes" muted value={0} />
          <div className={styles.summaryTotal}>
            <strong>Units bought</strong>
            <span>{units > 0 ? units.toFixed(4) : '0.0000'}</span>
          </div>
          <p className={styles.tradeHint}>Buying uses whole merits from Spend. No fee or tax applies.</p>
          <button
            className={cn(styles.button, styles.buttonFull)}
            disabled={!valid || isBuying}
            onClick={submit}
            type="button"
          >
            <MeritIcon size={15} /> {isBuying ? 'Investing merits' : 'Invest merits'}
          </button>
        </InvestmentCard>
      </div>
    </>
  );
}

export function InvestmentWithdrawPage({
  holdings,
  isWithdrawing,
  loading,
  onWithdrawPortfolio,
  portfolioCostBasisMerits,
  portfolioValueMerits,
  spendBalance,
}: WithdrawPageProps) {
  const [amount, setAmount] = useState('');
  const grossMerits = Math.floor(Number.parseFloat(amount) || 0);
  const fee = Math.floor((grossMerits * withdrawFeePct) / 100);
  const estimatedCostBasis =
    portfolioValueMerits > 0
      ? Math.floor((portfolioCostBasisMerits * grossMerits) / portfolioValueMerits)
      : 0;
  const taxableGain = Math.max(0, grossMerits - estimatedCostBasis);
  const tax = Math.floor((taxableGain * capitalGainsTaxPct) / 100);
  const net = grossMerits - fee - tax;
  const valid = holdings.length > 0 && grossMerits > 0 && grossMerits <= portfolioValueMerits;

  function submit() {
    if (!valid) return;
    onWithdrawPortfolio(grossMerits);
    setAmount('');
  }

  if (loading || holdings.length === 0) {
    return (
      <>
        <TransferHeader
          description="Cash out some of your investments to spend in the Merit Shop. A small fee and tax apply."
          title="Withdraw to Spend wallet"
        />
        <InvestmentCard>
          <span className={styles.sectionLabel}>From → To</span>
          <RouteBoxes
            leftLabel="Investment"
            leftValue={portfolioValueMerits}
            rightLabel="Spend wallet"
            rightValue={spendBalance}
          />
          <div className={styles.portfolioEmpty}>
            <PortfolioSkeleton />
            <div>
              <h2>{loading ? 'Loading holdings' : 'No holdings to withdraw'}</h2>
              <p>
                {loading
                  ? 'Your stocks and ETFs will appear here when the portfolio is ready.'
                  : 'Buy a stock or ETF first. Withdrawals sell a small slice of each holding.'}
              </p>
              <Link className={styles.button} href={{ pathname: '/student/invest/invest' }}>
                Invest merits
              </Link>
            </div>
          </div>
        </InvestmentCard>
      </>
    );
  }

  return (
    <>
      <TransferHeader
        description="Cash out some of your investments to spend in the Merit Shop. A small fee and tax apply."
        title="Withdraw to Spend wallet"
      />
      <div className={styles.transferGrid}>
        <InvestmentCard>
          <span className={styles.sectionLabel}>From → To</span>
          <RouteBoxes
            leftLabel="Investment"
            leftValue={portfolioValueMerits}
            rightLabel="Spend wallet"
            rightValue={spendBalance}
          />
          <AmountInput
            amount={amount}
            id="withdraw-amount"
            label="Amount to withdraw"
            max={portfolioValueMerits}
            onAmount={setAmount}
          />
        </InvestmentCard>

        <InvestmentCard>
          <span className={styles.sectionLabel}>Breakdown</span>
          <SummaryLine label="You withdraw" value={grossMerits} />
          <SummaryLine danger label={`Withdrawal fee (${String(withdrawFeePct)}%)`} value={-fee} />
          <SummaryLine
            danger
            label={`Capital-gains tax (${String(capitalGainsTaxPct)}%)`}
            value={-tax}
          />
          <div className={styles.summaryTotal}>
            <strong>Lands in Spend wallet</strong>
            <span>
              <MeritIcon size={16} /> {formatMerits(net, 1)}
            </span>
          </div>
          <p className={styles.tradeHint}>
            Investing profit is taxed. Your original merits come out tax-free.
          </p>
          <button
            className={cn(styles.dangerButton, styles.buttonFull)}
            disabled={!valid || isWithdrawing}
            onClick={submit}
            type="button"
          >
            {isWithdrawing ? 'Withdrawing merits' : 'Withdraw merits'}
          </button>
        </InvestmentCard>
      </div>
      <section className={styles.noticeCard}>
        <Info aria-hidden="true" size={17} />
        <p>
          Withdrawing sells a slice of every holding to raise the merits. If you only need a little,
          consider leaving the rest invested so it can keep growing.
        </p>
      </section>
    </>
  );
}

function HoldingsTable({ holdings }: { holdings: readonly AccountHolding[] }) {
  return (
    <div className={styles.holdingsDesktop}>
      <table className={styles.table}>
        <thead>
          <tr>
            {['Holding', 'Price', 'Units', 'Value', 'Total return', 'Weight'].map((label) => (
              <th className={styles.tableHead} key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.id}>
              <td>
                <span className={styles.holdingCell}>
                  <span className={styles.tickerMark}>{holding.symbol.slice(0, 2)}</span>
                  <span className={styles.holdingMain}>
                    <strong>{holding.symbol}</strong>
                    <span>{holding.displayName}</span>
                  </span>
                </span>
              </td>
              <td>{formatMerits(holding.currentPriceMerits, 1)}</td>
              <td>{holding.units.toFixed(2)}</td>
              <td>
                <strong>{formatMerits(holding.currentValueMerits, 1)}</strong>
              </td>
              <td>
                <span className={holding.returnMerits >= 0 ? styles.positiveText : styles.negativeText}>
                  {formatSignedMerits(holding.returnMerits, 1)}
                </span>
              </td>
              <td>{holding.weightPct.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyPortfolio() {
  return (
    <div className={styles.portfolioEmpty}>
      <PortfolioSkeleton />
      <div>
        <h2>No stocks yet</h2>
        <p>Buy your first stock or ETF and this portfolio table will fill in.</p>
        <Link className={styles.button} href={{ pathname: '/student/invest/invest' }}>
          Invest merits
        </Link>
      </div>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div aria-hidden="true" className={styles.skeletonList}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} style={{ width: `${String(88 - index * 8)}%` }} />
      ))}
    </div>
  );
}

function TransferHeader({ description, title }: { description: string; title: string }) {
  return (
    <section className={styles.screenHeader}>
      <div>
        <Link className={styles.backLink} href={{ pathname: '/student/invest' }}>
          ‹ Overview
        </Link>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

function RouteBoxes({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
}) {
  return (
    <div className={styles.withdrawRoute}>
      <div className={styles.walletBox}>
        <span className={styles.sectionLabel}>{leftLabel}</span>
        <strong>
          <MeritIcon size={17} /> {formatMerits(leftValue, 1)}
        </strong>
      </div>
      <ArrowRight aria-hidden="true" size={22} />
      <div className={styles.spendBox}>
        <span className={styles.sectionLabel}>{rightLabel}</span>
        <strong>
          <MeritIcon size={17} /> {formatMerits(Math.max(0, rightValue), 1)}
        </strong>
      </div>
    </div>
  );
}

function AmountInput({
  amount,
  id,
  label,
  max,
  onAmount,
}: {
  amount: string;
  id: string;
  label: string;
  max: number;
  onAmount: (value: string) => void;
}) {
  const quick = useMemo(() => [5, 10, 25], []);
  return (
    <>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <input
        className={styles.amountInput}
        id={id}
        inputMode="numeric"
        onChange={(event) => {
          onAmount(event.target.value.replace(/\D/g, ''));
        }}
        placeholder="0.0"
        type="text"
        value={amount}
      />
      <div className={styles.quickAmounts}>
        {quick.map((value) => (
          <button
            className={styles.chipButton}
            disabled={value > max}
            key={value}
            onClick={() => {
              onAmount(String(value));
            }}
            type="button"
          >
            {value}
          </button>
        ))}
        <button
          className={styles.chipButton}
          disabled={max <= 0}
          onClick={() => {
            onAmount(String(Math.floor(max)));
          }}
          type="button"
        >
          Max
        </button>
      </div>
    </>
  );
}

function SummaryLine({
  danger = false,
  label,
  muted = false,
  value,
}: {
  danger?: boolean;
  label: string;
  muted?: boolean;
  value: number;
}) {
  return (
    <div className={styles.tradeSummaryRow}>
      <span className={styles.smallText}>{label}</span>
      <strong className={danger ? styles.negativeText : muted ? styles.mutedText : undefined}>
        {value < 0 ? '-' : ''}
        {formatMerits(Math.abs(value), 2)}
      </strong>
    </div>
  );
}
