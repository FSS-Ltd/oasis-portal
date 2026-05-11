import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import { ConversationView } from './parent-message-conversation';
import { InboxView } from './parent-message-inbox';
import { NewThreadView } from './parent-message-new-thread';
import type { Recipient, ThreadSummary } from './parent-message-types';

type MessageScreen = 'inbox' | 'conversation' | 'new';

interface ParentMessagesPanelProps {
  recipients: Recipient[];
  threads: ThreadSummary[];
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function ParentMessagesPanel({
  recipients,
  threads,
  refreshing = false,
  onRefresh,
}: ParentMessagesPanelProps) {
  const utils = api.useUtils();
  const [screen, setScreen] = useState<MessageScreen>('inbox');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const selectedSummary = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const activeRecipient =
    recipients.find((recipient) => recipient.id === recipientId) ?? recipients[0];
  const activeRecipientId = activeRecipient?.id ?? '';
  const messages = api.message.listInThread.useQuery(
    { threadId: selectedThreadId },
    { enabled: screen === 'conversation' && Boolean(selectedThreadId), retry: false },
  );
  const openThread = api.message.openThread.useMutation();
  const sendMessage = api.message.send.useMutation();
  const pending = openThread.isPending || sendMessage.isPending;
  const unreadTotal = threads.reduce((count, thread) => count + thread.unreadCount, 0);

  async function refreshMessages(threadId?: string) {
    const tasks = [utils.message.listThreads.invalidate()];
    if (threadId) tasks.push(utils.message.listInThread.invalidate({ threadId }));
    await Promise.all(tasks);
  }

  async function refreshPanel() {
    await Promise.all([onRefresh?.(), refreshMessages(selectedThreadId || undefined)]);
  }

  function openInbox() {
    setScreen('inbox');
    setFormError(null);
  }

  function openConversation(threadId: string) {
    setSelectedThreadId(threadId);
    setScreen('conversation');
    setFormError(null);
  }

  function openComposer() {
    setScreen('new');
    setFormError(null);
  }

  async function startThread() {
    const trimmedSubject = subject.trim();
    const trimmedBody = newBody.trim();
    if (!activeRecipientId || !trimmedSubject || !trimmedBody) {
      setFormError('Recipient, subject, and message are required.');
      return;
    }

    setFormError(null);
    try {
      const thread = await openThread.mutateAsync({
        adminId: activeRecipientId,
        subject: trimmedSubject,
      });
      await sendMessage.mutateAsync({ threadId: thread.id, body: trimmedBody });
      setSelectedThreadId(thread.id);
      setSubject('');
      setNewBody('');
      setScreen('conversation');
      await refreshMessages(thread.id);
    } catch {
      // Mutation errors are rendered in the active view.
    }
  }

  async function sendReply() {
    const trimmedBody = replyBody.trim();
    if (!selectedThreadId || !trimmedBody) {
      setFormError('Choose a thread and enter a reply.');
      return;
    }

    setFormError(null);
    try {
      await sendMessage.mutateAsync({ threadId: selectedThreadId, body: trimmedBody });
      setReplyBody('');
      await refreshMessages(selectedThreadId);
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
          onCompose={openComposer}
          onOpenThread={openConversation}
          onRefresh={() => {
            void refreshPanel();
          }}
          refreshing={refreshing}
          threads={threads}
          unreadTotal={unreadTotal}
        />
      ) : null}

      {screen === 'conversation' ? (
        <ConversationView
          detail={messages.data}
          error={messages.error?.message}
          formError={formError}
          loading={messages.isLoading && Boolean(selectedThreadId)}
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
          openThreadError={openThread.error?.message}
          pending={pending}
          recipients={recipients}
          sendError={sendMessage.error?.message}
          setBody={setNewBody}
          setRecipientId={setRecipientId}
          setSubject={setSubject}
          subject={subject}
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
