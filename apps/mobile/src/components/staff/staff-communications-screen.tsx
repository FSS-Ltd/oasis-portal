import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { canRespondToParentMessages } from '@oasis/domain/rbac';
import { api, type RouterOutputs } from '../../lib/trpc';
import { MobileMessagesPanel } from '../messages/mobile-messages-panel';
import type { RecipientGroup } from '../messages/mobile-message-types';
import { C, elevation, radius, typeRamp } from '../core/mobile-theme';
import { ErrorText, InlineSpinner } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { StaffNoticesPanel, type StaffNotice } from './staff-notices-panel';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffConversation = RouterOutputs['message']['listConversations']['items'][number];
type StaffCommunicationsTab = 'notices' | 'messages';

const staffInboxConversationKinds = ['Staffroom', 'StaffDirect'] as const;
const supervisorHeadConversationKinds = ['SupervisorHead'] as const;
const parentConversationKinds = ['ParentStaff'] as const;
const messagePageSize = 20;
const nextPage = (page: { nextCursor?: string | null }) => page.nextCursor ?? undefined;

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
  const [activeTab, setActiveTab] = useState<StaffCommunicationsTab>('notices');
  // A conversation takes the whole screen, like Messages: no header, back row or tabs above it.
  const [threadOpen, setThreadOpen] = useState(false);
  const canUseSupervisorHead = user?.role === 'Supervisor';
  const canMessageParents = user ? canRespondToParentMessages(user) : false;
  const notices = api.notice.listForStaff.useQuery(undefined, { retry: false });
  // Paged like the parent inbox, so older conversations stay reachable with Load more.
  const conversations = api.message.listConversations.useInfiniteQuery(
    { kinds: [...staffInboxConversationKinds], limit: messagePageSize },
    { getNextPageParam: nextPage, retry: false },
  );
  const supervisorHeadConversations = api.message.listConversations.useInfiniteQuery(
    { kinds: [...supervisorHeadConversationKinds], limit: messagePageSize },
    { enabled: canUseSupervisorHead, getNextPageParam: nextPage, retry: false },
  );
  const parentConversations = api.message.listConversations.useInfiniteQuery(
    { kinds: [...parentConversationKinds], limit: messagePageSize },
    { enabled: canMessageParents, getNextPageParam: nextPage, retry: false },
  );
  const conversationItems = useMemo(
    () => conversations.data?.pages.flatMap((page) => page.items) ?? [],
    [conversations.data],
  );
  const supervisorHeadItems = useMemo(
    () => supervisorHeadConversations.data?.pages.flatMap((page) => page.items) ?? [],
    [supervisorHeadConversations.data],
  );
  const parentItems = useMemo(
    () => parentConversations.data?.pages.flatMap((page) => page.items) ?? [],
    [parentConversations.data],
  );
  const pagedSources = [conversations, supervisorHeadConversations, parentConversations];
  const hasMoreMessages = pagedSources.some((source) => source.hasNextPage);
  const loadingMoreMessages = pagedSources.some((source) => source.isFetchingNextPage);
  const recipients = api.message.listRecipients.useQuery({ kind: 'StaffDirect' }, { retry: false });
  const headRecipients = api.message.listRecipients.useQuery(
    { kind: 'SupervisorHead' },
    { enabled: canUseSupervisorHead, retry: false },
  );
  const parentRecipients = api.message.listRecipients.useQuery(
    { kind: 'ParentStaff', direction: 'toParent' },
    { enabled: canMessageParents, retry: false },
  );
  const unreadNotices = useMemo(() => unreadCount(notices.data ?? []), [notices.data]);
  const unreadMessages = useMemo(
    () =>
      [...conversationItems, ...supervisorHeadItems, ...parentItems]
        .filter(isStaffConversation)
        .reduce((count, conversation) => count + conversation.unreadCount, 0),
    [conversationItems, supervisorHeadItems, parentItems],
  );
  const allConversations = useMemo(
    () =>
      [
        ...conversationItems.filter(isStaffInboxConversation),
        ...supervisorHeadItems.filter(isSupervisorHeadConversation),
        ...parentItems.filter(isParentStaffConversation),
      ].sort((a, b) => latestAt(b) - latestAt(a)),
    [conversationItems, supervisorHeadItems, parentItems],
  );
  const recipientGroups = useMemo<RecipientGroup[]>(
    () => [
      { kind: 'StaffDirect', label: 'Staff', recipients: recipients.data ?? [] },
      ...(canUseSupervisorHead && headRecipients.data && headRecipients.data.length > 0
        ? [{ kind: 'SupervisorHead' as const, label: 'Head team', recipients: headRecipients.data }]
        : []),
      ...(canMessageParents
        ? [
            {
              kind: 'ParentStaff' as const,
              label: 'Parents',
              recipients: parentRecipients.data ?? [],
            },
          ]
        : []),
    ],
    [
      canMessageParents,
      canUseSupervisorHead,
      headRecipients.data,
      parentRecipients.data,
      recipients.data,
    ],
  );
  const refreshing =
    notices.isFetching ||
    conversations.isFetching ||
    supervisorHeadConversations.isFetching ||
    parentConversations.isFetching ||
    recipients.isFetching ||
    headRecipients.isFetching ||
    parentRecipients.isFetching;

  async function refresh() {
    await Promise.all([
      notices.refetch(),
      conversations.refetch(),
      canUseSupervisorHead ? supervisorHeadConversations.refetch() : Promise.resolve(),
      canMessageParents ? parentConversations.refetch() : Promise.resolve(),
      recipients.refetch(),
      canUseSupervisorHead ? headRecipients.refetch() : Promise.resolve(),
      canMessageParents ? parentRecipients.refetch() : Promise.resolve(),
    ]);
  }

  const messagesReady =
    !conversations.isLoading && !conversations.error && !recipients.isLoading && !recipients.error;

  return (
    <SafeAreaView style={styles.shell}>
      {threadOpen ? null : (
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
      )}
      <View style={styles.content}>
        {threadOpen ? null : (
          <View style={styles.chrome}>
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
          </View>
        )}

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
            <View style={styles.messagesStatus}>
              {conversations.isLoading ||
              recipients.isLoading ||
              (canMessageParents &&
                (parentConversations.isLoading || parentRecipients.isLoading)) ? (
                <InlineSpinner label="Loading staff messages" />
              ) : null}
              {conversations.error ? <ErrorText>{conversations.error.message}</ErrorText> : null}
              {supervisorHeadConversations.error ? (
                <ErrorText>{supervisorHeadConversations.error.message}</ErrorText>
              ) : null}
              {parentConversations.error ? (
                <ErrorText>{parentConversations.error.message}</ErrorText>
              ) : null}
              {recipients.error ? <ErrorText>{recipients.error.message}</ErrorText> : null}
              {headRecipients.error ? <ErrorText>{headRecipients.error.message}</ErrorText> : null}
              {parentRecipients.error ? (
                <ErrorText>{parentRecipients.error.message}</ErrorText>
              ) : null}
            </View>
            {messagesReady ? (
              <MobileMessagesPanel
                accent={C.navy}
                conversationKind="StaffDirect"
                conversations={allConversations}
                hasMore={hasMoreMessages}
                loadingMore={loadingMoreMessages}
                navClearance={false}
                onLoadMore={() => {
                  for (const source of pagedSources) {
                    if (source.hasNextPage && !source.isFetchingNextPage) {
                      void source.fetchNextPage();
                    }
                  }
                }}
                onRefresh={refresh}
                onThreadOpenChange={setThreadOpen}
                recipientGroups={recipientGroups}
                recipients={recipients.data ?? []}
                refreshing={refreshing}
                showStaffroom
              />
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function latestAt(conversation: StaffConversation): number {
  return new Date(conversation.latestMessage?.createdAt ?? conversation.updatedAt).getTime();
}

function isStaffInboxConversation(conversation: StaffConversation): boolean {
  return conversation.kind === 'Staffroom' || conversation.kind === 'StaffDirect';
}

function isSupervisorHeadConversation(conversation: StaffConversation): boolean {
  return conversation.kind === 'SupervisorHead';
}

function isParentStaffConversation(conversation: StaffConversation): boolean {
  return conversation.kind === 'ParentStaff';
}

function isStaffConversation(conversation: StaffConversation): boolean {
  return (
    isStaffInboxConversation(conversation) ||
    isSupervisorHeadConversation(conversation) ||
    isParentStaffConversation(conversation)
  );
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
    backgroundColor: C.surface,
    borderColor: C.hairline,
    borderCurve: 'continuous',
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  backButtonText: {
    ...typeRamp.subhead,
    color: C.link,
    fontWeight: '600',
  },
  chrome: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  content: {
    flex: 1,
    gap: 14,
  },
  eyebrow: {
    ...typeRamp.caption,
    color: C.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  messagesPane: {
    flex: 1,
    gap: 8,
  },
  messagesStatus: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
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
    fontWeight: '700',
  },
  tabButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.sm - 2,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 36,
  },
  tabButtonActive: {
    backgroundColor: C.surface,
    boxShadow: elevation.card,
  },
  tabButtonText: {
    ...typeRamp.footnote,
    color: C.textSecondary,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: C.navy,
  },
  tabRow: {
    backgroundColor: C.fill,
    borderCurve: 'continuous',
    borderRadius: radius.sm,
    flexDirection: 'row',
    padding: 2,
  },
  title: {
    ...typeRamp.title3,
    color: C.navy,
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
