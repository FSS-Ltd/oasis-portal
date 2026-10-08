import { PERMISSION_TAGS, ROLES, type PermissionTag, type Role } from '@oasis/domain/rbac';
import type { RouterOutputs } from '../../lib/trpc';

export type AccessAccount = RouterOutputs['admin']['listUserAccounts'][number];
export type AccessInvitation = RouterOutputs['admin']['listUserInvitations'][number];
export type AccessFilter = 'active' | 'all' | 'inactive' | Role;

export type DirectoryRow =
  | { account: AccessAccount; id: string; kind: 'account' }
  | { id: string; invitation: AccessInvitation; kind: 'invitation' };

export const accessFilters: readonly { id: AccessFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  ...ROLES.map((role) => ({ id: role, label: roleLabel(role) })),
];

export function formatAccountDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function roleLabel(role: string): string {
  if (role === 'ClubsAdmin') return 'Activities Admin';
  if (role === 'ClubsLead') return 'Activities Lead';
  return role === 'TechnicalSupport' ? 'Technical Support' : role;
}

export function toPermissionTags(tags: readonly string[]): PermissionTag[] {
  return PERMISSION_TAGS.filter((tag) => tags.includes(tag));
}
