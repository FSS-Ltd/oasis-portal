import { describe, expect, it } from 'vitest';
import {
  assertPermissionSlipCanBeParentMarkedPaid,
  assertPermissionSlipPaymentCanBeConfirmed,
  canManagePermissionSlips,
  initialPermissionSlipPaymentStatus,
  permissionSlipCalendarCategory,
} from '../permissionSlips.js';
import type { SessionUser } from '../rbac.js';

const user = (role: SessionUser['role']): SessionUser => ({
  id: `u_${role}`,
  role,
  tags: [],
  requires2fa: false,
});

describe('permission slip roles', () => {
  it('limits permission slip management to Head and Pastor', () => {
    expect(canManagePermissionSlips(user('Head'))).toBe(true);
    expect(canManagePermissionSlips(user('Pastor'))).toBe(true);
    expect(canManagePermissionSlips(user('Principal'))).toBe(false);
    expect(canManagePermissionSlips(user('HeadOfDiscipline'))).toBe(false);
    expect(canManagePermissionSlips(user('Supervisor'))).toBe(false);
    expect(canManagePermissionSlips(user('Parent'))).toBe(false);
  });
});

describe('permission slip calendar mapping', () => {
  it('maps trips to the Trips calendar category and other slips to OasisDays', () => {
    expect(permissionSlipCalendarCategory('SchoolTrip')).toBe('Trips');
    expect(permissionSlipCalendarCategory('Activity')).toBe('OasisDays');
    expect(permissionSlipCalendarCategory('Reward')).toBe('OasisDays');
    expect(permissionSlipCalendarCategory('Consent')).toBe('OasisDays');
  });
});

describe('permission slip payment transitions', () => {
  it('keeps paid unreachable until confirmation', () => {
    expect(initialPermissionSlipPaymentStatus(true)).toBe('Unpaid');
    expect(initialPermissionSlipPaymentStatus(false)).toBe('NotRequired');
    expect(() => {
      assertPermissionSlipCanBeParentMarkedPaid({
        responseStatus: 'Signed',
        paymentStatus: 'Unpaid',
      });
    }).not.toThrow();
    expect(() => {
      assertPermissionSlipCanBeParentMarkedPaid({
        responseStatus: 'Pending',
        paymentStatus: 'Unpaid',
      });
    }).toThrow(/signed/u);
    expect(() => {
      assertPermissionSlipCanBeParentMarkedPaid({
        responseStatus: 'Signed',
        paymentStatus: 'Paid',
      });
    }).toThrow(/unpaid/u);
    expect(() => {
      assertPermissionSlipPaymentCanBeConfirmed('PaymentPending');
    }).not.toThrow();
    expect(() => {
      assertPermissionSlipPaymentCanBeConfirmed('Unpaid');
    }).toThrow(/pending/u);
  });
});
