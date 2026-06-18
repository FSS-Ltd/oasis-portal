import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { ParentMessagesPanel } from '../smoke/parent-smoke-messages';
import { Card, ErrorText, InlineSpinner, MutedText, SmokeButton } from '../smoke/smoke-ui';
import { PortalMobileHeader } from '../smoke/portal-mobile-shell';
import { StaffNoticesPanel, type StaffNotice } from './staff-notices-panel';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffConversation = RouterOutputs['message']['listConversations']['items'][number];
type StaffCommunicationsTab = 'notices' | 'messages';

const staffInboxConversationKinds = ['Staffroom', 'StaffDirect'] as const;
const supervisorHeadConversationKinds = ['SupervisorHead'] as const;

function unreadCount(notices: StaffNotice[]): number {
  return notices.filter((notice) => !notice.read).length;
}

export function StaffCommunicationsScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StaffCommunicationsTab>('notices');
  const canUseSupervisorHead = user?.role === 'Supervisor';
  const notices = api.notice.listForStaff.useQuery(undefined, { retry: false });
  const conversations = api.message.listConversations.useQuery(
    { kinds: [...staffInboxConversationKinds], limit: 20 },
    { retry: false },
  );
  const supervisorHeadConversations = api.message.listConversations.useQuery(
    { kinds: [...supervisorHeadConversationKinds], limit: 20 },
    { enabled: canUseSupervisorHead, retry: false },
  );
  const recipients = api.message.listRecipients.useQuery({ kind: 'StaffDirect' }, { retry: false });
  const headRecipients = api.message.listRecipients.useQuery(
    { kind: 'SupervisorHead' },
    { enabled: canUseSupervisorHead, retry: false },
  );
  const openStaffroom = api.message.openStaffroom.useMutation({
    onSuccess: async () => {
      setActiveTab('messages');
      await utils.message.listConversations.invalidate();
    },
  });
  const unreadNotices = useMemo(() => unreadCount(notices.data ?? []), [notices.data]);
  const unreadMessages = useMemo(
    () =>
      [...(conversations.data?.items ?? []), ...(supervisorHeadConversations.data?.items ?? [])]
        .filter(isStaffConversation)
        .reduce((count, conversation) => count + conversation.unreadCount, 0),
    [conversations.data?.items, supervisorHeadConversations.data?.items],
  );
  const refreshing =
    notices.isFetching ||
    conversations.isFetching ||
    supervisorHeadConversations.isFetching ||
    recipients.isFetching ||
    headRecipients.isFetching ||
    openStaffroom.isPending;

  async function refresh() {
    await Promise.all([
      notices.refetch(),
      conversations.refetch(),
      canUseSupervisorHead ? supervisorHeadConversations.refetch() : Promise.resolve(),
      recipients.refetch(),
      canUseSupervisorHead ? headRecipients.refetch() : Promise.resolve(),
    ]);
  }

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Sign out of staff account"
        actionLabel="Out"
        avatarLabel="S"
        eyebrow="Staff Portal"
        onActionPress={() => {
          void signOut();
        }}
        subtitle={`${user?.role ?? 'Staff'} · Communications`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to staff home"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.titleGroup}>
            <Text style={styles.eyebrow}>Daily communications</Text>
            <Text style={styles.title}>Noticeboard and staff messages</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton
            active={activeTab === 'notices'}
            badge={unreadNotices}
            label="Notices"
            onPress={() => {
              setActiveTab('notices');
            }}
          />
          <TabButton
            active={activeTab === 'messages'}
            badge={unreadMessages}
            label="Messages"
            onPress={() => {
              setActiveTab('messages');
            }}
          />
        </View>

        {activeTab === 'notices' ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                onRefresh={() => {
                  void refresh();
                }}
                refreshing={refreshing}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {notices.isLoading ? <InlineSpinner label="Loading staff notices" /> : null}
            {notices.error ? <ErrorText>{notices.error.message}</ErrorText> : null}
            {!notices.isLoading && !notices.error ? (
              <StaffNoticesPanel notices={notices.data ?? []} />
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.messagesPane}>
            <Card style={styles.staffroomCard}>
              <View style={styles.staffroomText}>
                <Text style={styles.staffroomTitle}>Staffroom</Text>
                <MutedText>Open the shared staff conversation for daily team updates.</MutedText>
              </View>
              <SmokeButton
                compact
                disabled={openStaffroom.isPending}
                label={openStaffroom.isPending ? 'Opening...' : 'Open'}
                onPress={() => {
                  openStaffroom.mutate();
                }}
                variant="blue"
              />
            </Card>
            {openStaffroom.error ? <ErrorText>{openStaffroom.error.message}</ErrorText> : null}
            {conversations.isLoading || recipients.isLoading || headRecipients.isLoading ? (
              <InlineSpinner label="Loading staff messages" />
            ) : null}
            {conversations.error ? <ErrorText>{conversations.error.message}</ErrorText> : null}
            {supervisorHeadConversations.error ? (
              <ErrorText>{supervisorHeadConversations.error.message}</ErrorText>
            ) : null}
            {recipients.error ? <ErrorText>{recipients.error.message}</ErrorText> : null}
            {headRecipients.error ? <ErrorText>{headRecipients.error.message}</ErrorText> : null}
            {!conversations.isLoading && !conversations.error && !recipients.error ? (
              <ParentMessagesPanel
                conversationKind="StaffDirect"
                conversations={(conversations.data?.items ?? []).filter(isStaffInboxConversation)}
                hasMore={Boolean(conversations.data?.nextCursor)}
                loadingMore={conversations.isFetching}
                onRefresh={refresh}
                recipients={recipients.data ?? []}
                refreshing={refreshing}
              />
            ) : null}
            {canUseSupervisorHead &&
            !supervisorHeadConversations.isLoading &&
            !supervisorHeadConversations.error &&
            headRecipients.data &&
            headRecipients.data.length > 0 ? (
              <Card style={styles.headTeamCard}>
                <Text style={styles.staffroomTitle}>Head team</Text>
                <MutedText>
                  Supervisor-to-Head conversations use the same secure message flow.
                </MutedText>
                <ParentMessagesPanel
                  conversationKind="SupervisorHead"
                  conversations={(supervisorHeadConversations.data?.items ?? []).filter(
                    isSupervisorHeadConversation,
                  )}
                  hasMore={Boolean(supervisorHeadConversations.data?.nextCursor)}
                  loadingMore={supervisorHeadConversations.isFetching}
                  onRefresh={refresh}
                  recipients={headRecipients.data}
                  refreshing={refreshing}
                />
              </Card>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function isStaffInboxConversation(conversation: StaffConversation): boolean {
  return conversation.kind === 'Staffroom' || conversation.kind === 'StaffDirect';
}

function isSupervisorHeadConversation(conversation: StaffConversation): boolean {
  return conversation.kind === 'SupervisorHead';
}

function isStaffConversation(conversation: StaffConversation): boolean {
  return isStaffInboxConversation(conversation) || isSupervisorHeadConversation(conversation);
}

function TabButton({
  active,
  badge,
  label,
  onPress,
}: {
  active: boolean;
  badge: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active ? styles.tabButtonActive : null]}
    >
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>
        {label}
      </Text>
      {badge > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{String(badge)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  backButtonText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    gap: 14,
    padding: 16,
  },
  headTeamCard: {
    gap: 10,
    padding: 14,
  },
  eyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  messagesPane: {
    flex: 1,
    gap: 10,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 28,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  staffroomCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  staffroomText: {
    flex: 1,
    gap: 3,
  },
  staffroomTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  tabBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: C.surface,
    fontSize: 10,
    fontWeight: '900',
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
  },
  tabButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  tabButtonText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: C.surface,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
