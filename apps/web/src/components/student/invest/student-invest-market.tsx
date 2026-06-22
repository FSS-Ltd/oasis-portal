'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  formatDate,
  formatDateInput,
  formatMerits,
  formatPercent,
  formatShortDate,
  formatSignedMerits,
  historyDays,
  instruments,
  msDay,
  percentChange,
  portfolioRangeOptions,
  riskBand,
  sliceInstrumentSeries,
  today,
  toMerits,
  type AccountHolding,
  type CustomRange,
  type Instrument,
  type InstrumentType,
  type MarketDividendEvent,
  type MarketNewsItem,
  type RangeId,
} from './student-invest-data';
import { TradePanel } from './student-invest-trade';
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
  cashBalanceMerits: number;
  detailLoading?: boolean;
  dividends?: readonly MarketDividendEvent[];
  holding: AccountHolding | null;
  isBuying: boolean;
  isSelling: boolean;
  liveInstruments?: readonly Instrument[];
  marketFreshness?: string | undefined;
  news?: readonly MarketNewsItem[];
  onBuyHolding: (input: { instrumentId: string; merits: number }) => void;
  onBack: () => void;
  onSellHolding: (input: { instrumentId: string; units: number }) => void;
  ticker: string;
}

type MarketFilter = 'All' | 'Crypto' | 'ETFs' | 'Stocks';
type MarketSort = 'largest' | 'gainers' | 'losers';

const MARKET_PAGE_SIZE = 8;

function instrumentLabel(type: InstrumentType): string {
  if (type === 'crypto') return 'Crypto';
  if (type === 'etf') return 'ETF';
  return 'Stock';
}

function instrumentBadgeTone(type: InstrumentType): 'blue' | 'gold' | 'grey' {
  if (type === 'crypto') return 'gold';
  if (type === 'etf') return 'blue';
  return 'grey';
}

function filterMatches(filter: MarketFilter, instrument: Instrument): boolean {
  if (filter === 'Crypto') return instrument.type === 'crypto';
  if (filter === 'ETFs') return instrument.type === 'etf';
  if (filter === 'Stocks') return instrument.type === 'stock';
  return true;
}

function emptyMarketText(filter: MarketFilter, query: string): string {
  if (query.trim()) return `No matches for "${query}".`;
  if (filter === 'Crypto') return 'No crypto instruments are available yet.';
  if (filter === 'ETFs') return 'No ETF instruments are available yet.';
  if (filter === 'Stocks') return 'No stock instruments are available yet.';
  return 'No market instruments are available yet.';
}

