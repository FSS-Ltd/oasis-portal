import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { MutedText } from '../smoke/smoke-ui';
import type { ConversationSummary } from './mobile-message-types';
import { formatThreadTime, latestSenderLabel, unreadLabel } from './mobile-message-utils';

interface InboxViewProps {
  emptyDetail: string;
  hasMore: boolean;
  loadingMore: boolean;
  onCompose: () => void;
  onLoadMore: () => void;
  onOpenConversation: (conversationId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  conversations: ConversationSummary[];
  unreadTotal: number;
}

function conversationCountLabel(count: number): string {
  return count === 1 ? '1 message' : `${String(count)} messages`;
}

export function InboxView({
  conversations,
  emptyDetail,
  hasMore,
  loadingMore,
  onCompose,
  onLoadMore,
  onOpenConversation,
  onRefresh,
  refreshing,
  unreadTotal,
}: InboxViewProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.inboxHeader}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerEyebrow}>Centre communications</Text>
          <Text style={styles.largeTitle}>Messages</Text>
        </View>
        <Pressable
          accessibilityLabel="Start a new message"
          accessibilityRole="button"
          onPress={onCompose}
          style={styles.composeButton}
        >
          <Text style={styles.composeButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.inboxMetaRow}>
        <Text style={styles.inboxMetaText}>{conversationCountLabel(conversations.length)}</Text>
        {unreadTotal > 0 ? (
          <View style={styles.unreadSummary}>
            <Text style={styles.unreadSummaryText}>{String(unreadTotal)} unread</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.threadList}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
        showsVerticalScrollIndicator={false}
      >
        {conversations.length === 0 ? (
          <EmptyInbox detail={emptyDetail} onCompose={onCompose} />
        ) : (
          conversations.map((conversation) => (
            <ConversationRow
              conversation={conversation}
              key={conversation.id}
              onPress={() => {
                onOpenConversation(conversation.id);
              }}
            />
          ))
        )}
        {hasMore ? (
          <Pressable
            accessibilityRole="button"
            disabled={loadingMore}
            onPress={onLoadMore}
            style={[styles.primaryButton, styles.loadMoreButton]}
          >
            <Text style={styles.primaryButtonText}>{loadingMore ? 'Loading' : 'Load more'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function EmptyInbox({ detail, onCompose }: { detail: string; onCompose: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <MutedText>{detail}</MutedText>
      <Pressable accessibilityRole="button" onPress={onCompose} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>New Message</Text>
      </Pressable>
    </View>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: ConversationSummary;
  onPress: () => void;
}) {
  const latestTime = conversation.latestMessage?.createdAt ?? conversation.updatedAt;
  const unread = conversation.unreadCount > 0;
  const contact =
    conversation.kind === 'Staffroom'
      ? 'Staffroom'
      : (conversation.participants.find(
          (participant) => participant.id !== conversation.currentUserId,
        )?.fullName ??
        conversation.admin?.fullName ??
        'Centre team');

  return (
    <Pressable
      accessibilityLabel={`Message with ${contact}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.threadRow, unread ? styles.threadRowUnread : null]}
    >
      <View style={styles.threadAvatar}>
        <Text style={styles.threadAvatarText}>{contact.slice(0, 1)}</Text>
      </View>
      <View style={styles.threadBody}>
        <View style={styles.threadTopLine}>
          <Text numberOfLines={1} style={styles.threadName}>
            {contact}
          </Text>
          <Text style={styles.threadTime}>{formatThreadTime(latestTime)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.threadSubject}>
          {conversation.kind === 'Staffroom' ? 'Staff group chat' : 'Private message'}
        </Text>
        <Text numberOfLines={1} style={styles.threadLatest}>
          {latestSenderLabel(conversation)} -{' '}
          {conversation.messageCount === 1
            ? '1 message'
            : `${String(conversation.messageCount)} messages`}
        </Text>
      </View>
      {unread ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{unreadLabel(conversation.unreadCount)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  composeButton: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  composeButtonText: {
    color: C.surface,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 26,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 16,
    padding: 24,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerEyebrow: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerTitleGroup: {
    flex: 1,
    gap: 2,
  },
  inboxHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  inboxMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  inboxMetaText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  largeTitle: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '800',
  },
  loadMoreButton: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: C.crimson,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '800',
  },
  screen: {
    flex: 1,
    gap: 12,
  },
  threadAvatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  threadAvatarText: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '800',
  },
  threadBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  threadLatest: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  threadList: {
    gap: 10,
    paddingBottom: 20,
  },
  threadName: {
    color: C.navy,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  threadRow: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  threadRowUnread: {
    borderLeftColor: C.crimson,
    borderLeftWidth: 3,
  },
  threadSubject: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  threadTime: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  threadTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 11,
    justifyContent: 'center',
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: C.surface,
    fontSize: 11,
    fontWeight: '900',
  },
  unreadSummary: {
    backgroundColor: C.crimsonLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  unreadSummaryText: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '800',
  },
});
