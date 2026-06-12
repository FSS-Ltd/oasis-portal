'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { Hash, Lock, MessageCircle, Send, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyErrorMessage, showErrorToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  countLabel,
  formatCommunityDateTime,
  formatCommunityTime,
  type CommunityGroup,
  type CommunityMessage,
} from './community-types';

interface PendingMessage {
  id: string;
  body: string;
  createdAt: Date;
  status: 'Sending' | 'Sent';
}

interface TypingPayload {
  studentId: string;
  occurredAt: string;
}

function isTypingPayload(value: unknown): value is TypingPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.studentId === 'string' && typeof payload.occurredAt === 'string';
}

function groupMeta(group: CommunityGroup): string {
  const parts = [
    countLabel(group.memberCount, 'member'),
    countLabel(group.messageCount, 'message'),
  ];
  if (!group.isPublic) parts.push('Invite only');
  if (!group.active) parts.push('Disabled');
  return parts.join(' · ');
}

function messageStatus(message: CommunityMessage): string {
  if (message.readByOtherStudents && message.latestReadAtByOtherStudent) {
    return `Read ${formatCommunityTime(message.latestReadAtByOtherStudent)}`;
  }
  return 'Delivered';
}

function GroupButton({
  active,
  group,
  onSelect,
}: {
  active: boolean;
  group: CommunityGroup;
  onSelect: (groupId: string) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={active ? 'community-group-row is-active' : 'community-group-row'}
      onClick={() => {
        onSelect(group.id);
      }}
      type="button"
    >
      <span className="community-group-row__icon">
        {group.isCentral ? (
          <MessageCircle aria-hidden="true" size={17} />
        ) : (
          <Hash aria-hidden="true" size={17} />
        )}
      </span>
      <span>
        <strong>{group.title}</strong>
        <small>{groupMeta(group)}</small>
      </span>
      {!group.joined ? <b>Join</b> : null}
    </button>
  );
}

function MessageBubble({
  currentStudentId,
  message,
}: {
  currentStudentId: string;
  message: CommunityMessage;
}) {
  const mine = message.senderStudentId === currentStudentId;
  return (
    <article className={mine ? 'community-message is-mine' : 'community-message'}>
      <header>
        <strong>{mine ? 'You' : message.sender.fullName}</strong>
        <time>{formatCommunityDateTime(message.createdAt)}</time>
      </header>
      <p>{message.body}</p>
      {mine ? <footer>{messageStatus(message)}</footer> : null}
    </article>
  );
}

function PendingBubble({ message }: { message: PendingMessage }) {
  return (
    <article className="community-message is-mine is-pending">
      <header>
        <strong>You</strong>
        <time>{formatCommunityDateTime(message.createdAt)}</time>
      </header>
      <p>{message.body}</p>
      <footer>{message.status}</footer>
    </article>
  );
}

