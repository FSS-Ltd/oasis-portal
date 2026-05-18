import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './mobile-theme';
import type { ThreadSummary } from './parent-message-types';
import { formatThreadTime, latestSenderLabel, unreadLabel } from './parent-message-utils';
import { MutedText } from './smoke-ui';

interface InboxViewProps {
  onCompose: () => void;
  onOpenThread: (threadId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  threads: ThreadSummary[];
  unreadTotal: number;
}

export function InboxView({
  onCompose,
  onOpenThread,
  onRefresh,
  refreshing,
  threads,
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
          accessibilityLabel="Start a new message thread"
          accessibilityRole="button"
          onPress={onCompose}
          style={styles.composeButton}
        >
          <Text style={styles.composeButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.inboxMetaRow}>
        <Text style={styles.inboxMetaText}>
          {threads.length === 1 ? '1 thread' : `${String(threads.length)} threads`}
        </Text>
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
        {threads.length === 0 ? (
          <EmptyInbox onCompose={onCompose} />
        ) : (
          threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              onPress={() => {
                onOpenThread(thread.id);
              }}
              thread={thread}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function EmptyInbox({ onCompose }: { onCompose: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <MutedText>Start a message thread with the centre team.</MutedText>
      <Pressable accessibilityRole="button" onPress={onCompose} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>New Message</Text>
      </Pressable>
    </View>
  );
}

function ThreadRow({ onPress, thread }: { onPress: () => void; thread: ThreadSummary }) {
  const latestTime = thread.latestMessage?.createdAt ?? thread.updatedAt;
  const unread = thread.unreadCount > 0;
  const adminName = thread.admin?.fullName ?? 'Centre team';

  return (
    <Pressable
      accessibilityLabel={`${thread.subject}, ${adminName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.threadRow, unread ? styles.threadRowUnread : null]}
    >
      <View style={styles.threadAvatar}>
        <Text style={styles.threadAvatarText}>{adminName.slice(0, 1)}</Text>
      </View>
      <View style={styles.threadBody}>
        <View style={styles.threadTopLine}>
          <Text numberOfLines={1} style={styles.threadName}>
            {adminName}
          </Text>
          <Text style={styles.threadTime}>{formatThreadTime(latestTime)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.threadSubject}>
          {thread.subject}
        </Text>
        <Text numberOfLines={1} style={styles.threadLatest}>
          {latestSenderLabel(thread)} -{' '}
          {thread.messageCount === 1 ? '1 message' : `${String(thread.messageCount)} messages`}
        </Text>
      </View>
      {unread ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{unreadLabel(thread.unreadCount)}</Text>
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
