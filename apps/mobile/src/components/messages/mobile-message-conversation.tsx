import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { C, radius, typeRamp } from '../core/mobile-theme';
import { useReduceMotion } from '../core/glass';
import { ErrorText, InlineSpinner, MutedText } from '../core/mobile-ui';
import { Avatar, GlassBackButton } from './mobile-message-ui';
import type { ConversationDetail, ConversationMessage } from './mobile-message-types';
import { buildMessageRows, formatThreadTime, type MessageRow } from './mobile-message-utils';

/** Id of the optimistic bubble shown while a message is on its way. */
const PENDING_ID = 'pending-send';

type BubbleMessage = Pick<
  ConversationMessage,
  'body' | 'createdAt' | 'id' | 'readByOtherParticipant' | 'senderId'
> & { sender: { fullName: string } };

interface ConversationViewProps {
  accent: string;
  contactName: string;
  /** A contact picked from the list who has no conversation yet. */
  draft: boolean;
  detail: ConversationDetail | undefined;
  error: string | undefined;
  formError: string | null;
  isGroup: boolean;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSend: () => void;
  /** Body of the message being sent, shown at once as a bubble while the server confirms it. */
  pendingBody: string | null;
  refreshing: boolean;
  replyBody: string;
  sendError: string | undefined;
  sending: boolean;
  setReplyBody: (value: string) => void;
  subtitle: string;
  unreadTotal: number;
}

export function ConversationView({
  accent,
  contactName,
  detail,
  draft,
  error,
  formError,
  isGroup,
  loading,
  onBack,
  onRefresh,
  onSend,
  pendingBody,
  refreshing,
  replyBody,
  sendError,
  sending,
  setReplyBody,
  subtitle,
  unreadTotal,
}: ConversationViewProps) {
  const scroller = useRef<ScrollView>(null);
  const scrolledOnce = useRef(false);
  // A draft has no conversation yet, so it has no user id to compare senders against.
  const currentUserId = detail?.currentUserId ?? 'me';
  const rows = useMemo(() => {
    const messages: BubbleMessage[] = [...(detail?.messages ?? [])];
    if (pendingBody !== null) {
      messages.push({
        body: pendingBody,
        createdAt: new Date(),
        id: PENDING_ID,
        readByOtherParticipant: false,
        sender: { fullName: '' },
        senderId: currentUserId,
      });
    }
    return buildMessageRows(messages, currentUserId);
  }, [detail?.messages, currentUserId, pendingBody]);
  const backLabel =
    unreadTotal > 0 ? `Back to messages, ${String(unreadTotal)} unread` : 'Back to messages';
  const showEmpty =
    pendingBody === null && (draft || Boolean(detail && detail.messages.length === 0));

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarSide}>
          <GlassBackButton
            accent={accent}
            label={backLabel}
            onPress={onBack}
            unread={unreadTotal}
          />
        </View>
        <View style={styles.titleGroup}>
          <Avatar group={isGroup} name={contactName} size={38} />
          <Text accessibilityRole="header" numberOfLines={1} style={styles.contactName}>
            {contactName}
          </Text>
          <Text numberOfLines={1} style={styles.contactSubtitle}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, showEmpty ? styles.listEmpty : null]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          // Jump to the newest message on open, then glide as new bubbles arrive.
          scroller.current?.scrollToEnd({ animated: scrolledOnce.current });
          scrolledOnce.current = true;
        }}
        ref={scroller}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        {loading ? <InlineSpinner label="Loading messages" /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {!loading && !error && !draft && !detail ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Message unavailable</Text>
            <MutedText>Select a message from your inbox.</MutedText>
          </View>
        ) : null}
        {showEmpty ? (
          <View style={styles.empty}>
            <Avatar group={isGroup} name={contactName} size={72} />
            <Text style={styles.emptyTitle}>{contactName}</Text>
            <MutedText>
              {draft ? 'Send a message to start the conversation.' : 'No messages yet.'}
            </MutedText>
          </View>
        ) : null}
        {rows.map((row) => (
          <RowView accent={accent} isGroup={isGroup} key={row.key} row={row} />
        ))}
      </ScrollView>

      <Composer
        accent={accent}
        formError={formError}
        onSend={onSend}
        replyBody={replyBody}
        sendError={sendError}
        sending={sending}
        setReplyBody={setReplyBody}
      />
    </View>
  );
}

