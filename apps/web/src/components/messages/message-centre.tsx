'use client';

import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquarePlus, Send } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput } from '@/components/ui/field';

type MessageMode = 'admin' | 'parent' | 'supervisor' | 'student';
type ConversationKind = 'ParentStaff' | 'SupervisorHead' | 'StaffDirect' | 'StudentDirect';
type ConversationPage = RouterOutputs['message']['listConversations'];
type LoadedConversationPage = { cursor: string | undefined; page: ConversationPage };
type ConversationSummary = ConversationPage['items'][number];
type ConversationDetail = RouterOutputs['message']['listConversationMessages'];
type Recipient = RouterOutputs['message']['listRecipients'][number];

interface MessageCentreProps {
  mode: MessageMode;
}

const copy = {
  admin: {
    eyebrow: 'Staff communications',
    heading: 'Messages',
    sub: 'Private staff conversations and staffroom updates.',
    emptyTitle: 'No staff messages',
    emptyDetail: 'Start a staff message or open the staffroom.',
    replyPlaceholder: 'Type your reply...',
    conversationListLabel: 'Staff messages',
  },
  parent: {
    eyebrow: 'Centre communications',
    heading: 'Messages',
    sub: 'Message the centre team from your parent portal.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Start a message with the centre team.',
    replyPlaceholder: 'Type your message...',
    conversationListLabel: 'Your messages',
  },
  supervisor: {
    eyebrow: 'Staff communications',
    heading: 'Messages',
    sub: 'Message colleagues privately or use the staffroom.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Start a staff message or open the staffroom.',
    replyPlaceholder: 'Type your message...',
    conversationListLabel: 'Your messages',
  },
  student: {
    eyebrow: 'Student communications',
    heading: 'Messages',
    sub: 'Message other students, the Head, or the Pastor.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Choose a contact and send your first message.',
    replyPlaceholder: 'Type your message...',
    conversationListLabel: 'Your messages',
  },
} as const;

const conversationKindByMode: Record<MessageMode, ConversationKind | null> = {
  admin: 'StaffDirect',
  parent: 'ParentStaff',
  supervisor: 'StaffDirect',
  student: 'StudentDirect',
};

const CONVERSATION_PAGE_SIZE = 20;

const messageDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatDateTime(value: Date | string): string {
  return messageDateTimeFormatter.format(new Date(value));
}

function otherDirectParticipant(conversation: ConversationSummary | ConversationDetail) {
  return conversation.participants.find(
    (participant) => participant.id !== conversation.currentUserId,
  );
}

function counterpartLabel(
  mode: MessageMode,
  conversation: ConversationSummary | ConversationDetail,
): string {
  if (conversation.kind === 'Staffroom') return 'Staffroom';
  if (conversation.kind === 'StaffDirect' || conversation.kind === 'StudentDirect') {
    return otherDirectParticipant(conversation)?.fullName ?? 'Contact';
  }
  if (mode === 'parent' || mode === 'supervisor') {
    return conversation.admin?.fullName ?? 'Staff member';
  }
  return conversation.kind === 'SupervisorHead'
    ? (conversation.supervisor?.fullName ?? 'Supervisor')
    : (conversation.parent?.fullName ?? 'Parent');
}

function counterpartRole(
  mode: MessageMode,
  conversation: ConversationSummary | ConversationDetail,
): string {
  if (conversation.kind === 'Staffroom') return 'Group chat';
  if (conversation.kind === 'StaffDirect' || conversation.kind === 'StudentDirect') {
    return otherDirectParticipant(conversation)?.role ?? 'Contact';
  }
  if (mode === 'parent' || mode === 'supervisor') return conversation.admin?.role ?? 'Staff';
  return conversation.kind === 'SupervisorHead' ? 'Supervisor' : 'Parent';
}

function submitFormOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
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
      className={active ? 'message-thread-row is-active' : 'message-thread-row'}
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

