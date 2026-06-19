import { type RouterOutputs } from '../../lib/trpc';

export type ParentDashboard = RouterOutputs['childLog']['parentDashboard'];
export type ParentDashboardChild = ParentDashboard['children'][number];
export type ParentNotice = RouterOutputs['notice']['listForParents'][number];
export type ParentConversation = RouterOutputs['message']['listConversations']['items'][number];
export type ParentClubContext = RouterOutputs['club']['linkedChildSignupContext'];
export type ParentInvoiceList = RouterOutputs['invoice']['listParent'];
export type ParentPermissionSlipList = RouterOutputs['permissionSlip']['listParent'];

export interface ParentHomeSignals {
  clubPromptCount: number;
  feeDueCount: number;
  permissionSlipCount: number;
  unreadMessageCount: number;
  unreadNoticeCount: number;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 2);
}

export function displaySchoolYearLabel(year: string): string {
  const trimmed = year.trim();
  if (/^nursery$/iu.test(trimmed)) return 'Nursery';
  if (/^(reception|abc|r)$/iu.test(trimmed)) return 'ABC';
  const yearMatch = /^(?:year\s*|y)([1-9]|1[0-3])$/iu.exec(trimmed);
  return yearMatch ? `Level ${String(Number(yearMatch[1]))}` : year;
}

export function formatParentDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(value),
  );
}

export function formatParentDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function formatMerits(value: number): string {
  return `${String(value)} merits`;
}

export function selectedParentChild(
  children: readonly ParentDashboardChild[],
  selectedChildId: string | null,
): ParentDashboardChild | null {
  return (
    children.find((child) => child.student.id === selectedChildId) ??
    children[0] ??
    null
  );
}

export function attendanceTone(
  status: ParentDashboardChild['todayStatus']['label'],
): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'Present') return 'success';
  if (status === 'Late') return 'warning';
  if (status === 'Absent') return 'danger';
  return 'neutral';
}

export function parentHomeSignals({
  clubContext,
  conversations,
  invoices,
  notices,
  permissionSlips,
  selectedChildId,
}: {
  clubContext: ParentClubContext | undefined;
  conversations: readonly ParentConversation[];
  invoices: ParentInvoiceList | undefined;
  notices: readonly ParentNotice[];
  permissionSlips: ParentPermissionSlipList | undefined;
  selectedChildId: string | null;
}): ParentHomeSignals {
  const selectedClubChild = clubContext?.children.find((child) => child.id === selectedChildId);
  const clubs = clubContext?.clubs ?? [];
  const clubPromptCount = selectedClubChild
    ? clubs.filter(
        (club) =>
          !club.signedUpStudentIds.includes(selectedClubChild.id) &&
          (club.capacity === null || club.activeSignupCount < club.capacity),
      ).length
    : 0;

  const permissionSlipCount =
    permissionSlips?.slips.reduce((count, slip) => {
      const openRecipients = slip.recipients.filter(
        (recipient) =>
          (!selectedChildId || recipient.studentId === selectedChildId) &&
          recipient.responseStatus === 'Pending',
      );
      return count + openRecipients.length;
    }, 0) ?? 0;

  return {
    clubPromptCount,
    feeDueCount: invoices?.stats.unpaidCount ?? 0,
    permissionSlipCount,
    unreadMessageCount: conversations.reduce(
      (count, conversation) => count + conversation.unreadCount,
      0,
    ),
    unreadNoticeCount: notices.filter((notice) => !notice.read).length,
  };
}
