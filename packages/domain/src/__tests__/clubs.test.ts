import { describe, expect, it } from 'vitest';
import {
  assertCanManageClub,
  canSignUpForClub,
  canUseLinkedChildClubSignup,
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

describe('canUseLinkedChildClubSignup', () => {
  it('allows parents, clubs admins, supervisors, and full-admin child-registration roles', () => {
    expect(canUseLinkedChildClubSignup({ role: 'Parent' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'ClubsAdmin' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'Supervisor' })).toBe(true);
    expect(canUseLinkedChildClubSignup({ role: 'Head' })).toBe(true);
  });

  it('blocks Student accounts', () => {
    expect(canUseLinkedChildClubSignup({ role: 'Student' })).toBe(false);
  });
});
