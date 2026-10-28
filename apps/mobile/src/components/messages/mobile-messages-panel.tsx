import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { api } from '../../lib/trpc';
import { useReduceMotion } from '../core/glass';
import { C } from '../core/mobile-theme';
import { ErrorText } from '../core/mobile-ui';
import { ConversationView } from './mobile-message-conversation';
import { InboxView, type PinnedConversation } from './mobile-message-inbox';
import { ContactsView } from './mobile-message-new-thread';
import type {
  ConversationKind,
  ConversationSummary,
  Recipient,
  RecipientGroup,
} from './mobile-message-types';
import { findConversationForRecipient } from './mobile-message-utils';

/** The screens pushed over the inbox. The inbox itself stays mounted underneath. */
type MessageScreen = 'contacts' | 'conversation';

// Back-swipe starts within this distance of the left edge, as in iOS navigation.
const EDGE_WIDTH = 28;

interface DraftConversation {
  kind: ConversationKind;
  recipient: Recipient;
}

interface MobileMessagesPanelProps {
  /** Bubble, send button and link colour. Parent is crimson, staff is navy. */
  accent?: string;
  conversationKind?: ConversationKind;
  conversations: ConversationSummary[];
  hasMore?: boolean;
  loadingMore?: boolean;
  /** Leave room for the floating tab bar on the list. Staff screens have none. */
  navClearance?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void> | void;
  /**
   * Called with true while a thread or the contacts page is open, so the host can hide its own
   * header and navigation and give the conversation the whole screen.
   */
  onThreadOpenChange?: (open: boolean) => void;
  recipientGroups?: RecipientGroup[];
  recipients: Recipient[];
  refreshing?: boolean;
  /** Pin the shared Staffroom at the top of the list until it has been opened. */
  showStaffroom?: boolean;
}

