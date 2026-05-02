import { PERMISSION_TAGS, type PermissionTag } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';

export type UserRow = RouterOutputs['admin']['listUsers'][number];
export type InvitationRow = RouterOutputs['admin']['listUserInvitations'][number];
export type StudentRow = RouterOutputs['student']['list'][number];
export type DirectoryFilter = 'all' | 'student' | 'supervisor' | 'parent';
export type UserProfileTab = 'personal' | 'role' | 'contact' | 'children';
export type StudentProfileTab = 'personal' | 'academic' | 'contact';

export type DirectoryItem =
  | {
      key: string;
      kind: 'student';
      searchText: string;
      student: StudentRow;
      subtitle: string;
      title: string;
    }
  | {
      key: string;
      kind: 'parent' | 'supervisor';
      searchText: string;
      subtitle: string;
      title: string;
      user: UserRow;
    }
  | {
      invitation: InvitationRow;
      key: string;
      kind: 'invite';
      searchText: string;
      subtitle: string;
      title: string;
    };

export const directoryFilters: readonly { id: DirectoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'student', label: 'Students' },
  { id: 'supervisor', label: 'Supervisors' },
  { id: 'parent', label: 'Parents' },
];

export const userTabs = {
  supervisor: [
    { id: 'personal', label: 'Personal' },
    { id: 'role', label: 'Role & Access' },
    { id: 'contact', label: 'Contact' },
  ],
  parent: [
    { id: 'personal', label: 'Personal' },
    { id: 'contact', label: 'Contact' },
    { id: 'children', label: 'Children' },
  ],
} as const satisfies Record<
  'parent' | 'supervisor',
  readonly { id: UserProfileTab; label: string }[]
>;

export const studentTabs: readonly { id: StudentProfileTab; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'academic', label: 'Academic' },
  { id: 'contact', label: 'Contact' },
];

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function childLabel(count: number): string {
  if (count === 1) return '1 child linked';
  return `${String(count)} children linked`;
}

export function toggleTag(tags: readonly string[], tag: PermissionTag): PermissionTag[] {
  const next = new Set(tags);
  if (next.has(tag)) {
    next.delete(tag);
  } else {
    next.add(tag);
  }
  return PERMISSION_TAGS.filter((candidate) => next.has(candidate));
}

export function userForm(user: UserRow) {
  return {
    fullName: user.fullName,
    phone: user.phone ?? '',
    address: user.address ?? '',
  };
}

export function statusTone(active: boolean): 'amber' | 'green' {
  return active ? 'green' : 'amber';
}
