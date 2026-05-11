import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  SmokeButton,
} from './smoke-ui';

type ThreadSummary = RouterOutputs['message']['listThreads'][number];
type ThreadDetail = RouterOutputs['message']['listInThread'];
type Recipient = RouterOutputs['message']['listRecipients'][number];

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function shortText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3)}...`;
}

export function ParentMessagesPanel({
  recipients,
  threads,
}: {
  recipients: Recipient[];
  threads: ThreadSummary[];
}) {
  const utils = api.useUtils();
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const activeThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const activeThreadId = activeThread?.id ?? '';
  const activeRecipientId = recipientId || recipients[0]?.id || '';
  const messages = api.message.listInThread.useQuery(
    { threadId: activeThreadId },
    { enabled: Boolean(activeThreadId), retry: false },
  );
  const openThread = api.message.openThread.useMutation();
  const sendMessage = api.message.send.useMutation();
  const pending = openThread.isPending || sendMessage.isPending;

  async function refreshMessages(threadId: string) {
    await Promise.all([
      utils.message.listThreads.invalidate(),
      utils.message.listInThread.invalidate({ threadId }),
    ]);
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
      await refreshMessages(thread.id);
    } catch {
      // Mutation errors are rendered below the form.
    }
  }

  async function sendReply() {
    const trimmedBody = replyBody.trim();
    if (!activeThreadId || !trimmedBody) {
      setFormError('Choose a thread and enter a reply.');
      return;
    }

    setFormError(null);
    try {
      await sendMessage.mutateAsync({ threadId: activeThreadId, body: trimmedBody });
      setReplyBody('');
      await refreshMessages(activeThreadId);
    } catch {
      // Mutation errors are rendered below the form.
    }
  }

  return (
    <View style={styles.panelStack}>
      <Card>
        <SectionTitle>New message</SectionTitle>
        {recipients.length === 0 ? <MutedText>No message recipients returned.</MutedText> : null}
        <View style={styles.buttonColumn}>
          {recipients.map((recipient) => (
            <SmokeButton
              compact
              key={recipient.id}
              label={`${recipient.fullName} - ${recipient.role}`}
              onPress={() => {
                setRecipientId(recipient.id);
              }}
              variant={activeRecipientId === recipient.id ? 'primary' : 'secondary'}
            />
          ))}
        </View>
        <Field label="Subject" onChangeText={setSubject} value={subject} />
        <Field label="Message" multiline onChangeText={setNewBody} value={newBody} />
        <SmokeButton
          disabled={pending || recipients.length === 0}
          label={pending ? 'Sending...' : 'Start thread'}
          onPress={() => {
            void startThread();
          }}
          variant="navy"
        />
      </Card>

      <Card>
        <SectionTitle>Threads</SectionTitle>
        {threads.length === 0 ? <MutedText>No message threads returned.</MutedText> : null}
        {threads.map((thread) => (
          <Pressable
            accessibilityRole="button"
            key={thread.id}
            onPress={() => {
              setSelectedThreadId(thread.id);
            }}
            style={[
              styles.threadRow,
              activeThreadId === thread.id ? styles.threadRowActive : null,
            ]}
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{thread.subject}</Text>
              <MutedText>
                {thread.admin.fullName} - {formatDateTime(thread.updatedAt)}
              </MutedText>
              {thread.latestMessage ? <LatestMessageLine thread={thread} /> : null}
            </View>
            {thread.unreadCount > 0 ? (
              <Badge variant="crimson">{String(thread.unreadCount)}</Badge>
            ) : null}
          </Pressable>
        ))}
      </Card>

      <ThreadMessages
        detail={messages.data}
        error={messages.error?.message}
        loading={messages.isLoading && Boolean(activeThreadId)}
      />

      {activeThreadId ? (
        <Card>
          <SectionTitle>Reply</SectionTitle>
          <Field label="Message" multiline onChangeText={setReplyBody} value={replyBody} />
          <SmokeButton
            disabled={sendMessage.isPending || !replyBody.trim()}
            label={sendMessage.isPending ? 'Sending...' : 'Send reply'}
            onPress={() => {
              void sendReply();
            }}
          />
        </Card>
      ) : null}

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {openThread.error ? <ErrorText>{openThread.error.message}</ErrorText> : null}
      {sendMessage.error ? <ErrorText>{sendMessage.error.message}</ErrorText> : null}
    </View>
  );
}

function LatestMessageLine({ thread }: { thread: ThreadSummary }) {
  const latest = thread.latestMessage;
  if (!latest) return null;

  const senderName =
    latest.senderId === thread.parentId ? thread.parent.fullName : thread.admin.fullName;
  return <MutedText>{shortText(`Latest: ${senderName}`, 48)}</MutedText>;
}

function ThreadMessages({
  detail,
  error,
  loading,
}: {
  detail: ThreadDetail | undefined;
  error: string | undefined;
  loading: boolean;
}) {
  if (loading) return <InlineSpinner label="Loading thread" />;
  if (error) return <ErrorText>{error}</ErrorText>;

  return (
    <Card>
      <SectionTitle>{detail?.subject ?? 'Thread'}</SectionTitle>
      {!detail ? <MutedText>Select a thread to read messages.</MutedText> : null}
      {detail?.messages.length === 0 ? <MutedText>No messages returned.</MutedText> : null}
      {detail?.messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.messageBubble,
            message.readByCurrentUser ? styles.messageBubbleRead : null,
          ]}
        >
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle}>{message.sender.fullName}</Text>
            <MutedText>{formatDateTime(message.createdAt)}</MutedText>
          </View>
          <Text style={styles.messageText}>{message.body}</Text>
          {message.readByOtherParticipant ? <MutedText>Read</MutedText> : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  buttonColumn: {
    gap: 8,
  },
  messageBubble: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  messageBubbleRead: {
    borderColor: C.blueMid,
  },
  messageText: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  panelStack: {
    gap: 16,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  threadRow: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  threadRowActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
});
