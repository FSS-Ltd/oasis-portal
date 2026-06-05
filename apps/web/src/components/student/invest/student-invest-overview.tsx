'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
  dayDate,
  formatDateInput,
  formatGbp,
  formatMerits,
  formatPercent,
  formatShortDate,
  formatSignedMerits,
  holdingCostMerits,
  holdingDayProfitLoss,
  holdingValueMerits,
  holdingsCostMerits,
  holdingsValueMerits,
  instrumentForTicker,
  netWorthMerits,
  portfolioSeries,
  today,
  toGbp,
  toMerits,
  type CustomRange,
  type Holding,
  type Instrument,
  type RangeId,
} from './student-invest-data';
import {
  AreaChart,
  DeltaPill,
  HelpTip,
  InvestmentCard,
  MeritIcon,
  MeritValue,
  RangeTabs,
  Sparkline,
  TickerMark,
} from './student-invest-ui';
import styles from './student-invest.module.css';

interface OverviewProps {
  cashMerits: number;
  defaultRange: RangeId;
  holdings: readonly Holding[];
  onNavigate: (screen: 'market' | 'portfolio' | 'withdraw') => void;
  onOpenStock: (ticker: string) => void;
}

interface PortfolioProps {
  cashMerits: number;
  defaultRange: RangeId;
  holdings: readonly Holding[];
  onNavigate: (screen: 'market' | 'overview') => void;
  onOpenStock: (ticker: string) => void;
}

interface AllocationRow {
  holding: Holding;
  instrument: Instrument;
  value: number;
  weight: number;
}