export function InvestmentMarket({
  liveInstruments,
  marketFreshness,
  marketLoading,
  onOpenStock,
}: MarketProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MarketFilter>('All');
  const [sort, setSort] = useState<MarketSort>('largest');
  const [page, setPage] = useState(1);
  const sourceInstruments = liveInstruments ?? instruments;

  const filteredInstruments = useMemo(() => {
    return sourceInstruments
      .filter((instrument) => {
        if (!filterMatches(filter, instrument)) return false;
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
  const pageCount = Math.max(1, Math.ceil(filteredInstruments.length / MARKET_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * MARKET_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + MARKET_PAGE_SIZE, filteredInstruments.length);
  const paginatedInstruments = filteredInstruments.slice(pageStart, pageEnd);

  function resetPage(): void {
    setPage(1);
  }

  return (
    <>
      <section className={styles.screenHeader}>
        <div>
          <p className={styles.eyebrow}>Market</p>
          <h1>Stocks, ETFs and Crypto</h1>
          <p>
            Educational market data - browse real companies, funds, and selected crypto assets.
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
            resetPage();
          }}
          placeholder="Search Apple, Bitcoin, S&P 500..."
          type="search"
          value={query}
        />
        <div className={styles.tabList}>
          {(['All', 'Stocks', 'ETFs', 'Crypto'] as const).map((item) => (
            <button
              className={cn(styles.tabButton, filter === item ? styles.tabButtonActive : undefined)}
              key={item}
              onClick={() => {
                setFilter(item);
                resetPage();
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
            resetPage();
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
      {filter === 'Crypto' ? (
        <div className={styles.noticeCard} role="note">
          <strong>Crypto risk</strong>
          <p>Crypto prices trade all week and can move sharply. Keep it small and balanced.</p>
        </div>
      ) : null}
      {marketFreshness === 'empty' ? (
        <p className={styles.emptyState}>
          Market data is unavailable. Cached prices will appear after the next refresh.
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
                  {paginatedInstruments.map((instrument) => (
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
                            <InvestmentBadge tone={instrumentBadgeTone(instrument.type)}>
                              {instrumentLabel(instrument.type)}
                            </InvestmentBadge>
                            <br />
                            <span className={styles.smallText}>
                              {instrument.name} - {instrument.sector}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {instrument.price > 0 ? (
                          <MeritValueStack value={toMerits(instrument.price)} />
                        ) : (
                          <span className={styles.smallText}>Awaiting price</span>
                        )}
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
              {paginatedInstruments.map((instrument) => (
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
                    {instrument.price > 0 ? (
                      <>
                        <MeritValue value={toMerits(instrument.price)} />
                        <GbpEquivalent value={toMerits(instrument.price)} />
                      </>
                    ) : (
                      <span className={styles.smallText}>Awaiting price</span>
                    )}
                    <DeltaPill arrow={false} plain value={instrument.dayChangePct} />
                  </span>
                </button>
              ))}
            </div>
            <MarketPagination
              currentPage={currentPage}
              onPageChange={setPage}
              pageCount={pageCount}
              pageEnd={pageEnd}
              pageStart={pageStart}
              pageSize={MARKET_PAGE_SIZE}
              total={filteredInstruments.length}
            />
            {filteredInstruments.length === 0 ? (
              <p className={styles.emptyState}>{emptyMarketText(filter, query)}</p>
            ) : null}
          </>
        )}
      </InvestmentCard>
    </>
  );
}

function MarketPagination({
  currentPage,
  onPageChange,
  pageCount,
  pageEnd,
  pageStart,
  pageSize,
  total,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  pageCount: number;
  pageEnd: number;
  pageStart: number;
  pageSize: number;
  total: number;
}) {
  if (total <= pageSize) return null;

  return (
    <div className={styles.paginationBar}>
      <span className={styles.smallText}>
        Showing {pageStart + 1}-{pageEnd} of {total}
      </span>
      <div className={styles.paginationControls}>
        <button
          className={styles.secondaryButton}
          disabled={currentPage === 1}
          onClick={() => {
            onPageChange(Math.max(1, currentPage - 1));
          }}
          type="button"
        >
          Previous
        </button>
        <span className={styles.paginationCount}>
          Page {currentPage} of {pageCount}
        </span>
        <button
          className={styles.secondaryButton}
          disabled={currentPage === pageCount}
          onClick={() => {
            onPageChange(Math.min(pageCount, currentPage + 1));
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
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

export function InvestmentStockDetail({
  cashBalanceMerits,
  detailLoading = false,
  dividends = [],
  holding,
  isBuying,
  isSelling,
  liveInstruments,
  marketFreshness,
  news = [],
  onBack,
  onBuyHolding,
  onSellHolding,
  ticker,
}: StockDetailProps) {
  const instrument =
    liveInstruments?.find((candidate) => candidate.ticker === ticker) ??
    instruments.find((candidate) => candidate.ticker === ticker);
  const [range, setRange] = useState<RangeId>('3M');
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [mobileTradeSide, setMobileTradeSide] = useState<'buy' | 'sell' | null>(null);

  if (!instrument) {
    return (
      <>
        <button className={styles.ghostButton} onClick={onBack} type="button">
          Back to market
        </button>
        <InvestmentCard>
          <p className={styles.emptyState}>This instrument is not available.</p>
        </InvestmentCard>
      </>
    );
  }

  const series = sliceInstrumentSeries(instrument, range, customRange);
  const rangePct = percentChange(series.first, series.last);
  const recent = instrument.daily.slice(-30);
  const low = Math.min(...recent);
  const high = Math.max(...recent);
  const risk = riskBand(instrument.volatility);
  const minDate = formatDateInput(new Date(today.getTime() - (historyDays - 1) * msDay));
  const maxDate = formatDateInput(today);
  const holdingUnits = holding?.units ?? 0;
  const hasCachedPrice = (instrument.priceMerits ?? 0) > 0;
  const selectedInstrumentId = instrument.instrumentId;

  function buySelectedHolding(merits: number) {
    if (!selectedInstrumentId) return;
    onBuyHolding({ instrumentId: selectedInstrumentId, merits });
  }

  function sellSelectedHolding(units: number) {
    if (!selectedInstrumentId) return;
    onSellHolding({ instrumentId: selectedInstrumentId, units });
  }

  const tradePanel = (initialSide: 'buy' | 'sell', closeAfterSubmit = false) => {
    const closeTradeModal = () => {
      setMobileTradeSide(null);
    };
    const commonProps = {
      cashBalanceMerits,
      holdingUnits,
      initialSide,
      instrument,
      isBuying,
      isSelling,
      onBuy: buySelectedHolding,
      onSell: sellSelectedHolding,
    };

    return closeAfterSubmit ? (
      <TradePanel {...commonProps} onAfterSubmit={closeTradeModal} />
    ) : (
      <TradePanel {...commonProps} />
    );
  };

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
              <InvestmentBadge tone={instrumentBadgeTone(instrument.type)}>
                {instrumentLabel(instrument.type)}
              </InvestmentBadge>
            </div>
            <p className={styles.smallText}>
              {instrument.ticker} - {instrument.sector}
            </p>
          </div>
        </div>
        <div>
          {hasCachedPrice ? (
            <>
              <div className={styles.stockPrice}>
                <MeritIcon size={22} />
                {formatMerits(toMerits(instrument.price), 2)}
                <span className={styles.smallText}>merits</span>
              </div>
              <div className={styles.valueMeta}>
                <span
                  className={instrument.dayChange >= 0 ? styles.positiveText : styles.negativeText}
                >
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
            </>
          ) : (
            <span className={styles.smallText}>Awaiting price</span>
          )}
        </div>
      </section>

      <div className={styles.stockDetailGrid}>
        <div className={styles.detailStack}>
          {marketFreshness === 'stale' ? (
            <div className={styles.noticeCard} role="status">
              <strong>Delayed price</strong>
              <p>This detail view is using the latest cached snapshot.</p>
            </div>
          ) : null}
          {!hasCachedPrice ? (
            <div className={styles.noticeCard} role="status">
              <strong>Trading paused</strong>
              <p>A cached provider price is required before this asset can be bought or sold.</p>
            </div>
          ) : null}
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
                ranges={portfolioRangeOptions}
                showCustom={false}
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
                value={
                  hasCachedPrice ? (
                    <MeritValueStack digits={2} value={toMerits(instrument.prevClose)} />
                  ) : (
                    <span className={styles.smallText}>Awaiting price</span>
                  )
                }
              />
              <StatBox label="Risk level" value={risk.label} />
            </div>
            <div className={styles.noticeCard} style={{ marginTop: 16 }}>
              <strong>
                {instrument.type === 'crypto'
                  ? 'Crypto risk'
                  : instrument.type === 'etf'
                    ? 'ETF note'
                    : 'Stock note'}
              </strong>
              <p>
                {instrument.type === 'crypto'
                  ? 'Crypto can move sharply at any time and may be harder to value than company shares or funds.'
                  : instrument.type === 'etf'
                    ? 'ETFs spread merits across many companies, but they can still fall.'
                    : `Single stocks like ${instrument.name} can swing more than a fund. Consider holding a mix.`}
              </p>
            </div>
          </InvestmentCard>

          <MarketNewsCard detailLoading={detailLoading} news={news} />

          {instrument.type !== 'crypto' ? (
            <MarketDividendCard detailLoading={detailLoading} dividends={dividends} />
          ) : null}
        </div>

        <div className={styles.desktopTrade}>
          <InvestmentCard>
            <span className={styles.sectionLabel}>Trade {instrument.ticker}</span>
            <div className={styles.positionRow}>
              <span className={styles.smallText}>Your units</span>
              <strong>{holdingUnits.toFixed(4)}</strong>
            </div>
            {tradePanel('buy')}
          </InvestmentCard>
        </div>
      </div>

      <div className={styles.mobileTradeBar}>
        <button
          className={cn(styles.successButton, styles.buttonFull)}
          onClick={() => {
            setMobileTradeSide('buy');
          }}
          type="button"
        >
          Buy
        </button>
        <button
          className={cn(styles.dangerButton, styles.buttonFull)}
          disabled={holdingUnits <= 0.000001}
          onClick={() => {
            setMobileTradeSide('sell');
          }}
          type="button"
        >
          Sell
        </button>
      </div>

      {mobileTradeSide ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => {
            setMobileTradeSide(null);
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className={styles.modal}
            onClick={(event) => {
              event.stopPropagation();
            }}
            role="dialog"
          >
            <div className={styles.modalBody}>
              <div className={styles.cardHeader}>
                <div className={styles.stockNameCell}>
                  <TickerMark instrument={instrument} size={40} />
                  <div>
                    <h2 className={styles.cardTitle}>{instrument.name}</h2>
                    <p className={styles.smallText}>
                      {formatMerits(toMerits(instrument.price), 2)} merits
                    </p>
                  </div>
                </div>
                <button
                  className={styles.ghostButton}
                  onClick={() => {
                    setMobileTradeSide(null);
                  }}
                  type="button"
                >
                  Close
                </button>
              </div>
              {tradePanel(mobileTradeSide, true)}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MarketNewsCard({
  detailLoading,
  news,
}: {
  detailLoading: boolean;
  news: readonly MarketNewsItem[];
}) {
  return (
    <InvestmentCard>
      <span className={styles.sectionLabel}>News context</span>
      {detailLoading ? <p className={styles.mutedText}>Loading cached news...</p> : null}
      {!detailLoading && news.length === 0 ? (
        <p className={styles.mutedText}>No recent Finnhub news is cached for this asset.</p>
      ) : null}
      {news.length > 0 ? (
        <ul className={styles.infoList}>
          {news.slice(0, 3).map((item) => (
            <li className={styles.infoItem} key={item.id}>
              <a className={styles.infoLink} href={item.url} rel="noreferrer" target="_blank">
                {item.headline}
              </a>
              <span className={styles.infoMeta}>
                {item.source} - {formatDate(item.publishedAt)}
              </span>
              {item.summary ? <p className={styles.mutedText}>{item.summary}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </InvestmentCard>
  );
}

function MarketDividendCard({
  detailLoading,
  dividends,
}: {
  detailLoading: boolean;
  dividends: readonly MarketDividendEvent[];
}) {
  return (
    <InvestmentCard>
      <span className={styles.sectionLabel}>Dividends</span>
      {detailLoading ? <p className={styles.mutedText}>Loading cached dividends...</p> : null}
      {!detailLoading && dividends.length === 0 ? (
        <p className={styles.mutedText}>No recent or upcoming dividends are cached.</p>
      ) : null}
      {dividends.length > 0 ? (
        <ul className={styles.infoList}>
          {dividends.slice(0, 4).map((item) => (
            <li className={styles.infoItem} key={item.id}>
              <strong>{formatMerits(item.amountMerits, 2)} merits per unit</strong>
              <span className={styles.infoMeta}>
                Ex-dividend {formatDate(item.exDate)}
                {item.payDate ? ` - pays ${formatDate(item.payDate)}` : ''}
              </span>
              <p className={styles.mutedText}>
                Source amount {item.amountSource.toFixed(4)} {item.sourceCurrency}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </InvestmentCard>
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
