import { describe, expect, it } from 'vitest';
import {
  assertIncidentTransition,
  canCreateIncidentReport,
  canEscalateIncidentReport,
  canOverrideIncidentParentVisibility,
  canShareIncidentParentCopy,
  canSignOffIncidentReport,
  canUseLinkedChildIncidentAccess,
  defaultIncidentParentVisibility,
  incidentParentCopyIsVisible,
  nextIncidentStatus,
  type IncidentParentCopyStatus,
  type IncidentReportStatus,
} from '../incidents.js';
import type { SessionUser } from '../rbac.js';

const user = (role: SessionUser['role']): SessionUser => ({
  id: `u_${role}`,
  role,
  tags: [],
  requires2fa: false,
});

describe('incident role gates', () => {
  it('allows supervisors and full admins to record incident reports', () => {
    expect(canCreateIncidentReport(user('Supervisor'))).toBe(true);
    expect(canCreateIncidentReport(user('Head'))).toBe(true);
    expect(canCreateIncidentReport(user('HeadOfDiscipline'))).toBe(true);
    expect(canCreateIncidentReport(user('ClubsAdmin'))).toBe(false);
    expect(canCreateIncidentReport(user('Parent'))).toBe(false);
  });

  it('limits sign-off to Head and HeadOfDiscipline', () => {
    expect(canSignOffIncidentReport(user('Head'))).toBe(true);
    expect(canSignOffIncidentReport(user('HeadOfDiscipline'))).toBe(true);
    expect(canSignOffIncidentReport(user('Principal'))).toBe(false);
    expect(canSignOffIncidentReport(user('Pastor'))).toBe(false);
    expect(canSignOffIncidentReport(user('Supervisor'))).toBe(false);
  });

  it('limits escalation handling to Pastor and Principal', () => {
    expect(canEscalateIncidentReport(user('Pastor'))).toBe(true);
    expect(canEscalateIncidentReport(user('Principal'))).toBe(true);
    expect(canEscalateIncidentReport(user('Head'))).toBe(false);
    expect(canEscalateIncidentReport(user('Supervisor'))).toBe(false);
  });

  it('allows parent-copy sharing only for senior incident reviewers', () => {
    expect(canShareIncidentParentCopy(user('Head'))).toBe(true);
    expect(canShareIncidentParentCopy(user('HeadOfDiscipline'))).toBe(true);
    expect(canShareIncidentParentCopy(user('Pastor'))).toBe(true);
    expect(canShareIncidentParentCopy(user('Principal'))).toBe(true);
    expect(canShareIncidentParentCopy(user('Supervisor'))).toBe(false);
  });

  it('allows parent visibility overrides only for senior incident reviewers', () => {
    expect(canOverrideIncidentParentVisibility(user('Head'))).toBe(true);
    expect(canOverrideIncidentParentVisibility(user('HeadOfDiscipline'))).toBe(true);
    expect(canOverrideIncidentParentVisibility(user('Pastor'))).toBe(true);
    expect(canOverrideIncidentParentVisibility(user('Principal'))).toBe(true);
    expect(canOverrideIncidentParentVisibility(user('Supervisor'))).toBe(false);
  });
});

describe('linked-child incident access', () => {
  it('allows parents and adult linked-child guardian roles', () => {
    for (const role of [
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor',
    ] as const) {
      expect(canUseLinkedChildIncidentAccess(user(role))).toBe(true);
    }
  });

  it('rejects roles that cannot act as linked-child guardians', () => {
    expect(canUseLinkedChildIncidentAccess(user('Student'))).toBe(false);
    expect(canUseLinkedChildIncidentAccess(user('ClubsLead'))).toBe(false);
  });
});

describe('incident status transitions', () => {
  it('keeps parent visibility off by default', () => {
    expect(defaultIncidentParentVisibility()).toBe(false);
  });

  it.each([
    ['Draft', 'submitForHeadReview', 'HeadReview'],
    ['HeadReview', 'signOff', 'SignedOff'],
    ['HeadReview', 'escalate', 'Escalated'],
    ['Escalated', 'signOff', 'SignedOff'],
    ['SignedOff', 'archive', 'Archived'],
  ] satisfies Array<[IncidentReportStatus, Parameters<typeof nextIncidentStatus>[1], IncidentReportStatus]>)(
    'allows %s -> %s',
    (from, action, expected) => {
      expect(nextIncidentStatus(from, action)).toBe(expected);
      expect(() => {
        assertIncidentTransition(from, action);
      }).not.toThrow();
    },
  );

  it.each([
    ['Draft', 'signOff'],
    ['Draft', 'escalate'],
    ['Escalated', 'submitForHeadReview'],
    ['SignedOff', 'submitForHeadReview'],
    ['Archived', 'signOff'],
  ] satisfies Array<[IncidentReportStatus, Parameters<typeof nextIncidentStatus>[1]]>)(
    'rejects %s -> %s',
    (from, action) => {
      expect(() => {
        nextIncidentStatus(from, action);
      }).toThrow(/cannot/u);
    },
  );
});

describe('incident parent copy visibility', () => {
  it.each([
    ['Draft', false],
    ['Generated', false],
    ['Shared', true],
    ['Archived', false],
  ] satisfies Array<[IncidentParentCopyStatus, boolean]>)(
    'treats %s visibility as %s',
    (status, expected) => {
      expect(incidentParentCopyIsVisible(status)).toBe(expected);
    },
  );
});
