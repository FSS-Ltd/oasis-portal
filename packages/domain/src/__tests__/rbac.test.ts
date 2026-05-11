import { describe, expect, it } from 'vitest';
import {
  AccessDeniedError,
  canAnswerChildRegistrationPrompt,
  canExportAttendance,
  canManageCalendar,
  canManageUserAccountRole,
  canManageUserAccounts,
  canRecordStudentAttendance,
  canRespondToParentMessages,
  canCreateSensitiveBehaviour,
  canUseFullPaceAccess,
  canViewAnyStudentDrillThrough,
  canViewBehaviourReports,
  canViewSensitiveBehaviour,
  canViewSensitiveChildNotes,
  canViewSensitiveBehaviourEntry,
  canViewSensitiveStudentDrillThrough,
  canViewStudentDrillThrough,
  canSubmitInitialRegistration,
  isFullAdmin,
  isStaff,
  requireCanViewSensitive,
  requireClubsAdminOrFullAdmin,
  requireUserAccountAdmin,
  requireFullAdmin,
  requireOwnChild,
  requireSelfStudent,
  requireTag,
  resolvePostSignInPortal,
  type SessionUser,
} from '../rbac.js';

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

describe('TechnicalSupport account administration', () => {
  it('is the only User Access account-admin role', () => {
    expect(canManageUserAccounts(technicalSupport)).toBe(true);
    expect(canManageUserAccounts(head)).toBe(false);
    expect(canManageUserAccounts(principal)).toBe(false);
    expect(isStaff(technicalSupport)).toBe(false);
    expect(isFullAdmin(technicalSupport)).toBe(false);
    expect(() => {
      requireUserAccountAdmin(technicalSupport);
    }).not.toThrow();
    expect(() => {
      requireUserAccountAdmin(head);
    }).toThrow(AccessDeniedError);
  });

  it('can manage Parent and TechnicalSupport account shells only', () => {
    expect(canManageUserAccountRole(technicalSupport, 'Parent')).toBe(true);
    expect(canManageUserAccountRole(technicalSupport, 'TechnicalSupport')).toBe(true);
    expect(canManageUserAccountRole(technicalSupport, 'Supervisor')).toBe(false);
    expect(canManageUserAccountRole(technicalSupport, 'Student')).toBe(false);
    expect(canManageUserAccountRole(technicalSupport, 'Head')).toBe(false);
    expect(canManageUserAccountRole(head, 'Supervisor')).toBe(true);
  });
});

describe('child registration prompt roles', () => {
  it('includes adult non-parent roles and excludes Parent/Student', () => {
    expect(canAnswerChildRegistrationPrompt(head)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(principal)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(pastor)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(hod)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(technicalSupport)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(clubsAdmin)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(supervisor)).toBe(true);
    expect(canAnswerChildRegistrationPrompt(parent)).toBe(false);
    expect(canAnswerChildRegistrationPrompt(student)).toBe(false);
  });

  it('allows registration for Parents or adult non-Parents who answered yes', () => {
    expect(canSubmitInitialRegistration(parent, 'Unanswered')).toBe(true);
    expect(canSubmitInitialRegistration(supervisor, 'HasChildren')).toBe(true);
    expect(canSubmitInitialRegistration(technicalSupport, 'HasChildren')).toBe(true);
    expect(canSubmitInitialRegistration(supervisor, 'Unanswered')).toBe(false);
    expect(canSubmitInitialRegistration(supervisor, 'NoChildren')).toBe(false);
    expect(canSubmitInitialRegistration(student, 'HasChildren')).toBe(false);
  });
});

describe('resolvePostSignInPortal', () => {
  it('sends full admins to the admin portal', () => {
    expect(resolvePostSignInPortal(head)).toBe('full-admin');
    expect(resolvePostSignInPortal(principal)).toBe('full-admin');
  });

  it('sends account admins to the access portal', () => {
    expect(resolvePostSignInPortal(technicalSupport)).toBe('account-admin');
  });

  it('sends supervisors and parents to their portals', () => {
    expect(resolvePostSignInPortal(supervisor)).toBe('supervisor');
    expect(resolvePostSignInPortal(parent)).toBe('parent');
  });

  it('sends signed-in users without a ready local portal to not-ready', () => {
    expect(resolvePostSignInPortal(student)).toBe('not-ready');
    expect(resolvePostSignInPortal(clubsAdmin)).toBe('not-ready');
  });

  it('sends missing local users to not-ready', () => {
    expect(resolvePostSignInPortal(null)).toBe('not-ready');
  });
});