function TypingBubble() {
  return (
    <div className="community-typing" aria-live="polite" aria-label="Someone is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

export function StudentCommunityClient() {
  const { session } = useSession();
  const utils = api.useUtils();
  const groupsQuery = api.community.listStudentGroups.useQuery(undefined, { retry: false });
  const groups = groupsQuery.data?.groups ?? [];
  const currentStudentId = groupsQuery.data?.currentStudentId ?? null;
  const blocked = groupsQuery.data?.communityMessagingBlocked ?? false;
  const blockedReason = groupsQuery.data?.communityMessagingBlockedReason ?? null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const activeGroupId = selectedGroup?.id ?? null;
  const [body, setBody] = useState('');
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [typingUntil, setTypingUntil] = useState(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const lastTypingSentAtRef = useRef(0);

  const supabase = useMemo(
    () =>
      createClient({
        accessToken: async () => session?.getToken() ?? null,
      }),
    [session],
  );

  const messagesQuery = api.community.listGroupMessages.useQuery(
    { groupId: activeGroupId ?? '' },
    {
      enabled: Boolean(activeGroupId && selectedGroup?.joined),
      retry: false,
    },
  );

  const joinGroup = api.community.joinGroup.useMutation({
    onError(error) {
      showErrorToast(error, 'Community group could not be joined.');
    },
    async onSuccess() {
      await utils.community.listStudentGroups.invalidate();
      if (activeGroupId) {
        await utils.community.listGroupMessages.invalidate({ groupId: activeGroupId });
      }
    },
  });

  const sendMessage = api.community.sendMessage.useMutation({
    onError(error) {
      showErrorToast(error, 'Community message could not be sent.');
    },
  });

  useEffect(() => {
    if (!selectedGroupId && groups[0]) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (!activeGroupId || !currentStudentId) return;

    const channel = supabase.channel(`oasis:community:${activeGroupId}`, {
      config: { private: true },
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!isTypingPayload(payload) || payload.studentId === currentStudentId) return;
      const nextTypingUntil = Date.now() + 3000;
      setTypingUntil(nextTypingUntil);
      window.setTimeout(() => {
        setTypingUntil((current) => (current <= Date.now() ? 0 : current));
      }, 3200);
    });

    channel.subscribe();

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [activeGroupId, currentStudentId, supabase]);

  function sendTypingEvent() {
    if (!currentStudentId) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 1000) return;
    lastTypingSentAtRef.current = now;
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        studentId: currentStudentId,
        occurredAt: new Date().toISOString(),
      },
    });
  }

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setBody(event.target.value);
    sendTypingEvent();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!activeGroupId || !trimmedBody) return;

    const pendingId = `pending-${Date.now().toString()}`;
    const pendingMessage: PendingMessage = {
      id: pendingId,
      body: trimmedBody,
      createdAt: new Date(),
      status: 'Sending',
    };
    setPendingMessages((current) => [...current, pendingMessage]);
    window.setTimeout(() => {
      setPendingMessages((current) =>
        current.map((message) =>
          message.id === pendingId ? { ...message, status: 'Sent' } : message,
        ),
      );
    }, 250);
    setBody('');

    try {
      await sendMessage.mutateAsync({ groupId: activeGroupId, body: trimmedBody });
      setPendingMessages((current) => current.filter((message) => message.id !== pendingId));
      await utils.community.listStudentGroups.invalidate();
      await utils.community.listGroupMessages.invalidate({ groupId: activeGroupId });
    } catch {
      setPendingMessages((current) => current.filter((message) => message.id !== pendingId));
    }
  }

  const messages = messagesQuery.data?.messages ?? [];
  const groupPendingMessages = activeGroupId ? pendingMessages : [];
  const typingVisible = typingUntil > Date.now();
  const composerDisabled = blocked || !selectedGroup?.joined || sendMessage.isPending;

  if (groupsQuery.isLoading) {
    return <div className="student-inline-state">Loading community...</div>;
  }

  if (groupsQuery.error) {
    return (
      <EmptyState detail={friendlyErrorMessage(groupsQuery.error)} title="Community unavailable" />
    );
  }

  return (
    <div className="student-page community-page">
      <section className="student-hero community-hero">
        <div className="student-hero__identity">
          <span className="student-hero__icon" aria-hidden="true">
            <UsersRound size={24} />
          </span>
          <div>
            <p>Student Community</p>
            <h1>Community</h1>
            <span>Text-only groups for Oasis students</span>
          </div>
        </div>
      </section>

      <div className="community-layout">
        <section className="panel community-group-panel" aria-labelledby="community-groups-title">
          <div className="message-panel-header">
            <h2 id="community-groups-title">Groups</h2>
            <span>{String(groups.length)}</span>
          </div>
          <div className="community-group-list">
            {groups.map((group) => (
              <GroupButton
                active={group.id === activeGroupId}
                group={group}
                key={group.id}
                onSelect={setSelectedGroupId}
              />
            ))}
          </div>
        </section>

        <section className="panel panel__body community-chat-panel" aria-live="polite">
          {selectedGroup ? (
            <div className="community-chat-header">
              <div>
                <p>{selectedGroup.isCentral ? 'Central space' : 'Group chat'}</p>
                <h2>{selectedGroup.title}</h2>
                <span>{selectedGroup.description ?? groupMeta(selectedGroup)}</span>
              </div>
              {!selectedGroup.joined ? (
                <Button
                  onClick={() => {
                    void joinGroup.mutateAsync({ groupId: selectedGroup.id });
                  }}
                  pending={joinGroup.isPending}
                  size="sm"
                  type="button"
                >
                  Join Group
                </Button>
              ) : null}
            </div>
          ) : null}

          {!selectedGroup ? (
            <EmptyState detail="Community groups will appear here." title="No groups yet" />
          ) : null}

          {selectedGroup && !selectedGroup.joined ? (
            <EmptyState
              detail="Join this group to read and send messages."
              title="Join the group"
            />
          ) : null}

          {messagesQuery.isLoading ? <EmptyState title="Loading messages..." /> : null}
          {messagesQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(messagesQuery.error)}</p>
          ) : null}

          {selectedGroup?.joined ? (
            <>
              <div className="community-message-list" aria-label="Community messages">
                {messages.map((message) => (
                  <MessageBubble
                    currentStudentId={currentStudentId ?? ''}
                    key={message.id}
                    message={message}
                  />
                ))}
                {groupPendingMessages.map((message) => (
                  <PendingBubble key={message.id} message={message} />
                ))}
                {typingVisible ? <TypingBubble /> : null}
              </div>

              {blocked ? (
                <div className="community-blocked-state">
                  <Lock aria-hidden="true" size={16} />
                  <span>
                    {blockedReason ?? 'Messaging is disabled for your account right now.'}
                  </span>
                </div>
              ) : null}

              <form
                className="community-composer"
                onSubmit={(event) => {
                  void submit(event);
                }}
              >
                <textarea
                  aria-label="Community message"
                  className="input textarea"
                  disabled={composerDisabled}
                  maxLength={2000}
                  onChange={handleBodyChange}
                  placeholder={blocked ? 'Messaging disabled' : 'Message'}
                  rows={2}
                  value={body}
                />
                <Button
                  aria-label="Send community message"
                  disabled={composerDisabled || body.trim().length === 0}
                  type="submit"
                >
                  <Send aria-hidden="true" size={16} />
                </Button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
