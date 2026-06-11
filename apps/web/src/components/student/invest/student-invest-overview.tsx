'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  formatMerits,
  formatPercent,
  formatSignedMerits,
  navHistoryToChartSeries,
  percentChange,
  type AccountHolding,
  type NavDto,
  type RangeId,
} from './student-invest-data';
import {
  AreaChart,
  DeltaPill,
  GbpEquivalent,
  HelpTip,
  InvestmentCard,
  MeritIcon,
  MeritValueStack,
  RangeTabs,
} from './student-invest-ui';
import styles from './student-invest.module.css';

interface OverviewProps {
  currentValueMerits: number;
  defaultRange: RangeId;
  holdings: readonly AccountHolding[];
  investmentCashMerits: number;
  latestNav: { nav: number; dailyReturn: number } | null;
  loading: boolean;
  navHistory: readonly NavDto[];
  onNavigate: (screen: 'market') => void;
  portfolioReturnMerits: number;
  portfolioValueMerits: number;
  spendBalance: number;
  studentFirstName: string;
  totalNetWorthMerits: number;
  units: number;
}

export function InvestmentOverview({
  currentValueMerits,
  defaultRange,
  holdings,
  investmentCashMerits,
  latestNav,
  loading,
  navHistory,
  onNavigate,
  portfolioReturnMerits,
  portfolioValueMerits,
  spendBalance,
  studentFirstName,
  totalNetWorthMerits,
  units,
}: OverviewProps) {
  const [range, setRange] = useState<RangeId>(defaultRange);
  const greeting = studentFirstName ? `Good morning, ${studentFirstName}` : 'Good morning';
  const totalReturn = portfolioReturnMerits;
  const stockCostBasis = holdings.reduce((sum, holding) => sum + holding.costBasisMerits, 0);
  const totalReturnPct = stockCostBasis > 0 ? (totalReturn / stockCostBasis) * 100 : 0;
  const dailyReturnPct = latestNav?.dailyReturn ?? 0;
  const dailyReturnMerits = currentValueMerits * (dailyReturnPct / (1 + dailyReturnPct));

  const fullSeries = useMemo(() => navHistoryToChartSeries(navHistory), [navHistory]);

  const series = useMemo(() => {
    if (fullSeries.points.length === 0) return fullSeries;
    const daysForRange = (r: RangeId): number => {
      if (r === '1D') return 1;
      if (r === '1W') return 7;
      if (r === '1M') return 30;
      if (r === '3M') return 90;
      if (r === '1Y') return 365;
      return 9999;
    };
    const days = daysForRange(range);
    const cutoff = fullSeries.points.length - days;
    const sliced = fullSeries.points.slice(Math.max(0, cutoff));
    if (sliced.length === 0) return fullSeries;
    const scaled = sliced.map((p, i) => ({
      ...p,
      x: i / (sliced.length - 1 || 1),
    }));
    return {
      points: scaled,
      first: scaled[0]?.value ?? 0,
      last: scaled[scaled.length - 1]?.value ?? 0,
    };
  }, [fullSeries, range]);

  const rangePct = percentChange(series.first, series.last);

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <h1>{greeting}</h1>
          <p>Here&apos;s how your Merit Markets portfolio is doing today.</p>
        </div>
        <div className={styles.inlineActions}>
          <Link className={styles.secondaryButton} href={{ pathname: '/student/invest/withdraw' }}>
            Withdraw
          </Link>
          <Link className={styles.button} href={{ pathname: '/student/invest/invest' }}>
            + Fund balance
          </Link>
        </div>
      </section>

      <div className={styles.dashboardGrid}>
        <div className={styles.titleBlock}>
          <InvestmentCard>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionLabel}>
                  Total net worth
                  <HelpTip
                    label="Total net worth"
                    text="Investment cash plus the current value of your stocks and ETFs."
                  />
                </span>
                <div className={styles.heroValue}>
                  {loading ? (
                    <span className={styles.mutedText}>Loading…</span>
                  ) : (
                    <>
                      <MeritIcon size={30} />
                      {formatMerits(totalNetWorthMerits, 1)}
                      <span className={styles.smallText}>merits</span>
                    </>
                  )}
                </div>
                <div className={styles.valueMeta}>
                  <span className={dailyReturnPct >= 0 ? styles.positiveText : styles.negativeText}>
                    {formatSignedMerits(dailyReturnMerits, 1)}
                  </span>
                  <DeltaPill value={dailyReturnPct * 100} />
                  <span className={styles.smallText}>today</span>
                  {totalNetWorthMerits > 0 ? <GbpEquivalent value={totalNetWorthMerits} /> : null}
                </div>
              </div>
              <div className={styles.titleBlock}>
                <RangeTabs onCustom={() => {}} onRange={setRange} value={range} />
                <span className={rangePct >= 0 ? styles.positiveText : styles.negativeText}>
                  {formatPercent(rangePct)} NAV change
                </span>
              </div>
            </div>
            {navHistory.length > 0 ? (
              <AreaChart series={series} />
            ) : loading ? (
              <div style={{ height: 180 }} />
            ) : (
              <p className={styles.emptyState}>No NAV history available yet.</p>
            )}
            <div className={styles.metricGrid}>
              <MiniStat label="Fund units" value={<strong>{units.toFixed(4)}</strong>} />
              <MiniStat
                label="Invested"
                value={<MeritValueStack value={investmentCashMerits + portfolioValueMerits} />}
                tip="Unallocated investment cash plus current stock and ETF value."
              />
              <MiniStat
                label="All-time return"
                value={
                  <span className={styles.valueStack}>
                    <span className={totalReturn >= 0 ? styles.positiveText : styles.negativeText}>
                      {formatSignedMerits(totalReturn, 1)} ({formatPercent(totalReturnPct)})
                    </span>
                    <GbpEquivalent value={totalReturn} />
                  </span>
                }
              />
              <MiniStat
                label="Spend balance"
                value={<MeritValueStack value={spendBalance} />}
                tip="Merits available in your Spend wallet to invest."
              />
            </div>
          </InvestmentCard>

          <RiskReminder />
        </div>

        <div className={styles.rightRail}>
          <WeeklyResult value={portfolioReturnMerits} />
          <AllocationCard holdings={holdings} onNavigate={onNavigate} />

          {latestNav ? (
            <InvestmentCard>
              <span className={styles.sectionLabel}>Fund info</span>
              <div className={styles.metricGrid} style={{ marginTop: 8, paddingTop: 8 }}>
                <MiniStat
                  label="NAV today"
                  value={<MeritValueStack digits={2} value={latestNav.nav} />}
                />
                <MiniStat
                  label="Daily return"
                  value={
                    <span
                      className={
                        latestNav.dailyReturn >= 0 ? styles.positiveText : styles.negativeText
                      }
                    >
                      {formatPercent(latestNav.dailyReturn * 100)}
                    </span>
                  }
                />
              </div>
              <p className={styles.tradeHint} style={{ marginTop: 10 }}>
                The fund tracks a diversified basket of global assets. NAV is updated daily.
              </p>
            </InvestmentCard>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, tip, value }: { label: string; tip?: string; value: ReactNode }) {
  return (
    <div className={styles.miniStat}>
      <span className={styles.sectionLabel}>
        {label}
        {tip ? <HelpTip label={label} text={tip} /> : null}
      </span>
      {value}
    </div>
  );
}