describe('requireCanViewSensitive', () => {
  it('limits global sensitive behaviour reads to Head and HeadOfDiscipline', () => {
    expect(() => {
      requireCanViewSensitive(head);
    }).not.toThrow();
    expect(() => {
      requireCanViewSensitive(hod);
    }).not.toThrow();
    expect(() => {
      requireCanViewSensitive(principal);
    }).toThrow(AccessDeniedError);
    expect(() => {
      requireCanViewSensitive(pastor);
    }).toThrow(AccessDeniedError);
    expect(() => {
      requireCanViewSensitive(supervisor);
    }).toThrow(AccessDeniedError);
    expect(() => {
      requireCanViewSensitive(parent);
    }).toThrow(AccessDeniedError);
  });

  it('allows supervisors to read only their own sensitive demerits', () => {
    expect(canViewSensitiveBehaviour(head)).toBe(true);
    expect(canViewSensitiveBehaviour(hod)).toBe(true);
    expect(canViewSensitiveBehaviour(principal)).toBe(false);
    expect(canViewSensitiveBehaviour(pastor)).toBe(false);
    expect(canViewSensitiveBehaviour(supervisor)).toBe(false);

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
        type: 'Merit',
        visibility: 'Sensitive',
      }),
    ).toBe(false);
  });

  it('limits sensitive behaviour creation to Head, HeadOfDiscipline, or Supervisor demerits', () => {
    expect(canCreateSensitiveBehaviour(head, { type: 'Merit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(hod, { type: 'Demerit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(principal, { type: 'Demerit' })).toBe(false);
    expect(canCreateSensitiveBehaviour(pastor, { type: 'Merit' })).toBe(false);
    expect(canCreateSensitiveBehaviour(supervisor, { type: 'Demerit' })).toBe(true);
    expect(canCreateSensitiveBehaviour(supervisor, { type: 'Merit' })).toBe(false);
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
  it('limits attendance recording to Head or attendance-recorder', () => {
    expect(canRecordStudentAttendance(head)).toBe(true);
    expect(canRecordStudentAttendance(supervisor)).toBe(false);
    expect(canRecordStudentAttendance({ ...supervisor, tags: ['attendance-recorder'] })).toBe(true);
    expect(canRecordStudentAttendance(principal)).toBe(false);
  });

  it('limits attendance exports to full-admin or attendance-exporter', () => {
    expect(canExportAttendance(head)).toBe(true);
    expect(canExportAttendance(principal)).toBe(true);
    expect(canExportAttendance(supervisor)).toBe(false);
    expect(canExportAttendance({ ...supervisor, tags: ['attendance-exporter'] })).toBe(true);
    expect(canExportAttendance(technicalSupport)).toBe(false);
  });

  it('limits sensitive child notes to Head or sensitive-note-viewer', () => {
    expect(canViewSensitiveChildNotes(head)).toBe(true);
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
    expect(canViewBehaviourReports(technicalSupport)).toBe(false);
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

  it('limits sensitive student drill-through data to Head', () => {
    expect(canViewSensitiveStudentDrillThrough(head)).toBe(true);
    expect(canViewSensitiveStudentDrillThrough(hod)).toBe(false);
    expect(
      canViewSensitiveStudentDrillThrough({ ...supervisor, tags: ['student-drillthrough-viewer'] }),
    ).toBe(false);
    expect(canViewSensitiveStudentDrillThrough(parent)).toBe(false);
    expect(canViewSensitiveStudentDrillThrough(technicalSupport)).toBe(false);
  });

  it('allows full PACE access for full-admin roles or the pace-full-access tag', () => {
    expect(canUseFullPaceAccess(head)).toBe(true);
    expect(canUseFullPaceAccess(hod)).toBe(true);
    expect(canUseFullPaceAccess(supervisor)).toBe(false);
    expect(canUseFullPaceAccess({ ...supervisor, tags: ['pace-full-access'] })).toBe(true);
    expect(canUseFullPaceAccess(parent)).toBe(false);
    expect(canUseFullPaceAccess({ ...parent, tags: ['pace-full-access'] })).toBe(true);
    expect(canUseFullPaceAccess(technicalSupport)).toBe(false);
  });

  it('limits calendar management to Head or tagged staff', () => {
    expect(canManageCalendar(head)).toBe(true);
    expect(canManageCalendar(principal)).toBe(false);
    expect(canManageCalendar(hod)).toBe(false);
    expect(canManageCalendar({ ...principal, tags: ['calendar-manager'] })).toBe(true);
    expect(canManageCalendar(supervisor)).toBe(false);
    expect(canManageCalendar({ ...supervisor, tags: ['calendar-manager'] })).toBe(true);
    expect(canManageCalendar({ ...parent, tags: ['calendar-manager'] })).toBe(false);
    expect(canManageCalendar({ ...student, tags: ['calendar-manager'] })).toBe(false);
    expect(canManageCalendar({ ...technicalSupport, tags: ['calendar-manager'] })).toBe(false);
  });

  it('limits parent message response to Head or tagged full-admin users', () => {
    expect(canRespondToParentMessages(head)).toBe(true);
    expect(canRespondToParentMessages(principal)).toBe(false);
    expect(canRespondToParentMessages({ ...principal, tags: ['parent-message-responder'] })).toBe(
      true,
    );
    expect(canRespondToParentMessages({ ...supervisor, tags: ['parent-message-responder'] })).toBe(
      false,
    );
    expect(canRespondToParentMessages({ ...parent, tags: ['parent-message-responder'] })).toBe(
      false,
    );
  });
});

describe('requireClubsAdminOrFullAdmin', () => {
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
