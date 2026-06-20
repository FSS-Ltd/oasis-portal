import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { ConversationView } from './mobile-message-conversation';
import { InboxView } from './mobile-message-inbox';
import { NewThreadView } from './mobile-message-new-thread';
import type { ConversationSummary, Recipient } from './mobile-message-types';

type MessageScreen = 'inbox' | 'conversation' | 'new';
type ConversationKind = 'ParentStaff' | 'StudentDirect' | 'StaffDirect' | 'SupervisorHead';

interface MobileMessagesPanelProps {
  conversationKind?: ConversationKind;
  conversations: ConversationSummary[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  recipients: Recipient[];
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function MobileMessagesPanel({
  conversationKind = 'ParentStaff',
  conversations,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  recipients,
  refreshing = false,
  onRefresh,
}: MobileMessagesPanelProps) {
  const utils = api.useUtils();
  const [screen, setScreen] = useState<MessageScreen>('inbox');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [newBody, setNewBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const selectedSummary =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const activeRecipient =
    recipients.find((recipient) => recipient.id === recipientId) ?? recipients[0];
  const activeRecipientId = activeRecipient?.id ?? '';
  const messages = api.message.listConversationMessages.useQuery(
    { conversationId: selectedConversationId },
    { enabled: screen === 'conversation' && Boolean(selectedConversationId), retry: false },
  );
  const openConversation = api.message.openConversation.useMutation();
  const sendMessage = api.message.sendInConversation.useMutation();
  const pending = openConversation.isPending || sendMessage.isPending;
  const unreadTotal = conversations.reduce(
    (count, conversation) => count + conversation.unreadCount,
    0,
  );
  const emptyDetail =
    conversationKind === 'StudentDirect'
      ? 'Choose a student, the Head, or the Pastor to start a message.'
      : conversationKind === 'SupervisorHead'
        ? 'Start a message with the Head team.'
        : conversationKind === 'StaffDirect'
          ? 'Start a staff-direct conversation or use the Staffroom for team updates.'
          : 'Start a message with the centre team.';

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
    setFormError(null);
  }

  function openConversationScreen(conversationId: string) {
    setSelectedConversationId(conversationId);
    setScreen('conversation');
    setFormError(null);
  }

  function openComposer() {
    setScreen('new');
    setFormError(null);
  }

  async function startThread() {
    const trimmedBody = newBody.trim();
    if (!activeRecipientId || !trimmedBody) {
      setFormError('Recipient and message are required.');
      return;
    }

    setFormError(null);
    try {
      const conversation = await openConversation.mutateAsync({
        kind: conversationKind,
        recipientId: activeRecipientId,
      });
      await sendMessage.mutateAsync({ conversationId: conversation.id, body: trimmedBody });
      setSelectedConversationId(conversation.id);
      setNewBody('');
      setScreen('conversation');
      await refreshMessages(conversation.id);
    } catch {
      // Mutation errors are rendered in the active view.
    }
  }

  async function sendReply() {
    const trimmedBody = replyBody.trim();
    if (!selectedConversationId || !trimmedBody) {
      setFormError('Choose a message and enter a reply.');
      return;
    }

    setFormError(null);
    try {
      await sendMessage.mutateAsync({ conversationId: selectedConversationId, body: trimmedBody });
      setReplyBody('');
      await refreshMessages(selectedConversationId);
    } catch {
      // Mutation errors are rendered in the active view.
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.shell}
    >
      {screen === 'inbox' ? (
        <InboxView
          conversations={conversations}
          emptyDetail={emptyDetail}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onCompose={openComposer}
          onLoadMore={onLoadMore ?? (() => undefined)}
          onOpenConversation={openConversationScreen}
          onRefresh={() => {
            void refreshPanel();
          }}
          refreshing={refreshing}
          unreadTotal={unreadTotal}
        />
      ) : null}

      {screen === 'conversation' ? (
        <ConversationView
          detail={messages.data}
          error={messages.error?.message}
          formError={formError}
          loading={messages.isLoading && Boolean(selectedConversationId)}
          onBack={openInbox}
          onRefresh={() => {
            void refreshPanel();
          }}
          onSend={() => {
            void sendReply();
          }}
          refreshing={refreshing}
          replyBody={replyBody}
          selectedSummary={selectedSummary}
          sendError={sendMessage.error?.message}
          sending={sendMessage.isPending}
          setReplyBody={setReplyBody}
          unreadTotal={unreadTotal}
        />
      ) : null}

      {screen === 'new' ? (
        <NewThreadView
          activeRecipientId={activeRecipientId}
          body={newBody}
          formError={formError}
          onBack={openInbox}
          onSend={() => {
            void startThread();
          }}
          openConversationError={openConversation.error?.message}
          pending={pending}
          recipients={recipients}
          sendError={sendMessage.error?.message}
          setBody={setNewBody}
          setRecipientId={setRecipientId}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
});