function RowView({
  accent,
  isGroup,
  row,
}: {
  accent: string;
  isGroup: boolean;
  row: MessageRow<BubbleMessage>;
}) {
  if (row.type === 'separator') {
    return <Text style={styles.separator}>{row.label}</Text>;
  }

  const { message, mine, position, showSender, showStatus } = row;
  const tail = position === 'single' || position === 'last';
  const startsGroup = position === 'single' || position === 'first';
  const pending = message.id === PENDING_ID;

  return (
    <SendRise
      enabled={pending}
      style={[
        styles.messageRow,
        mine ? styles.rowMine : styles.rowTheirs,
        startsGroup ? styles.rowGroupStart : null,
      ]}
    >
      {isGroup && showSender ? (
        <Text numberOfLines={1} style={styles.sender}>
          {message.sender.fullName}
        </Text>
      ) : null}
      <View
        style={[
          styles.bubble,
          mine ? { backgroundColor: accent } : styles.bubbleTheirs,
          tail ? (mine ? styles.tailMine : styles.tailTheirs) : null,
        ]}
      >
        <Text selectable style={[styles.messageText, mine ? styles.messageTextMine : null]}>
          {message.body}
        </Text>
      </View>
      {mine && showStatus ? (
        <Text style={styles.status}>
          {pending
            ? 'Sending…'
            : `${message.readByOtherParticipant ? 'Read' : 'Sent'} ${formatThreadTime(message.createdAt)}`}
        </Text>
      ) : null}
    </SendRise>
  );
}

/**
 * The just-sent bubble rises out of the composer and settles with a soft spring, as in Messages.
 * When the server confirms the message the real bubble takes its place without moving.
 */
function SendRise({
  children,
  enabled,
  style,
}: {
  children: ReactNode;
  enabled: boolean;
  style: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const rise = useRef(new Animated.Value(enabled && !reduceMotion ? 0 : 1)).current;

  useEffect(() => {
    if (!enabled || reduceMotion) return;
    Animated.spring(rise, {
      damping: 18,
      mass: 0.8,
      stiffness: 260,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [enabled, reduceMotion, rise]);

  if (!enabled) return <View style={style}>{children}</View>;

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: rise.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
            { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
          ],
          transformOrigin: 'bottom right',
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Composer({
  accent,
  formError,
  onSend,
  replyBody,
  sendError,
  sending,
  setReplyBody,
}: {
  accent: string;
  formError: string | null;
  onSend: () => void;
  replyBody: string;
  sendError: string | undefined;
  sending: boolean;
  setReplyBody: (value: string) => void;
}) {
  const canSend = replyBody.trim().length > 0 && !sending;

  return (
    <View style={styles.composer}>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {sendError ? <ErrorText>{sendError}</ErrorText> : null}
      <View style={styles.composerRow}>
        <TextInput
          accessibilityLabel="Message reply"
          maxLength={4000}
          multiline
          onChangeText={setReplyBody}
          placeholder="Message"
          placeholderTextColor={C.textMuted}
          selectionColor={accent}
          style={styles.input}
          value={replyBody}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          accessibilityState={{ busy: sending, disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: accent },
            canSend ? null : styles.sendDisabled,
            pressed ? styles.sendPressed : null,
          ]}
        >
          <Feather color={C.surface} name="arrow-up" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderCurve: 'continuous',
    borderRadius: 20,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleTheirs: {
    backgroundColor: C.bubble,
  },
  composer: {
    backgroundColor: C.bg,
    borderTopColor: C.hairline,
    borderTopWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  contactName: {
    ...typeRamp.footnote,
    color: C.navy,
    fontWeight: '600',
    marginTop: 4,
  },
  contactSubtitle: {
    ...typeRamp.caption,
    color: C.textSecondary,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...typeRamp.title3,
    color: C.navy,
    marginTop: 4,
    textAlign: 'center',
  },
  input: {
    ...typeRamp.body,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    borderWidth: 1,
    color: C.textPrimary,
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  list: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  messageRow: {
    gap: 3,
    marginTop: 2,
  },
  messageText: {
    ...typeRamp.body,
    color: C.navy,
  },
  messageTextMine: {
    color: C.surface,
  },
  rowGroupStart: {
    marginTop: 10,
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignItems: 'flex-start',
  },
  screen: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  send: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendDisabled: {
    opacity: 0.35,
  },
  sendPressed: {
    opacity: 0.75,
  },
  sender: {
    ...typeRamp.caption,
    color: C.textSecondary,
    fontWeight: '600',
    paddingHorizontal: 14,
  },
  separator: {
    ...typeRamp.caption,
    color: C.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 14,
    textAlign: 'center',
  },
  status: {
    ...typeRamp.caption,
    color: C.textSecondary,
    paddingHorizontal: 4,
  },
  tailMine: {
    borderBottomRightRadius: 6,
  },
  tailTheirs: {
    borderBottomLeftRadius: 6,
  },
  titleGroup: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  topBarSide: {
    width: 56,
  },
});
