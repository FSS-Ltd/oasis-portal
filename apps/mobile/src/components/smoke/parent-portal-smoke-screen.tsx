import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from './smoke-ui';
import { ParentChildOverview, ParentChildPicker } from './parent-smoke-children';
import { ParentMessagesPanel } from './parent-smoke-messages';
import { ParentNoticesPanel } from './parent-smoke-notices';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from './portal-mobile-shell';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type DashboardChild = RouterOutputs['childLog']['parentDashboard']['children'][number];
type ParentMobileTab = 'home' | 'notices' | 'messages';

const tabs: Array<PortalMobileNavItem<ParentMobileTab>> = [
  { id: 'home', label: 'Home', icon: 'dashboard' },
  { id: 'notices', label: 'Notices', icon: 'notices' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
];

function firstError(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => Boolean(message)) ?? null;
}

function ParentHomeIntro({ child }: { child: DashboardChild | null }) {
  return (
    <View style={styles.homeIntro}>
      <Text style={styles.dateText}>
        {new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(new Date())}
      </Text>
      <Text style={styles.homeTitle}>Welcome</Text>
      <Text style={styles.homeSubtitle}>
        {child ? `Parent of ${child.student.fullName}` : 'Your family dashboard'}
      </Text>
    </View>
  );
}

export function ParentPortalSmokeScreen({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<ParentMobileTab>('home');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const dashboard = api.childLog.parentDashboard.useQuery(undefined, { retry: false });
  const notices = api.notice.listForParents.useQuery(undefined, { retry: false });
  const threads = api.message.listThreads.useQuery(undefined, { retry: false });
  const recipients = api.message.listRecipients.useQuery(undefined, { retry: false });

  const children = dashboard.data?.children ?? [];
  const selectedChild =
    children.find((child) => child.student.id === selectedStudentId) ?? children[0] ?? null;
  const selectedChildId = selectedChild?.student.id ?? '';
  const childDetail = api.childLog.drillThrough.useQuery(
    { studentId: selectedChildId },
    { enabled: Boolean(selectedChildId), retry: false },
  );

  const loading =
    dashboard.isFetching ||
    notices.isFetching ||
    threads.isFetching ||
    recipients.isFetching ||
    childDetail.isFetching;
  const unreadNoticeCount = (notices.data ?? []).filter((notice) => !notice.read).length;
  const unreadMessageCount = (threads.data ?? []).reduce(
    (count, thread) => count + thread.unreadCount,
    0,
  );
  const queryError = firstError(
    dashboard.error?.message,
    notices.error?.message,
    threads.error?.message,
    recipients.error?.message,
    childDetail.error?.message,
  );

  async function refresh() {
    await Promise.all([
      dashboard.refetch(),
      notices.refetch(),
      threads.refetch(),
      recipients.refetch(),
    ]);
    if (selectedChildId) await childDetail.refetch();
  }

  const header = (
    <PortalMobileHeader
      actionAccessibilityLabel={`Sign out of parent account ${user.id}`}
      actionLabel="Sign out"
      avatarLabel="P"
      eyebrow="Parent Portal"
      onActionPress={() => {
        void signOut();
      }}
      subtitle={selectedChild ? `Parent of ${selectedChild.student.fullName}` : 'Family account'}
      title="Oasis Learning Centre"
    />
  );

  const bottomNav = (
    <PortalMobileBottomNav
      activeId={activeTab}
      items={tabs.map((tab) => ({
        ...tab,
        badge:
          tab.id === 'notices'
            ? unreadNoticeCount
            : tab.id === 'messages'
              ? unreadMessageCount
              : undefined,
      }))}
      onSelect={setActiveTab}
    />
  );

  if (activeTab === 'messages') {
    return (
      <SafeAreaView style={styles.shell}>
        {header}
        <View style={styles.messagesContent}>
          {queryError ? <ErrorText>{queryError}</ErrorText> : null}
          <ParentMessagesPanel
            onRefresh={refresh}
            recipients={recipients.data ?? []}
            refreshing={loading}
            threads={threads.data ?? []}
          />
        </View>
        {bottomNav}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={loading}
          />
        }
        style={styles.scroller}
      >
        {queryError ? <ErrorText>{queryError}</ErrorText> : null}

        {activeTab === 'home' ? (
          <>
            <ParentHomeIntro child={selectedChild} />
            <ParentChildPicker
              rows={children}
              selectedStudentId={selectedChildId}
              onSelect={setSelectedStudentId}
            />
            {dashboard.isLoading ? <InlineSpinner label="Loading children" /> : null}
            {selectedChild ? (
              <ParentChildOverview child={selectedChild} detail={childDetail.data} />
            ) : (
              <Card>
                <SectionTitle>No linked children</SectionTitle>
                <MutedText>No active linked children were returned for this parent account.</MutedText>
              </Card>
            )}
          </>
        ) : null}

        {activeTab === 'notices' ? <ParentNoticesPanel notices={notices.data ?? []} /> : null}
      </ScrollView>
      {bottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 14,
    paddingBottom: 26,
  },
  dateText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  homeIntro: {
    gap: 2,
    paddingTop: 2,
  },
  homeSubtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  homeTitle: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '800',
  },
  messagesContent: {
    backgroundColor: C.bg,
    flex: 1,
    gap: 12,
    padding: 14,
    paddingBottom: 10,
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  shell: {
    backgroundColor: C.surface,
    flex: 1,
  },
});
