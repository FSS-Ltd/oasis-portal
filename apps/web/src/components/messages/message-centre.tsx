'use client';

import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquarePlus, Send } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

type MessageMode = 'admin' | 'parent' | 'supervisor';
type ThreadKind = 'ParentStaff' | 'SupervisorHead' | 'StaffDirect';
type ThreadSummary = RouterOutputs['message']['listThreads'][number];
type ThreadDetail = RouterOutputs['message']['listInThread'];
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
    emptyDetail: 'Start a staff thread or open the staffroom.',
    replyPlaceholder: 'Type your reply...',
    threadListLabel: 'Staff message threads',
  },
  parent: {
    eyebrow: 'Centre communications',
    heading: 'Messages',
    sub: 'Message the centre team from your parent portal.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Start a message thread with the centre team.',
    replyPlaceholder: 'Type your message...',
    threadListLabel: 'Your message threads',
  },
  supervisor: {
    eyebrow: 'Staff communications',
    heading: 'Messages',
    sub: 'Message colleagues privately or use the staffroom.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Start a staff thread or open the staffroom.',
    replyPlaceholder: 'Type your message...',
    threadListLabel: 'Your message threads',
  },
} as const;

const threadKindByMode: Record<MessageMode, ThreadKind | null> = {
  admin: 'StaffDirect',
  parent: 'ParentStaff',
  supervisor: 'StaffDirect',
};

const messageDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatDateTime(value: Date | string): string {
  return messageDateTimeFormatter.format(new Date(value));
}

function otherStaffParticipant(thread: ThreadSummary | ThreadDetail) {
  return thread.participants.find((participant) => participant.id !== thread.currentUserId);
}

function counterpartLabel(mode: MessageMode, thread: ThreadSummary | ThreadDetail): string {
  if (thread.kind === 'Staffroom') return 'Staffroom';
  if (thread.kind === 'StaffDirect') {
    return otherStaffParticipant(thread)?.fullName ?? 'Staff member';
  }
  if (mode === 'parent' || mode === 'supervisor') return thread.admin?.fullName ?? 'Staff member';
  return thread.kind === 'SupervisorHead'
    ? (thread.supervisor?.fullName ?? 'Supervisor')
    : (thread.parent?.fullName ?? 'Parent');
}

function counterpartRole(mode: MessageMode, thread: ThreadSummary | ThreadDetail): string {
  if (thread.kind === 'Staffroom') return 'Group chat';
  if (thread.kind === 'StaffDirect') {
    return otherStaffParticipant(thread)?.role ?? 'Staff';
  }
  if (mode === 'parent' || mode === 'supervisor') return thread.admin?.role ?? 'Staff';
  return thread.kind === 'SupervisorHead' ? 'Supervisor' : 'Parent';
}

function submitFormOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function ThreadRow({
  active,
  mode,
  onSelect,
  thread,
}: {
  active: boolean;
  mode: MessageMode;
  onSelect: (threadId: string) => void;
  thread: ThreadSummary;
}) {
  const latest = thread.latestMessage;

  return (
    <button
      aria-pressed={active}
      className={active ? 'message-thread-row is-active' : 'message-thread-row'}
      onClick={() => {
        onSelect(thread.id);
      }}
      type="button"
    >
      <span>
        <strong>{counterpartLabel(mode, thread)}</strong>
        <small>{counterpartRole(mode, thread)}</small>
      </span>
      <span className="message-thread-row__meta">
        {latest ? formatDateTime(latest.createdAt) : formatDateTime(thread.createdAt)}
      </span>
      <em>{thread.subject}</em>
      <span className="message-thread-row__footer">
        <small>
          {thread.messageCount === 1 ? '1 message' : `${String(thread.messageCount)} messages`}
        </small>
        {thread.unreadCount > 0 ? (
          <b aria-label={`${String(thread.unreadCount)} unread messages`}>
            {thread.unreadCount > 99 ? '99+' : String(thread.unreadCount)}
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
  message: ThreadDetail['messages'][number];
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

function NewThreadComposer({
  kind,
  onCreated,
  recipients,
  recipientsLoading,
}: {
  kind: ThreadKind;
  onCreated: (threadId: string) => void;
  recipients: Recipient[];
  recipientsLoading: boolean;
}) {
  const utils = api.useUtils();
  const [adminId, setAdminId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const openThread = api.message.openThread.useMutation({
    onError(error) {
      showErrorToast(error, 'Message thread could not be started.');
    },
  });
  const sendMessage = api.message.send.useMutation({
    onError(error) {
      showErrorToast(error, 'Message could not be sent.');
    },
  });

  useEffect(() => {
    if (!adminId && recipients[0]) setAdminId(recipients[0].id);
  }, [adminId, recipients]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!adminId || !trimmedSubject || !trimmedBody) {
      setError('Recipient, subject, and message are required.');
      return;
    }

    setError(null);
    try {
      const thread = await openThread.mutateAsync({ adminId, kind, subject: trimmedSubject });
      await sendMessage.mutateAsync({ threadId: thread.id, body: trimmedBody });
      setSubject('');
      setBody('');
      await utils.message.listThreads.invalidate();
      onCreated(thread.id);
      showSuccessToast('Message sent.');
    } catch {
      // The mutation error is shown in a toast and inline below the form.
    }
  }

  const pending = openThread.isPending || sendMessage.isPending;

  return (
    <section className="panel panel__body message-new-thread" aria-labelledby="new-message-title">
      <div className="section-title">
        <div>
          <h2 id="new-message-title">New Message</h2>
          <p className="muted">
            Start a private thread with{' '}
            {kind === 'ParentStaff'
              ? 'the centre team'
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
        <Field label="Subject" required>
          <TextInput
            maxLength={160}
            onChange={(event) => {
              setSubject(event.target.value);
            }}
            placeholder="What is this about?"
            required
            value={subject}
          />
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
          Start Thread
        </Button>
        {recipients.length === 0 && !recipientsLoading ? (
          <p className="status--error">No message recipients are currently available.</p>
        ) : null}
        {error ? <p className="status--error">{error}</p> : null}
        {openThread.error ? (
          <p className="status--error">{friendlyErrorMessage(openThread.error)}</p>
        ) : null}
        {sendMessage.error ? (
          <p className="status--error">{friendlyErrorMessage(sendMessage.error)}</p>
        ) : null}
      </form>
    </section>
  );
}

function ReplyComposer({
  disabled,
  onSent,
  placeholder,
  threadId,
}: {
  disabled: boolean;
  onSent: () => void;
  placeholder: string;
  threadId: string;
}) {
  const [body, setBody] = useState('');
  const sendMessage = api.message.send.useMutation({
    onError(error) {
      showErrorToast(error, 'Message could not be sent.');
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    try {
      await sendMessage.mutateAsync({ threadId, body: trimmedBody });
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
  const threadKind = threadKindByMode[mode];
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(null);
  const [staffroomRequested, setStaffroomRequested] = useState(false);
  const threadsQuery = api.message.listThreads.useQuery(undefined, { retry: false });
  const openStaffroom = api.message.openStaffroom.useMutation();
  const recipientsQuery = api.message.listRecipients.useQuery(
    threadKind ? { kind: threadKind } : undefined,
    {
      enabled: Boolean(threadKind),
      retry: false,
    },
  );
  const threads = threadsQuery.data ?? [];
  const queryThreadId = searchParams?.get('threadId') ?? null;
  const selectedThreadId = useMemo(() => {
    if (selectedOverrideId && threads.some((thread) => thread.id === selectedOverrideId)) {
      return selectedOverrideId;
    }
    if (queryThreadId && threads.some((thread) => thread.id === queryThreadId)) {
      return queryThreadId;
    }
    return threads[0]?.id ?? null;
  }, [queryThreadId, selectedOverrideId, threads]);
  const selectedSummary = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const threadQuery = api.message.listInThread.useQuery(
    { threadId: selectedThreadId ?? '' },
    { enabled: Boolean(selectedThreadId), retry: false },
  );
  const selectedThread = threadQuery.data ?? null;
  const currentUserId = selectedThread?.currentUserId ?? null;
  const pageCopy = copy[mode];
  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  useEffect(() => {
    if (mode === 'parent' || staffroomRequested || threadsQuery.isLoading) return;
    if (threads.some((thread) => thread.kind === 'Staffroom')) return;

    setStaffroomRequested(true);
    openStaffroom.mutate(undefined, {
      onSuccess: () => {
        void utils.message.listThreads.invalidate();
      },
    });
  }, [
    mode,
    openStaffroom,
    staffroomRequested,
    threads,
    threadsQuery.isLoading,
    utils.message.listThreads,
  ]);

  useEffect(() => {
    if (!selectedThread) return;
    const selectedThreadUnreadCount = selectedThread.messages.filter(
      (message) => message.senderId !== selectedThread.currentUserId && !message.readByCurrentUser,
    ).length;
    if (selectedSummary?.unreadCount && selectedThreadUnreadCount === 0) {
      utils.message.listThreads.setData(undefined, (currentThreads) =>
        currentThreads?.map((thread) =>
          thread.id === selectedThread.id
            ? {
                ...thread,
                latestMessage: thread.latestMessage
                  ? { ...thread.latestMessage, readByCurrentUser: true }
                  : null,
                unreadCount: 0,
              }
            : thread,
        ),
      );
      router.refresh();
    }
    void utils.message.listThreads.invalidate();
  }, [router, selectedSummary?.unreadCount, selectedThread, utils.message.listThreads]);

  function selectThread(threadId: string) {
    setSelectedOverrideId(threadId);
    const encodedThreadId = encodeURIComponent(threadId);
    const href =
      mode === 'parent'
        ? `/parent/messages?threadId=${encodedThreadId}`
        : mode === 'supervisor'
          ? `/supervisor/messages?threadId=${encodedThreadId}`
          : `/admin/messages?threadId=${encodedThreadId}`;
    window.history.replaceState(null, '', href);
  }

  async function refreshSelectedThread() {
    await utils.message.listThreads.invalidate();
    if (selectedThreadId) {
      await utils.message.listInThread.invalidate({ threadId: selectedThreadId });
    }
  }

  return (
    <div className="messages-page">
      <div className="dashboard-hero">
        <p>{pageCopy.eyebrow}</p>
        <h1>{pageCopy.heading}</h1>
        <span>{pageCopy.sub}</span>
      </div>

      {threadKind ? (
        <NewThreadComposer
          kind={threadKind}
          onCreated={selectThread}
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
            <h2 id="message-list-title">{pageCopy.threadListLabel}</h2>
            <span>
              {unreadTotal > 0 ? `${String(unreadTotal)} unread` : String(threads.length)}
            </span>
          </div>
          {threadsQuery.isLoading ? <EmptyState>Loading messages...</EmptyState> : null}
          {threadsQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(threadsQuery.error)}</p>
          ) : null}
          {!threadsQuery.isLoading && threads.length === 0 ? (
            <EmptyState detail={pageCopy.emptyDetail} title={pageCopy.emptyTitle} />
          ) : null}
          <div className="message-thread-list" aria-label={pageCopy.threadListLabel}>
            {threads.map((thread) => (
              <ThreadRow
                active={thread.id === selectedThreadId}
                key={thread.id}
                mode={mode}
                onSelect={selectThread}
                thread={thread}
              />
            ))}
          </div>
        </section>

        <section className="panel panel__body message-detail-panel">
          {selectedSummary ? (
            <div className="message-detail-header">
              <div>
                <p>{counterpartRole(mode, selectedSummary)}</p>
                <h2>{counterpartLabel(mode, selectedSummary)}</h2>
                <span>{selectedSummary.subject}</span>
              </div>
            </div>
          ) : null}

          {threadQuery.isLoading ? <EmptyState>Loading thread...</EmptyState> : null}
          {threadQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(threadQuery.error)}</p>
          ) : null}
          {!selectedThreadId && !threadsQuery.isLoading ? (
            <EmptyState detail={pageCopy.emptyDetail} title={pageCopy.emptyTitle} />
          ) : null}
          {selectedThread && selectedThread.messages.length === 0 ? (
            <EmptyState detail="Messages in this thread will appear here." title="No replies yet" />
          ) : null}
          {selectedThread ? (
            <>
              <div className="message-bubble-list" aria-label="Message thread">
                {selectedThread.messages.map((message) => (
                  <MessageBubble currentUserId={currentUserId} key={message.id} message={message} />
                ))}
              </div>
              <ReplyComposer
                disabled={threadQuery.isLoading}
                onSent={() => {
                  void refreshSelectedThread();
                }}
                placeholder={pageCopy.replyPlaceholder}
                threadId={selectedThread.id}
              />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