function NewConversationComposer({
  kind,
  onCreated,
  recipients,
  recipientsLoading,
}: {
  kind: ConversationKind;
  onCreated: (conversationId: string) => void;
  recipients: Recipient[];
  recipientsLoading: boolean;
}) {
  const utils = api.useUtils();
  const [adminId, setAdminId] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const openConversation = api.message.openConversation.useMutation({
    onError(error) {
      showErrorToast(error, 'Message could not be started.');
    },
  });
  const sendMessage = api.message.sendInConversation.useMutation({
    onError(error) {
      showErrorToast(error, 'Message could not be sent.');
    },
  });

  useEffect(() => {
    if (!adminId && recipients[0]) setAdminId(recipients[0].id);
  }, [adminId, recipients]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!adminId || !trimmedBody) {
      setError('Recipient and message are required.');
      return;
    }

    setError(null);
    try {
      const conversation = await openConversation.mutateAsync({ recipientId: adminId, kind });
      await sendMessage.mutateAsync({ conversationId: conversation.id, body: trimmedBody });
      setBody('');
      await utils.message.listConversations.invalidate();
      onCreated(conversation.id);
      showSuccessToast('Message sent.');
    } catch {
      // The mutation error is shown in a toast and inline below the form.
    }
  }

  const pending = openConversation.isPending || sendMessage.isPending;

  return (
    <section className="panel panel__body message-new-thread" aria-labelledby="new-message-title">
      <div className="section-title">
        <div>
          <h2 id="new-message-title">New Message</h2>
          <p className="muted">
            Start a private message with{' '}
            {kind === 'ParentStaff'
              ? 'the centre team'
              : kind === 'StudentDirect'
                ? 'a student, the Head, or the Pastor'
                : kind === 'SupervisorHead'
                  ? 'the Head team'
                  : 'another staff member'}
          </p>
        </div>
      </div>
      <form
        className="message-form"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Field label="Recipient" required>
          <SelectInput
            aria-label="Message recipient"
            disabled={pending || recipientsLoading || recipients.length === 0}
            onChange={(event) => {
              setAdminId(event.target.value);
            }}
            required
            value={adminId}
          >
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.fullName}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Message" required>
          <textarea
            className="input textarea"
            maxLength={4000}
            onKeyDown={submitFormOnEnter}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            placeholder="Write your message..."
            required
            rows={5}
            value={body}
          />
        </Field>
        <Button disabled={recipients.length === 0} pending={pending} type="submit">
          <MessageSquarePlus aria-hidden="true" size={16} />
          Send Message
        </Button>
        {recipients.length === 0 && !recipientsLoading ? (
          <p className="status--error">No message recipients are currently available.</p>
        ) : null}
        {error ? <p className="status--error">{error}</p> : null}
        {openConversation.error ? (
          <p className="status--error">{friendlyErrorMessage(openConversation.error)}</p>
        ) : null}
        {sendMessage.error ? (
          <p className="status--error">{friendlyErrorMessage(sendMessage.error)}</p>
        ) : null}
      </form>
    </section>
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

