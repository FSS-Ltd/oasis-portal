import type { RouterOutputs } from '../../lib/trpc';

export type StudentCommunityGroups = RouterOutputs['community']['listStudentGroups'];
export type StudentCommunityGroup = StudentCommunityGroups['groups'][number];
export type StudentCommunityMessages = RouterOutputs['community']['listGroupMessages'];
export type StudentCommunityMessage = StudentCommunityMessages['messages'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

export function formatCommunityMessageDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

export function communityGroupMeta(group: StudentCommunityGroup): string {
  const parts = [
    `${String(group.memberCount)} member${group.memberCount === 1 ? '' : 's'}`,
    `${String(group.messageCount)} message${group.messageCount === 1 ? '' : 's'}`,
  ];
  if (!group.isPublic) parts.push('Invite only');
  if (!group.active) parts.push('Disabled');
  return parts.join(' / ');
}

export function communityMessageStatus(message: StudentCommunityMessage): string {
  if (message.readByOtherStudents && message.latestReadAtByOtherStudent) {
    return `Read ${formatCommunityMessageDate(message.latestReadAtByOtherStudent)}`;
  }
  return 'Delivered';
}

export function isCommunityBlockedMessage(message: string | null | undefined): boolean {
  return Boolean(message?.includes('student community messaging is disabled'));
}