export function InvestmentOverview({
  cashMerits,
  defaultRange,
  holdings,
  onNavigate,
  onOpenStock,
}: OverviewProps) {
  const [range, setRange] = useState<RangeId>(defaultRange);
  const liveHoldings = holdings.filter((holding) => holding.units > 0.000001);
  const netWorth = netWorthMerits(liveHoldings, cashMerits);
  const invested = holdingsValueMerits(liveHoldings);
  const cost = holdingsCostMerits(liveHoldings);
  const totalReturn = invested - cost;
  const totalReturnPct = (totalReturn / (cost || 1)) * 100;
  const dayProfitLoss = liveHoldings.reduce(
    (total, holding) => total + holdingDayProfitLoss(holding),
    0,
  );
  const dayPct = (dayProfitLoss / (netWorth - dayProfitLoss || 1)) * 100;
  const weekSeries = portfolioSeries(liveHoldings, cashMerits, '1W', null);
  const weekDelta = weekSeries.last - weekSeries.first;
  const weekPct = (weekDelta / (weekSeries.first || 1)) * 100;
  const series = portfolioSeries(liveHoldings, cashMerits, range, null);
  const rangePct = ((series.last - series.first) / (series.first || 1)) * 100;
  const movers = liveHoldings
    .map((holding) => instrumentForTicker(holding.ticker))
    .sort((left, right) => right.dayChangePct - left.dayChangePct);
  const risers = movers.filter((instrument) => instrument.dayChangePct >= 0).slice(0, 3);
  const fallers = movers
    .filter((instrument) => instrument.dayChangePct < 0)
    .reverse()
    .slice(0, 3);

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <p className={styles.eyebrow}>Overview</p>
          <h1>Good morning, Grace</h1>
          <p>Here is how your Merit Markets portfolio is doing today.</p>
        </div>
        <div className={styles.inlineActions}>
          <button
            className={styles.secondaryButton}
            onClick={() => {
              onNavigate('withdraw');
            }}
            type="button"
          >
            Withdraw
          </button>
          <button
            className={styles.button}
            onClick={() => {
              onNavigate('market');
            }}
            type="button"
          >
            Invest merits
          </button>
        </div>
      </section>

      <div className={styles.dashboardGrid}>
        <InvestmentCard>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.sectionLabel}>
                Total net worth
                <HelpTip
                  label="Net worth"
                  text="Everything your investment account is worth right now: holdings at today's prices plus uninvested merits."
                />
              </span>
              <div className={styles.heroValue}>
                <MeritIcon size={30} />
                {formatMerits(netWorth, 1)}
                <span className={styles.smallText}>merits</span>
              </div>
              <div className={styles.valueMeta}>
                <span className={dayProfitLoss >= 0 ? styles.positiveText : styles.negativeText}>
                  {formatSignedMerits(dayProfitLoss, 1)}
                </span>
                <span className={styles.smallText}>{formatPercent(dayPct)} today</span>
                <span className={styles.smallText}>approx {formatGbp(toGbp(netWorth))}</span>
              </div>
            </div>
            <div className={styles.titleBlock}>
              <RangeTabs
                onCustom={() => {
                  onNavigate('portfolio');
                }}
                onRange={setRange}
                value={range}
              />
              <span className={rangePct >= 0 ? styles.positiveText : styles.negativeText}>
                {formatPercent(rangePct)} over range
              </span>
            </div>
          </div>
          <AreaChart series={series} />
          <div className={styles.metricGrid}>
            <MiniStat label="Invested" value={<MeritValue value={invested} />} />
            <MiniStat
              label="Cash"
              value={<MeritValue value={cashMerits} />}
              tip="Merits in your investment account that are ready to buy stocks or ETFs."
            />
            <MiniStat
              label="All-time return"
              value={
                <span className={totalReturn >= 0 ? styles.positiveText : styles.negativeText}>
                  {formatSignedMerits(totalReturn, 1)} ({formatPercent(totalReturnPct)})
                </span>
              }
            />
          </div>
        </InvestmentCard>

        <div className={styles.titleBlock}>
          <section className={styles.darkCard}>
            <div className={styles.cardHeader}>
              <span className={styles.sectionLabel}>This week&apos;s result</span>
              <span className={styles.badge}>{formatPercent(weekPct)}</span>
            </div>
            <div className={styles.weekValue}>
              <MeritIcon size={24} />
              {formatSignedMerits(weekDelta, 1)}
            </div>
            <p className={styles.mutedText}>
              {weekDelta >= 0 ? 'Your portfolio grew' : 'Your portfolio dipped'} over the last 7
              days.
            </p>
            <AreaChart height={92} series={weekSeries} />
          </section>

          <InvestmentCard>
            <div className={styles.cardHeader}>
              <span className={styles.sectionLabel}>Allocation</span>
              <button
                className={styles.ghostButton}
                onClick={() => {
                  onNavigate('portfolio');
                }}
                type="button"
              >
                Details
              </button>
            </div>
            <AllocationBar holdings={liveHoldings} />
          </InvestmentCard>
        </div>
      </div>

      <div className={styles.moversGrid}>
        <InvestmentCard>
          <div className={styles.cardHeader}>
            <span className={styles.sectionLabel}>
              <ArrowUpRight aria-hidden="true" size={16} /> Rising today
            </span>
          </div>
          {risers.length > 0 ? (
            risers.map((instrument) => (
              <MoverRow instrument={instrument} key={instrument.ticker} onOpenStock={onOpenStock} />
            ))
          ) : (
            <p className={styles.emptyState}>Nothing in the green today.</p>
          )}
        </InvestmentCard>
        <InvestmentCard>
          <div className={styles.cardHeader}>
            <span className={styles.sectionLabel}>
              <ArrowDownRight aria-hidden="true" size={16} /> Falling today
            </span>
          </div>
          {fallers.length > 0 ? (
            fallers.map((instrument) => (
              <MoverRow instrument={instrument} key={instrument.ticker} onOpenStock={onOpenStock} />
            ))
          ) : (
            <p className={styles.emptyState}>Everything you hold is up today.</p>
          )}
        </InvestmentCard>
      </div>

      <RiskReminder />
    </>
  );
}

