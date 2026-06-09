import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C } from './mobile-theme';
import type { ThreadDetail, ThreadSummary } from './parent-message-types';
import { formatDateTime, formatThreadTime, unreadLabel } from './parent-message-utils';
import { ErrorText, InlineSpinner, MutedText } from './smoke-ui';

interface ConversationViewProps {
  detail: ThreadDetail | undefined;
  error: string | undefined;
  formError: string | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSend: () => void;
  refreshing: boolean;
  replyBody: string;
  selectedSummary: ThreadSummary | null;
  sendError: string | undefined;
  sending: boolean;
  setReplyBody: (value: string) => void;
  unreadTotal: number;
}

export function ConversationView({
  detail,
  error,
  formError,
  loading,
  onBack,
  onRefresh,
  onSend,
  refreshing,
  replyBody,
  selectedSummary,
  sendError,
  sending,
  setReplyBody,
  unreadTotal,
}: ConversationViewProps) {
  const title = detail?.admin?.fullName ?? selectedSummary?.admin?.fullName ?? 'Centre team';
  const subject = detail?.subject ?? selectedSummary?.subject ?? 'Message thread';
  const currentUserId = detail?.currentUserId ?? null;
  const unreadBackLabel =
    unreadTotal > 0
      ? `Back to message threads, ${String(unreadTotal)} unread`
      : 'Back to message threads';

  return (
    <View style={styles.conversationScreen}>
      <View style={styles.conversationHeader}>
        <Pressable
          accessibilityLabel={unreadBackLabel}
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <View style={styles.backChevronFrame}>
            <View style={styles.backChevron} />
          </View>
          {unreadTotal > 0 ? (
            <View style={styles.backUnreadBadge}>
              <Text style={styles.backUnreadText}>{unreadLabel(unreadTotal)}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.conversationTitleGroup}>
          <Text numberOfLines={1} style={styles.conversationName}>
            {title}
          </Text>
          <Text numberOfLines={2} style={styles.conversationSubject}>
            {subject}
          </Text>
        </View>
      </View>

      {loading ? <InlineSpinner label="Loading thread" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!loading && !error && !detail ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Thread unavailable</Text>
          <MutedText>Select a thread from your inbox.</MutedText>
        </View>
      ) : null}

      {detail ? (
        <>
          <ScrollView
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
            showsVerticalScrollIndicator={false}
            style={styles.messageScroller}
          >
            {detail.messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No replies yet</Text>
                <MutedText>Messages in this thread will appear here.</MutedText>
              </View>
            ) : (
              detail.messages.map((message) => (
                <MessageBubble currentUserId={currentUserId} key={message.id} message={message} />
              ))
            )}
          </ScrollView>
          <ReplyComposer
            disabled={sending}
            onSend={onSend}
            replyBody={replyBody}
            sendError={sendError}
            setReplyBody={setReplyBody}
          />
        </>
      ) : null}

      {formError ? <ErrorText>{formError}</ErrorText> : null}
    </View>
  );
}

function MessageBubble({
  currentUserId,
  message,
}: {
  currentUserId: string | null;
  message: ThreadDetail['messages'][number];
}) {
  const mine = currentUserId === message.senderId;
  const metaLabel = messageMetaLabel(message, mine);

  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
      <View
        style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}
      >
        {!mine ? (
          <Text numberOfLines={1} style={styles.messageSender}>
            {message.sender.fullName}
          </Text>
        ) : null}
        <Text style={[styles.messageText, mine ? styles.messageTextMine : null]}>
          {message.body}
        </Text>
      </View>
      <Text style={[styles.messageMeta, mine ? styles.messageMetaMine : null]}>{metaLabel}</Text>
    </View>
  );
}

function messageMetaLabel(message: ThreadDetail['messages'][number], mine: boolean): string {
  if (!mine) return formatDateTime(message.createdAt);

  const status = message.readByOtherParticipant ? 'Read' : 'Sent';
  return `${status} ${formatThreadTime(message.createdAt)}`;
}

function ReplyComposer({
  disabled,
  onSend,
  replyBody,
  sendError,
  setReplyBody,
}: {
  disabled: boolean;
  onSend: () => void;
  replyBody: string;
  sendError: string | undefined;
  setReplyBody: (value: string) => void;
}) {
  const canSend = replyBody.trim().length > 0 && !disabled;

  return (
    <View style={styles.replyWrap}>
      <View style={styles.replyComposer}>
        <TextInput
          accessibilityLabel="Message reply"
          multiline
          onChangeText={setReplyBody}
          placeholder="Message"
          placeholderTextColor={C.textMuted}
          style={styles.replyInput}
          value={replyBody}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!canSend}
          onPress={onSend}
          style={[styles.sendButton, canSend ? null : styles.sendButtonDisabled]}
        >
          <Text style={styles.sendButtonText}>{disabled ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
      {sendError ? <ErrorText>{sendError}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    minWidth: 40,
  },
  backChevron: {
    borderBottomColor: C.surface,
    borderBottomWidth: 4,
    borderLeftColor: C.surface,
    borderLeftWidth: 4,
    height: 15,
    marginLeft: 5,
    transform: [{ rotate: '45deg' }],
    width: 15,
  },
  backChevronFrame: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  backUnreadBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 24,
    minWidth: 24,
    paddingHorizontal: 7,
  },
  backUnreadText: {
    color: C.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  conversationHeader: {
    alignItems: 'stretch',
    backgroundColor: C.bg,
    borderBottomColor: C.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingBottom: 12,
    paddingTop: 2,
  },
  conversationName: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '800',
  },
  conversationScreen: {
    flex: 1,
    gap: 12,
  },
  conversationSubject: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 2,
  },
  conversationTitleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
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
  messageBubble: {
    borderRadius: 18,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    backgroundColor: C.crimson,
    borderBottomRightRadius: 6,
  },
  messageBubbleTheirs: {
    backgroundColor: C.surface,
    borderBottomLeftRadius: 6,
    borderColor: C.border,
    borderWidth: 1,
  },
  messageList: {
    gap: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  messageMeta: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  messageMetaMine: {
    textAlign: 'right',
  },
  messageRow: {
    gap: 2,
  },
  messageRowMine: {
    alignItems: 'flex-end',
  },
  messageRowTheirs: {
    alignItems: 'flex-start',
  },
  messageScroller: {
    flex: 1,
  },
  messageSender: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    color: C.textPrimary,
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextMine: {
    color: C.surface,
  },
  replyComposer: {
    alignItems: 'flex-end',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
  },
  replyInput: {
    color: C.textPrimary,
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  replyWrap: {
    gap: 8,
    paddingTop: 4,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 15,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: C.surface,
    fontSize: 12,
    fontWeight: '800',
  },
});
