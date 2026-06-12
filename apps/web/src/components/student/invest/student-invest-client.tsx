'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BriefcaseBusiness, History, LineChart, Store, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type RouterOutputs } from '@/lib/trpc';
import {
  buildSyntheticDailySeries,
  buildSyntheticIntradaySeries,
  formatMerits,
  instruments,
  instrumentsByTicker,
  meritGbp,
  navHistoryToChartSeries,
  type Instrument,
  type InstrumentType,
  type MarketDividendEvent,
  type MarketNewsItem,
  type RangeId,
} from './student-invest-data';
import { InvestmentActivity } from './student-invest-extras';
import { InvestmentMarket, InvestmentStockDetail } from './student-invest-market';
import { InvestmentOverview } from './student-invest-overview';
import {
  InvestmentInvestPage,
  InvestmentPortfolioPage,
  InvestmentWithdrawPage,
} from './student-invest-pages';
import { GbpEquivalent, MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

type Screen = 'activity' | 'invest' | 'market' | 'overview' | 'portfolio' | 'stock' | 'withdraw';

interface ViewState {
  screen: Screen;
  ticker: string | null;
}

interface StudentInvestClientProps {
  initialScreen?: Exclude<Screen, 'stock'>;
}

type MarketDataInstrument = RouterOutputs['investment']['marketData']['instruments'][number];
type MarketDataSnapshot = RouterOutputs['investment']['marketData']['snapshots'][number];
type InstrumentDetail = RouterOutputs['investment']['instrumentDetail'];

const defaultRange: RangeId = '1M';

const navItems: readonly {
  href?: string;
  icon: LucideIcon;
  label: string;
  screen: Exclude<Screen, 'stock'>;
}[] = [
  { href: '/student/invest', icon: LineChart, label: 'Overview', screen: 'overview' },
  {
    href: '/student/invest/portfolio',
    icon: BriefcaseBusiness,
    label: 'Portfolio',
    screen: 'portfolio',
  },
  { icon: Store, label: 'Market', screen: 'market' },
  { icon: History, label: 'Activity', screen: 'activity' },
];

function instrumentType(kind: MarketDataInstrument['kind']): InstrumentType {
  if (kind === 'crypto') return 'crypto';
  if (kind === 'etf') return 'etf';
  return 'stock';
}

function fallbackColor(type: InstrumentType): string {
  if (type === 'crypto') return '#475569';
  if (type === 'etf') return '#2e5e8c';
  return '#555b61';
}

function volatilityFromRisk(riskBand: string, type: InstrumentType): number {
  if (type === 'crypto') return riskBand === 'medium' ? 0.012 : 0.035;
  if (riskBand === 'low') return 0.007;
  if (riskBand === 'high') return 0.024;
  return 0.014;
}

function defaultInstrumentSummary(instrument: MarketDataInstrument): string {
  if (instrument.kind === 'crypto') {
    return `${instrument.displayName} is a crypto asset. Prices can move sharply at any time, so it should be treated as a high-risk learning option.`;
  }
  if (instrument.kind === 'etf') {
    return `${instrument.displayName} is an exchange-traded fund. It can spread merits across a basket of assets, but it can still fall.`;
  }
  return `${instrument.displayName} is a listed company in Merit Markets. Single stocks can move more than broad funds.`;
}

function mapLiveInstrument(
  instrument: MarketDataInstrument,
  snapshot: MarketDataSnapshot | undefined,
): Instrument {
  const fallback = instrumentsByTicker.get(instrument.symbol);
  const type = instrumentType(instrument.kind);
  const price = snapshot ? snapshot.priceMerits * meritGbp : 0;
  const prevClose = snapshot ? snapshot.previousCloseMerits * meritGbp : 0;
  const volatility = fallback?.volatility ?? volatilityFromRisk(instrument.riskBand, type);
  const seriesPrice = snapshot ? price : fallback?.price ?? 1;
  const seriesPrevClose = snapshot ? prevClose : fallback?.prevClose ?? seriesPrice;
  const mapped: Instrument = {
    about: instrument.summary ?? fallback?.about ?? defaultInstrumentSummary(instrument),
    color: instrument.themeColor ?? fallback?.color ?? fallbackColor(type),
    daily: fallback?.daily ?? buildSyntheticDailySeries(instrument.symbol, seriesPrice, volatility),
    dayChange: price - prevClose,
    dayChangePct: snapshot?.dayChangePct ?? 0,
    instrumentId: instrument.id,
    intraday:
      fallback?.intraday ??
      buildSyntheticIntradaySeries(instrument.symbol, seriesPrevClose, seriesPrice),
    name: instrument.displayName,
    prevClose,
    price,
    sector: instrument.category ?? fallback?.sector ?? instrument.exchangeMic,
    ticker: instrument.symbol,
    type,
    volatility,
  };
  if (snapshot) {
    mapped.learningDayChangePct = snapshot.learningDayChangePct;
    mapped.priceMerits = snapshot.priceMerits;
  }
  return mapped;
}

function mapNewsItem(item: InstrumentDetail['news'][number]): MarketNewsItem {
  return {
    headline: item.headline,
    id: item.id,
    imageUrl: item.imageUrl,
    publishedAt: new Date(item.publishedAt),
    source: item.source,
    summary: item.summary,
    url: item.url,
  };
}

function mapDividendEvent(item: InstrumentDetail['dividends'][number]): MarketDividendEvent {
  return {
    amountMerits: item.amountMerits,
    amountSource: item.amountSource,
    exDate: new Date(item.exDate),
    id: item.id,
    payDate: item.payDate ? new Date(item.payDate) : null,
    sourceCurrency: item.sourceCurrency,
  };
}

export function StudentInvestClient({ initialScreen = 'overview' }: StudentInvestClientProps) {
  const [view, setView] = useState<ViewState>({ screen: initialScreen, ticker: null });
  const [toast, setToast] = useState<string | null>(null);

  const dashboardQuery = api.student.dashboard.useQuery(undefined, { retry: false });
  const studentId = dashboardQuery.data?.profile.studentId;
  const spendBalance = dashboardQuery.data?.merits.balances.Spend ?? 0;
  const studentFirstName = dashboardQuery.data?.profile.firstName ?? '';

  const accountQuery = api.investment.account.useQuery(
    { studentId: studentId ?? '' },
    { enabled: !!studentId, refetchInterval: 60_000 },
  );

  const navHistoryQuery = api.investment.navHistory.useQuery(
    { days: 365 },
    { enabled: !!studentId },
  );

  const marketQuery = api.investment.marketData.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const buyHoldingMutation = api.investment.buyHolding.useMutation({
    onSuccess: (data) => {
      void accountQuery.refetch();
      void dashboardQuery.refetch();
      setToast(
        `Invested ${formatMerits(data.costBasisMerits, 1)} merits — ${data.unitsBought.toFixed(4)} units added.`,
      );
    },
    onError: () => {
      setToast('Investment failed. Check your Spend balance and market price, then try again.');
    },
  });

  const fundCashMutation = api.investment.fundCash.useMutation({
    onSuccess: (data) => {
      void accountQuery.refetch();
      void dashboardQuery.refetch();
      setToast(`Moved ${formatMerits(data.cashFundedMerits, 1)} merits into Merit Markets cash.`);
    },
    onError: () => {
      setToast('Funding failed. Check your Spend balance and try again.');
    },
  });

  const sellHoldingMutation = api.investment.sellHolding.useMutation({
    onSuccess: (data) => {
      void accountQuery.refetch();
      void dashboardQuery.refetch();
      setToast(
        `Sold ${data.unitsSold.toFixed(4)} units — ${formatMerits(data.grossMerits, 1)} merits returned to cash.`,
      );
    },
    onError: () => {
      setToast('Sale failed. Check your units and market price, then try again.');
    },
  });

  const withdrawPortfolioMutation = api.investment.withdrawPortfolio.useMutation({
    onSuccess: (data) => {
      void accountQuery.refetch();
      void dashboardQuery.refetch();
      setToast(
        `Withdrawal complete — ${formatMerits(data.netMerits, 1)} merits returned to Spend.`,
      );
    },
    onError: () => {
      setToast('Withdrawal failed. Check your portfolio value and try again.');
    },
  });

  const liveInstruments = useMemo<readonly Instrument[]>(() => {
    const marketInstruments = marketQuery.data?.instruments;
    if (marketInstruments?.length) {
      const byInstrumentId = new Map(
        (marketQuery.data?.snapshots ?? []).map((snapshot) => [snapshot.instrumentId, snapshot]),
      );
      return marketInstruments.map((instrument) =>
        mapLiveInstrument(instrument, byInstrumentId.get(instrument.id)),
      );
    }

    const snapshots = marketQuery.data?.snapshots;
    if (!snapshots?.length) return instruments;
    const bySymbol = new Map(snapshots.map((snapshot) => [snapshot.symbol, snapshot]));
    return instruments.map((instrument) => {
      const snapshot = bySymbol.get(instrument.ticker);
      return snapshot
        ? mapLiveInstrument(
            {
              category: instrument.sector,
              displayName: instrument.name,
              dividendSymbol: null,
              exchangeMic: 'LOCAL',
              id: snapshot.instrumentId,
              kind: instrument.type,
              newsSymbol: null,
              provider: snapshot.provider,
              providerSymbol: instrument.ticker,
              riskBand: 'medium',
              sortOrder: 0,
              sourceCurrency: snapshot.sourceCurrency,
              summary: instrument.about,
              symbol: instrument.ticker,
              themeColor: instrument.color,
            },
            snapshot,
          )
        : instrument;
    });
  }, [marketQuery.data]);

  const marketFreshness = marketQuery.data?.freshness;
  const marketLoading = marketQuery.isLoading && !marketQuery.data;
  const selectedInstrument =
    view.ticker ? liveInstruments.find((instrument) => instrument.ticker === view.ticker) : null;

  const instrumentDetailQuery = api.investment.instrumentDetail.useQuery(
    { instrumentId: selectedInstrument?.instrumentId ?? '' },
    {
      enabled: view.screen === 'stock' && Boolean(selectedInstrument?.instrumentId),
      retry: false,
    },
  );

  const selectedNews = useMemo<readonly MarketNewsItem[]>(
    () => instrumentDetailQuery.data?.news.map(mapNewsItem) ?? [],
    [instrumentDetailQuery.data?.news],
  );

  const selectedDividends = useMemo<readonly MarketDividendEvent[]>(
    () => instrumentDetailQuery.data?.dividends.map(mapDividendEvent) ?? [],
    [instrumentDetailQuery.data?.dividends],
  );

  const units = accountQuery.data?.units ?? 0;
  const currentValueMerits = accountQuery.data?.currentValueMerits ?? 0;
  const costBasisMerits = accountQuery.data?.costBasisMerits ?? 0;
  const investmentCashMerits = accountQuery.data?.investmentCashMerits ?? costBasisMerits;
  const holdings = accountQuery.data?.holdings ?? [];
  const portfolioValueMerits = accountQuery.data?.portfolioValueMerits ?? 0;
  const portfolioCostBasisMerits = accountQuery.data?.portfolioCostBasisMerits ?? 0;
  const portfolioReturnMerits = accountQuery.data?.portfolioReturnMerits ?? 0;
  const totalNetWorthMerits = investmentCashMerits + portfolioValueMerits;
  const latestNav = accountQuery.data?.latestNav ?? null;
  const transactions = accountQuery.data?.transactions ?? [];
  const navHistory = navHistoryQuery.data ?? [];
  const navSeries = useMemo(() => navHistoryToChartSeries(navHistory), [navHistory]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  const navigate = useCallback((screen: Screen, ticker: string | null = null) => {
    setView({ screen, ticker });
    window.scrollTo({ top: 0 });
  }, []);

  const buyHolding = useCallback(
    (input: { instrumentId: string; merits: number }) => {
      if (!studentId) return;
      buyHoldingMutation.mutate({ studentId, ...input });
    },
    [buyHoldingMutation, studentId],
  );

  const fundCash = useCallback(
    (merits: number) => {
      if (!studentId) return;
      fundCashMutation.mutate({ studentId, merits });
    },
    [fundCashMutation, studentId],
  );

  const sellHolding = useCallback(
    (input: { instrumentId: string; units: number }) => {
      if (!studentId) return;
      sellHoldingMutation.mutate({ studentId, ...input });
    },
    [sellHoldingMutation, studentId],
  );

  const withdrawPortfolio = useCallback(
    (grossMerits: number) => {
      if (!studentId) return;
      withdrawPortfolioMutation.mutate({ studentId, grossMerits });
    },
    [studentId, withdrawPortfolioMutation],
  );

  return (
    <div className={styles.shell}>
      <section className={styles.portalHeader}>
        <div className={styles.portalBrand}>
          <span className={styles.portalLogoFrame}>
            <Image alt="" height={44} src="/oasis-logo.svg" width={44} />
          </span>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Student portal</p>
            <h1>Merit Markets</h1>
            <p>
              {studentFirstName ? `${studentFirstName}'s investment account` : 'Investment account'}
            </p>
          </div>
        </div>
        <div className={styles.portalActions}>
          <div className={styles.walletValue}>
            <span className={styles.metaLabel}>Net worth</span>
            <strong>
              <MeritIcon size={16} /> {formatMerits(totalNetWorthMerits, 1)}
            </strong>
            <GbpEquivalent value={totalNetWorthMerits} />
          </div>
        </div>
      </section>

      <nav aria-label="Investment sections" className={styles.tabList}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            view.screen === item.screen || (item.screen === 'market' && view.screen === 'stock');
          return item.href ? (
            <Link
              className={cn(styles.tabButton, active ? styles.tabButtonActive : undefined)}
              href={{ pathname: item.href }}
              key={item.screen}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          ) : (
            <button
              className={cn(styles.tabButton, active ? styles.tabButtonActive : undefined)}
              key={item.screen}
              onClick={() => {
                navigate(item.screen);
              }}
              type="button"
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {view.screen === 'overview' ? (
        <InvestmentOverview
          currentValueMerits={currentValueMerits}
          defaultRange={defaultRange}
          holdings={holdings}
          investmentCashMerits={investmentCashMerits}
          latestNav={latestNav}
          loading={accountQuery.isLoading}
          navHistory={navHistory}
          onNavigate={(screen) => {
            navigate(screen);
          }}
          portfolioReturnMerits={portfolioReturnMerits}
          portfolioValueMerits={portfolioValueMerits}
          spendBalance={spendBalance}
          studentFirstName={studentFirstName}
          totalNetWorthMerits={totalNetWorthMerits}
          units={units}
        />
      ) : null}
      {view.screen === 'portfolio' ? (
        <InvestmentPortfolioPage
          holdings={holdings}
          loading={accountQuery.isLoading}
          navSeries={navSeries}
          portfolioCostBasisMerits={portfolioCostBasisMerits}
          portfolioReturnMerits={portfolioReturnMerits}
          portfolioValueMerits={portfolioValueMerits}
        />
      ) : null}
      {view.screen === 'invest' ? (
        <InvestmentInvestPage
          investmentCashMerits={investmentCashMerits}
          isFunding={fundCashMutation.isPending}
          onFundCash={fundCash}
          spendBalance={spendBalance}
        />
      ) : null}
      {view.screen === 'withdraw' ? (
        <InvestmentWithdrawPage
          holdings={holdings}
          isWithdrawing={withdrawPortfolioMutation.isPending}
          loading={accountQuery.isLoading}
          onWithdrawPortfolio={withdrawPortfolio}
          portfolioCostBasisMerits={portfolioCostBasisMerits}
          portfolioValueMerits={portfolioValueMerits}
          spendBalance={spendBalance}
        />
      ) : null}
      {view.screen === 'market' ? (
        <InvestmentMarket
          liveInstruments={liveInstruments}
          marketFreshness={marketFreshness}
          marketLoading={marketLoading}
          onOpenStock={(ticker) => {
            navigate('stock', ticker);
          }}
        />
      ) : null}
      {view.screen === 'stock' && view.ticker ? (
        <InvestmentStockDetail
          cashBalanceMerits={investmentCashMerits}
          detailLoading={instrumentDetailQuery.isLoading}
          dividends={selectedDividends}
          holding={holdings.find((holding) => holding.symbol === view.ticker) ?? null}
          isBuying={buyHoldingMutation.isPending}
          isSelling={sellHoldingMutation.isPending}
          liveInstruments={liveInstruments}
          marketFreshness={marketFreshness}
          news={selectedNews}
          onBuyHolding={buyHolding}
          onBack={() => {
            navigate('market');
          }}
          onSellHolding={sellHolding}
          ticker={view.ticker}
        />
      ) : null}
      {view.screen === 'activity' ? <InvestmentActivity transactions={transactions} /> : null}

      {toast ? (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
