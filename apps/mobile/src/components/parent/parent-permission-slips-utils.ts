import type { RouterOutputs } from '../../lib/trpc';

export type ParentPermissionSlipList = RouterOutputs['permissionSlip']['listParent'];
export type ParentPermissionSlip = ParentPermissionSlipList['slips'][number];
export type ParentPermissionSlipRecipient = ParentPermissionSlip['recipients'][number];
export type ParentPermissionSlipQuestion = ParentPermissionSlip['questions'][number];

export type ParentPermissionSlipTab = 'outstanding' | 'completed';

export interface ParentPermissionSlipRow {
  recipient: ParentPermissionSlipRecipient;
  slip: ParentPermissionSlip;
}

export const parentPermissionSlipCategoryLabels = {
  Activity: 'Activity',
  Consent: 'Consent',
  Reward: 'Reward',
  SchoolTrip: 'Oasis visit',
} as const satisfies Record<ParentPermissionSlip['category'], string>;

export function formatParentSlipDate(value: Date | string | null): string {
  if (!value) return 'Not set';
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

export function parentPermissionSlipRows(
  slips: readonly ParentPermissionSlip[],
): ParentPermissionSlipRow[] {
  return slips.flatMap((slip) => slip.recipients.map((recipient) => ({ recipient, slip })));
}

export function isOutstandingPermissionSlip(row: ParentPermissionSlipRow): boolean {
  return row.recipient.responseStatus === 'Pending' && !row.slip.inactive;
}

export function splitParentPermissionSlipRows(rows: readonly ParentPermissionSlipRow[]): {
  completedRows: ParentPermissionSlipRow[];
  outstandingRows: ParentPermissionSlipRow[];
} {
  return rows.reduce<{
    completedRows: ParentPermissionSlipRow[];
    outstandingRows: ParentPermissionSlipRow[];
  }>(
    (groups, row) => {
      if (isOutstandingPermissionSlip(row)) {
        groups.outstandingRows.push(row);
      } else {
        groups.completedRows.push(row);
      }
      return groups;
    },
    { completedRows: [], outstandingRows: [] },
  );
}

export function responseLabel(status: ParentPermissionSlipRecipient['responseStatus']): string {
  if (status === 'Signed') return 'Signed';
  if (status === 'Declined') return 'Declined';
  return 'Pending';
}

export function responseBadgeVariant(
  status: ParentPermissionSlipRecipient['responseStatus'],
): 'danger' | 'success' | 'warning' {
  if (status === 'Signed') return 'success';
  if (status === 'Declined') return 'danger';
  return 'warning';
}

export function paymentLabel(status: ParentPermissionSlipRecipient['paymentStatus']): string {
  if (status === 'PaymentPending') return 'Awaiting confirmation';
  if (status === 'NotRequired') return 'No payment';
  return status;
}

export function paymentBadgeVariant(
  status: ParentPermissionSlipRecipient['paymentStatus'],
): 'blue' | 'neutral' | 'success' | 'warning' {
  if (status === 'Paid') return 'success';
  if (status === 'PaymentPending') return 'blue';
  if (status === 'Unpaid') return 'warning';
  return 'neutral';
}

export function rowActionLabel(row: ParentPermissionSlipRow): 'Open & sign' | 'View' {
  return isOutstandingPermissionSlip(row) ? 'Open & sign' : 'View';
}
