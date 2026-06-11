'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  formatDateInput,
  formatMerits,
  formatPercent,
  formatShortDate,
  formatSignedMerits,
  historyDays,
  instrumentForTicker,
  instruments,
  msDay,
  percentChange,
  riskBand,
  sliceInstrumentSeries,
  today,
  toMerits,
  type CustomRange,
  type Instrument,
  type RangeId,
} from './student-invest-data';
import {
  AreaChart,
  DeltaPill,
  GbpEquivalent,
  HelpTip,
  InvestmentBadge,
  InvestmentCard,
  LearningBadge,
  MeritIcon,
  MeritValue,
  MeritValueStack,
  RangeTabs,
  RiskDots,
  Sparkline,
  TickerMark,
} from './student-invest-ui';
import styles from './student-invest.module.css';

interface MarketProps {
  liveInstruments?: readonly Instrument[];
  marketFreshness?: string | undefined;
  marketLoading?: boolean;
  onOpenStock: (ticker: string) => void;
}

interface StockDetailProps {
  liveInstruments?: readonly Instrument[];
  onBack: () => void;
  ticker: string;
}

type MarketFilter = 'All' | 'ETFs' | 'Stocks';
type MarketSort = 'largest' | 'gainers' | 'losers';

export function InvestmentMarket({
  liveInstruments,
  marketFreshness,
  marketLoading,
  onOpenStock,
}: MarketProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MarketFilter>('All');
  const [sort, setSort] = useState<MarketSort>('largest');
  const sourceInstruments = liveInstruments ?? instruments;

  const filteredInstruments = useMemo(() => {
    return sourceInstruments
      .filter((instrument) => {
        if (filter === 'ETFs' && instrument.type !== 'etf') return false;
        if (filter === 'Stocks' && instrument.type !== 'stock') return false;
        const haystack =
          `${instrument.ticker} ${instrument.name} ${instrument.sector}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
      .sort((left, right) => {
        if (sort === 'gainers') return right.dayChangePct - left.dayChangePct;
        if (sort === 'losers') return left.dayChangePct - right.dayChangePct;
        return right.price - left.price;
      });
  }, [filter, query, sort, sourceInstruments]);

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <p className={styles.eyebrow}>Market</p>
          <h1>Stocks and ETFs</h1>
          <p>
            Educational market data — browse real companies and funds.
            <HelpTip
              label="What is an ETF?"
              text="An ETF is a ready-made basket of many companies in one investment. It can spread risk more than a single stock."
            />
          </p>
        </div>
      </section>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search Apple, S&P 500, Nvidia..."
          type="search"
          value={query}
        />
        <div className={styles.tabList}>
          {(['All', 'ETFs', 'Stocks'] as const).map((item) => (
            <button
              className={cn(styles.tabButton, filter === item ? styles.tabButtonActive : undefined)}
              key={item}
              onClick={() => {
                setFilter(item);
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <select
          className={styles.selectInput}
          onChange={(event) => {
            setSort(event.target.value as MarketSort);
          }}
          value={sort}
        >
          <option value="largest">Sort: largest</option>
          <option value="gainers">Sort: top risers</option>
          <option value="losers">Sort: top fallers</option>
        </select>
      </div>

      {marketFreshness === 'stale' ? (
        <div className={styles.noticeCard} role="status">
          <span>⚠</span>
          <span>Market prices may be delayed. Last available snapshot shown.</span>
        </div>
      ) : null}
      {marketFreshness === 'empty' ? (
        <p className={styles.emptyState}>
          Market data is unavailable. Check back during LSE trading hours.
        </p>
      ) : null}

      <InvestmentCard flush>
        {marketLoading ? (
          <MarketSkeleton />
        ) : (
          <>
            <div className={styles.marketDesktop}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['Name', 'Price', 'Today', '30-day', 'Risk', ''].map((label) => (
                      <th className={styles.tableHead} key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInstruments.map((instrument) => (
                    <tr
                      key={instrument.ticker}
                      onClick={() => {
                        onOpenStock(instrument.ticker);
                      }}
                    >
                      <td>
                        <span className={styles.stockNameCell}>
                          <TickerMark instrument={instrument} size={38} />
                          <span>
                            <strong>{instrument.ticker}</strong>{' '}
                            <InvestmentBadge tone={instrument.type === 'etf' ? 'blue' : 'grey'}>
                              {instrument.type === 'etf' ? 'ETF' : 'Stock'}
                            </InvestmentBadge>
                            <br />
                            <span className={styles.smallText}>
                              {instrument.name} - {instrument.sector}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <MeritValueStack value={toMerits(instrument.price)} />
                      </td>
                      <td>
                        {instrument.learningDayChangePct !== undefined ? (
                          <LearningBadge
                            learningPct={instrument.learningDayChangePct}
                            rawPct={instrument.dayChangePct}
                          />
                        ) : (
                          <DeltaPill arrow={false} plain value={instrument.dayChangePct} />
                        )}
                      </td>
                      <td>
                        <Sparkline daily={instrument.daily} width={96} />
                      </td>
                      <td>
                        <RiskDots instrument={instrument} />
                      </td>
                      <td>
                        <button
                          className={styles.secondaryButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenStock(instrument.ticker);
                          }}
                          type="button"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.marketMobile}>
              {filteredInstruments.map((instrument) => (
                <button
                  className={styles.marketMobileRow}
                  key={instrument.ticker}
                  onClick={() => {
                    onOpenStock(instrument.ticker);
                  }}
                  type="button"
                >
                  <TickerMark instrument={instrument} size={40} />
                  <span className={styles.marketMain}>
                    <strong>{instrument.ticker}</strong>
                    <span>{instrument.name}</span>
                  </span>
                  <Sparkline daily={instrument.daily} width={54} />
                  <span>
                    <MeritValue value={toMerits(instrument.price)} />
                    <GbpEquivalent value={toMerits(instrument.price)} />
                    <DeltaPill arrow={false} plain value={instrument.dayChangePct} />
                  </span>
                </button>
              ))}
            </div>
            {filteredInstruments.length === 0 ? (
              <p className={styles.emptyState}>No matches for &quot;{query}&quot;.</p>
            ) : null}
          </>
        )}
      </InvestmentCard>
    </>
  );
}

function MarketSkeleton() {
  return (
    <div className={styles.marketDesktop}>
      <table className={styles.table}>
        <thead>
          <tr>
            {['Name', 'Price', 'Today', '30-day', 'Risk', ''].map((label) => (
              <th className={styles.tableHead} key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, index) => (
            <tr key={index}>
              <td>
                <span className={styles.stockNameCell}>
                  <span
                    className={styles.tickerMark}
                    style={{ backgroundColor: '#dde3f0', height: 38, width: 38 }}
                  />
                  <span>
                    <span
                      style={{
                        background: '#dde3f0',
                        borderRadius: 4,
                        display: 'inline-block',
                        height: 12,
                        width: 48 + (index % 3) * 16,
                      }}
                    />
                  </span>
                </span>
              </td>
              {[56, 40, 72, 24].map((w) => (
                <td key={w}>
                  <span
                    style={{
                      background: '#dde3f0',
                      borderRadius: 4,
                      display: 'inline-block',
                      height: 12,
                      width: w,
                    }}
                  />
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvestmentStockDetail({ liveInstruments, onBack, ticker }: StockDetailProps) {
  const instrument =
    liveInstruments?.find((i) => i.ticker === ticker) ?? instrumentForTicker(ticker);
  const [range, setRange] = useState<RangeId>('3M');
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const series = sliceInstrumentSeries(instrument, range, customRange);
  const rangePct = percentChange(series.first, series.last);
  const recent = instrument.daily.slice(-30);
  const low = Math.min(...recent);
  const high = Math.max(...recent);
  const risk = riskBand(instrument.volatility);
  const minDate = formatDateInput(new Date(today.getTime() - (historyDays - 1) * msDay));
  const maxDate = formatDateInput(today);

  return (
    <>
      <button className={styles.ghostButton} onClick={onBack} type="button">
        Back to market
      </button>

      <section className={styles.stockHeader}>
        <div className={styles.stockNameCell}>
          <TickerMark instrument={instrument} size={58} />
          <div>
            <div className={styles.inlineActions}>
              <h1 className={styles.stockTitle}>{instrument.name}</h1>
              <InvestmentBadge tone={instrument.type === 'etf' ? 'blue' : 'grey'}>
                {instrument.type === 'etf' ? 'ETF' : 'Stock'}
              </InvestmentBadge>
            </div>
            <p className={styles.smallText}>
              {instrument.ticker} - {instrument.sector}
            </p>
          </div>
        </div>
        <div>
          <div className={styles.stockPrice}>
            <MeritIcon size={22} />
            {formatMerits(toMerits(instrument.price), 2)}
            <span className={styles.smallText}>merits</span>
          </div>
          <div className={styles.valueMeta}>
            <span className={instrument.dayChange >= 0 ? styles.positiveText : styles.negativeText}>
              {formatSignedMerits(toMerits(instrument.dayChange), 2)}
            </span>
            {instrument.learningDayChangePct !== undefined ? (
              <LearningBadge
                learningPct={instrument.learningDayChangePct}
                rawPct={instrument.dayChangePct}
              />
            ) : (
              <DeltaPill plain value={instrument.dayChangePct} />
            )}
            <GbpEquivalent value={toMerits(instrument.price)} />
          </div>
        </div>
      </section>

      <InvestmentCard>
        <div className={styles.cardHeader}>
          <span className={rangePct >= 0 ? styles.positiveText : styles.negativeText}>
            {formatPercent(rangePct)}
            <span className={styles.smallText}>
              {' '}
              {customRange
                ? `${formatShortDate(customRange.from)} to ${formatShortDate(customRange.to)}`
                : 'selected range'}
            </span>
          </span>
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
        </div>
        {showCustom ? (
          <StockCustomRange
            maxDate={maxDate}
            minDate={minDate}
            onApply={(nextRange) => {
              setCustomRange(nextRange);
              setShowCustom(false);
            }}
          />
        ) : null}
        <AreaChart
          height={300}
          series={series}
          valueFormatter={(value) => formatMerits(toMerits(value), 2)}
        />
      </InvestmentCard>

      <InvestmentCard>
        <span className={styles.sectionLabel}>About {instrument.name}</span>
        <p className={styles.mutedText}>{instrument.about}</p>
        <div className={styles.statGrid}>
          <StatBox label="30-day low" value={<MeritValueStack value={toMerits(low)} />} />
          <StatBox label="30-day high" value={<MeritValueStack value={toMerits(high)} />} />
          <StatBox
            label="Prev. close"
            value={<MeritValueStack digits={2} value={toMerits(instrument.prevClose)} />}
          />
          <StatBox label="Risk level" value={risk.label} />
        </div>
        <div className={styles.noticeCard} style={{ marginTop: 16 }}>
          <strong>{instrument.type === 'etf' ? 'ETF note' : 'Stock note'}</strong>
          <p>
            {instrument.type === 'etf'
              ? 'ETFs spread merits across many companies, but they can still fall.'
              : `Single stocks like ${instrument.name} can swing more than a fund. Consider holding a mix.`}
          </p>
        </div>
      </InvestmentCard>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.statBox}>
      <span className={styles.metaLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StockCustomRange({
  maxDate,
  minDate,
  onApply,
}: {
  maxDate: string;
  minDate: string;
  onApply: (range: CustomRange) => void;
}) {
  const [from, setFrom] = useState(formatDateInput(new Date(today.getTime() - 90 * msDay)));
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
