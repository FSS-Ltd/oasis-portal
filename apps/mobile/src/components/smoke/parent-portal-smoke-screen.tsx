import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import {
  Card,
  ErrorText,
  InlineSpinner,
  MutedText,
  SectionTitle,
  SmokeButton,
  StatCard,
} from './smoke-ui';
import { ParentChildOverview, ParentChildPicker } from './parent-smoke-children';
import { ParentMessagesPanel } from './parent-smoke-messages';
import { ParentNoticesPanel } from './parent-smoke-notices';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type ParentSmokeTab = 'overview' | 'notices' | 'messages';

const tabs: Array<{ id: ParentSmokeTab; label: string }> = [
  { id: 'overview', label: 'Children' },
  { id: 'notices', label: 'Notices' },
  { id: 'messages', label: 'Messages' },
];

function firstError(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => Boolean(message)) ?? null;
}

export function ParentPortalSmokeScreen({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<ParentSmokeTab>('overview');
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

  return (
    <SafeAreaView style={styles.shell}>
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
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Parent Portal</Text>
            <Text style={styles.title}>Mobile smoke</Text>
            <Text style={styles.subtitle}>{user.id}</Text>
          </View>
          <SmokeButton
            compact
            label="Sign out"
            onPress={() => {
              void signOut();
            }}
            variant="secondary"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard accent={C.blue} label="Children" value={String(children.length)} />
          <StatCard accent={C.crimson} label="Notices" value={String(unreadNoticeCount)} />
          <StatCard accent={C.navy} label="Messages" value={String(unreadMessageCount)} />
        </View>

        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <SmokeButton
              compact
              key={tab.id}
              label={tab.label}
              onPress={() => {
                setActiveTab(tab.id);
              }}
              variant={activeTab === tab.id ? 'primary' : 'secondary'}
            />
          ))}
        </View>

        {queryError ? <ErrorText>{queryError}</ErrorText> : null}

        {activeTab === 'overview' ? (
          <>
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

        {activeTab === 'messages' ? (
          <ParentMessagesPanel recipients={recipients.data ?? []} threads={threads.data ?? []} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 28,
  },
  eyebrow: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: C.navy,
    fontSize: 24,
    fontWeight: '800',
  },
});
