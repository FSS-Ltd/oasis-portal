import { describe, expect, it } from 'vitest';
import {
  AccessDeniedError,
  canAnswerChildRegistrationPrompt,
  canExportAttendance,
  canManageCalendar,
  canManageClubs,
  canManageStaffParentVolunteerAccess,
  canManageInvoices,
  canManageUserAccountRole,
  canManageUserAccounts,
  canRecordStudentAttendance,
  canRespondToParentMessages,
  canCreateSensitiveBehaviour,
  canUseAdminOperations,
  canUseAllStudentSupervisorWorkflow,
  canUsePrimaryStudentSupervisorWorkflow,
  canUseFullPaceAccess,
  canUsePersonalTasks,
  canUseStaffMessaging,
  canViewAnyStudentDrillThrough,
  canViewAuditLog,
  canViewBehaviourReports,
  canViewSensitiveBehaviour,
  canViewSensitiveChildNotes,
  canViewSensitiveBehaviourEntry,
  canViewSensitiveStudentDrillThrough,
  canViewStudentFinance,
  canViewStudentDrillThrough,
  canSubmitInitialRegistration,
  canUseClubLeadAccess,
  canUseClubsLeadPortal,
  canUseLinkedChildGuardianAccess,
  hasCompletedTwoFactor,
  isFullAdmin,
  isStaffParentVolunteerEligibleRole,
  isStaff,
  PERMISSION_TAGS,
  ROLES,
  requireClubsLead,
  requireCanViewSensitive,
  requireCanManageInvoices,
  requireClubsAdminOrFullAdmin,
  requireAdminOperations,
  requireUserAccountAdmin,
  requireFullAdmin,
  requireOwnChild,
  requireSelfStudent,
  requireTag,
  resolvePostSignInPortal,
  type SessionUser,
} from '../rbac.js';
import {
  canUseParentVolunteerNavigation,
  resolveParentVolunteerAccess,
} from '../parentVolunteer.js';

