'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, LineChart, Store, WalletCards, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatMerits,
  initialCashMerits,
  initialHoldings,
  initialTransactions,
  instrumentForTicker,
  netWorthMerits,
  studentInvestor,
  today,
  toMerits,
  type Holding,
  type InvestmentTransaction,
  type RangeId,
} from './student-invest-data';
import {
  InvestmentActivity,
  InvestmentWithdraw,
  proportionalWithdrawalScale,
} from './student-invest-extras';
import { InvestmentMarket, InvestmentStockDetail } from './student-invest-market';
import { InvestmentOverview, InvestmentPortfolio } from './student-invest-overview';
import { MeritIcon } from './student-invest-ui';
import styles from './student-invest.module.css';

type Screen = 'activity' | 'market' | 'overview' | 'portfolio' | 'stock' | 'withdraw';

interface ViewState {
  screen: Screen;
  ticker: string | null;
}

interface SavedState {
  cashMerits: number;
  holdings: readonly Holding[];
  transactions: readonly InvestmentTransaction[];
}

const storageKey = 'oasis-student-invest-v1';
const defaultRange: RangeId = '1M';

const navItems: readonly {
  icon: LucideIcon;
  label: string;
  screen: Exclude<Screen, 'stock' | 'withdraw'>;
}[] = [
  { icon: LineChart, label: 'Overview', screen: 'overview' },
  { icon: WalletCards, label: 'Portfolio', screen: 'portfolio' },
  { icon: Store, label: 'Market', screen: 'market' },
  { icon: History, label: 'Activity', screen: 'activity' },
];