export function MobileMessagesPanel({
  accent = C.crimson,
  conversationKind = 'ParentStaff',
  conversations,
  hasMore = false,
  loadingMore = false,
  navClearance = true,
  onLoadMore,
  onRefresh,
  onThreadOpenChange,
  recipientGroups,
  recipients,
  refreshing = false,
  showStaffroom = false,
}: MobileMessagesPanelProps) {
  const utils = api.useUtils();
  const frame = useRef<View>(null);
  const [topOffset, setTopOffset] = useState(0);
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  // 0 shows the inbox, 1 shows the pushed screen. Driven natively so the slide stays smooth.
  const push = useRef(new Animated.Value(0)).current;
  // `screen` stays set while the pushed screen slides away; `open` flips as soon as it starts to.
  const [screen, setScreen] = useState<MessageScreen | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const openedOnce = useRef(false);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [draft, setDraft] = useState<DraftConversation | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const groups = useMemo<RecipientGroup[]>(
    () => recipientGroups ?? [{ kind: conversationKind, label: 'Contacts', recipients }],
    [conversationKind, recipientGroups, recipients],
  );
  const selectedSummary =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const messages = api.message.listConversationMessages.useQuery(
    { conversationId: selectedConversationId },
    { enabled: screen === 'conversation' && Boolean(selectedConversationId), retry: false },
  );
  const openConversation = api.message.openConversation.useMutation();
  const openStaffroom = api.message.openStaffroom.useMutation();
  const sendMessage = api.message.sendInConversation.useMutation();
  const unreadTotal = conversations.reduce(
    (count, conversation) => count + conversation.unreadCount,
    0,
  );
  const staffroomOpened = conversations.some((conversation) => conversation.kind === 'Staffroom');
  const emptyDetail =
    conversationKind === 'StudentDirect'
      ? 'Choose the Head or Pastor to start a message.'
      : conversationKind === 'SupervisorHead'
        ? 'Start a message with the Head team.'
        : conversationKind === 'StaffDirect'
          ? 'Start a conversation with a colleague, a parent or the Head team.'
          : 'Start a message with the centre team.';

  // Runs before paint so the host's header and tab bar move in the same frame as the push.
  useLayoutEffect(() => {
    if (!openedOnce.current && !open) return;
    openedOnce.current = true;
    if (!reduceMotion) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(320, LayoutAnimation.Types.easeInEaseOut, 'opacity'),
      );
    }
    onThreadOpenChange?.(open);
  }, [onThreadOpenChange, open, reduceMotion]);
  useEffect(
    () => () => {
      onThreadOpenChange?.(false);
    },
    [onThreadOpenChange],
  );

  async function refreshMessages(conversationId?: string) {
    const tasks = [utils.message.listConversations.invalidate()];
    if (conversationId) {
      tasks.push(utils.message.listConversationMessages.invalidate({ conversationId }));
    }
    await Promise.all(tasks);
  }

  async function refreshPanel() {
    await Promise.all([onRefresh?.(), refreshMessages(selectedConversationId || undefined)]);
  }

  function slide(toValue: 0 | 1, onDone?: () => void) {
    if (reduceMotion) {
      push.setValue(toValue);
      onDone?.();
      return;
    }
    // Close to critically damped: a quick, settled push with no bounce past the screen edge.
    Animated.spring(push, {
      damping: 32,
      mass: 1,
      overshootClamping: true,
      stiffness: 300,
      toValue,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone?.();
    });
  }

  function showScreen(next: MessageScreen) {
    // Contacts to conversation swaps in place, like the New Message sheet becoming the thread.
    // Checking `open` (not `screen`) also re-pushes if a row is tapped mid back-slide.
    if (!open) slide(1);
    setScreen(next);
    setOpen(true);
    setFormError(null);
    // A failed send belongs to the thread it happened in, not the next one opened.
    sendMessage.reset();
    openConversation.reset();
  }

  function openInbox() {
    setOpen(false);
    slide(0, () => {
      setScreen(null);
      setDraft(null);
      setReplyBody('');
      setPendingBody(null);
      setFormError(null);
    });
  }

  function openConversationScreen(conversationId: string) {
    setSelectedConversationId(conversationId);
    setDraft(null);
    showScreen('conversation');
  }

  function openContacts() {
    showScreen('contacts');
  }

  // Swipe right from the left edge to go back, following the finger.
  const backSwipe = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (event, gesture) =>
      event.nativeEvent.pageX - gesture.dx < EDGE_WIDTH &&
      gesture.dx > 10 &&
      gesture.dx > Math.abs(gesture.dy) * 2,
    onPanResponderMove: (_event, gesture) => {
      push.setValue(Math.min(Math.max(1 - gesture.dx / width, 0), 1));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx > width * 0.35 || gesture.vx > 0.5) {
        openInbox();
        return;
      }
      slide(1);
    },
    onPanResponderTerminate: () => {
      slide(1);
    },
  });

  function pickContact(recipient: Recipient, kind: ConversationKind) {
    const existing = findConversationForRecipient(conversations, recipient.id, kind);
    if (existing) {
      openConversationScreen(existing.id);
      return;
    }
    setSelectedConversationId('');
    setDraft({ kind, recipient });
    setReplyBody('');
    showScreen('conversation');
  }

  async function openStaffroomThread() {
    try {
      const staffroom = await openStaffroom.mutateAsync();
      await utils.message.listConversations.invalidate();
      openConversationScreen(staffroom.conversationId);
    } catch {
      // The mutation error is rendered by the list.
    }
  }

  async function send() {
    const trimmedBody = replyBody.trim();
    if (!trimmedBody) {
      setFormError('Enter a message.');
      return;
    }

    setFormError(null);
    // Show the bubble and clear the field at once; the server catches up behind it.
    setPendingBody(trimmedBody);
    setReplyBody('');
    if (Platform.OS === 'ios') impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      let conversationId = selectedConversationId;
      if (draft) {
        const conversation = await openConversation.mutateAsync({
          kind: draft.kind,
          recipientId: draft.recipient.id,
        });
        conversationId = conversation.id;
      }
      if (!conversationId) {
        setFormError('Choose a conversation first.');
        setPendingBody(null);
        setReplyBody(trimmedBody);
        return;
      }
      await sendMessage.mutateAsync({ conversationId, body: trimmedBody });
      setSelectedConversationId(conversationId);
      setDraft(null);
      await refreshMessages(conversationId);
      setPendingBody(null);
    } catch {
      // Mutation errors are rendered in the active view. Put the text back so nothing is lost.
      setPendingBody(null);
      setReplyBody((current) => current || trimmedBody);
    }
  }

  const detail = messages.data;
  const isGroup = (detail?.kind ?? selectedSummary?.kind) === 'Staffroom';
  const otherParticipant =
    detail?.participants.find((participant) => participant.id !== detail.currentUserId) ??
    selectedSummary?.participants.find(
      (participant) => participant.id !== selectedSummary.currentUserId,
    );
  const contactName = draft
    ? draft.recipient.fullName
    : isGroup
      ? 'Staffroom'
      : (otherParticipant?.fullName ??
        detail?.admin?.fullName ??
        selectedSummary?.admin?.fullName ??
        'Centre team');
  const subtitle = draft
    ? draft.recipient.role
    : isGroup
      ? 'Staff group chat'
      : (otherParticipant?.role ?? 'Private message');
  const pinned: PinnedConversation | null =
    showStaffroom && !staffroomOpened
      ? {
          title: 'Staffroom',
          detail: 'Shared staff conversation for daily team updates.',
          pending: openStaffroom.isPending,
          onPress: () => {
            void openStaffroomThread();
          },
        }
      : null;

  const inboxShift = push.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 0.3] });
  const screenShift = push.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <View
      onLayout={() => {
        frame.current?.measureInWindow((_x, y) => {
          setTopOffset(y);
        });
      }}
      ref={frame}
      style={[styles.shell, styles.clip]}
    >
      <Animated.View
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        pointerEvents={open ? 'none' : 'auto'}
        style={[styles.shell, { transform: [{ translateX: inboxShift }] }]}
      >
        {openStaffroom.error ? <ErrorText>{openStaffroom.error.message}</ErrorText> : null}
        <InboxView
          accent={accent}
          conversations={conversations}
          emptyDetail={emptyDetail}
          hasMore={hasMore}
          loadingMore={loadingMore}
          navClearance={navClearance}
          onCompose={openContacts}
          onLoadMore={onLoadMore ?? (() => undefined)}
          onOpenConversation={openConversationScreen}
          onRefresh={() => {
            void refreshPanel();
          }}
          pinned={pinned}
          refreshing={refreshing}
          unreadTotal={unreadTotal}
        />
      </Animated.View>

      {screen ? (
        <Animated.View
          {...backSwipe.panHandlers}
          pointerEvents={open ? 'auto' : 'none'}
          style={[styles.pushed, { transform: [{ translateX: screenShift }] }]}
        >
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={topOffset}
            style={styles.shell}
          >
            {screen === 'contacts' ? (
              <ContactsView
                accent={accent}
                groups={groups}
                onBack={openInbox}
                onSelect={pickContact}
              />
            ) : (
              <ConversationView
                accent={accent}
                contactName={contactName}
                detail={detail}
                draft={draft !== null}
                error={draft ? undefined : messages.error?.message}
                formError={formError}
                isGroup={isGroup}
                loading={
                  !draft &&
                  pendingBody === null &&
                  messages.isLoading &&
                  Boolean(selectedConversationId)
                }
                onBack={openInbox}
                onRefresh={() => {
                  void refreshPanel();
                }}
                onSend={() => {
                  void send();
                }}
                pendingBody={pendingBody}
                refreshing={refreshing}
                replyBody={replyBody}
                sendError={sendMessage.error?.message ?? openConversation.error?.message}
                sending={sendMessage.isPending || openConversation.isPending}
                setReplyBody={setReplyBody}
                subtitle={subtitle}
                unreadTotal={unreadTotal}
              />
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Keeps the pushed screen's shadow from bleeding past the top and bottom edges.
  clip: {
    overflow: 'hidden',
  },
  pushed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    // Soft leading-edge shadow so the pushed screen reads as a layer over the inbox.
    boxShadow: '-8px 0px 24px rgba(15, 23, 42, 0.10)',
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
});
