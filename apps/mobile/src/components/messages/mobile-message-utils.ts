import type { ConversationSummary } from './mobile-message-types';

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function formatThreadTime(value: Date | string): string {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (sameDay) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function latestSenderLabel(conversation: ConversationSummary): string {
  const latest = conversation.latestMessage;
  if (!latest) return 'No messages yet';
  const otherParticipant = conversation.participants.find(
    (participant) => participant.id !== conversation.currentUserId,
  );
  return latest.senderId === conversation.currentUserId
    ? 'You sent the latest message'
    : `${otherParticipant?.fullName ?? conversation.admin?.fullName ?? 'Contact'} replied`;
}

export function unreadLabel(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

// A new time label appears after a 30 minute pause, a new bubble group after 5.
const SEPARATOR_GAP_MS = 30 * 60 * 1000;
const GROUP_GAP_MS = 5 * 60 * 1000;

export type BubblePosition = 'single' | 'first' | 'middle' | 'last';

interface MessageLike {
  id: string;
  senderId: string;
  createdAt: Date | string;
}

export type MessageRow<M extends MessageLike> =
  | { type: 'separator'; key: string; label: string }
  | {
      type: 'message';
      key: string;
      message: M;
      mine: boolean;
      position: BubblePosition;
      showSender: boolean;
      showStatus: boolean;
    };

function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
}

export function formatSeparator(value: Date | string, now: Date = new Date()): string {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const yesterday = new Date(now.getTime() - dayMs);

  if (dayKey(date) === dayKey(now)) return `Today ${time}`;
  if (dayKey(date) === dayKey(yesterday)) return `Yesterday ${time}`;
  if (now.getTime() - date.getTime() < 6 * dayMs) {
    return `${new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date)} ${time}`;
  }
  return `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)} ${time}`;
}

/**
 * Turns an ascending message list into iMessage-style rows: a centred time label after a pause or on
 * a new day, bubbles grouped by sender (only the last of a group keeps its tail), and the delivery
 * status shown once, under the most recent message you sent.
 */
export function buildMessageRows<M extends MessageLike>(
  messages: readonly M[],
  currentUserId: string | null,
  now: Date = new Date(),
): MessageRow<M>[] {
  const rows: MessageRow<M>[] = [];
  let lastMineIndex = -1;
  messages.forEach((message, index) => {
    if (message.senderId === currentUserId) lastMineIndex = index;
  });

  messages.forEach((message, index) => {
    const at = new Date(message.createdAt);
    const previous = index > 0 ? messages[index - 1] : undefined;
    const next = messages[index + 1];
    const previousAt = previous ? new Date(previous.createdAt) : undefined;
    const nextAt = next ? new Date(next.createdAt) : undefined;

    const startsBlock =
      !previousAt ||
      at.getTime() - previousAt.getTime() > SEPARATOR_GAP_MS ||
      dayKey(at) !== dayKey(previousAt);
    if (startsBlock) {
      rows.push({
        type: 'separator',
        key: `separator-${message.id}`,
        label: formatSeparator(at, now),
      });
    }

    const joinsPrevious =
      !startsBlock &&
      previous !== undefined &&
      previous.senderId === message.senderId &&
      at.getTime() - previousAt.getTime() <= GROUP_GAP_MS;
    const joinsNext =
      next !== undefined &&
      nextAt !== undefined &&
      next.senderId === message.senderId &&
      nextAt.getTime() - at.getTime() <= GROUP_GAP_MS &&
      dayKey(nextAt) === dayKey(at);

    let position: BubblePosition = 'single';
    if (joinsPrevious && joinsNext) position = 'middle';
    else if (joinsPrevious) position = 'last';
    else if (joinsNext) position = 'first';

    const mine = message.senderId === currentUserId;
    rows.push({
      type: 'message',
      key: message.id,
      message,
      mine,
      position,
      showSender: !mine && !joinsPrevious,
      showStatus: index === lastMineIndex,
    });
  });

  return rows;
}

const AVATAR_COLOURS = ['#1B2B5E', '#7D1C2C', '#3D6EA5', '#2F6F57', '#7A5A1E', '#5B4B8A'] as const;

export function avatarColour(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length] ?? AVATAR_COLOURS[0];
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const first = words[0]?.charAt(0) ?? '?';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** The existing one-to-one conversation with this person, so picking a contact reopens it. */
export function findConversationForRecipient<
  C extends { id: string; kind: string; participants: Array<{ id: string }> },
>(conversations: readonly C[], recipientId: string, kind: string): C | undefined {
  return conversations.find(
    (conversation) =>
      conversation.kind === kind &&
      conversation.participants.some((participant) => participant.id === recipientId),
  );
}
