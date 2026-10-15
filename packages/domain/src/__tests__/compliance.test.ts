import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_ACCOUNT_ROLES,
  complianceBadgeSummary,
  isComplianceAccount,
  updateAdultComplianceInput,
} from '../compliance.js';
import {
  canAssignPermissionTag,
  canUseAdminOperations,
  canManageCalendar,
  canUseCompliance,
  canUseComplianceAdminTag,
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
  it('grants the tag to staff accounts and rejects family accounts', () => {
    for (const role of ['Supervisor', 'ClubsLead', 'SafeguardingLead'] as const) {
      const actor = { role, tags: ['compliance-admin'] };
      expect(canUseComplianceAdminTag(actor)).toBe(true);
      expect(canUseCompliance(actor)).toBe(true);
      expect(canUseCompliance({ role, tags: [] })).toBe(role === 'SafeguardingLead');
    }
    for (const role of ['Parent', 'Student'] as const) {
      expect(canAssignPermissionTag(role, 'compliance-admin')).toBe(false);
      expect(canUseComplianceAdminTag({ role, tags: ['compliance-admin'] })).toBe(false);
      expect(canUseCompliance({ role, tags: ['compliance-admin'] })).toBe(false);
    }
    expect(canAssignPermissionTag('SafeguardingLead', 'compliance-admin')).toBe(true);
    expect(canAssignPermissionTag('SafeguardingLead', 'audit-viewer')).toBe(false);
    const taggedLead = { role: 'ClubsLead' as const, tags: ['compliance-admin'] };
    expect(canUseAdminOperations(taggedLead)).toBe(false);
  });
  it('routes the role to compliance without inheriting staff or parent access', () => {
    expect(canUseCompliance(lead)).toBe(true);
    expect(canViewCompliance(lead)).toBe(true);
    expect(resolvePostSignInPortal(lead)).toBe('compliance');
    expect(isStaff(lead)).toBe(false);
    expect(canManageCalendar(lead)).toBe(false);
    expect(canUseLinkedChildGuardianAccess(lead)).toBe(false);
    expect(resolvePostSignInPortal({ ...lead, requires2fa: true })).toBe('two-factor-required');
  });

  it('lets staff view compliance while reserving editing for three named roles', () => {
    expect(canUseCompliance({ role: 'Head' })).toBe(true);
    expect(canUseCompliance({ role: 'Pastor' })).toBe(true);
    expect(canUseCompliance({ role: 'Supervisor' })).toBe(false);
    expect(canViewCompliance({ role: 'Supervisor' })).toBe(true);
    expect(canViewCompliance({ role: 'TechnicalSupport' })).toBe(true);
    expect(canViewCompliance({ role: 'Principal' })).toBe(true);
    expect(canViewCompliance({ role: 'HeadOfDiscipline' })).toBe(true);
    expect(canViewCompliance({ role: 'ClubsAdmin' })).toBe(true);
    expect(canUseCompliance({ role: 'TechnicalSupport' })).toBe(false);
    expect(canViewCompliance({ role: 'ClubsLead' })).toBe(true);
    expect(canUseCompliance({ role: 'ClubsLead' })).toBe(false);
    expect(canUseCompliance({ role: 'Parent' })).toBe(false);
    expect(canViewCompliance({ role: 'Parent' })).toBe(false);
  });

  it('includes adult roles with activity duties but excludes minors and activities leads only', () => {
    expect(COMPLIANCE_ACCOUNT_ROLES).toContain('Pastor');
    expect(COMPLIANCE_ACCOUNT_ROLES).toContain('TechnicalSupport');
    expect(COMPLIANCE_ACCOUNT_ROLES).toContain('Parent');
    expect(COMPLIANCE_ACCOUNT_ROLES).toContain('Student');
    expect(COMPLIANCE_ACCOUNT_ROLES).not.toContain('ClubsLead');
    expect(isComplianceAccount('Pastor', '1980-01-01', new Date('2026-10-11'))).toBe(true);
    expect(isComplianceAccount('Supervisor', '2010-01-01', new Date('2026-10-11'))).toBe(false);
    expect(isComplianceAccount('ClubsLead', '1980-01-01', new Date('2026-10-11'))).toBe(false);
    expect(isComplianceAccount('Parent', null, new Date('2026-10-11'))).toBe(true);
    expect(isComplianceAccount('Student', '2000-01-01', new Date('2026-10-11'))).toBe(true);
    expect(isComplianceAccount('Student', null, new Date('2026-10-11'))).toBe(false);
    expect(isComplianceAccount('Student', '2008-10-11', new Date('2026-10-11'))).toBe(true);
    expect(isComplianceAccount('Student', '2008-10-12', new Date('2026-10-11'))).toBe(false);
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
