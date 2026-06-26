'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCommunityDateTime } from './community-types';
import type { CommunityGroup } from './community-types';

type CommunityMember = CommunityGroup['members'][number];
type DirectConversationDetail = RouterOutputs['message']['listConversationMessages'];

interface StudentCommunityContactsProps {
  currentStudentId: string | null;
  group: CommunityGroup;
}

function memberContactLabel(member: CommunityMember): string {
  return member.student.yearGroup ? `Year ${member.student.yearGroup}` : 'Student';
}

function DirectMessageBubble({
  currentUserId,
  message,
}: {
  currentUserId: string | null;
  message: DirectConversationDetail['messages'][number];
}) {
  const mine = currentUserId === message.senderId;

  return (
    <article className={mine ? 'message-bubble is-mine' : 'message-bubble'}>
      <header>
        <strong>{mine ? 'You' : message.sender.fullName}</strong>
        <time>{formatCommunityDateTime(message.createdAt)}</time>
      </header>
      <p>{message.body}</p>
      {mine ? <footer>{message.readByOtherParticipant ? 'Read' : 'Sent'}</footer> : null}
    </article>
  );
}

function DirectMessagePanel({
  conversation,
  conversationError,
  conversationId,
  conversationLoading,
  onSent,
}: {
  conversation: DirectConversationDetail | null;
  conversationError: string | null;
  conversationId: string | null;
  conversationLoading: boolean;
  onSent: () => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const sendMessage = api.message.sendInConversation.useMutation({
    onError(error) {
      showErrorToast(error, 'Direct message could not be sent.');
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!conversationId || !trimmedBody) return;

    try {
      await sendMessage.mutateAsync({ body: trimmedBody, conversationId });
      setBody('');
      await onSent();
      showSuccessToast('Message sent.');
    } catch {
      // The mutation error is shown in a toast and inline below the form.
    }
  }

  return (
    <section className="community-direct-panel" aria-labelledby="community-direct-title">
      <div className="message-panel-header">
        <h3 id="community-direct-title">Individual message</h3>
        <span>{conversation ? String(conversation.messages.length) : '0'}</span>
      </div>

      {!conversationId && !conversationLoading ? (
        <EmptyState
          detail="Open a student contact to message them individually."
          title="Choose a contact"
        />
      ) : null}
      {conversationLoading ? <EmptyState title="Loading direct messages..." /> : null}
      {conversationError ? <p className="status--error">{conversationError}</p> : null}
      {conversation ? (
        <>
          <div className="message-bubble-list" aria-label="Individual messages">
            {conversation.messages.length === 0 ? (
              <EmptyState
                detail="Direct messages with this student will appear here."
                title="No direct messages yet"
              />
            ) : (
              conversation.messages.map((message) => (
                <DirectMessageBubble
                  currentUserId={conversation.currentUserId}
                  key={message.id}
                  message={message}
                />
              ))
            )}
          </div>
          <form
            className="message-reply-form"
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <textarea
              aria-label="Individual message"
              className="input textarea"
              disabled={sendMessage.isPending}
              maxLength={4000}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              placeholder="Type your message..."
              rows={3}
              value={body}
            />
            <Button
              disabled={body.trim().length === 0}
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
        </>
      ) : null}
    </section>
  );
}

export function StudentCommunityContacts({
  currentStudentId,
  group,
}: StudentCommunityContactsProps) {
  const utils = api.useUtils();
  const [activeContactUserId, setActiveContactUserId] = useState<string | null>(null);
  const [directConversationId, setDirectConversationId] = useState<string | null>(null);
  const openConversation = api.message.openConversation.useMutation({
    onError(error) {
      showErrorToast(error, 'Student contact could not be opened.');
    },
  });
  const directConversation = api.message.listConversationMessages.useQuery(
    { conversationId: directConversationId ?? '' },
    { enabled: Boolean(directConversationId), retry: false },
  );

  useEffect(() => {
    setActiveContactUserId(null);
    setDirectConversationId(null);
  }, [group.id]);

  async function openContact(member: CommunityMember) {
    const recipientUserId = member.student.userId;
    if (!recipientUserId || member.studentId === currentStudentId || openConversation.isPending) {
      return;
    }

    setActiveContactUserId(recipientUserId);
    setDirectConversationId(null);
    try {
      const conversation = await openConversation.mutateAsync({
        kind: 'StudentDirect',
        recipientId: recipientUserId,
      });
      setDirectConversationId(conversation.id);
      await utils.message.listConversations.invalidate();
    } catch {
      setActiveContactUserId(null);
    }
  }

  async function refreshDirectConversation() {
    if (!directConversationId) return;
    await directConversation.refetch();
    await utils.message.listConversationMessages.invalidate({
      conversationId: directConversationId,
    });
  }

  return (
    <section className="community-contact-panel" aria-labelledby="community-contacts-title">
      <div className="message-panel-header">
        <h3 id="community-contacts-title">Student contacts</h3>
        <span>{String(group.members.length)}</span>
      </div>
      <div className="community-membership-list">
        {group.members.length === 0 ? <p className="muted">No contacts yet.</p> : null}
        {group.members.map((member) => {
          const recipientUserId = member.student.userId;
          const isCurrentStudent = member.studentId === currentStudentId;
          const opening = Boolean(
            recipientUserId &&
            recipientUserId === activeContactUserId &&
            openConversation.isPending,
          );
          const active = Boolean(
            recipientUserId && recipientUserId === activeContactUserId && directConversationId,
          );

          return (
            <button
              aria-pressed={active}
              className={
                active
                  ? 'community-membership-row community-contact-row is-active'
                  : 'community-membership-row community-contact-row'
              }
              disabled={!recipientUserId || isCurrentStudent || opening}
              key={member.studentId}
              onClick={() => {
                void openContact(member);
              }}
              type="button"
            >
              <span>
                <strong>{isCurrentStudent ? 'You' : member.student.fullName}</strong>
                <small>{memberContactLabel(member)}</small>
              </span>
              <b>{isCurrentStudent ? 'You' : opening ? 'Opening' : 'Message'}</b>
            </button>
          );
        })}
      </div>
      {openConversation.error ? (
        <p className="status--error">{friendlyErrorMessage(openConversation.error)}</p>
      ) : null}
      <DirectMessagePanel
        conversation={directConversation.data ?? null}
        conversationError={
          directConversation.error ? friendlyErrorMessage(directConversation.error) : null
        }
        conversationId={directConversationId}
        conversationLoading={directConversation.isLoading || openConversation.isPending}
        onSent={refreshDirectConversation}
      />
    </section>
  );
}
