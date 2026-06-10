'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  formatMerits,
  formatPercent,
  formatSignedMerits,
  navHistoryToChartSeries,
  percentChange,
  toGbp,
  type NavDto,
  type RangeId,
} from './student-invest-data';
import { TradePanel } from './student-invest-trade';
import {
  AreaChart,
  DeltaPill,
  HelpTip,
  InvestmentCard,
  MeritIcon,
  MeritValue,
  RangeTabs,
} from './student-invest-ui';
import styles from './student-invest.module.css';

interface OverviewProps {
  costBasisMerits: number;
  currentValueMerits: number;
  defaultRange: RangeId;
  isBuying: boolean;
  isSelling: boolean;
  latestNav: { nav: number; dailyReturn: number } | null;
  loading: boolean;
  navHistory: readonly NavDto[];
  onBuy: (merits: number) => void;
  onNavigate: (screen: 'market') => void;
  onSell: (units: number) => void;
  spendBalance: number;
  studentFirstName: string;
  units: number;
}

export function InvestmentOverview({
  costBasisMerits,
  currentValueMerits,
  defaultRange,
  isBuying,
  isSelling,
  latestNav,
  loading,
  navHistory,
  onBuy,
  onNavigate,
  onSell,
  spendBalance,
  studentFirstName,
  units,
}: OverviewProps) {
  const [range, setRange] = useState<RangeId>(defaultRange);
  const greeting = studentFirstName ? `Good morning, ${studentFirstName}` : 'Good morning';
  const totalReturn = currentValueMerits - costBasisMerits;
  const totalReturnPct = costBasisMerits > 0 ? (totalReturn / costBasisMerits) * 100 : 0;
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
          <p className={styles.eyebrow}>Overview</p>
          <h1>{greeting}</h1>
          <p>Here is how your Merit Markets fund is performing.</p>
        </div>
        <div className={styles.inlineActions}>
          <button
            className={styles.button}
            onClick={() => {
              onNavigate('market');
            }}
            type="button"
          >
            Browse market
          </button>
        </div>
      </section>

      <div className={styles.dashboardGrid}>
        <div className={styles.titleBlock}>
          <InvestmentCard>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionLabel}>
                  Portfolio value
                  <HelpTip
                    label="Portfolio value"
                    text="Your investment units multiplied by today's fund NAV — how much your account is worth right now."
                  />
                </span>
                <div className={styles.heroValue}>
                  {loading ? (
                    <span className={styles.mutedText}>Loading…</span>
                  ) : (
                    <>
                      <MeritIcon size={30} />
                      {formatMerits(currentValueMerits, 1)}
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
                  {currentValueMerits > 0 ? (
                    <span className={styles.smallText}>
                      approx £{toGbp(currentValueMerits).toFixed(2)}
                    </span>
                  ) : null}
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
              <MiniStat label="Units held" value={<strong>{units.toFixed(4)}</strong>} />
              <MiniStat
                label="Cost basis"
                value={<MeritValue value={costBasisMerits} />}
                tip="Total merits you have invested in the fund."
              />
              <MiniStat
                label="All-time return"
                value={
                  <span className={totalReturn >= 0 ? styles.positiveText : styles.negativeText}>
                    {formatSignedMerits(totalReturn, 1)} ({formatPercent(totalReturnPct)})
                  </span>
                }
              />
              <MiniStat
                label="Spend balance"
                value={<MeritValue value={spendBalance} />}
                tip="Merits available in your Spend wallet to invest."
              />
            </div>
          </InvestmentCard>

          <RiskReminder />
        </div>

        <div className={styles.rightRail}>
          <InvestmentCard>
            <h2 className={styles.cardTitle}>Invest or withdraw</h2>
            <TradePanel
              isBuying={isBuying}
              isSelling={isSelling}
              latestNav={latestNav}
              onBuy={onBuy}
              onSell={onSell}
              spendBalance={spendBalance}
              units={units}
            />
          </InvestmentCard>

          {latestNav ? (
            <InvestmentCard>
              <span className={styles.sectionLabel}>Fund info</span>
              <div className={styles.metricGrid} style={{ marginTop: 8, paddingTop: 8 }}>
                <MiniStat
                  label="NAV today"
                  value={
                    <strong>
                      <MeritIcon size={12} /> {formatMerits(latestNav.nav, 2)}
                    </strong>
                  }
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

function MiniStat({
  label,
  tip,
  value,
}: {
  label: string;
  tip?: string;
  value: ReactNode;
}) {
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
