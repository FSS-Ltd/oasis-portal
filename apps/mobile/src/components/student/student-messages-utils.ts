import type {
  ConversationSummary,
  Recipient,
} from '../messages/mobile-message-types';

export const studentMessageAccessBlockedCopy = [
  'Student portal locked',
  'Off-limit day',
  'Usage limit reached',
] as const;

export function isPastoralStudentMessageRecipient(recipient: Recipient): boolean {
  return recipient.role === 'Head' || recipient.role === 'Pastor';
}

export function conversationHasPastoralParticipant(conversation: ConversationSummary): boolean {
  return conversation.participants.some(
    (participant) =>
      participant.id !== conversation.currentUserId &&
      (participant.role === 'Head' || participant.role === 'Pastor'),
  );
}

export function studentDirectUnreadCount(
  conversations: readonly ConversationSummary[],
): number {
  return conversations.reduce((count, conversation) => count + conversation.unreadCount, 0);
}

export function isStudentMessagingDisabledMessage(message: string | null | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student messaging is disabled'));
}
