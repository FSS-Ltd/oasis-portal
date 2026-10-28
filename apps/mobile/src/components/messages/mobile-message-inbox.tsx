import Feather from '@expo/vector-icons/Feather';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PortalScrollView } from '../core/portal-scroll-view';
import { C, elevation, radius, typeRamp } from '../core/mobile-theme';
import { MutedText } from '../core/mobile-ui';
import { Avatar } from './mobile-message-ui';
import type { ConversationSummary } from './mobile-message-types';
import { formatThreadTime, latestSenderLabel } from './mobile-message-utils';

export interface PinnedConversation {
  title: string;
  detail: string;
  pending: boolean;
  onPress: () => void;
}

interface InboxViewProps {
  accent: string;
  conversations: ConversationSummary[];
  emptyDetail: string;
  hasMore: boolean;
  loadingMore: boolean;
  /** Leave room for the floating tab bar when the portal shows one. */
  navClearance: boolean;
  onCompose: () => void;
  onLoadMore: () => void;
  onOpenConversation: (conversationId: string) => void;
  onRefresh: () => void;
  pinned: PinnedConversation | null;
  refreshing: boolean;
  unreadTotal: number;
}

export function conversationContact(conversation: ConversationSummary): string {
  if (conversation.kind === 'Staffroom') return 'Staffroom';

  return (
    conversation.participants.find((participant) => participant.id !== conversation.currentUserId)
      ?.fullName ??
    conversation.admin?.fullName ??
    'Centre team'
  );
}

export function InboxView({
  accent,
  conversations,
  emptyDetail,
  hasMore,
  loadingMore,
  navClearance,
  onCompose,
  onLoadMore,
  onOpenConversation,
  onRefresh,
  pinned,
  refreshing,
  unreadTotal,
}: InboxViewProps) {
  const Scroller = navClearance ? PortalScrollView : ScrollView;
  const rowCount = conversations.length + (pinned ? 1 : 0);

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={styles.largeTitle}>
            Messages
          </Text>
          {unreadTotal > 0 ? (
            <Text style={[styles.unreadSummary, { color: accent }]}>
              {String(unreadTotal)} unread
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="Start a new message"
          accessibilityRole="button"
          hitSlop={6}
          onPress={onCompose}
          style={({ pressed }) => [
            styles.composeButton,
            { backgroundColor: accent },
            pressed ? styles.pressed : null,
          ]}
        >
          <Feather color={C.surface} name="edit" size={19} />
        </Pressable>
      </View>

      <Scroller
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
        showsVerticalScrollIndicator={false}
      >
        {rowCount === 0 ? (
          <EmptyInbox accent={accent} detail={emptyDetail} onCompose={onCompose} />
        ) : (
          <View style={styles.group}>
            {pinned ? (
              <PinnedRow accent={accent} last={conversations.length === 0} pinned={pinned} />
            ) : null}
            {conversations.map((conversation, index) => (
              <ConversationRow
                accent={accent}
                conversation={conversation}
                key={conversation.id}
                last={index === conversations.length - 1}
                onPress={() => {
                  onOpenConversation(conversation.id);
                }}
              />
            ))}
          </View>
        )}
        {hasMore ? (
          <Pressable
            accessibilityRole="button"
            disabled={loadingMore}
            onPress={onLoadMore}
            style={styles.loadMore}
          >
            <Text style={[styles.loadMoreText, { color: accent }]}>
              {loadingMore ? 'Loading' : 'Load more'}
            </Text>
          </Pressable>
        ) : null}
      </Scroller>
    </View>
  );
}

function EmptyInbox({
  accent,
  detail,
  onCompose,
}: {
  accent: string;
  detail: string;
  onCompose: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: C.fill }]}>
        <Feather color={accent} name="message-circle" size={30} />
      </View>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <MutedText>{detail}</MutedText>
      <Pressable
        accessibilityRole="button"
        onPress={onCompose}
        style={[styles.emptyButton, { backgroundColor: accent }]}
      >
        <Text style={styles.emptyButtonText}>New Message</Text>
      </Pressable>
    </View>
  );
}

function PinnedRow({
  accent,
  last,
  pinned,
}: {
  accent: string;
  last: boolean;
  pinned: PinnedConversation;
}) {
  return (
    <>
      <Pressable
        accessibilityLabel={`Open ${pinned.title}`}
        accessibilityRole="button"
        accessibilityState={{ busy: pinned.pending }}
        disabled={pinned.pending}
        onPress={pinned.onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.gutter} />
        <Avatar group name={pinned.title} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <Text numberOfLines={1} style={styles.name}>
              {pinned.title}
            </Text>
            <Feather color={accent} name="chevron-right" size={18} />
          </View>
          <Text numberOfLines={2} style={styles.preview}>
            {pinned.pending ? 'Opening…' : pinned.detail}
          </Text>
        </View>
      </Pressable>
      {last ? null : <View style={styles.separator} />}
    </>
  );
}

function ConversationRow({
  accent,
  conversation,
  last,
  onPress,
}: {
  accent: string;
  conversation: ConversationSummary;
  last: boolean;
  onPress: () => void;
}) {
  const latestTime = conversation.latestMessage?.createdAt ?? conversation.updatedAt;
  const unread = conversation.unreadCount > 0;
  const contact = conversationContact(conversation);
  const group = conversation.kind === 'Staffroom';

  return (
    <>
      <Pressable
        accessibilityLabel={`Message with ${contact}${
          unread ? `, ${String(conversation.unreadCount)} unread` : ''
        }`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.gutter}>
          {unread ? <View style={[styles.unreadDot, { backgroundColor: accent }]} /> : null}
        </View>
        <Avatar group={group} name={contact} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <Text numberOfLines={1} style={[styles.name, unread ? styles.nameUnread : null]}>
              {contact}
            </Text>
            <Text style={[styles.time, unread ? { color: accent } : null]}>
              {formatThreadTime(latestTime)}
            </Text>
          </View>
          <Text numberOfLines={2} style={[styles.preview, unread ? styles.previewUnread : null]}>
            {group ? 'Staff group chat · ' : ''}
            {latestSenderLabel(conversation)}
          </Text>
        </View>
      </Pressable>
      {last ? null : <View style={styles.separator} />}
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  composeButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  emptyButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.md,
    marginTop: 6,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  emptyButtonText: {
    ...typeRamp.headline,
    color: C.surface,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyTitle: {
    ...typeRamp.title3,
    color: C.navy,
  },
  group: {
    backgroundColor: C.surface,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    boxShadow: elevation.card,
    overflow: 'hidden',
  },
  gutter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
  },
  largeTitle: {
    ...typeRamp.largeTitle,
    color: C.navy,
  },
  list: {
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  loadMore: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  loadMoreText: {
    ...typeRamp.headline,
  },
  name: {
    ...typeRamp.headline,
    color: C.navy,
    flex: 1,
    fontWeight: '500',
  },
  nameUnread: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  preview: {
    ...typeRamp.subhead,
    color: C.textSecondary,
  },
  previewUnread: {
    color: C.navy,
    fontWeight: '500',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: C.fill,
  },
  screen: {
    flex: 1,
    gap: 8,
  },
  separator: {
    backgroundColor: C.hairline,
    height: 1,
    marginLeft: 78,
  },
  time: {
    ...typeRamp.footnote,
    color: C.textSecondary,
  },
  titleGroup: {
    flex: 1,
    gap: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  topLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unreadDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  unreadSummary: {
    ...typeRamp.footnote,
    fontWeight: '600',
  },
});