export function StudentInvestClient() {
  const [holdings, setHoldings] = useState<readonly Holding[]>(initialHoldings);
  const [cashMerits, setCashMerits] = useState(initialCashMerits);
  const [transactions, setTransactions] =
    useState<readonly InvestmentTransaction[]>(initialTransactions);
  const [view, setView] = useState<ViewState>({ screen: 'overview', ticker: null });
  const [toast, setToast] = useState<string | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const liveHoldings = holdings.filter((holding) => holding.units > 0.000001);
  const netWorth = netWorthMerits(liveHoldings, cashMerits);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedState>;
        if (Array.isArray(parsed.holdings)) setHoldings(parsed.holdings);
        if (typeof parsed.cashMerits === 'number') setCashMerits(parsed.cashMerits);
        if (Array.isArray(parsed.transactions)) setTransactions(parsed.transactions);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setStateLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!stateLoaded) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ cashMerits, holdings, transactions } satisfies SavedState),
    );
  }, [cashMerits, holdings, stateLoaded, transactions]);

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

  const nextTransactionId = useCallback(
    () => Math.max(0, ...transactions.map((transaction) => transaction.id)) + 1,
    [transactions],
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(today),
    [],
  );

  const buy = useCallback(
    (ticker: string, merits: number) => {
      const instrument = instrumentForTicker(ticker);
      const unitsToAdd = merits / toMerits(instrument.price);
      setHoldings((currentHoldings) => {
        const existing = currentHoldings.find((holding) => holding.ticker === ticker);
        if (!existing) {
          return [...currentHoldings, { avgCost: instrument.price, ticker, units: unitsToAdd }];
        }
        const totalUnits = existing.units + unitsToAdd;
        const avgCost =
          (existing.units * existing.avgCost + unitsToAdd * instrument.price) / totalUnits;
        return currentHoldings.map((holding) =>
          holding.ticker === ticker ? { ...holding, avgCost, units: totalUnits } : holding,
        );
      });
      setCashMerits((currentCash) => Number((currentCash - merits).toFixed(4)));
      setTransactions((currentTransactions) => [
        {
          date: todayLabel,
          id: nextTransactionId(),
          kind: 'buy',
          merits,
          note: '',
          ticker,
          units: unitsToAdd,
        },
        ...currentTransactions,
      ]);
    },
    [nextTransactionId, todayLabel],
  );

  const sell = useCallback(
    (ticker: string, merits: number) => {
      const instrument = instrumentForTicker(ticker);
      const unitsToRemove = merits / toMerits(instrument.price);
      setHoldings((currentHoldings) =>
        currentHoldings
          .map((holding) =>
            holding.ticker === ticker
              ? { ...holding, units: Math.max(0, holding.units - unitsToRemove) }
              : holding,
          )
          .filter((holding) => holding.units > 0.0001),
      );
      setCashMerits((currentCash) => Number((currentCash + merits).toFixed(4)));
      setTransactions((currentTransactions) => [
        {
          date: todayLabel,
          id: nextTransactionId(),
          kind: 'sell',
          merits,
          note: '',
          ticker,
          units: unitsToRemove,
        },
        ...currentTransactions,
      ]);
    },
    [nextTransactionId, todayLabel],
  );

  const withdraw = useCallback(
    (grossMerits: number, netMerits: number) => {
      const scale = proportionalWithdrawalScale(liveHoldings, cashMerits, grossMerits);
      setHoldings((currentHoldings) =>
        currentHoldings
          .map((holding) => ({ ...holding, units: holding.units * scale }))
          .filter((holding) => holding.units > 0.0001),
      );
      setCashMerits((currentCash) => Number((currentCash * scale).toFixed(4)));
      setTransactions((currentTransactions) => [
        {
          date: todayLabel,
          id: nextTransactionId(),
          kind: 'withdraw',
          merits: -grossMerits,
          note: `${formatMerits(netMerits, 1)} to Spend wallet`,
          ticker: null,
          units: 0,
        },
        ...currentTransactions,
      ]);
    },
    [cashMerits, liveHoldings, nextTransactionId, todayLabel],
  );

  const resetPrototype = useCallback(() => {
    setHoldings(initialHoldings);
    setCashMerits(initialCashMerits);
    setTransactions(initialTransactions);
    setToast('Portfolio reset to its starting state.');
    navigate('overview');
  }, [navigate]);

  return (
    <div className={styles.shell}>
      <section className={styles.topRow}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Merit Markets</p>
          <h1>Investment portfolio</h1>
          <p>
            {studentInvestor.name} - {studentInvestor.year} - {studentInvestor.tutor}
          </p>
        </div>
        <div className={styles.topActions}>
          <div className={styles.studentAvatar} style={{ backgroundColor: studentInvestor.color }}>
            {studentInvestor.initials}
          </div>
          <div className={styles.walletValue}>
            <span className={styles.metaLabel}>Net worth</span>
            <strong>
              <MeritIcon size={16} /> {formatMerits(netWorth, 1)}
            </strong>
          </div>
          <button className={styles.secondaryButton} onClick={resetPrototype} type="button">
            Reset
          </button>
        </div>
      </section>

      <nav aria-label="Investment sections" className={styles.tabList}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            view.screen === item.screen ||
            (item.screen === 'market' && view.screen === 'stock') ||
            (item.screen === 'overview' && view.screen === 'withdraw');
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
          cashMerits={cashMerits}
          defaultRange={defaultRange}
          holdings={holdings}
          onNavigate={(screen) => {
            navigate(screen);
          }}
          onOpenStock={(ticker) => {
            navigate('stock', ticker);
          }}
        />
      ) : null}
      {view.screen === 'portfolio' ? (
        <InvestmentPortfolio
          cashMerits={cashMerits}
          defaultRange={defaultRange}
          holdings={holdings}
          onNavigate={(screen) => {
            navigate(screen);
          }}
          onOpenStock={(ticker) => {
            navigate('stock', ticker);
          }}
        />
      ) : null}
      {view.screen === 'market' ? (
        <InvestmentMarket
          holdings={holdings}
          onOpenStock={(ticker) => {
            navigate('stock', ticker);
          }}
        />
      ) : null}
      {view.screen === 'stock' && view.ticker ? (
        <InvestmentStockDetail
          cashMerits={cashMerits}
          holdings={holdings}
          onBack={() => {
            navigate('market');
          }}
          onBuy={buy}
          onSell={sell}
          onToast={setToast}
          ticker={view.ticker}
        />
      ) : null}
      {view.screen === 'withdraw' ? (
        <InvestmentWithdraw
          cashMerits={cashMerits}
          holdings={holdings}
          onBack={() => {
            navigate('overview');
          }}
          onToast={setToast}
          onWithdraw={withdraw}
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
