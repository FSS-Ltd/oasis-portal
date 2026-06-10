'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, LineChart, Store, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/trpc';
import {
  formatMerits,
  instruments,
  meritGbp,
  type Instrument,
  type RangeId,
} from './student-invest-data';
import { InvestmentActivity } from './student-invest-extras';
import { InvestmentMarket, InvestmentStockDetail } from './student-invest-market';
import { InvestmentOverview } from './student-invest-overview';
import { MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

type Screen = 'activity' | 'market' | 'overview' | 'stock';

interface ViewState {
  screen: Screen;
  ticker: string | null;
}

const defaultRange: RangeId = '1M';

const navItems: readonly {
  icon: LucideIcon;
  label: string;
  screen: Exclude<Screen, 'stock'>;
}[] = [
  { icon: LineChart, label: 'Overview', screen: 'overview' },
  { icon: Store, label: 'Market', screen: 'market' },
  { icon: History, label: 'Activity', screen: 'activity' },
];

export function StudentInvestClient() {
  const [view, setView] = useState<ViewState>({ screen: 'overview', ticker: null });
  const [toast, setToast] = useState<string | null>(null);

  const dashboardQuery = api.student.dashboard.useQuery(undefined, { retry: false });
  const studentId = dashboardQuery.data?.profile.studentId;
  const spendBalance = dashboardQuery.data?.merits.balances.Spend ?? 0;
  const studentFirstName = dashboardQuery.data?.profile.firstName ?? '';

  const accountQuery = api.investment.account.useQuery(
    { studentId: studentId! },
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

  const buyMutation = api.investment.buy.useMutation({
    onSuccess: (data) => {
      void accountQuery.refetch();
      void dashboardQuery.refetch();
      setToast(
        `Invested ${formatMerits(data.unitsBought * data.nav.nav, 1)} merits — ${data.unitsBought.toFixed(4)} units added.`,
      );
    },
    onError: () => {
      setToast('Investment failed. Check your Spend balance and try again.');
    },
  });

  const sellMutation = api.investment.sell.useMutation({
    onSuccess: () => {
      void accountQuery.refetch();
      void dashboardQuery.refetch();
      setToast('Withdrawal complete — merits returned to your Spend wallet.');
    },
    onError: () => {
      setToast('Withdrawal failed. Check your available units and try again.');
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
        price,
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
  const latestNav = accountQuery.data?.latestNav ?? null;
  const transactions = accountQuery.data?.transactions ?? [];
  const navHistory = navHistoryQuery.data ?? [];

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

  const buy = useCallback(
    (merits: number) => {
      if (!studentId) return;
      buyMutation.mutate({ studentId, merits });
    },
    [buyMutation, studentId],
  );

  const sell = useCallback(
    (sellUnits: number) => {
      if (!studentId) return;
      sellMutation.mutate({ studentId, units: sellUnits });
    },
    [sellMutation, studentId],
  );

  return (
    <div className={styles.shell}>
      <section className={styles.topRow}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Merit Markets</p>
          <h1>Investment portfolio</h1>
          {studentFirstName ? (
            <p>{studentFirstName}&apos;s investment account</p>
          ) : null}
        </div>
        <div className={styles.topActions}>
          <div className={styles.walletValue}>
            <span className={styles.metaLabel}>Portfolio value</span>
            <strong>
              <MeritIcon size={16} /> {formatMerits(currentValueMerits, 1)}
            </strong>
          </div>
        </div>
      </section>

      <nav aria-label="Investment sections" className={styles.tabList}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            view.screen === item.screen ||
            (item.screen === 'market' && view.screen === 'stock');
          return (
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
          costBasisMerits={costBasisMerits}
          currentValueMerits={currentValueMerits}
          defaultRange={defaultRange}
          isBuying={buyMutation.isPending}
          isSelling={sellMutation.isPending}
          latestNav={latestNav}
          loading={accountQuery.isLoading}
          navHistory={navHistory}
          onBuy={buy}
          onNavigate={(screen) => {
            navigate(screen);
          }}
          onSell={sell}
          spendBalance={spendBalance}
          studentFirstName={studentFirstName}
          units={units}
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
          liveInstruments={liveInstruments}
          onBack={() => {
            navigate('market');
          }}
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
