import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  conversationRecipientId,
  counterpartLabel,
  counterpartRole,
  formatDateTime,
} from './message-display';
import type {
  ConversationKind,
  ConversationSummary,
  MessageMode,
  Recipient,
} from './message-types';

interface MessageContactListProps {
  conversationError?: string | null;
  conversationKind: ConversationKind | null;
  conversations: ConversationSummary[];
  emptyDetail: string;
  emptyTitle: string;
  fetchingMore: boolean;
  label: string;
  loading: boolean;
  mode: MessageMode;
  nextConversationCursor: string | null;
  onLoadMore: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSelectRecipient: (recipientId: string) => void;
  openingRecipientId: string | null;
  recipients: Recipient[];
  recipientsError?: string | null;
  selectedConversationId: string | null;
  selectedRecipientId: string | null;
  unreadTotal: number;
}

function rowClassName(active: boolean, pending = false): string {
  return ['message-thread-row', active ? 'is-active' : '', pending ? 'is-pending' : '']
    .filter(Boolean)
    .join(' ');
}

function ConversationRow({
  active,
  conversation,
  mode,
  onSelect,
}: {
  active: boolean;
  conversation: ConversationSummary;
  mode: MessageMode;
  onSelect: (conversationId: string) => void;
}) {
  const latest = conversation.latestMessage;

  return (
    <button
      aria-pressed={active}
      className={rowClassName(active)}
      onClick={() => {
        onSelect(conversation.id);
      }}
      type="button"
    >
      <span>
        <strong>{counterpartLabel(mode, conversation)}</strong>
        <small>{counterpartRole(mode, conversation)}</small>
      </span>
      <span className="message-thread-row__meta">
        {latest ? formatDateTime(latest.createdAt) : formatDateTime(conversation.createdAt)}
      </span>
      <em>
        {conversation.messageCount === 1
          ? '1 message'
          : `${String(conversation.messageCount)} messages`}
      </em>
      <span className="message-thread-row__footer">
        <small>{conversation.kind === 'Staffroom' ? 'Group chat' : 'Private message'}</small>
        {conversation.unreadCount > 0 ? (
          <b aria-label={`${String(conversation.unreadCount)} unread messages`}>
            {conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount)}
          </b>
        ) : null}
      </span>
    </button>
  );
}

function RecipientRow({
  active,
  onSelect,
  pending,
  recipient,
}: {
  active: boolean;
  onSelect: (recipientId: string) => void;
  pending: boolean;
  recipient: Recipient;
}) {
  return (
    <button
      aria-pressed={active}
      className={rowClassName(active, pending)}
      disabled={pending}
      onClick={() => {
        onSelect(recipient.id);
      }}
      type="button"
    >
      <span>
        <strong>{recipient.fullName}</strong>
        <small>{recipient.role}</small>
      </span>
      <span className="message-thread-row__meta">{pending ? 'Opening' : 'New'}</span>
      <em>No messages yet</em>
      <span className="message-thread-row__footer">
        <small>Private message</small>
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="message-thread-section-label">{children}</p>;
}

export function MessageContactList({
  conversationError = null,
  conversationKind,
  conversations,
  emptyDetail,
  emptyTitle,
  fetchingMore,
  label,
  loading,
  mode,
  nextConversationCursor,
  onLoadMore,
  onSelectConversation,
  onSelectRecipient,
  openingRecipientId,
  recipients,
  recipientsError = null,
  selectedConversationId,
  selectedRecipientId,
  unreadTotal,
}: MessageContactListProps) {
  const staffroom = conversations.find((conversation) => conversation.kind === 'Staffroom') ?? null;
  const privateConversations = conversations.filter(
    (conversation) => conversation.kind !== 'Staffroom',
  );
  const existingRecipientIds = new Set(
    conversations
      .map((conversation) => conversationRecipientId(conversationKind, conversation))
      .filter((recipientId): recipientId is string => Boolean(recipientId)),
  );
  const availableRecipients = conversationKind
    ? recipients.filter((recipient) => !existingRecipientIds.has(recipient.id))
    : [];
  const contactCount = conversations.length + availableRecipients.length;
  const showEmpty = !loading && contactCount === 0;

  return (
    <section className="panel message-thread-list-panel" aria-labelledby="message-list-title">
      <div className="message-panel-header">
        <h2 id="message-list-title">{label}</h2>
        <span>{unreadTotal > 0 ? `${String(unreadTotal)} unread` : String(contactCount)}</span>
      </div>

      <div className="message-thread-list-scroll">
        {loading ? <EmptyState>Loading contacts...</EmptyState> : null}
        {conversationError ? <p className="status--error">{conversationError}</p> : null}
        {recipientsError ? <p className="status--error">{recipientsError}</p> : null}
        {showEmpty ? <EmptyState detail={emptyDetail} title={emptyTitle} /> : null}

        <div className="message-thread-list" aria-label={label}>
          {staffroom ? (
            <>
              <SectionLabel>Group</SectionLabel>
              <ConversationRow
                active={staffroom.id === selectedConversationId}
                conversation={staffroom}
                mode={mode}
                onSelect={onSelectConversation}
              />
            </>
          ) : null}

          {privateConversations.length > 0 ? (
            <>
              <SectionLabel>Conversations</SectionLabel>
              {privateConversations.map((conversation) => (
                <ConversationRow
                  active={conversation.id === selectedConversationId}
                  conversation={conversation}
                  key={conversation.id}
                  mode={mode}
                  onSelect={onSelectConversation}
                />
              ))}
            </>
          ) : null}

          {availableRecipients.length > 0 ? (
            <>
              <SectionLabel>Contacts</SectionLabel>
              {availableRecipients.map((recipient) => (
                <RecipientRow
                  active={
                    recipient.id === selectedRecipientId || recipient.id === openingRecipientId
                  }
                  key={recipient.id}
                  onSelect={onSelectRecipient}
                  pending={recipient.id === openingRecipientId}
                  recipient={recipient}
                />
              ))}
            </>
          ) : null}
        </div>

        {nextConversationCursor ? (
          <div className="message-list-pagination">
            <Button disabled={fetchingMore} onClick={onLoadMore} type="button" variant="secondary">
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
