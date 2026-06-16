'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { friendlyErrorMessage, showErrorToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { MessageContactList } from './message-contact-list';
import { MessageConversationPanel } from './message-conversation-panel';
import type { ConversationKind, LoadedConversationPage, MessageMode } from './message-types';

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
    conversationListLabel: 'Your contacts',
  },
  supervisor: {
    eyebrow: 'Staff communications',
    heading: 'Messages',
    sub: 'Message colleagues privately or use the staffroom.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Start a staff message or open the staffroom.',
    replyPlaceholder: 'Type your message...',
    conversationListLabel: 'Your contacts',
  },
  student: {
    eyebrow: 'Student communications',
    heading: 'Messages',
    sub: 'Message other students, the Head, or the Pastor.',
    emptyTitle: 'No messages yet',
    emptyDetail: 'Choose a contact and send your first message.',
    replyPlaceholder: 'Type your message...',
    conversationListLabel: 'Your contacts',
  },
} as const;

const conversationKindByMode: Record<MessageMode, ConversationKind | null> = {
  admin: 'StaffDirect',
  parent: 'ParentStaff',
  supervisor: 'StaffDirect',
  student: 'StudentDirect',
};

const CONVERSATION_PAGE_SIZE = 50;

export function MessageCentre({ mode }: MessageCentreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const conversationKind = conversationKindByMode[mode];
  const pageCopy = copy[mode];
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [openingRecipientId, setOpeningRecipientId] = useState<string | null>(null);
  const [staffroomRequested, setStaffroomRequested] = useState(false);
  const [conversationCursor, setConversationCursor] = useState<string | undefined>(undefined);
  const [conversationPages, setConversationPages] = useState<LoadedConversationPage[]>([]);
  const conversationsQuery = api.message.listConversations.useQuery(
    { limit: CONVERSATION_PAGE_SIZE, cursor: conversationCursor },
    { retry: false },
  );
  const openStaffroom = api.message.openStaffroom.useMutation({
    onError(error) {
      showErrorToast(error, 'Staffroom could not be opened.');
    },
  });
  const openConversation = api.message.openConversation.useMutation({
    onError(error) {
      showErrorToast(error, 'Conversation could not be opened.');
    },
  });
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
  const queryThreadConversationId = queryThreadId
    ? (conversations.find((conversation) => conversation.threadIds.includes(queryThreadId))?.id ??
      null)
    : null;
  const selectedConversationId =
    selectedOverrideId ?? queryConversationId ?? queryThreadConversationId;
  const selectedSummary =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const conversationQuery = api.message.listConversationMessages.useQuery(
    { conversationId: selectedConversationId ?? '' },
    { enabled: Boolean(selectedConversationId), retry: false },
  );
  const selectedConversation = conversationQuery.data ?? null;
  const unreadTotal = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  );
  const contactListLoading =
    (conversationsQuery.isLoading && conversations.length === 0) ||
    Boolean(conversationKind && recipientsQuery.isLoading && !recipientsQuery.data);

  const resetConversationPages = useCallback(() => {
    setConversationCursor(undefined);
    setConversationPages([]);
  }, []);

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
        resetConversationPages();
        void utils.message.listConversations.invalidate();
      },
    });
  }, [
    mode,
    openStaffroom,
    staffroomRequested,
    conversations,
    conversationsQuery.isLoading,
    resetConversationPages,
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

  useEffect(() => {
    if (selectedSummary) setSelectedRecipientId(null);
  }, [selectedSummary]);

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
    setSelectedRecipientId(null);
    setSelectedOverrideId(conversationId);
    window.history.replaceState(null, '', conversationHref(conversationId));
  }

  async function selectRecipient(recipientId: string) {
    if (!conversationKind || openingRecipientId) return;

    setOpeningRecipientId(recipientId);
    setSelectedRecipientId(recipientId);
    try {
      const conversation = await openConversation.mutateAsync({
        kind: conversationKind,
        recipientId,
      });
      setSelectedOverrideId(conversation.id);
      window.history.replaceState(null, '', conversationHref(conversation.id));
      resetConversationPages();
      await utils.message.listConversations.invalidate();
      await utils.message.listConversationMessages.invalidate({ conversationId: conversation.id });
    } catch {
      setSelectedRecipientId(null);
      // The mutation error is shown in a toast by the mutation handler.
    } finally {
      setOpeningRecipientId(null);
    }
  }

  async function refreshSelectedConversation() {
    resetConversationPages();
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

  return (
    <div className="messages-page">
      <div className="dashboard-hero">
        <p>{pageCopy.eyebrow}</p>
        <h1>{pageCopy.heading}</h1>
        <span>{pageCopy.sub}</span>
      </div>

      <div className="messages-layout">
        <MessageContactList
          conversationError={
            conversationsQuery.error ? friendlyErrorMessage(conversationsQuery.error) : null
          }
          conversationKind={conversationKind}
          conversations={conversations}
          emptyDetail={pageCopy.emptyDetail}
          emptyTitle={pageCopy.emptyTitle}
          fetchingMore={conversationsQuery.isFetching}
          label={pageCopy.conversationListLabel}
          loading={contactListLoading}
          mode={mode}
          nextConversationCursor={nextConversationCursor}
          onLoadMore={loadMoreConversations}
          onSelectConversation={selectConversation}
          onSelectRecipient={(recipientId) => {
            void selectRecipient(recipientId);
          }}
          openingRecipientId={openingRecipientId}
          recipients={recipientsQuery.data ?? []}
          recipientsError={
            recipientsQuery.error ? friendlyErrorMessage(recipientsQuery.error) : null
          }
          selectedConversationId={selectedConversationId}
          selectedRecipientId={selectedRecipientId}
          unreadTotal={unreadTotal}
        />

        <MessageConversationPanel
          conversationError={
            conversationQuery.error ? friendlyErrorMessage(conversationQuery.error) : null
          }
          conversationLoading={Boolean(selectedConversationId) && conversationQuery.isLoading}
          mode={mode}
          onSent={() => {
            void refreshSelectedConversation();
          }}
          placeholder={pageCopy.replyPlaceholder}
          selectedConversation={selectedConversation}
          selectedConversationId={selectedConversationId}
          selectedSummary={selectedSummary}
        />
      </div>
    </div>
  );
}
