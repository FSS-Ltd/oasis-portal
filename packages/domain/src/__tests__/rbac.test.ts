import { describe, expect, it } from 'vitest';
import {
  AccessDeniedError,
  canRecordStudentAttendance,
  canViewAnyStudentDrillThrough,
  canViewBehaviourReports,
  canViewSensitiveChildNotes,
  canViewSensitiveStudentDrillThrough,
  canViewStudentDrillThrough,
  isFullAdmin,
  requireCanViewSensitive,
  requireClubsAdminOrFullAdmin,
  requireFullAdmin,
  requireOwnChild,
  requireSelfStudent,
  requireTag,
  type SessionUser,
} from '../rbac.js';

const head: SessionUser = { id: 'u1', role: 'Head', tags: [], requires2fa: false };
const principal: SessionUser = { id: 'u2', role: 'Principal', tags: [], requires2fa: false };
const pastor: SessionUser = { id: 'u3', role: 'Pastor', tags: [], requires2fa: false };
const hod: SessionUser = { id: 'u4', role: 'HeadOfDiscipline', tags: [], requires2fa: false };
const clubsAdmin: SessionUser = { id: 'u5', role: 'ClubsAdmin', tags: [], requires2fa: false };
const supervisor: SessionUser = { id: 'u6', role: 'Supervisor', tags: [], requires2fa: false };
const parent: SessionUser = { id: 'u7', role: 'Parent', tags: [], requires2fa: false };
const student: SessionUser = { id: 'u8', role: 'Student', tags: [], requires2fa: false };

describe('isFullAdmin', () => {
  it('treats Head, Principal, Pastor, HeadOfDiscipline as full admins', () => {
    expect(isFullAdmin(head)).toBe(true);
    expect(isFullAdmin(principal)).toBe(true);
    expect(isFullAdmin(pastor)).toBe(true);
    expect(isFullAdmin(hod)).toBe(true);
  });
  it('rejects non-admin roles', () => {
    expect(isFullAdmin(clubsAdmin)).toBe(false);
    expect(isFullAdmin(supervisor)).toBe(false);
    expect(isFullAdmin(parent)).toBe(false);
    expect(isFullAdmin(student)).toBe(false);
  });
});

describe('requireFullAdmin', () => {
  it('passes for full-admin roles', () => {
    expect(() => { requireFullAdmin(head); }).not.toThrow();
    expect(() => { requireFullAdmin(pastor); }).not.toThrow();
  });
  it('throws AccessDeniedError otherwise', () => {
    expect(() => { requireFullAdmin(supervisor); }).toThrow(AccessDeniedError);
  });
});

describe('requireCanViewSensitive', () => {
  it('only full admins can view sensitive entries', () => {
    expect(() => { requireCanViewSensitive(head); }).not.toThrow();
    expect(() => { requireCanViewSensitive(supervisor); }).toThrow(AccessDeniedError);
    expect(() => { requireCanViewSensitive(parent); }).toThrow(AccessDeniedError);
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
    expect(() => { requireTag(seller, 'shopkeeper'); }).not.toThrow();
  });
  it('rejects users without the tag', () => {
    expect(() => { requireTag(supervisor, 'shopkeeper'); }).toThrow(AccessDeniedError);
  });
});

describe('workflow tags', () => {
  it('limits attendance recording to Head or attendance-recorder', () => {
    expect(canRecordStudentAttendance(head)).toBe(true);
    expect(canRecordStudentAttendance(supervisor)).toBe(false);
    expect(canRecordStudentAttendance({ ...supervisor, tags: ['attendance-recorder'] })).toBe(true);
    expect(canRecordStudentAttendance(principal)).toBe(false);
  });

  it('limits sensitive child notes to Head or sensitive-note-viewer', () => {
    expect(canViewSensitiveChildNotes(head)).toBe(true);
    expect(canViewSensitiveChildNotes(supervisor)).toBe(false);
    expect(canViewSensitiveChildNotes({ ...supervisor, tags: ['sensitive-note-viewer'] })).toBe(true);
  });

  it('lets HeadOfDiscipline use behaviour reports by default', () => {
    expect(canViewBehaviourReports(head)).toBe(true);
    expect(canViewBehaviourReports(hod)).toBe(true);
    expect(canViewBehaviourReports(supervisor)).toBe(false);
    expect(canViewBehaviourReports({ ...supervisor, tags: ['behaviour-viewer'] })).toBe(true);
  });

  it('limits student drill-through reads to full-admin, tagged staff, or parents', () => {
    expect(canViewAnyStudentDrillThrough(head)).toBe(true);
    expect(canViewAnyStudentDrillThrough(hod)).toBe(true);
    expect(canViewAnyStudentDrillThrough(supervisor)).toBe(false);
    expect(canViewAnyStudentDrillThrough({ ...supervisor, tags: ['student-drillthrough-viewer'] })).toBe(true);
    expect(canViewStudentDrillThrough(parent)).toBe(true);
    expect(canViewStudentDrillThrough(student)).toBe(false);
  });

  it('limits sensitive student drill-through data to Head', () => {
    expect(canViewSensitiveStudentDrillThrough(head)).toBe(true);
    expect(canViewSensitiveStudentDrillThrough(hod)).toBe(false);
    expect(canViewSensitiveStudentDrillThrough({ ...supervisor, tags: ['student-drillthrough-viewer'] })).toBe(false);
    expect(canViewSensitiveStudentDrillThrough(parent)).toBe(false);
  });
});

describe('requireClubsAdminOrFullAdmin', () => {
  it('accepts clubs admin and full admins', () => {
    expect(() => { requireClubsAdminOrFullAdmin(clubsAdmin); }).not.toThrow();
    expect(() => { requireClubsAdminOrFullAdmin(head); }).not.toThrow();
  });
  it('rejects supervisors, parents, students', () => {
    expect(() => { requireClubsAdminOrFullAdmin(supervisor); }).toThrow(AccessDeniedError);
    expect(() => { requireClubsAdminOrFullAdmin(parent); }).toThrow(AccessDeniedError);
  });
});

describe('requireOwnChild', () => {
  it('accepts a parent linked to the student', () => {
    expect(() => { requireOwnChild(parent, 's1', ['s1', 's2']); }).not.toThrow();
  });
  it('rejects a parent not linked to the student', () => {
    expect(() => { requireOwnChild(parent, 's9', ['s1', 's2']); }).toThrow(AccessDeniedError);
  });
  it('rejects non-Parent users', () => {
    expect(() => { requireOwnChild(head, 's1', ['s1']); }).toThrow(AccessDeniedError);
  });
});

describe('requireSelfStudent', () => {
  it('accepts a student viewing their own record', () => {
    expect(() => { requireSelfStudent(student, 's1', 'u8'); }).not.toThrow();
  });
  it('rejects a student viewing another student', () => {
    expect(() => { requireSelfStudent(student, 's2', 'other-user'); }).toThrow(AccessDeniedError);
  });
});
