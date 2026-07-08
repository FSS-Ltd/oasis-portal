import type { KeyboardEvent } from 'react';
import type {
  ConversationDetail,
  ConversationKind,
  ConversationSummary,
  MessageMode,
} from './message-types';

const messageDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

export function formatDateTime(value: Date | string): string {
  return messageDateTimeFormatter.format(new Date(value));
}

export function otherDirectParticipant(conversation: ConversationSummary | ConversationDetail) {
  return conversation.participants.find(
    (participant) => participant.id !== conversation.currentUserId,
  );
}

export function counterpartLabel(
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

export function counterpartRole(
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

export function conversationRecipientId(
  mode: MessageMode,
  kind: ConversationKind | null,
  conversation: ConversationSummary,
): string | null {
  if (!kind || conversation.kind !== kind) return null;
  if (kind === 'StaffDirect' || kind === 'StudentDirect') {
    return otherDirectParticipant(conversation)?.id ?? null;
  }
  if (kind === 'ParentStaff') {
    return mode === 'parent' ? conversation.adminId : conversation.parentId;
  }
  return conversation.adminId;
}

export function submitFormOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}
