import { describe, expect, it } from 'vitest';
import { complianceBadgeSummary, updateAdultComplianceInput } from '../compliance.js';
import {
  canManageCalendar,
  canUseCompliance,
  canViewCompliance,
  canUseLinkedChildGuardianAccess,
  isStaff,
  resolvePostSignInPortal,
  type SessionUser,
} from '../rbac.js';

const lead: SessionUser = {
  id: 'safeguarding-lead',
  role: 'SafeguardingLead',
  tags: [],
  requires2fa: false,
};

const emptyRecord = {
  userId: 'parent-1',
  dob: null,
  dbsCertificateNumber: null,
  dbsApplicationReference: null,
  dbsCompletedAt: null,
  dbsIssueDate: null,
  dbsApplicationType: null,
  dbsStatus: 'AwaitingCertificate',
  firstAidCompletedAt: null,
  firstAidLevel: null,
  safeguardingCompletedAt: null,
  safeguardingLevel: null,
} as const;

describe('safeguarding lead access', () => {
  it('routes the role to compliance without inheriting staff or parent access', () => {
    expect(canUseCompliance(lead)).toBe(true);
    expect(canViewCompliance(lead)).toBe(true);
    expect(resolvePostSignInPortal(lead)).toBe('compliance');
    expect(isStaff(lead)).toBe(false);
    expect(canManageCalendar(lead)).toBe(false);
    expect(canUseLinkedChildGuardianAccess(lead)).toBe(false);
    expect(resolvePostSignInPortal({ ...lead, requires2fa: true })).toBe('two-factor-required');
  });

  it('lets supervisors view compliance while reserving editing for three named roles', () => {
    expect(canUseCompliance({ role: 'Head' })).toBe(true);
    expect(canUseCompliance({ role: 'Pastor' })).toBe(true);
    expect(canUseCompliance({ role: 'Supervisor' })).toBe(false);
    expect(canViewCompliance({ role: 'Supervisor' })).toBe(true);
    expect(canUseCompliance({ role: 'Parent' })).toBe(false);
    expect(canViewCompliance({ role: 'Parent' })).toBe(false);
  });
});

describe('compliance record validation and badges', () => {
  it('rejects invalid dates and incomplete training pairs', () => {
    expect(
      updateAdultComplianceInput.safeParse({ ...emptyRecord, dob: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      updateAdultComplianceInput.safeParse({ ...emptyRecord, firstAidLevel: 'Level 3' }).success,
    ).toBe(false);
    expect(
      updateAdultComplianceInput.safeParse({
        ...emptyRecord,
        safeguardingCompletedAt: '2026-01-01',
      }).success,
    ).toBe(false);
  });

  it('requires certificate details for manually recorded current status', () => {
    expect(
      updateAdultComplianceInput.safeParse({ ...emptyRecord, dbsStatus: 'RecordedCurrent' })
        .success,
    ).toBe(false);
    expect(
      updateAdultComplianceInput.safeParse({
        ...emptyRecord,
        dbsStatus: 'RecordedCurrent',
        dbsCertificateNumber: '123',
        dbsIssueDate: '2026-01-01',
      }).success,
    ).toBe(true);
  });

  it('only shows training badges when a level and completion date exist', () => {
    expect(complianceBadgeSummary(null)).toEqual({
      dbsStatus: 'NotRecorded',
      firstAidTrained: false,
      safeguardingTrained: false,
    });
    expect(
      complianceBadgeSummary({
        dbsStatus: 'NoLongerCurrent',
        firstAidCompletedAt: new Date('2026-01-01'),
        firstAidLevel: null,
        safeguardingCompletedAt: new Date('2026-01-01'),
        safeguardingLevel: 'Level 2',
      }),
    ).toEqual({ dbsStatus: 'NoLongerCurrent', firstAidTrained: false, safeguardingTrained: true });
  });
});
