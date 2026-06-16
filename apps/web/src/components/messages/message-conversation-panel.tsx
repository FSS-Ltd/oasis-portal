import { type FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  counterpartLabel,
  counterpartRole,
  formatDateTime,
  submitFormOnEnter,
} from './message-display';
import type { ConversationDetail, ConversationSummary, MessageMode } from './message-types';

interface MessageConversationPanelProps {
  conversationError?: string | null;
  conversationLoading: boolean;
  onSent: () => void;
  placeholder: string;
  selectedConversation: ConversationDetail | null;
  selectedConversationId: string | null;
  selectedSummary: ConversationSummary | null;
  mode: MessageMode;
}

function MessageBubble({
  currentUserId,
  message,
}: {
  currentUserId: string | null;
  message: ConversationDetail['messages'][number];
}) {
  const mine = currentUserId === message.senderId;

  return (
    <article className={mine ? 'message-bubble is-mine' : 'message-bubble'}>
      <header>
        <strong>{mine ? 'You' : message.sender.fullName}</strong>
        <time>{formatDateTime(message.createdAt)}</time>
      </header>
      <p>{message.body}</p>
      {mine ? <footer>{message.readByOtherParticipant ? 'Read' : 'Sent'}</footer> : null}
    </article>
  );
}

function ReplyComposer({
  conversationId,
  disabled,
  onSent,
  placeholder,
}: {
  conversationId: string;
  disabled: boolean;
  onSent: () => void;
  placeholder: string;
}) {
  const [body, setBody] = useState('');
  const sendMessage = api.message.sendInConversation.useMutation({
    onError(error) {
      showErrorToast(error, 'Message could not be sent.');
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    try {
      await sendMessage.mutateAsync({ conversationId, body: trimmedBody });
      setBody('');
      onSent();
      showSuccessToast('Message sent.');
    } catch {
      // The mutation error is shown in a toast and inline below the form.
    }
  }

  return (
    <form
      className="message-reply-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <textarea
        aria-label="Message reply"
        className="input textarea"
        disabled={disabled || sendMessage.isPending}
        maxLength={4000}
        onKeyDown={submitFormOnEnter}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        placeholder={placeholder}
        rows={3}
        value={body}
      />
      <Button
        disabled={disabled || body.trim().length === 0}
        pending={sendMessage.isPending}
        type="submit"
      >
        <Send aria-hidden="true" size={16} />
        Send
      </Button>
      {sendMessage.error ? (
        <p className="status--error">{friendlyErrorMessage(sendMessage.error)}</p>
      ) : null}
    </form>
  );
}

function headerMessageCount(conversation: ConversationDetail | ConversationSummary): number {
  return 'messages' in conversation ? conversation.messages.length : conversation.messageCount;
}

export function MessageConversationPanel({
  conversationError = null,
  conversationLoading,
  mode,
  onSent,
  placeholder,
  selectedConversation,
  selectedConversationId,
  selectedSummary,
}: MessageConversationPanelProps) {
  const headerConversation = selectedConversation ?? selectedSummary;
  const currentUserId = selectedConversation?.currentUserId ?? null;
  const messageCount = headerConversation ? headerMessageCount(headerConversation) : 0;

  return (
    <section className="panel panel__body message-detail-panel" aria-label="Message conversation">
      {headerConversation ? (
        <div className="message-detail-header">
          <div>
            <p>{counterpartRole(mode, headerConversation)}</p>
            <h2>{counterpartLabel(mode, headerConversation)}</h2>
            <span>{messageCount === 1 ? '1 message' : `${String(messageCount)} messages`}</span>
          </div>
        </div>
      ) : null}

      {conversationLoading ? <EmptyState>Loading messages...</EmptyState> : null}
      {conversationError ? <p className="status--error">{conversationError}</p> : null}
      {!selectedConversationId && !conversationLoading ? (
        <EmptyState className="message-detail-empty" title="Select a contact" />
      ) : null}
      {selectedConversation ? (
        <>
          <div className="message-bubble-list" aria-label="Conversation messages">
            {selectedConversation.messages.length === 0 ? (
              <EmptyState
                className="message-detail-empty"
                detail="Messages in this conversation will appear here."
                title="No messages yet"
              />
            ) : (
              selectedConversation.messages.map((message) => (
                <MessageBubble currentUserId={currentUserId} key={message.id} message={message} />
              ))
            )}
          </div>
          <ReplyComposer
            conversationId={selectedConversation.id}
            disabled={conversationLoading}
            onSent={onSent}
            placeholder={placeholder}
          />
        </>
      ) : null}
    </section>
  );
}