const head: SessionUser = { id: 'u1', role: 'Head', tags: [], requires2fa: false };
const principal: SessionUser = { id: 'u2', role: 'Principal', tags: [], requires2fa: false };
const pastor: SessionUser = { id: 'u3', role: 'Pastor', tags: [], requires2fa: false };
const hod: SessionUser = { id: 'u4', role: 'HeadOfDiscipline', tags: [], requires2fa: false };
const technicalSupport: SessionUser = {
  id: 'u5',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const clubsAdmin: SessionUser = { id: 'u6', role: 'ClubsAdmin', tags: [], requires2fa: false };
const clubsLead: SessionUser = { id: 'u10', role: 'ClubsLead', tags: [], requires2fa: false };
const supervisor: SessionUser = { id: 'u7', role: 'Supervisor', tags: [], requires2fa: false };
const parent: SessionUser = { id: 'u8', role: 'Parent', tags: [], requires2fa: false };
const student: SessionUser = { id: 'u9', role: 'Student', tags: [], requires2fa: false };

describe('isFullAdmin', () => {
  it('treats Head, Principal, Pastor, HeadOfDiscipline as full admins', () => {
    expect(isFullAdmin(head)).toBe(true);
    expect(isFullAdmin(principal)).toBe(true);
    expect(isFullAdmin(pastor)).toBe(true);
    expect(isFullAdmin(hod)).toBe(true);
  });
  it('rejects non-admin roles', () => {
    expect(isFullAdmin(technicalSupport)).toBe(false);
    expect(isFullAdmin(clubsAdmin)).toBe(false);
    expect(isFullAdmin(clubsLead)).toBe(false);
    expect(isFullAdmin(supervisor)).toBe(false);
    expect(isFullAdmin(parent)).toBe(false);
    expect(isFullAdmin(student)).toBe(false);
  });
});

describe('requireFullAdmin', () => {
  it('passes for full-admin roles', () => {
    expect(() => {
      requireFullAdmin(head);
    }).not.toThrow();
    expect(() => {
      requireFullAdmin(pastor);
    }).not.toThrow();
  });
  it('throws AccessDeniedError otherwise', () => {
    expect(() => {
      requireFullAdmin(supervisor);
    }).toThrow(AccessDeniedError);
    expect(() => {
      requireFullAdmin(technicalSupport);
    }).toThrow(AccessDeniedError);
  });
});

describe('admin operations access', () => {
  it('allows full-admin roles and TechnicalSupport without changing full-admin semantics', () => {
    for (const user of [head, principal, pastor, hod, technicalSupport]) {
      expect(canUseAdminOperations(user)).toBe(true);
      expect(() => {
        requireAdminOperations(user);
      }).not.toThrow();
    }

    expect(isFullAdmin(technicalSupport)).toBe(false);
  });

  it('blocks non-operational roles', () => {
    for (const user of [clubsAdmin, clubsLead, supervisor, parent, student]) {
      expect(canUseAdminOperations(user)).toBe(false);
      expect(() => {
        requireAdminOperations(user);
      }).toThrow(AccessDeniedError);
    }
  });
});

describe('TechnicalSupport account administration', () => {
  it('allows full admins and Technical Support to manage user accounts', () => {
    expect(canManageUserAccounts(technicalSupport)).toBe(true);
    expect(canManageUserAccounts(head)).toBe(true);
    expect(canManageUserAccounts(principal)).toBe(true);
    expect(isStaff(clubsAdmin)).toBe(true);
    expect(isStaff(technicalSupport)).toBe(false);
    expect(isFullAdmin(technicalSupport)).toBe(false);
    expect(() => {
      requireUserAccountAdmin(technicalSupport);
    }).not.toThrow();
    expect(() => {
      requireUserAccountAdmin(head);
    }).not.toThrow();
  });

  it('can manage every role target while preserving non-admin denials', () => {
    for (const role of ROLES) {
      expect(canManageUserAccountRole(technicalSupport, role)).toBe(true);
      expect(canManageUserAccountRole(head, role)).toBe(true);
    }
    expect(canManageUserAccountRole(supervisor, 'Parent')).toBe(false);
    expect(canManageUserAccountRole(head, 'Supervisor')).toBe(true);
  });
});

describe('staff parent volunteer access', () => {
  it('allows Head and Technical Support to manage access', () => {
    expect(canManageStaffParentVolunteerAccess(head)).toBe(true);
    expect(canManageStaffParentVolunteerAccess(technicalSupport)).toBe(true);
    expect(canManageStaffParentVolunteerAccess(principal)).toBe(false);
    expect(canManageStaffParentVolunteerAccess(supervisor)).toBe(false);
  });

  it('allows every role except Parent and Student to receive access', () => {
    expect(isStaffParentVolunteerEligibleRole({ role: 'ClubsLead' })).toBe(true);
    expect(isStaffParentVolunteerEligibleRole({ role: 'Parent' })).toBe(false);
    expect(isStaffParentVolunteerEligibleRole({ role: 'Student' })).toBe(false);
  });

  it('resolves Parent, entitled staff, and every denied staff entitlement state', () => {
    expect(
      resolveParentVolunteerAccess({
        active: false,
        activeGuardianCount: 0,
        role: 'Parent',
        staffParentVolunteerAccess: false,
      }),
    ).toBe('parent');
    expect(
      resolveParentVolunteerAccess({
        active: true,
        activeGuardianCount: 1,
        role: 'ClubsLead',
        staffParentVolunteerAccess: true,
      }),
    ).toBe('staff');

    for (const deniedCandidate of [
      {
        active: false,
        activeGuardianCount: 1,
        role: 'Supervisor' as const,
        staffParentVolunteerAccess: true,
      },
      {
        active: true,
        activeGuardianCount: 0,
        role: 'Supervisor' as const,
        staffParentVolunteerAccess: true,
      },
      {
        active: true,
        activeGuardianCount: 1,
        role: 'Supervisor' as const,
        staffParentVolunteerAccess: false,
      },
      {
        active: true,
        activeGuardianCount: 1,
        role: 'Student' as const,
        staffParentVolunteerAccess: true,
      },
    ]) {
      expect(resolveParentVolunteerAccess(deniedCandidate)).toBeNull();
    }
  });

  it('shares route and navigation access', () => {
    expect(canUseParentVolunteerNavigation('parent')).toBe(true);
    expect(canUseParentVolunteerNavigation('staff')).toBe(true);
    expect(canUseParentVolunteerNavigation(null)).toBe(false);
  });
});

describe('invoice finance administration', () => {
  it('allows full admins and finance tagged staff to manage invoices', () => {
    expect(canManageInvoices(head)).toBe(true);
    expect(canManageInvoices(principal)).toBe(true);
    expect(canManageInvoices({ ...supervisor, tags: ['finance-admin'] })).toBe(true);
    expect(canManageInvoices({ ...technicalSupport, tags: ['finance-admin'] })).toBe(true);
    expect(canManageInvoices(supervisor)).toBe(false);
    expect(canManageInvoices(technicalSupport)).toBe(false);
    expect(canManageInvoices({ ...clubsLead, tags: ['finance-admin'] })).toBe(false);
    expect(canManageInvoices({ ...parent, tags: ['finance-admin'] })).toBe(false);
    expect(canManageInvoices({ ...student, tags: ['finance-admin'] })).toBe(false);

    expect(() => {
      requireCanManageInvoices({ ...supervisor, tags: ['finance-admin'] });
    }).not.toThrow();
    expect(() => {
      requireCanManageInvoices({ ...technicalSupport, tags: ['finance-admin'] });
    }).not.toThrow();
    expect(() => {
      requireCanManageInvoices(parent);
    }).toThrow(AccessDeniedError);
  });

  it('limits student finance visibility to Pastor and Principal', () => {
    expect(canViewStudentFinance(principal)).toBe(true);
    expect(canViewStudentFinance(pastor)).toBe(true);
    expect(canViewStudentFinance(head)).toBe(false);
    expect(canViewStudentFinance(hod)).toBe(false);
    const financeTaggedSupervisor: SessionUser = { ...supervisor, tags: ['finance-admin'] };
    expect(canViewStudentFinance(financeTaggedSupervisor)).toBe(false);
    expect(canViewStudentFinance(parent)).toBe(false);
    expect(canViewStudentFinance(student)).toBe(false);
  });
});

describe('canUseStaffMessaging', () => {
  it('allows all staffroom roles and blocks parent/student users', () => {
    for (const user of [head, principal, pastor, hod, technicalSupport, clubsAdmin, supervisor]) {
      expect(canUseStaffMessaging(user)).toBe(true);
    }
    expect(canUseStaffMessaging(clubsLead)).toBe(false);
    expect(canUseStaffMessaging(parent)).toBe(false);
    expect(canUseStaffMessaging(student)).toBe(false);
  });
});

describe('canUsePersonalTasks', () => {
  it('allows individual task lists for staffroom and technical support roles only', () => {
    for (const user of [head, principal, pastor, hod, technicalSupport, clubsAdmin, supervisor]) {
      expect(canUsePersonalTasks(user)).toBe(true);
    }

    expect(canUsePersonalTasks(clubsLead)).toBe(false);
    expect(canUsePersonalTasks(parent)).toBe(false);
    expect(canUsePersonalTasks(student)).toBe(false);
  });
});

describe('child registration prompt roles', () => {
  it('includes adult non-parent roles and excludes Parent and Student', () => {
    expect(canAnswerChildRegistrationPrompt(head)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(principal)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(pastor)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(hod)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(technicalSupport)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(clubsAdmin)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(clubsLead)).toBe(false);
    expect(canAnswerChildRegistrationPrompt(supervisor)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(parent)).toBe(false);
    expect(canAnswerChildRegistrationPrompt(student)).toBe(false);
  });

  it('allows registration for Parents or adult non-Parents who answered yes', () => {
    expect(canSubmitInitialRegistration(parent, 'Unanswered')).toBe(true);
    expect(canSubmitInitialRegistration(supervisor, 'HasChildren')).toBe(true);
    expect(canSubmitInitialRegistration(technicalSupport, 'HasChildren')).toBe(true);
    expect(canSubmitInitialRegistration(clubsAdmin, 'HasChildren')).toBe(true);
    expect(canSubmitInitialRegistration(supervisor, 'Unanswered')).toBe(false);
    expect(canSubmitInitialRegistration(supervisor, 'NoChildren')).toBe(false);
    expect(canSubmitInitialRegistration(student, 'HasChildren')).toBe(false);
  });
});

describe('linked-child guardian access', () => {
  it('allows Parent and adult child-registration roles while excluding Student and ClubsLead', () => {
    for (const user of [
      head,
      principal,
      pastor,
      hod,
      technicalSupport,
      clubsAdmin,
      supervisor,
      parent,
    ]) {
      expect(canUseLinkedChildGuardianAccess(user)).toBe(true);
    }

    expect(canUseLinkedChildGuardianAccess(clubsLead)).toBe(false);
    expect(canUseLinkedChildGuardianAccess(student)).toBe(false);
  });
});

describe('resolvePostSignInPortal', () => {
  it('sends users without completed 2FA to setup before portal routing', () => {
    expect(resolvePostSignInPortal({ ...head, requires2fa: true })).toBe('two-factor-required');
    expect(resolvePostSignInPortal({ ...parent, requires2fa: true })).toBe('two-factor-required');
  });

  it('sends full admins to the admin portal', () => {
    expect(resolvePostSignInPortal(head)).toBe('full-admin');
    expect(resolvePostSignInPortal(principal)).toBe('full-admin');
  });

  it('sends Technical Support to the normal admin operations portal', () => {
    expect(resolvePostSignInPortal(technicalSupport)).toBe('admin-operations');
  });

  it('sends supervisors and parents to their portals', () => {
    expect(resolvePostSignInPortal(supervisor)).toBe('supervisor');
    expect(resolvePostSignInPortal(parent)).toBe('parent');
  });

  it('sends clubs admins to the clubs portal', () => {
    expect(resolvePostSignInPortal(clubsAdmin)).toBe('clubs-admin');
  });

  it('sends clubs leads to the clubs lead portal', () => {
    expect(resolvePostSignInPortal(clubsLead)).toBe('clubs-lead');
  });

  it('sends students to the student portal', () => {
    expect(resolvePostSignInPortal(student)).toBe('student');
  });

  it('sends missing local users to not-ready', () => {
    expect(resolvePostSignInPortal(null)).toBe('not-ready');
  });
});

describe('hasCompletedTwoFactor', () => {
  it('accepts Clerk factor verification age only when the second factor has been verified', () => {
    expect(hasCompletedTwoFactor([0, 0])).toBe(true);
    expect(hasCompletedTwoFactor([9, 2])).toBe(true);
    expect(hasCompletedTwoFactor([9, -1])).toBe(false);
    expect(hasCompletedTwoFactor(null)).toBe(false);
    expect(hasCompletedTwoFactor([0])).toBe(false);
    expect(hasCompletedTwoFactor(['0', 0])).toBe(false);
    expect(hasCompletedTwoFactor([0, Number.NaN])).toBe(false);
  });
});

describe('canViewAuditLog', () => {
  it('allows Head without the audit-viewer tag', () => {
    expect(canViewAuditLog(head)).toBe(true);
  });

  it('allows tagged staff roles to view delegated audit access', () => {
    expect(canViewAuditLog({ ...principal, tags: ['audit-viewer'] })).toBe(true);
    expect(canViewAuditLog({ ...pastor, tags: ['audit-viewer'] })).toBe(true);
    expect(canViewAuditLog({ ...hod, tags: ['audit-viewer'] })).toBe(true);
    expect(canViewAuditLog({ ...technicalSupport, tags: ['audit-viewer'] })).toBe(true);
    expect(canViewAuditLog({ ...clubsAdmin, tags: ['audit-viewer'] })).toBe(true);
    expect(canViewAuditLog({ ...supervisor, tags: ['audit-viewer'] })).toBe(true);
  });

  it('rejects untagged non-Head roles and non-staff tagged roles', () => {
    expect(canViewAuditLog(principal)).toBe(false);
    expect(canViewAuditLog(pastor)).toBe(false);
    expect(canViewAuditLog(hod)).toBe(false);
    expect(canViewAuditLog(supervisor)).toBe(false);
    expect(canViewAuditLog(technicalSupport)).toBe(false);
    expect(canViewAuditLog({ ...clubsLead, tags: ['audit-viewer'] })).toBe(false);
    expect(canViewAuditLog({ ...parent, tags: ['audit-viewer'] })).toBe(false);
    expect(canViewAuditLog({ ...student, tags: ['audit-viewer'] })).toBe(false);
  });
});

describe('requireCanViewSensitive', () => {
  it('allows full admins to read global sensitive behaviour', () => {
    expect(() => {
      requireCanViewSensitive(head);
    }).not.toThrow();
    expect(() => {
      requireCanViewSensitive(principal);
    }).not.toThrow();
    expect(() => {
      requireCanViewSensitive(pastor);
    }).not.toThrow();
    expect(() => {
      requireCanViewSensitive(hod);
    }).not.toThrow();
    expect(() => {
      requireCanViewSensitive(supervisor);
    }).toThrow(AccessDeniedError);
    expect(() => {
      requireCanViewSensitive(parent);
    }).toThrow(AccessDeniedError);
  });

  it('allows supervisor workflow users to read only their own sensitive demerits', () => {
    expect(canViewSensitiveBehaviour(head)).toBe(true);
    expect(canViewSensitiveBehaviour(hod)).toBe(true);
    expect(canViewSensitiveBehaviour(principal)).toBe(true);
    expect(canViewSensitiveBehaviour(pastor)).toBe(true);
    expect(canViewSensitiveBehaviour(supervisor)).toBe(false);
    expect(canViewSensitiveBehaviour(clubsAdmin)).toBe(false);
    expect(canViewSensitiveBehaviour(clubsLead)).toBe(false);

    expect(
      canViewSensitiveBehaviourEntry(supervisor, {
        recordedById: supervisor.id,
        type: 'Demerit',
        visibility: 'Sensitive',
      }),
    ).toBe(true);
    expect(
      canViewSensitiveBehaviourEntry(supervisor, {
        recordedById: 'another-supervisor',
        type: 'Demerit',
        visibility: 'Sensitive',
      }),
    ).toBe(false);
    expect(
      canViewSensitiveBehaviourEntry(supervisor, {
        recordedById: supervisor.id,
        type: 'General',
        visibility: 'Sensitive',
      }),
    ).toBe(true);
    expect(
      canViewSensitiveBehaviourEntry(supervisor, {
        recordedById: 'another-supervisor',
        type: 'General',
        visibility: 'Sensitive',
      }),
    ).toBe(false);
    expect(
      canViewSensitiveBehaviourEntry(supervisor, {
        recordedById: supervisor.id,
        type: 'Merit',
        visibility: 'Sensitive',
      }),
    ).toBe(false);
    expect(
      canViewSensitiveBehaviourEntry(clubsAdmin, {
        recordedById: clubsAdmin.id,
        type: 'Demerit',
        visibility: 'Sensitive',
      }),
    ).toBe(true);
  });

  it('limits sensitive behaviour creation to full admins or staff demerits', () => {
    expect(canCreateSensitiveBehaviour(head, { type: 'Merit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(hod, { type: 'Demerit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(principal, { type: 'Demerit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(pastor, { type: 'Merit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(supervisor, { type: 'Demerit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(supervisor, { type: 'General' })).toBe(true);
    expect(canCreateSensitiveBehaviour(supervisor, { type: 'Merit' })).toBe(false);
    expect(canCreateSensitiveBehaviour(clubsAdmin, { type: 'Demerit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(clubsAdmin, { type: 'General' })).toBe(true);
    expect(canCreateSensitiveBehaviour(clubsAdmin, { type: 'Merit' })).toBe(false);
    expect(canCreateSensitiveBehaviour(clubsLead, { type: 'Demerit' })).toBe(false);
    expect(canCreateSensitiveBehaviour(clubsLead, { type: 'General' })).toBe(false);
    expect(canCreateSensitiveBehaviour(clubsLead, { type: 'Merit' })).toBe(false);
  });
});

describe('requireTag', () => {
  it('accepts users with the tag', () => {
    const seller: SessionUser = {
      id: 'u9',
      role: 'Supervisor',
      tags: ['shopkeeper'],
      requires2fa: false,
    };
    expect(() => {
      requireTag(seller, 'shopkeeper');
    }).not.toThrow();
  });
  it('rejects users without the tag', () => {
    expect(() => {
      requireTag(supervisor, 'shopkeeper');
    }).toThrow(AccessDeniedError);
  });
});

describe('workflow tags', () => {
  it('keeps ClubsLead outside full-admin and staff workflows while respecting explicit tags', () => {
    const taggedClubsLead: SessionUser = {
      ...clubsLead,
      tags: [
        'attendance-recorder',
        'attendance-exporter',
        'sensitive-note-viewer',
        'behaviour-viewer',
        'student-drillthrough-viewer',
        'pace-full-access',
        'supervisor-all-students',
        'supervisor-primary-students',
        'calendar-manager',
        'parent-message-responder',
      ],
    };

    expect(isStaff(taggedClubsLead)).toBe(false);
    expect(canUseClubsLeadPortal(taggedClubsLead)).toBe(true);
    expect(canUseClubLeadAccess(taggedClubsLead)).toBe(true);
    expect(canRecordStudentAttendance(taggedClubsLead)).toBe(false);
    expect(canExportAttendance(taggedClubsLead)).toBe(false);
    expect(canViewSensitiveChildNotes(taggedClubsLead)).toBe(false);
    expect(canViewBehaviourReports(taggedClubsLead)).toBe(false);
    expect(canViewAnyStudentDrillThrough(taggedClubsLead)).toBe(false);
    expect(canUseFullPaceAccess(taggedClubsLead)).toBe(false);
    expect(canUseAllStudentSupervisorWorkflow(taggedClubsLead)).toBe(false);
    expect(canUsePrimaryStudentSupervisorWorkflow(taggedClubsLead)).toBe(false);
    expect(canManageCalendar(taggedClubsLead)).toBe(false);
    expect(canRespondToParentMessages(taggedClubsLead)).toBe(true);
    expect(() => {
      requireClubsLead(taggedClubsLead);
    }).not.toThrow();
    expect(() => {
      requireClubsLead(supervisor);
    }).toThrow(AccessDeniedError);
  });

  it('allows the club-lead tag without changing normal supervisor permissions', () => {
    const taggedSupervisor: SessionUser = {
      ...supervisor,
      tags: ['club-lead', 'attendance-recorder'],
    };

    expect(canUseClubsLeadPortal(taggedSupervisor)).toBe(false);
    expect(canUseClubLeadAccess(taggedSupervisor)).toBe(true);
    expect(isStaff(taggedSupervisor)).toBe(true);
    expect(canRecordStudentAttendance(taggedSupervisor)).toBe(true);
  });

  it('allows attendance recording for operational admins or attendance-recorder', () => {
    expect(canRecordStudentAttendance(head)).toBe(true);
    expect(canRecordStudentAttendance(principal)).toBe(true);
    expect(canRecordStudentAttendance(pastor)).toBe(true);
    expect(canRecordStudentAttendance(technicalSupport)).toBe(true);
    expect(canRecordStudentAttendance(supervisor)).toBe(false);
    expect(canRecordStudentAttendance({ ...supervisor, tags: ['attendance-recorder'] })).toBe(true);
  });

  it('allows attendance exports for operational admins or attendance-exporter', () => {
    expect(canExportAttendance(head)).toBe(true);
    expect(canExportAttendance(principal)).toBe(true);
    expect(canExportAttendance(supervisor)).toBe(false);
    expect(canExportAttendance({ ...supervisor, tags: ['attendance-exporter'] })).toBe(true);
    expect(canExportAttendance(technicalSupport)).toBe(true);
  });

  it('limits sensitive child notes to full-admin or sensitive-note-viewer', () => {
    expect(canViewSensitiveChildNotes(head)).toBe(true);
    expect(canViewSensitiveChildNotes(principal)).toBe(true);
    expect(canViewSensitiveChildNotes(pastor)).toBe(true);
    expect(canViewSensitiveChildNotes(supervisor)).toBe(false);
    expect(canViewSensitiveChildNotes({ ...supervisor, tags: ['sensitive-note-viewer'] })).toBe(
      true,
    );
    expect(canViewSensitiveChildNotes(technicalSupport)).toBe(false);
  });

  it('lets HeadOfDiscipline use behaviour reports by default', () => {
    expect(canViewBehaviourReports(head)).toBe(true);
    expect(canViewBehaviourReports(hod)).toBe(true);
    expect(canViewBehaviourReports(supervisor)).toBe(false);
    expect(canViewBehaviourReports({ ...supervisor, tags: ['behaviour-viewer'] })).toBe(true);
    expect(canViewBehaviourReports(technicalSupport)).toBe(true);
  });

  it('limits scoped student drill-through reads to adults who can be linked to children', () => {
    expect(canViewAnyStudentDrillThrough(head)).toBe(true);
    expect(canViewAnyStudentDrillThrough(hod)).toBe(true);
    expect(canViewAnyStudentDrillThrough(supervisor)).toBe(false);
    expect(
      canViewAnyStudentDrillThrough({ ...supervisor, tags: ['student-drillthrough-viewer'] }),
    ).toBe(true);
    expect(canViewStudentDrillThrough(supervisor)).toBe(true);
    expect(canViewStudentDrillThrough(parent)).toBe(true);
    expect(canViewStudentDrillThrough(student)).toBe(false);
    expect(canViewStudentDrillThrough(technicalSupport)).toBe(true);
    expect(canViewStudentDrillThrough(clubsAdmin)).toBe(true);
  });

  it('limits sensitive student drill-through data to full admins', () => {
    expect(canViewSensitiveStudentDrillThrough(head)).toBe(true);
    expect(canViewSensitiveStudentDrillThrough(principal)).toBe(true);
    expect(canViewSensitiveStudentDrillThrough(pastor)).toBe(true);
    expect(canViewSensitiveStudentDrillThrough(hod)).toBe(true);
    expect(
      canViewSensitiveStudentDrillThrough({ ...supervisor, tags: ['student-drillthrough-viewer'] }),
    ).toBe(false);
    expect(canViewSensitiveStudentDrillThrough(parent)).toBe(false);
    expect(canViewSensitiveStudentDrillThrough(technicalSupport)).toBe(false);
  });

  it('allows full PACE access for operational admins or the pace-full-access tag', () => {
    expect(canUseFullPaceAccess(head)).toBe(true);
    expect(canUseFullPaceAccess(hod)).toBe(true);
    expect(canUseFullPaceAccess(supervisor)).toBe(false);
    expect(canUseFullPaceAccess({ ...supervisor, tags: ['pace-full-access'] })).toBe(true);
    expect(canUseFullPaceAccess(parent)).toBe(false);
    expect(canUseFullPaceAccess({ ...parent, tags: ['pace-full-access'] })).toBe(true);
    expect(canUseFullPaceAccess(technicalSupport)).toBe(true);
  });

  it('limits all-student supervisor workflow access to full admins or tagged staff operators', () => {
    expect(canUseAllStudentSupervisorWorkflow(head)).toBe(true);
    expect(canUseAllStudentSupervisorWorkflow(hod)).toBe(true);
    expect(canUseAllStudentSupervisorWorkflow(supervisor)).toBe(false);
    expect(
      canUseAllStudentSupervisorWorkflow({
        ...supervisor,
        tags: ['supervisor-all-students'],
      }),
    ).toBe(true);
    expect(
      canUseAllStudentSupervisorWorkflow({
        ...clubsAdmin,
        tags: ['supervisor-all-students'],
      }),
    ).toBe(true);
    expect(
      canUseAllStudentSupervisorWorkflow({
        ...parent,
        tags: ['supervisor-all-students'],
      }),
    ).toBe(false);
    expect(canUseAllStudentSupervisorWorkflow(technicalSupport)).toBe(true);
  });

  it('limits primary-student supervisor workflow access to tagged staff operators', () => {
    expect(PERMISSION_TAGS).toContain('supervisor-primary-students');
    expect(canUsePrimaryStudentSupervisorWorkflow(head)).toBe(false);
    expect(canUsePrimaryStudentSupervisorWorkflow(supervisor)).toBe(false);
    expect(
      canUsePrimaryStudentSupervisorWorkflow({
        ...supervisor,
        tags: ['supervisor-primary-students'],
      }),
    ).toBe(true);
    expect(
      canUsePrimaryStudentSupervisorWorkflow({
        ...clubsAdmin,
        tags: ['supervisor-primary-students'],
      }),
    ).toBe(true);
    expect(
      canUsePrimaryStudentSupervisorWorkflow({
        ...parent,
        tags: ['supervisor-primary-students'],
      }),
    ).toBe(false);
    expect(
      canUsePrimaryStudentSupervisorWorkflow({
        ...student,
        tags: ['supervisor-primary-students'],
      }),
    ).toBe(false);
    expect(canUsePrimaryStudentSupervisorWorkflow(technicalSupport)).toBe(false);
  });

  it('allows calendar management for operational admins or tagged staff', () => {
    expect(canManageCalendar(head)).toBe(true);
    expect(canManageCalendar(principal)).toBe(true);
    expect(canManageCalendar(pastor)).toBe(true);
    expect(canManageCalendar(hod)).toBe(true);
    expect(canManageCalendar({ ...principal, tags: ['calendar-manager'] })).toBe(true);
    expect(canManageCalendar(supervisor)).toBe(false);
    expect(canManageCalendar({ ...supervisor, tags: ['calendar-manager'] })).toBe(true);
    expect(canManageCalendar({ ...parent, tags: ['calendar-manager'] })).toBe(false);
    expect(canManageCalendar({ ...student, tags: ['calendar-manager'] })).toBe(false);
    expect(canManageCalendar(technicalSupport)).toBe(true);
  });

  it('allows parent message response for the Head or tagged users', () => {
    expect(canRespondToParentMessages(head)).toBe(true);
    expect(canRespondToParentMessages({ ...principal, tags: [] })).toBe(false);
    expect(canRespondToParentMessages(pastor)).toBe(false);
    expect(canRespondToParentMessages(hod)).toBe(false);
    expect(canRespondToParentMessages({ ...supervisor, tags: ['parent-message-responder'] })).toBe(
      true,
    );
    expect(canRespondToParentMessages({ ...parent, tags: ['parent-message-responder'] })).toBe(
      true,
    );
    expect(canRespondToParentMessages(technicalSupport)).toBe(false);
  });
});

describe('requireClubsAdminOrFullAdmin', () => {
  it('identifies club managers', () => {
    expect(canManageClubs(clubsAdmin)).toBe(true);
    expect(canManageClubs(head)).toBe(true);
    expect(canManageClubs(supervisor)).toBe(false);
    expect(canManageClubs(parent)).toBe(false);
  });

  it('accepts clubs admin and full admins', () => {
    expect(() => {
      requireClubsAdminOrFullAdmin(clubsAdmin);
    }).not.toThrow();
    expect(() => {
      requireClubsAdminOrFullAdmin(head);
    }).not.toThrow();
  });
  it('rejects supervisors, parents, students', () => {
    expect(() => {
      requireClubsAdminOrFullAdmin(supervisor);
    }).toThrow(AccessDeniedError);
    expect(() => {
      requireClubsAdminOrFullAdmin(parent);
    }).toThrow(AccessDeniedError);
  });
});

describe('requireOwnChild', () => {
  it('accepts a parent linked to the student', () => {
    expect(() => {
      requireOwnChild(parent, 's1', ['s1', 's2']);
    }).not.toThrow();
  });
  it('rejects a parent not linked to the student', () => {
    expect(() => {
      requireOwnChild(parent, 's9', ['s1', 's2']);
    }).toThrow(AccessDeniedError);
  });
  it('rejects non-Parent users', () => {
    expect(() => {
      requireOwnChild(head, 's1', ['s1']);
    }).toThrow(AccessDeniedError);
  });
});

describe('requireSelfStudent', () => {
  it('accepts a student viewing their own record', () => {
    expect(() => {
      requireSelfStudent(student, 's1', 'u9');
    }).not.toThrow();
  });
  it('rejects a student viewing another student', () => {
    expect(() => {
      requireSelfStudent(student, 's2', 'other-user');
    }).toThrow(AccessDeniedError);
  });
});
