import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from '../core/portal-mobile-shell';
import { ErrorText } from '../core/mobile-ui';
import { StudentClubsFaithScreen } from './student-clubs-faith-screen';
import { StudentCommunityScreen } from './student-community-screen';
import { StudentHomeworkActivityScreen } from './student-homework-activity-screen';
import { StudentHomeScreen } from './student-home-screen';
import { StudentLearningScreen } from './student-learning-screen';
import type { PublicLeaderboardKind } from './student-learning-utils';
import { StudentMarketsScreen } from './student-markets-screen';
import type { MarketBuyInput, MarketSellInput, MarketTradeSide } from './student-markets-utils';
import { StudentMobileAccessGate } from './student-mobile-access-gate';
import { StudentNotificationsScreen } from './student-notifications-screen';
import { StudentShopScreen } from './student-shop-screen';
import { StudentWalletScreen } from './student-wallet-screen';
import type { TithePreferenceInput, TransferAccount } from './student-wallet-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StudentMobileTab =
  | 'home'
  | 'wallet'
  | 'learning'
  | 'activity'
  | 'clubs'
  | 'shop'
  | 'markets'
  | 'community'
  | 'updates';

export function StudentPortalScreen({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
  const signOutStudent = () => {
    void signOut();
  };

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel={`Sign out of student account ${user.id}`}
        actionLabel="Out"
        avatarLabel="ST"
        eyebrow="Student Portal"
        onActionPress={signOutStudent}
        subtitle="Student account"
        title="Oasis Learning Centre"
        variant="dark"
      />

      <StudentMobileAccessGate onSignOut={signOutStudent}>
        <StudentPortalContent user={user} />
      </StudentMobileAccessGate>
    </SafeAreaView>
  );
}