export function MessageCentre({ mode }: MessageCentreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const conversationKind = conversationKindByMode[mode];
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(null);
  const [staffroomRequested, setStaffroomRequested] = useState(false);
  const [conversationCursor, setConversationCursor] = useState<string | undefined>(undefined);
  const [conversationPages, setConversationPages] = useState<LoadedConversationPage[]>([]);
  const conversationsQuery = api.message.listConversations.useQuery(
    { limit: CONVERSATION_PAGE_SIZE, cursor: conversationCursor },
    { retry: false },
  );
  const openStaffroom = api.message.openStaffroom.useMutation();
  const recipientsQuery = api.message.listRecipients.useQuery(
    conversationKind ? { kind: conversationKind } : undefined,
    {
      enabled: Boolean(conversationKind),
      retry: false,
    },
  );
  const conversations = useMemo(
    () => conversationPages.flatMap(({ page }) => page.items),
    [conversationPages],
  );
  const nextConversationCursor =
    conversationPages[conversationPages.length - 1]?.page.nextCursor ?? null;
  const queryConversationId = searchParams?.get('conversationId') ?? null;
  const queryThreadId = searchParams?.get('threadId') ?? null;
  const selectedConversationId = useMemo(() => {
    if (
      selectedOverrideId &&
      conversations.some((conversation) => conversation.id === selectedOverrideId)
    ) {
      return selectedOverrideId;
    }
    if (
      queryConversationId &&
      conversations.some((conversation) => conversation.id === queryConversationId)
    ) {
      return queryConversationId;
    }
    if (queryThreadId) {
      return (
        conversations.find((conversation) => conversation.threadIds.includes(queryThreadId))?.id ??
        null
      );
    }
    return conversations[0]?.id ?? null;
  }, [conversations, queryConversationId, queryThreadId, selectedOverrideId]);
  const selectedSummary =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const conversationQuery = api.message.listConversationMessages.useQuery(
    { conversationId: selectedConversationId ?? '' },
    { enabled: Boolean(selectedConversationId), retry: false },
  );
  const selectedConversation = conversationQuery.data ?? null;
  const currentUserId = selectedConversation?.currentUserId ?? null;
  const pageCopy = copy[mode];
  const unreadTotal = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  );

  useEffect(() => {
    if (!conversationsQuery.data) return;
    setConversationPages((currentPages) => {
      const nextPage = { cursor: conversationCursor, page: conversationsQuery.data };
      if (!conversationCursor) return [nextPage];
      const existingIndex = currentPages.findIndex((page) => page.cursor === conversationCursor);
      if (existingIndex === -1) return [...currentPages, nextPage];
      return currentPages.map((page, index) => (index === existingIndex ? nextPage : page));
    });
  }, [conversationCursor, conversationsQuery.data]);

  useEffect(() => {
    if (
      mode === 'parent' ||
      mode === 'student' ||
      staffroomRequested ||
      conversationsQuery.isLoading
    ) {
      return;
    }
    if (conversations.some((conversation) => conversation.kind === 'Staffroom')) return;

    setStaffroomRequested(true);
    openStaffroom.mutate(undefined, {
      onSuccess: () => {
        setConversationCursor(undefined);
        setConversationPages([]);
        void utils.message.listConversations.invalidate();
      },
    });
  }, [
    mode,
    openStaffroom,
    staffroomRequested,
    conversations,
    conversationsQuery.isLoading,
    utils.message.listConversations,
  ]);

  useEffect(() => {
    if (!selectedConversation) return;
    const selectedConversationUnreadCount = selectedConversation.messages.filter(
      (message) =>
        message.senderId !== selectedConversation.currentUserId && !message.readByCurrentUser,
    ).length;
    if (selectedSummary?.unreadCount && selectedConversationUnreadCount === 0) {
      setConversationPages((pages) =>
        pages.map((loadedPage) => ({
          ...loadedPage,
          page: {
            ...loadedPage.page,
            items: loadedPage.page.items.map((conversation) =>
              conversation.id === selectedConversation.id
                ? {
                    ...conversation,
                    latestMessage: conversation.latestMessage
                      ? { ...conversation.latestMessage, readByCurrentUser: true }
                      : null,
                    unreadCount: 0,
                  }
                : conversation,
            ),
          },
        })),
      );
      router.refresh();
    }
    void utils.message.listConversations.invalidate();
  }, [router, selectedConversation, selectedSummary?.unreadCount, utils.message.listConversations]);

  function conversationHref(conversationId: string) {
    const encodedConversationId = encodeURIComponent(conversationId);
    if (mode === 'parent') return `/parent/messages?conversationId=${encodedConversationId}`;
    if (mode === 'supervisor') {
      return `/supervisor/messages?conversationId=${encodedConversationId}`;
    }
    if (mode === 'student') return `/student/messages?conversationId=${encodedConversationId}`;
    return `/admin/messages?conversationId=${encodedConversationId}`;
  }

  function selectConversation(conversationId: string) {
    setSelectedOverrideId(conversationId);
    window.history.replaceState(null, '', conversationHref(conversationId));
  }

  async function refreshSelectedConversation() {
    setConversationCursor(undefined);
    setConversationPages([]);
    await utils.message.listConversations.invalidate();
    if (selectedConversationId) {
      await utils.message.listConversationMessages.invalidate({
        conversationId: selectedConversationId,
      });
    }
  }

  function loadMoreConversations() {
    if (!nextConversationCursor) return;
    setConversationCursor(nextConversationCursor);
  }

  const conversationListLoading = conversationsQuery.isLoading && conversations.length === 0;

  return (
    <div className="messages-page">
      <div className="dashboard-hero">
        <p>{pageCopy.eyebrow}</p>
        <h1>{pageCopy.heading}</h1>
        <span>{pageCopy.sub}</span>
      </div>

      {conversationKind ? (
        <NewConversationComposer
          kind={conversationKind}
          onCreated={selectConversation}
          recipients={recipientsQuery.data ?? []}
          recipientsLoading={recipientsQuery.isLoading}
        />
      ) : null}
      {recipientsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(recipientsQuery.error)}</p>
      ) : null}

      <div className="messages-layout">
        <section className="panel message-thread-list-panel" aria-labelledby="message-list-title">
          <div className="message-panel-header">
            <h2 id="message-list-title">{pageCopy.conversationListLabel}</h2>
            <span>
              {unreadTotal > 0 ? `${String(unreadTotal)} unread` : String(conversations.length)}
            </span>
          </div>
          {conversationListLoading ? <EmptyState>Loading messages...</EmptyState> : null}
          {conversationsQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(conversationsQuery.error)}</p>
          ) : null}
          {!conversationListLoading && conversations.length === 0 ? (
            <EmptyState detail={pageCopy.emptyDetail} title={pageCopy.emptyTitle} />
          ) : null}
          <div className="message-thread-list" aria-label={pageCopy.conversationListLabel}>
            {conversations.map((conversation) => (
              <ConversationRow
                active={conversation.id === selectedConversationId}
                conversation={conversation}
                key={conversation.id}
                mode={mode}
                onSelect={selectConversation}
              />
            ))}
          </div>
          {nextConversationCursor ? (
            <div className="message-list-pagination">
              <Button
                disabled={conversationsQuery.isFetching}
                onClick={loadMoreConversations}
                type="button"
                variant="secondary"
              >
                Load more
              </Button>
            </div>
          ) : null}
        </section>

        <section className="panel panel__body message-detail-panel">
          {selectedSummary ? (
            <div className="message-detail-header">
              <div>
                <p>{counterpartRole(mode, selectedSummary)}</p>
                <h2>{counterpartLabel(mode, selectedSummary)}</h2>
                <span>
                  {selectedSummary.messageCount === 1
                    ? '1 message'
                    : `${String(selectedSummary.messageCount)} messages`}
                </span>
              </div>
            </div>
          ) : null}

          {conversationQuery.isLoading ? <EmptyState>Loading messages...</EmptyState> : null}
          {conversationQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(conversationQuery.error)}</p>
          ) : null}
          {!selectedConversationId && !conversationListLoading ? (
            <EmptyState detail={pageCopy.emptyDetail} title={pageCopy.emptyTitle} />
          ) : null}
          {selectedConversation && selectedConversation.messages.length === 0 ? (
            <EmptyState
              detail="Messages in this conversation will appear here."
              title="No messages yet"
            />
          ) : null}
          {selectedConversation ? (
            <>
              <div className="message-bubble-list" aria-label="Conversation messages">
                {selectedConversation.messages.map((message) => (
                  <MessageBubble currentUserId={currentUserId} key={message.id} message={message} />
                ))}
              </div>
              <ReplyComposer
                conversationId={selectedConversation.id}
                disabled={conversationQuery.isLoading}
                onSent={() => {
                  void refreshSelectedConversation();
                }}
                placeholder={pageCopy.replyPlaceholder}
              />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