export function InvestmentPortfolio({
  cashMerits,
  defaultRange,
  holdings,
  onNavigate,
  onOpenStock,
}: PortfolioProps) {
  const [range, setRange] = useState<RangeId>(defaultRange === '1D' ? '1M' : defaultRange);
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const liveHoldings = holdings.filter((holding) => holding.units > 0.000001);
  const netWorth = netWorthMerits(liveHoldings, cashMerits);
  const series = portfolioSeries(liveHoldings, cashMerits, range, customRange);
  const rangeDelta = series.last - series.first;
  const rangePct = (rangeDelta / (series.first || 1)) * 100;
  const rows = useAllocationRows(liveHoldings);
  const minDate = formatDateInput(dayDate(0));
  const maxDate = formatDateInput(today);

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <button
            className={styles.ghostButton}
            onClick={() => {
              onNavigate('overview');
            }}
            type="button"
          >
            Back to overview
          </button>
          <h1>Portfolio growth</h1>
          <p>Review your holdings by day, week, month, year, or a custom date range.</p>
        </div>
        <button
          className={styles.button}
          onClick={() => {
            onNavigate('market');
          }}
          type="button"
        >
          Browse market
        </button>
      </section>

      <InvestmentCard>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.heroValue}>
              <MeritIcon size={28} />
              {formatMerits(netWorth, 1)}
            </div>
            <div className={styles.valueMeta}>
              <span className={rangeDelta >= 0 ? styles.positiveText : styles.negativeText}>
                {formatSignedMerits(rangeDelta, 1)} ({formatPercent(rangePct)})
              </span>
              <span className={styles.smallText}>
                {customRange
                  ? `${formatShortDate(customRange.from)} to ${formatShortDate(customRange.to)}`
                  : 'selected period'}
              </span>
            </div>
          </div>
          <div className={styles.titleBlock}>
            <RangeTabs
              customActive={Boolean(customRange) || showCustom}
              onCustom={() => {
                setShowCustom((current) => !current);
              }}
              onRange={(nextRange) => {
                setRange(nextRange);
                setCustomRange(null);
                setShowCustom(false);
              }}
              value={range}
            />
            {showCustom ? (
              <CustomRangeControls
                maxDate={maxDate}
                minDate={minDate}
                onApply={(nextRange) => {
                  setCustomRange(nextRange);
                  setShowCustom(false);
                }}
              />
            ) : null}
          </div>
        </div>
        <AreaChart height={320} series={series} />
      </InvestmentCard>

      <InvestmentCard flush>
        <div className={styles.cardHeader} style={{ padding: '16px 20px' }}>
          <span className={styles.sectionLabel}>Your holdings - {String(rows.length)}</span>
          <button
            className={styles.secondaryButton}
            onClick={() => {
              onNavigate('market');
            }}
            type="button"
          >
            Browse market
          </button>
        </div>
        <div className={styles.holdingsDesktop}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Holding', 'Price', 'Today', 'Units', 'Value', 'Total return', 'Weight'].map(
                  (label) => (
                    <th className={styles.tableHead} key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cost = holdingCostMerits(row.holding);
                const totalReturn = row.value - cost;
                const totalReturnPct = (totalReturn / (cost || 1)) * 100;
                return (
                  <tr
                    key={row.holding.ticker}
                    onClick={() => {
                      onOpenStock(row.holding.ticker);
                    }}
                  >
                    <td>
                      <span className={styles.holdingCell}>
                        <TickerMark instrument={row.instrument} size={34} />
                        <span>
                          <strong>{row.holding.ticker}</strong>
                          <br />
                          <span className={styles.smallText}>{row.instrument.name}</span>
                        </span>
                      </span>
                    </td>
                    <td>{formatMerits(toMerits(row.instrument.price), 1)}</td>
                    <td>
                      <DeltaPill arrow={false} plain value={row.instrument.dayChangePct} />
                    </td>
                    <td>{row.holding.units.toFixed(2)}</td>
                    <td>{formatMerits(row.value, 1)}</td>
                    <td className={totalReturn >= 0 ? styles.positiveText : styles.negativeText}>
                      {formatSignedMerits(totalReturn, 1)} ({formatPercent(totalReturnPct)})
                    </td>
                    <td>
                      <span className={styles.weightBar}>
                        <span
                          style={{
                            backgroundColor: row.instrument.color,
                            width: `${String(row.weight)}%`,
                          }}
                        />
                      </span>{' '}
                      {row.weight.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.holdingsMobile}>
          {rows.map((row) => (
            <button
              className={styles.holdingMobileRow}
              key={row.holding.ticker}
              onClick={() => {
                onOpenStock(row.holding.ticker);
              }}
              type="button"
            >
              <TickerMark instrument={row.instrument} size={38} />
              <span className={styles.holdingMain}>
                <strong>{row.holding.ticker}</strong>
                <span>
                  {row.holding.units.toFixed(2)} units - {row.weight.toFixed(0)}%
                </span>
              </span>
              <span>
                <MeritValue value={row.value} />
                <DeltaPill arrow={false} plain value={row.instrument.dayChangePct} />
              </span>
            </button>
          ))}
        </div>
      </InvestmentCard>
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

function AllocationBar({ holdings }: { holdings: readonly Holding[] }) {
  const rows = useAllocationRows(holdings);
  return (
    <>
      <div aria-hidden="true" className={styles.allocationBar}>
        {rows.map((row) => (
          <span
            key={row.holding.ticker}
            style={{ backgroundColor: row.instrument.color, width: `${String(row.weight)}%` }}
          />
        ))}
      </div>
      <div className={styles.allocationLegend}>
        {rows.slice(0, 8).map((row) => (
          <span className={styles.legendItem} key={row.holding.ticker}>
            <span className={styles.legendDot} style={{ backgroundColor: row.instrument.color }} />
            <strong>{row.holding.ticker}</strong>
            <span>{row.weight.toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </>
  );
}

function MoverRow({
  instrument,
  onOpenStock,
}: {
  instrument: Instrument;
  onOpenStock: (ticker: string) => void;
}) {
  return (
    <button
      className={styles.moverRow}
      onClick={() => {
        onOpenStock(instrument.ticker);
      }}
      type="button"
    >
      <TickerMark instrument={instrument} size={34} />
      <span className={styles.moverMain}>
        <strong>{instrument.ticker}</strong>
        <span>{instrument.name}</span>
      </span>
      <Sparkline daily={instrument.daily} width={58} />
      <span>
        <MeritValue digits={1} value={toMerits(instrument.price)} />
        <DeltaPill arrow={false} plain value={instrument.dayChangePct} />
      </span>
    </button>
  );
}

function CustomRangeControls({
  maxDate,
  minDate,
  onApply,
}: {
  maxDate: string;
  minDate: string;
  onApply: (range: CustomRange) => void;
}) {
  const [from, setFrom] = useState(formatDateInput(dayDate(historyStartOffset())));
  const [to, setTo] = useState(maxDate);
  const valid = new Date(from) < new Date(to);
  return (
    <div className={styles.customRange}>
      <input
        className={styles.dateInput}
        max={maxDate}
        min={minDate}
        onChange={(event) => {
          setFrom(event.target.value);
        }}
        type="date"
        value={from}
      />
      <span className={styles.smallText}>to</span>
      <input
        className={styles.dateInput}
        max={maxDate}
        min={minDate}
        onChange={(event) => {
          setTo(event.target.value);
        }}
        type="date"
        value={to}
      />
      <button
        className={styles.secondaryButton}
        disabled={!valid}
        onClick={() => {
          onApply({ from: new Date(from), to: new Date(to) });
        }}
        type="button"
      >
        Apply
      </button>
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

function useAllocationRows(holdings: readonly Holding[]): readonly AllocationRow[] {
  return useMemo(() => {
    const total = holdingsValueMerits(holdings) || 1;
    return holdings
      .map((holding) => {
        const instrument = instrumentForTicker(holding.ticker);
        const value = holdingValueMerits(holding);
        return {
          holding,
          instrument,
          value,
          weight: (value / total) * 100,
        };
      })
      .sort((left, right) => right.value - left.value);
  }, [holdings]);
}

function historyStartOffset(): number {
  return 400 - 90;
}