function StudentPortalContent({ user }: { user: SessionUser }) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StudentMobileTab>('home');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferPending, setTransferPending] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [titheSaveError, setTitheSaveError] = useState<string | null>(null);
  const [titheSaveStatus, setTitheSaveStatus] = useState<string | null>(null);
  const [tithePayError, setTithePayError] = useState<string | null>(null);
  const [tithePayStatus, setTithePayStatus] = useState<string | null>(null);
  const [charityError, setCharityError] = useState<string | null>(null);
  const [charityStatus, setCharityStatus] = useState<string | null>(null);
  const [marketCashError, setMarketCashError] = useState<string | null>(null);
  const [marketCashStatus, setMarketCashStatus] = useState<string | null>(null);
  const [marketTradeError, setMarketTradeError] = useState<string | null>(null);
  const [marketTradeStatus, setMarketTradeStatus] = useState<string | null>(null);
  const [leaderboardKind, setLeaderboardKind] = useState<PublicLeaderboardKind>('TopTithers');
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [notificationRefreshFailed, setNotificationRefreshFailed] = useState(false);
  const studentDashboard = api.student.dashboard.useQuery(undefined, { retry: false });
  const studentWallet = api.student.wallet.useQuery(undefined, { retry: false });
  const titheStatus = api.tithe.getStatus.useQuery(undefined, {
    enabled: activeTab === 'wallet',
    retry: false,
  });
  const academicScreensEnabled = studentDashboard.data?.profile.academicScreensEnabled === true;
  const studentId = studentWallet.data?.studentId ?? '';
  const studentPace = api.pace.forStudent.useQuery(
    { studentId },
    { enabled: academicScreensEnabled && studentId.length > 0, retry: false },
  );
  const studentAttendance = api.attendance.studentSummary.useQuery(undefined, {
    enabled: academicScreensEnabled,
    retry: false,
  });
  const studentLeaderboard = api.leaderboard.get.useQuery(
    {
      includeViewerRows: true,
      kind: leaderboardKind,
      limit: 10,
      scope: 'public',
    },
    { retry: false },
  );
  const studentHomeworkDue = api.homework.studentDue.useQuery(undefined, { retry: false });
  const studentHomeworkGraded = api.homework.studentGraded.useQuery(undefined, { retry: false });
  const studentNotifications = api.studentNotification.list.useQuery(undefined, { retry: false });
  const studentNotificationUnread = api.studentNotification.unreadCount.useQuery(undefined, {
    retry: false,
  });
  const shopItems = api.shop.listItems.useQuery(undefined, {
    enabled: activeTab === 'shop',
    retry: false,
  });
  const shopHistory = api.shop.studentHistory.useQuery(undefined, {
    enabled: activeTab === 'shop',
    retry: false,
  });
  const investmentAccount = api.investment.account.useQuery(
    { studentId },
    { enabled: activeTab === 'markets' && studentId.length > 0, retry: false },
  );
  const investmentMarket = api.investment.marketData.useQuery(undefined, {
    enabled: activeTab === 'markets',
    retry: false,
  });
  const transfer = api.meritLedger.transfer.useMutation();
  const updateTithePreference = api.tithe.updatePreference.useMutation();
  const payTitheDue = api.tithe.payDue.useMutation();
  const giveToCharity = api.meritLedger.giveToCharity.useMutation();
  const fundMarketCash = api.investment.fundCash.useMutation();
  const buyMarketHolding = api.investment.buyHolding.useMutation();
  const sellMarketHolding = api.investment.sellHolding.useMutation();
  const markNotificationRead = api.studentNotification.markRead.useMutation({
    onSettled: () => {
      setPendingNotificationId(null);
    },
    onSuccess: async () => {
      await Promise.all([
        utils.studentNotification.list.invalidate(),
        utils.studentNotification.unreadCount.invalidate(),
        utils.student.dashboard.invalidate(),
      ]);
    },
  });

  const studentTabs: Array<PortalMobileNavItem<StudentMobileTab>> = [
    { id: 'home', icon: 'dashboard', label: 'Home' },
    { id: 'wallet', icon: 'wallet', label: 'Wallet' },
    { id: 'learning', icon: 'pace', label: 'Learning' },
    { id: 'activity', icon: 'clubs', label: 'Activity' },
    { id: 'clubs', icon: 'clubs', label: 'Clubs' },
    { id: 'shop', icon: 'shop', label: 'Shop' },
    { id: 'markets', icon: 'wallet', label: 'Markets' },
    { id: 'community', icon: 'messages', label: 'Community' },
    {
      id: 'updates',
      icon: 'notices',
      label: 'Updates',
      badge: studentNotificationUnread.data?.count,
    },
  ];

  async function refreshHomework() {
    await Promise.all([studentHomeworkDue.refetch(), studentHomeworkGraded.refetch()]);
  }

  async function refresh() {
    setNotificationRefreshFailed(false);
    try {
      await Promise.all([
        studentDashboard.refetch(),
        studentWallet.refetch(),
        academicScreensEnabled && studentId.length > 0 ? studentPace.refetch() : Promise.resolve(),
        academicScreensEnabled ? studentAttendance.refetch() : Promise.resolve(),
        studentLeaderboard.refetch(),
        studentHomeworkDue.refetch(),
        studentHomeworkGraded.refetch(),
        studentNotifications.refetch(),
        studentNotificationUnread.refetch(),
        activeTab === 'wallet' ? titheStatus.refetch() : Promise.resolve(),
        activeTab === 'shop' ? shopItems.refetch() : Promise.resolve(),
        activeTab === 'shop' ? shopHistory.refetch() : Promise.resolve(),
        activeTab === 'markets' && studentId.length > 0
          ? investmentAccount.refetch()
          : Promise.resolve(),
        activeTab === 'markets' ? investmentMarket.refetch() : Promise.resolve(),
      ]);
    } catch {
      setNotificationRefreshFailed(true);
    }
  }

  async function handleWalletTransfer(from: TransferAccount, to: TransferAccount, amount: number) {
    if (!studentWallet.data) {
      setTransferError('Transfer failed: wallet is not ready yet.');
      setTransferStatus(null);
      return;
    }

    const studentId = studentWallet.data.studentId;
    setTransferError(null);
    setTransferPending(true);
    setTransferStatus(null);

    try {
      await transfer.mutateAsync({ amount, from, studentId, to });
      await Promise.all([studentWallet.refetch(), studentDashboard.refetch()]);
      setTransferStatus('Transfer complete');
    } catch (error) {
      setTransferError(`Transfer failed: ${messageFromUnknown(error)}`);
    } finally {
      setTransferPending(false);
    }
  }

  async function handleSaveTithePreference(input: TithePreferenceInput) {
    setTitheSaveError(null);
    setTitheSaveStatus(null);
    setTithePayError(null);
    setTithePayStatus(null);

    try {
      await updateTithePreference.mutateAsync(input);
      await titheStatus.refetch();
      setTitheSaveStatus('Tithe preference saved');
    } catch (error) {
      setTitheSaveError(`Tithe preference failed: ${messageFromUnknown(error)}`);
    }
  }

  async function handlePayTitheDue() {
    setTithePayError(null);
    setTithePayStatus(null);

    try {
      await payTitheDue.mutateAsync();
      await Promise.all([
        titheStatus.refetch(),
        studentWallet.refetch(),
        studentDashboard.refetch(),
      ]);
      setTithePayStatus('Tithe paid');
    } catch (error) {
      setTithePayError(`Tithe payment failed: ${messageFromUnknown(error)}`);
    }
  }

  async function handleGiveToCharity(amount: number) {
    if (!studentWallet.data) {
      setCharityError('Charity gift failed: wallet is not ready yet.');
      setCharityStatus(null);
      return;
    }

    setCharityError(null);
    setCharityStatus(null);

    try {
      await giveToCharity.mutateAsync({ amount, studentId: studentWallet.data.studentId });
      await Promise.all([studentWallet.refetch(), studentDashboard.refetch()]);
      setCharityStatus('Charity gift added');
    } catch (error) {
      setCharityError(`Charity gift failed: ${messageFromUnknown(error)}`);
    }
  }

  async function handleFundMarketCash(merits: number) {
    if (!studentWallet.data) {
      setMarketCashError('Funding failed: wallet is not ready yet.');
      setMarketCashStatus(null);
      return;
    }

    setMarketCashError(null);
    setMarketCashStatus(null);

    try {
      await fundMarketCash.mutateAsync({ merits, studentId: studentWallet.data.studentId });
      await Promise.all([
        investmentAccount.refetch(),
        studentWallet.refetch(),
        studentDashboard.refetch(),
      ]);
      setMarketCashStatus('Markets cash funded');
    } catch (error) {
      setMarketCashError(`Funding failed: ${messageFromUnknown(error)}`);
    }
  }

  async function refreshMarketsAfterTrade() {
    await Promise.all([
      investmentAccount.refetch(),
      investmentMarket.refetch(),
      studentWallet.refetch(),
      studentDashboard.refetch(),
    ]);
  }

  async function handleBuyMarketHolding(input: MarketBuyInput) {
    if (!studentWallet.data) {
      setMarketTradeError('Buy failed: wallet is not ready yet.');
      setMarketTradeStatus(null);
      return;
    }

    setMarketTradeError(null);
    setMarketTradeStatus(null);

    try {
      const result = await buyMarketHolding.mutateAsync({
        ...input,
        studentId: studentWallet.data.studentId,
      });
      await refreshMarketsAfterTrade();
      setMarketTradeStatus(`Buy complete: ${result.unitsBought.toFixed(4)} units`);
    } catch (error) {
      setMarketTradeError(`Buy failed: ${messageFromUnknown(error)}`);
    }
  }

  async function handleSellMarketHolding(input: MarketSellInput) {
    if (!studentWallet.data) {
      setMarketTradeError('Sell failed: wallet is not ready yet.');
      setMarketTradeStatus(null);
      return;
    }

    setMarketTradeError(null);
    setMarketTradeStatus(null);

    try {
      const result = await sellMarketHolding.mutateAsync({
        ...input,
        studentId: studentWallet.data.studentId,
      });
      await refreshMarketsAfterTrade();
      setMarketTradeStatus(`Sell complete: ${result.unitsSold.toFixed(4)} units`);
    } catch (error) {
      setMarketTradeError(`Sell failed: ${messageFromUnknown(error)}`);
    }
  }

  function handleMarkNotificationRead(notificationId: string) {
    setPendingNotificationId(notificationId);
    markNotificationRead.mutate({ notificationId });
  }

  const refreshing =
    studentDashboard.isFetching ||
    studentWallet.isFetching ||
    studentPace.isFetching ||
    studentAttendance.isFetching ||
    studentLeaderboard.isFetching ||
    studentHomeworkDue.isFetching ||
    studentHomeworkGraded.isFetching ||
    titheStatus.isFetching ||
    studentNotifications.isFetching ||
    studentNotificationUnread.isFetching ||
    shopItems.isFetching ||
    shopHistory.isFetching ||
    investmentAccount.isFetching ||
    investmentMarket.isFetching;
  const queryError =
    studentDashboard.error?.message ??
    studentWallet.error?.message ??
    (activeTab === 'wallet' ? titheStatus.error?.message : null) ??
    (activeTab === 'shop' ? (shopItems.error?.message ?? shopHistory.error?.message) : null) ??
    (activeTab === 'markets'
      ? (investmentAccount.error?.message ?? investmentMarket.error?.message)
      : null) ??
    null;

  return (
    <>
      <ScrollView
        accessibilityLabel={`Student portal content for ${user.id}`}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={refreshing}
            tintColor={C.surface}
            titleColor={C.surface}
          />
        }
      >
        {queryError && studentDashboard.data ? (
          <View style={styles.inlineError}>
            <ErrorText>{queryError}</ErrorText>
          </View>
        ) : null}

        {activeTab === 'home' ? (
          <StudentHomeScreen
            dashboard={studentDashboard.data}
            error={studentDashboard.error?.message ?? null}
            loading={studentDashboard.isLoading}
            onOpenWallet={() => {
              setActiveTab('wallet');
            }}
            onOpenShop={() => {
              setActiveTab('shop');
            }}
            wallet={studentWallet.data}
          />
        ) : null}

        {activeTab === 'wallet' ? (
          <StudentWalletScreen
            charityError={charityError}
            charityPending={giveToCharity.isPending}
            charityStatus={charityStatus}
            error={studentWallet.error?.message ?? studentDashboard.error?.message ?? null}
            loading={studentWallet.isLoading || studentDashboard.isLoading}
            onGiveToCharity={(amount) => {
              void handleGiveToCharity(amount);
            }}
            onPayTitheDue={() => {
              void handlePayTitheDue();
            }}
            onSaveTithePreference={(input) => {
              void handleSaveTithePreference(input);
            }}
            onTransfer={(from, to, amount) => {
              void handleWalletTransfer(from, to, amount);
            }}
            titheError={titheStatus.error?.message ?? null}
            titheLoading={titheStatus.isLoading}
            tithePayError={tithePayError}
            tithePayPending={payTitheDue.isPending}
            tithePayStatus={tithePayStatus}
            titheSaveError={titheSaveError}
            titheSavePending={updateTithePreference.isPending}
            titheSaveStatus={titheSaveStatus}
            titheStatus={titheStatus.data}
            transferError={transferError}
            transferPending={transferPending}
            transferStatus={transferStatus}
            wallet={studentWallet.data}
          />
        ) : null}

        {activeTab === 'learning' ? (
          <StudentLearningScreen
            attendance={studentAttendance.data}
            attendanceError={studentAttendance.error?.message ?? null}
            dashboard={studentDashboard.data}
            leaderboard={studentLeaderboard.data}
            leaderboardError={studentLeaderboard.error?.message ?? null}
            leaderboardKind={leaderboardKind}
            loading={
              studentDashboard.isLoading ||
              studentWallet.isLoading ||
              studentPace.isLoading ||
              studentAttendance.isLoading ||
              studentLeaderboard.isLoading
            }
            onSelectLeaderboardKind={setLeaderboardKind}
            pace={studentPace.data}
            paceError={studentPace.error?.message ?? null}
          />
        ) : null}

        {activeTab === 'activity' ? (
          <StudentHomeworkActivityScreen
            due={studentHomeworkDue.data}
            dueError={studentHomeworkDue.error?.message ?? null}
            graded={studentHomeworkGraded.data}
            gradedError={studentHomeworkGraded.error?.message ?? null}
            loading={studentHomeworkDue.isLoading || studentHomeworkGraded.isLoading}
            onRefreshHomework={refreshHomework}
          />
        ) : null}

        {activeTab === 'clubs' ? <StudentClubsFaithScreen /> : null}

        {activeTab === 'shop' ? (
          <StudentShopScreen
            heldMerits={studentWallet.data?.balances.ShopReserved ?? 0}
            history={shopHistory.data}
            historyError={shopHistory.error?.message ?? null}
            historyLoading={shopHistory.isFetching}
            items={shopItems.data ?? []}
            loading={shopItems.isFetching || studentWallet.isFetching}
            shopError={shopItems.error?.message ?? studentWallet.error?.message ?? null}
            spendBalance={studentWallet.data?.balances.Spend ?? 0}
            studentId={studentWallet.data?.studentId}
          />
        ) : null}

        {activeTab === 'markets' ? (
          <StudentMarketsScreen
            account={investmentAccount.data}
            accountError={investmentAccount.error?.message ?? null}
            accountLoading={investmentAccount.isLoading}
            fundCashError={marketCashError}
            fundCashPending={fundMarketCash.isPending}
            fundCashStatus={marketCashStatus}
            marketData={investmentMarket.data}
            marketError={investmentMarket.error?.message ?? null}
            marketLoading={investmentMarket.isLoading}
            onBuyHolding={(input) => {
              void handleBuyMarketHolding(input);
            }}
            onFundCash={(merits) => {
              void handleFundMarketCash(merits);
            }}
            onSellHolding={(input) => {
              void handleSellMarketHolding(input);
            }}
            spendBalance={studentWallet.data?.balances.Spend ?? 0}
            studentId={studentWallet.data?.studentId}
            tradeError={marketTradeError}
            tradePendingSide={marketTradePendingSide(
              buyMarketHolding.isPending,
              sellMarketHolding.isPending,
            )}
            tradeStatus={marketTradeStatus}
          />
        ) : null}

        {activeTab === 'community' ? <StudentCommunityScreen /> : null}

        {activeTab === 'updates' ? (
          <StudentNotificationsScreen
            error={studentNotifications.error?.message ?? null}
            loading={studentNotifications.isLoading || studentNotificationUnread.isLoading}
            markReadError={markNotificationRead.error?.message ?? null}
            notifications={studentNotifications.data}
            onMarkRead={handleMarkNotificationRead}
            pendingNotificationId={pendingNotificationId}
            refreshFailed={
              notificationRefreshFailed ||
              Boolean(studentNotifications.error && studentNotifications.data)
            }
            unreadCount={
              studentNotificationUnread.data?.count ??
              studentDashboard.data?.notifications.unreadCount ??
              0
            }
          />
        ) : null}

      </ScrollView>

      <PortalMobileBottomNav
        activeId={activeTab}
        items={studentTabs}
        onSelect={setActiveTab}
        primaryItemLimit={3}
        variant="dark"
      />
    </>
  );
}

function marketTradePendingSide(buyPending: boolean, sellPending: boolean): MarketTradeSide | null {
  if (buyPending) return 'buy';
  if (sellPending) return 'sell';
  return null;
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'insufficient source balance') return 'insufficient source balance';
    if (error.message === 'insufficient Spend balance') return 'insufficient Spend balance';
    if (error.message === 'insufficient Merit Markets cash balance') {
      return 'insufficient Merit Markets cash balance';
    }
    if (error.message === 'insufficient holding units') return 'insufficient holding units';
    if (error.message === 'investment instrument is unavailable') {
      return 'investment instrument is unavailable';
    }
    if (error.message === 'investment holding is unavailable') {
      return 'investment holding is unavailable';
    }
    return error.message;
  }
  if (typeof error === 'string') return error;
  return 'The wallet action could not be completed.';
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 120,
  },
  inlineError: {
    backgroundColor: C.surface,
    borderColor: C.dangerMid,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  shell: {
    backgroundColor: C.navy,
    flex: 1,
  },
});
