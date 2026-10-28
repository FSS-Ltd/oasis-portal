import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { api } from '../../lib/trpc';
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

type MessageScreen = 'inbox' | 'contacts' | 'conversation';

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
  const [screen, setScreen] = useState<MessageScreen>('inbox');
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

  useEffect(() => {
    onThreadOpenChange?.(screen !== 'inbox');
  }, [onThreadOpenChange, screen]);
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

  function openInbox() {
    setScreen('inbox');
    setDraft(null);
    setReplyBody('');
    setFormError(null);
  }

  function openConversationScreen(conversationId: string) {
    setSelectedConversationId(conversationId);
    setDraft(null);
    setScreen('conversation');
    setFormError(null);
  }

  function openContacts() {
    setScreen('contacts');
    setFormError(null);
  }

  function pickContact(recipient: Recipient, kind: ConversationKind) {
    const existing = findConversationForRecipient(conversations, recipient.id, kind);
    if (existing) {
      openConversationScreen(existing.id);
      return;
    }
    setSelectedConversationId('');
    setDraft({ kind, recipient });
    setReplyBody('');
    setScreen('conversation');
    setFormError(null);
  }

  async function openStaffroomThread() {
    try {
      const thread = await openStaffroom.mutateAsync();
      await utils.message.listConversations.invalidate();
      openConversationScreen(thread.id);
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
        return;
      }
      await sendMessage.mutateAsync({ conversationId, body: trimmedBody });
      setReplyBody('');
      setSelectedConversationId(conversationId);
      setDraft(null);
      await refreshMessages(conversationId);
    } catch {
      // Mutation errors are rendered in the active view.
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

  return (
    <View
      onLayout={() => {
        frame.current?.measureInWindow((_x, y) => {
          setTopOffset(y);
        });
      }}
      ref={frame}
      style={styles.shell}
    >
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={topOffset}
        style={styles.shell}
      >
        {screen === 'inbox' && openStaffroom.error ? (
          <ErrorText>{openStaffroom.error.message}</ErrorText>
        ) : null}
        {screen === 'inbox' ? (
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
        ) : null}

        {screen === 'contacts' ? (
          <ContactsView accent={accent} groups={groups} onBack={openInbox} onSelect={pickContact} />
        ) : null}

        {screen === 'conversation' ? (
          <ConversationView
            accent={accent}
            contactName={contactName}
            detail={detail}
            draft={draft !== null}
            error={draft ? undefined : messages.error?.message}
            formError={formError}
            isGroup={isGroup}
            loading={!draft && messages.isLoading && Boolean(selectedConversationId)}
            onBack={openInbox}
            onRefresh={() => {
              void refreshPanel();
            }}
            onSend={() => {
              void send();
            }}
            refreshing={refreshing}
            replyBody={replyBody}
            sendError={sendMessage.error?.message ?? openConversation.error?.message}
            sending={sendMessage.isPending || openConversation.isPending}
            setReplyBody={setReplyBody}
            subtitle={subtitle}
            unreadTotal={unreadTotal}
          />
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
});
