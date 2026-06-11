'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BriefcaseBusiness, History, LineChart, Store, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/trpc';
import {
  formatMerits,
  instruments,
  meritGbp,
  navHistoryToChartSeries,
  type Instrument,
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
    const snapshots = marketQuery.data?.snapshots;
    if (!snapshots?.length) return instruments;
    const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));
    return instruments.map((inst) => {
      const s = bySymbol.get(inst.ticker);
      if (!s) return inst;
      const price = s.priceMerits * meritGbp;
      const prevClose = s.previousCloseMerits * meritGbp;
      return {
        ...inst,
        instrumentId: s.instrumentId,
        price,
        priceMerits: s.priceMerits,
        prevClose,
        dayChange: price - prevClose,
        dayChangePct: s.dayChangePct,
        learningDayChangePct: s.learningDayChangePct,
      };
    });
  }, [marketQuery.data]);

  const marketFreshness = marketQuery.data?.freshness;
  const marketLoading = marketQuery.isLoading && !marketQuery.data;

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
          holding={holdings.find((holding) => holding.symbol === view.ticker) ?? null}
          isBuying={buyHoldingMutation.isPending}
          isSelling={sellHoldingMutation.isPending}
          liveInstruments={liveInstruments}
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
