import type { RouterOutputs } from '@/lib/trpc';

export type CommunityGroup = RouterOutputs['community']['listStudentGroups']['groups'][number];
export type CommunityMessage = RouterOutputs['community']['listGroupMessages']['messages'][number];
export type AdminCommunityGroup = RouterOutputs['community']['listAdminGroups'][number];
export type AdminCommunityMessage =
  RouterOutputs['community']['listAdminGroupMessages']['messages'][number];
export type StudentModerationRow = RouterOutputs['community']['listStudentModeration'][number];

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCommunityDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatCommunityTime(value: Date | string): string {
  return timeFormatter.format(new Date(value));
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? `1 ${singular}` : `${String(count)} ${plural}`;
}
