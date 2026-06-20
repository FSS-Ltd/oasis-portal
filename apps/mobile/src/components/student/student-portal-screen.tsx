import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from '../smoke/portal-mobile-shell';
import { ErrorText } from '../smoke/smoke-ui';
import { StudentHomeScreen } from './student-home-screen';
import { StudentMobileAccessGate } from './student-mobile-access-gate';
import { StudentWalletScreen } from './student-wallet-screen';
import type { TransferAccount } from './student-wallet-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StudentMobileTab = 'home' | 'wallet';

const studentTabs: Array<PortalMobileNavItem<StudentMobileTab>> = [
  { id: 'home', icon: 'dashboard', label: 'Home' },
  { id: 'wallet', icon: 'wallet', label: 'Wallet' },
];

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
  const [activeTab, setActiveTab] = useState<StudentMobileTab>('home');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferPending, setTransferPending] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const studentDashboard = api.student.dashboard.useQuery(undefined, { retry: false });
  const studentWallet = api.student.wallet.useQuery(undefined, { retry: false });
  const transfer = api.meritLedger.transfer.useMutation();

  async function refresh() {
    await Promise.all([studentDashboard.refetch(), studentWallet.refetch()]);
  }

  async function handleWalletTransfer(
    from: TransferAccount,
    to: TransferAccount,
    amount: number,
  ) {
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

  const refreshing = studentDashboard.isFetching || studentWallet.isFetching;
  const queryError = studentDashboard.error?.message ?? studentWallet.error?.message ?? null;

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
            wallet={studentWallet.data}
          />
        ) : null}

        {activeTab === 'wallet' ? (
          <StudentWalletScreen
            error={studentWallet.error?.message ?? studentDashboard.error?.message ?? null}
            loading={studentWallet.isLoading || studentDashboard.isLoading}
            onTransfer={(from, to, amount) => {
              void handleWalletTransfer(from, to, amount);
            }}
            transferError={transferError}
            transferPending={transferPending}
            transferStatus={transferStatus}
            wallet={studentWallet.data}
          />
        ) : null}
      </ScrollView>

      <PortalMobileBottomNav
        activeId={activeTab}
        items={studentTabs}
        onSelect={setActiveTab}
        primaryItemLimit={2}
        variant="dark"
      />
    </>
  );
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'insufficient source balance') return 'insufficient source balance';
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
