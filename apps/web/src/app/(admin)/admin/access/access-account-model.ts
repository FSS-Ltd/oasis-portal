import { ROLES, type Role } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { roleLabel } from '@/lib/profile-display';

export type AccessAccount = RouterOutputs['admin']['listUserAccounts'][number];
export type AccessInvitation = RouterOutputs['admin']['listUserInvitations'][number];
export type AccessFilter = 'all' | 'active' | 'inactive' | Role;

export const ACCESS_INVITE_ROLES = ROLES;

export const accessFilters: readonly { id: AccessFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  ...ROLES.map((role) => ({ id: role, label: roleLabel(role) })),
];

export function accountForm(account: AccessAccount) {
  return {
    fullName: account.fullName,
    phone: account.phone ?? '',
    address: account.address ?? '',
  };
}

export function formatAccountDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function statusTone(active: boolean): 'amber' | 'green' {
  return active ? 'green' : 'amber';
}
