import { describe, expect, it } from 'vitest';
import {
  assertCanManageClub,
  canOperateAssignedClub,
  canSignUpForClub,
  canUseLinkedChildClubSignup,
  clubMatchesYearGroupBands,
  formatClubSchedule,
  validateClubDraft,
} from '../clubs.js';
import { AccessDeniedError, type SessionUser } from '../rbac.js';

describe('validateClubDraft', () => {
  it('trims name and accepts a valid draft', () => {
    const d = validateClubDraft({ name: '  Choir  ', capacity: 10 });
    expect(d.name).toBe('Choir');
  });
  it('rejects empty name', () => {
    expect(() => validateClubDraft({ name: '' })).toThrow();
  });
  it('rejects non-positive capacity', () => {
    expect(() => validateClubDraft({ name: 'x', capacity: 0 })).toThrow();
    expect(() => validateClubDraft({ name: 'x', capacity: -5 })).toThrow();
  });
});

describe('assertCanManageClub', () => {
  const head: SessionUser = { id: 'u1', role: 'Head', tags: [], requires2fa: false };
  const clubsAdmin: SessionUser = {
    id: 'u2',
    role: 'ClubsAdmin',
    tags: [],
    requires2fa: false,
  };
  const supervisor: SessionUser = { id: 'u3', role: 'Supervisor', tags: [], requires2fa: false };

  it('allows full admin and ClubsAdmin', () => {
    expect(() => {
      assertCanManageClub(head);
    }).not.toThrow();
    expect(() => {
      assertCanManageClub(clubsAdmin);
    }).not.toThrow();
  });
  it('blocks supervisors', () => {
    expect(() => {
      assertCanManageClub(supervisor);
    }).toThrow(AccessDeniedError);
  });
});

describe('canSignUpForClub', () => {
  it('blocks duplicate signups', () => {
    expect(canSignUpForClub({ currentActiveSignups: 0, alreadySignedUp: true })).toMatch(/already/);
  });
  it('blocks when capacity is full', () => {
    expect(
      canSignUpForClub({ capacity: 5, currentActiveSignups: 5, alreadySignedUp: false }),
    ).toMatch(/capacity/);
  });
  it('allows otherwise', () => {
    expect(canSignUpForClub({ currentActiveSignups: 3, alreadySignedUp: false })).toBe(true);
    expect(
      canSignUpForClub({ capacity: 10, currentActiveSignups: 3, alreadySignedUp: false }),
    ).toBe(true);
  });
});

describe('club eligibility', () => {
  const bands = [
    { id: 'lower', name: 'Lower Primary', standardYears: ['Reception', 'Year 1'] },
    { id: 'upper', name: 'Upper Primary', standardYears: ['Year 2', 'Year 3', 'Year 4'] },
  ];

  it('matches a child against any selected year-group band', () => {
    expect(clubMatchesYearGroupBands('Year 3', bands)).toBe(true);
    expect(clubMatchesYearGroupBands('Y3', bands)).toBe(true);
    expect(clubMatchesYearGroupBands('Year 7', bands)).toBe(false);
  });

  it('treats a club with no selected bands as unavailable', () => {
    expect(clubMatchesYearGroupBands('Year 3', [])).toBe(false);
  });
});

describe('formatClubSchedule', () => {
  it('renders the weekly day and 24-hour time range', () => {
    expect(
      formatClubSchedule({
        startDate: new Date('2026-09-08T00:00:00.000Z'),
        startMinute: 15 * 60 + 30,
        endMinute: 16 * 60 + 30,
        frequency: 'Weekly',
      }),
    ).toBe('Tuesdays · 15:30–16:30');
  });
});

describe('canUseLinkedChildClubSignup', () => {
  it('allows parents, ClubsLead, clubs admins, supervisors, and full-admin child-registration roles', () => {
    expect(canUseLinkedChildClubSignup({ role: 'Parent' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'ClubsAdmin' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'Supervisor' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'Head' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'ClubsLead' })).toBe(true);
  });

  it('blocks Student accounts', () => {
    expect(canUseLinkedChildClubSignup({ role: 'Student' })).toBe(false);
  });
});

describe('canOperateAssignedClub', () => {
  it('allows ClubsLead users only for clubs they are assigned to', () => {
    const clubsLead: SessionUser = {
      id: 'u10',
      role: 'ClubsLead',
      tags: [],
      requires2fa: false,
    };
    const clubsAdmin: SessionUser = {
      id: 'u11',
      role: 'ClubsAdmin',
      tags: [],
      requires2fa: false,
    };

    expect(canOperateAssignedClub(clubsLead, ['club-a', 'club-b'], 'club-a')).toBe(true);
    expect(canOperateAssignedClub(clubsLead, ['club-a', 'club-b'], 'club-c')).toBe(false);
    expect(canOperateAssignedClub(clubsAdmin, ['club-a'], 'club-a')).toBe(false);
  });

  it('allows tagged adult users to operate assigned clubs', () => {
    const taggedSupervisor: SessionUser = {
      id: 'u12',
      role: 'Supervisor',
      tags: ['club-lead'],
      requires2fa: false,
    };

    expect(canOperateAssignedClub(taggedSupervisor, ['club-a'], 'club-a')).toBe(true);
    expect(canOperateAssignedClub(taggedSupervisor, ['club-a'], 'club-b')).toBe(false);
  });
});
