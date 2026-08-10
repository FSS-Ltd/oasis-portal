'use client';

import { Badge } from '@/components/ui/badge';
import type { RouterOutputs } from '@/lib/trpc';

export type AdminPermissionSlip =
  RouterOutputs['permissionSlip']['listAdmin']['slips'][number];
export type ParentPermissionSlip =
  RouterOutputs['permissionSlip']['listParent']['slips'][number];
export type PermissionSlipRecipient = AdminPermissionSlip['recipients'][number];
export type PermissionSlipQuestion = AdminPermissionSlip['questions'][number];

export const permissionSlipCategories = ['SchoolTrip', 'Activity', 'Reward', 'Consent'] as const;

export const permissionSlipCategoryLabels = {
  SchoolTrip: 'School Trip',
  Activity: 'Activity',
  Reward: 'Reward',
  Consent: 'Consent',
} as const;

export function formatSlipDate(value: Date | string | null): string {
  if (!value) return 'Not set';
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatSlipDateTime(value: Date | string | null): string {
  if (!value) return 'Not set';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function responseTone(status: PermissionSlipRecipient['responseStatus']) {
  if (status === 'Signed') return 'green';
  if (status === 'Declined') return 'red';
  return 'amber';
}

export function paymentTone(status: PermissionSlipRecipient['paymentStatus']) {
  if (status === 'Paid') return 'green';
  if (status === 'PaymentPending') return 'blue';
  if (status === 'Unpaid') return 'amber';
  return 'grey';
}

export function responseLabel(status: PermissionSlipRecipient['responseStatus']) {
  if (status === 'Signed') return 'Signed';
  if (status === 'Declined') return 'Declined';
  return 'Pending';
}

export function paymentLabel(status: PermissionSlipRecipient['paymentStatus']) {
  if (status === 'PaymentPending') return 'Awaiting confirmation';
  if (status === 'NotRequired') return 'No payment';
  return status;
}

export function ResponseStatusBadge({ status }: { status: PermissionSlipRecipient['responseStatus'] }) {
  return <Badge tone={responseTone(status)}>{responseLabel(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PermissionSlipRecipient['paymentStatus'] }) {
  return <Badge tone={paymentTone(status)}>{paymentLabel(status)}</Badge>;
}

export function PermissionSlipProgress({ slip }: { slip: Pick<AdminPermissionSlip, 'stats'> }) {
  const total = Math.max(1, slip.stats.total);
  const signedWidth = ((slip.stats.signed / total) * 100).toFixed(4);
  const declinedWidth = ((slip.stats.declined / total) * 100).toFixed(4);
  const pendingWidth = ((slip.stats.pending / total) * 100).toFixed(4);

  return (
    <div className="permission-progress">
      <div className="permission-progress__bar" aria-hidden="true">
        {slip.stats.signed > 0 ? (
          <span className="is-signed" style={{ width: `${signedWidth}%` }} />
        ) : null}
        {slip.stats.declined > 0 ? (
          <span className="is-declined" style={{ width: `${declinedWidth}%` }} />
        ) : null}
        {slip.stats.pending > 0 ? (
          <span className="is-pending" style={{ width: `${pendingWidth}%` }} />
        ) : null}
      </div>
      <div className="permission-progress__legend">
        <span className="is-signed">{slip.stats.signed} signed</span>
        <span className="is-declined">{slip.stats.declined} declined</span>
        <span className="is-pending">{slip.stats.pending} pending</span>
      </div>
    </div>
  );
}

export function PermissionSlipMeta({ slip }: { slip: AdminPermissionSlip | ParentPermissionSlip }) {
  return (
    <dl className="permission-meta">
      {slip.eventDate ? (
        <div>
          <dt>Event date</dt>
          <dd>{formatSlipDate(slip.eventDate)}</dd>
        </div>
      ) : null}
      {slip.departureTime ? (
        <div>
          <dt>Departure</dt>
          <dd>{slip.departureTime}</dd>
        </div>
      ) : null}
      {slip.returnTime ? (
        <div>
          <dt>Return</dt>
          <dd>{slip.returnTime}</dd>
        </div>
      ) : null}
      {slip.location ? (
        <div>
          <dt>Location</dt>
          <dd>{slip.location}</dd>
        </div>
      ) : null}
      {slip.transport ? (
        <div>
          <dt>Transport</dt>
          <dd>{slip.transport}</dd>
        </div>
      ) : null}
      {slip.cost ? (
        <div>
          <dt>Cost</dt>
          <dd>{slip.cost}</dd>
        </div>
      ) : null}
    </dl>
  );
}