function WeeklyResult({ value }: { value: number }) {
  return (
    <section className={styles.darkCard}>
      <span className={styles.sectionLabel}>This week&apos;s result</span>
      <div className={styles.weekValue}>
        <MeritIcon size={26} />
        {formatSignedMerits(value || 0, 1)}
      </div>
      <p className={styles.mutedText}>
        Your portfolio grew over the last 7 days. Nice work staying invested.
      </p>
    </section>
  );
}

function AllocationCard({
  holdings,
  onNavigate,
}: {
  holdings: readonly AccountHolding[];
  onNavigate: (screen: 'market') => void;
}) {
  const sorted = holdings.slice().sort((left, right) => right.weightPct - left.weightPct);
  return (
    <InvestmentCard>
      <div className={styles.cardHeader}>
        <span className={styles.sectionLabel}>Allocation</span>
        <button
          className={styles.ghostButton}
          onClick={() => {
            onNavigate('market');
          }}
          type="button"
        >
          Details →
        </button>
      </div>
      {sorted.length > 0 ? (
        <>
          <div className={styles.allocationBar}>
            {sorted.map((holding) => (
              <span
                key={holding.id}
                style={{
                  backgroundColor: colorForSymbol(holding.symbol),
                  width: `${String(Math.max(4, holding.weightPct))}%`,
                }}
              />
            ))}
          </div>
          <div className={styles.allocationLegend}>
            {sorted.slice(0, 8).map((holding) => (
              <span className={styles.legendItem} key={holding.id}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: colorForSymbol(holding.symbol) }}
                />
                <strong>{holding.symbol}</strong>
                <span>{holding.weightPct.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.emptyState}>Portfolio allocation appears after the first stock buy.</p>
      )}
    </InvestmentCard>
  );
}

function colorForSymbol(symbol: string): string {
  const palette = ['#2e5e8c', '#4338ca', '#1a7a4a', '#555b61', '#6b4c0a', '#4aa176'];
  const code = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[code % palette.length] ?? '#2e5e8c';
}

function RiskReminder() {
  return (
    <section className={styles.noticeCard}>
      <strong>Note</strong>
      <p>
        Investments can go down as well as up. Past performance does not tell you what will happen
        next, so invest merits you do not need straight away.
      </p>
    </section>
  );
}
