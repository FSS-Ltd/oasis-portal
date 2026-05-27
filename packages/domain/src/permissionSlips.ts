import { AccessDeniedError, canAnswerChildRegistrationPrompt, type SessionUser } from './rbac.js';

export const PERMISSION_SLIP_CATEGORIES = [
  'SchoolTrip',
  'Activity',
  'Reward',
  'Consent',
] as const;
export type PermissionSlipCategory = (typeof PERMISSION_SLIP_CATEGORIES)[number];

export const PERMISSION_SLIP_RESPONSE_STATUSES = ['Pending', 'Signed', 'Declined'] as const;
export type PermissionSlipResponseStatus = (typeof PERMISSION_SLIP_RESPONSE_STATUSES)[number];

export const PERMISSION_SLIP_SIGNATURE_SOURCES = ['ParentPortal', 'Physical'] as const;
export type PermissionSlipSignatureSource = (typeof PERMISSION_SLIP_SIGNATURE_SOURCES)[number];

export const PERMISSION_SLIP_PAYMENT_STATUSES = [
  'NotRequired',
  'Unpaid',
  'PaymentPending',
  'Paid',
] as const;
export type PermissionSlipPaymentStatus = (typeof PERMISSION_SLIP_PAYMENT_STATUSES)[number];

export function canManagePermissionSlips(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'Head' || user.role === 'Pastor';
}

export function canUseLinkedChildPermissionSlipAccess(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'Parent' || canAnswerChildRegistrationPrompt(user);
}

export function requireCanManagePermissionSlips(user: SessionUser): void {
  if (!canManagePermissionSlips(user)) {
    throw new AccessDeniedError(`role ${user.role} cannot manage permission slips`);
  }
}

export function permissionSlipCalendarCategory(
  category: PermissionSlipCategory,
): 'Trips' | 'OasisDays' {
  return category === 'SchoolTrip' ? 'Trips' : 'OasisDays';
}

export function initialPermissionSlipPaymentStatus(
  requirePayment: boolean,
): PermissionSlipPaymentStatus {
  return requirePayment ? 'Unpaid' : 'NotRequired';
}

export function assertPermissionSlipCanBeParentMarkedPaid(input: {
  paymentStatus: PermissionSlipPaymentStatus;
  responseStatus: PermissionSlipResponseStatus;
}): void {
  if (input.responseStatus !== 'Signed') {
    throw new Error('only signed permission slips can be marked paid');
  }
  if (input.paymentStatus !== 'Unpaid') {
    throw new Error('only unpaid permission slips can be marked paid');
  }
}

export function assertPermissionSlipPaymentCanBeConfirmed(
  paymentStatus: PermissionSlipPaymentStatus,
): void {
  if (paymentStatus !== 'PaymentPending') {
    throw new Error('only pending permission-slip payments can be confirmed');
  }
}
