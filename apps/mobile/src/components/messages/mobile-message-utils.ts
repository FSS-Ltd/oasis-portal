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
