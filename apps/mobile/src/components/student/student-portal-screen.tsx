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
import { StudentWalletScreen } from './student-wallet-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StudentMobileTab = 'home' | 'wallet';

const studentTabs: Array<PortalMobileNavItem<StudentMobileTab>> = [
  { id: 'home', icon: 'dashboard', label: 'Home' },
  { id: 'wallet', icon: 'wallet', label: 'Wallet' },
];

export function StudentPortalScreen({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<StudentMobileTab>('home');
  const studentDashboard = api.student.dashboard.useQuery(undefined, { retry: false });
  const studentWallet = api.student.wallet.useQuery(undefined, { retry: false });

  async function refresh() {
    await Promise.all([studentDashboard.refetch(), studentWallet.refetch()]);
  }

  const refreshing = studentDashboard.isFetching || studentWallet.isFetching;
  const queryError = studentDashboard.error?.message ?? studentWallet.error?.message ?? null;
  const firstName = studentDashboard.data?.profile.firstName ?? 'Student';
  const avatarLabel = studentDashboard.data?.profile.iconInitials ?? 'ST';

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel={`Sign out of student account ${user.id}`}
        actionLabel="Out"
        avatarLabel={avatarLabel}
        eyebrow="Student Portal"
        onActionPress={() => {
          void signOut();
        }}
        subtitle={`Hi, ${firstName}`}
        title="Oasis Learning Centre"
        variant="dark"
      />

      <ScrollView
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
    </SafeAreaView>
  );
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
