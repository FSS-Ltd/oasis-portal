import { describe, expect, it } from 'vitest';
import {
  canParentControlStudent,
  canUseLinkedChildStudentSettingsAccess,
  effectiveStudentPortalLock,
  isStudentAdult,
  studentMeritShopAccess,
  studentPortalUsageLimitStatus,
  validateStudentPortalUsageLimits,
} from '../studentPortalSettings.js';

const asOf = new Date('2026-06-03T12:00:00.000Z');

describe('student portal parent control eligibility', () => {
  it('allows parent control for students under 18', () => {
    expect(canParentControlStudent({ dateOfBirth: '2008-06-04', asOf })).toBe(true);
  });

  it('treats students as adult on their 18th birthday', () => {
    expect(isStudentAdult({ dateOfBirth: '2008-06-03', asOf })).toBe(true);
    expect(canParentControlStudent({ dateOfBirth: '2008-06-03', asOf })).toBe(false);
  });

  it('keeps parent control disabled after the student is over 18', () => {
    expect(canParentControlStudent({ dateOfBirth: '2008-06-02', asOf })).toBe(false);
  });
});

describe('canUseLinkedChildStudentSettingsAccess', () => {
  it('allows parents and adult linked-child guardian roles', () => {
    expect(canUseLinkedChildStudentSettingsAccess({ role: 'Parent' })).toBe(true);
    expect(canUseLinkedChildStudentSettingsAccess({ role: 'Supervisor' })).toBe(true);
    expect(canUseLinkedChildStudentSettingsAccess({ role: 'ClubsAdmin' })).toBe(true);
    expect(canUseLinkedChildStudentSettingsAccess({ role: 'Head' })).toBe(true);
  });

  it('rejects student and clubs-lead roles', () => {
    expect(canUseLinkedChildStudentSettingsAccess({ role: 'Student' })).toBe(false);
    expect(canUseLinkedChildStudentSettingsAccess({ role: 'ClubsLead' })).toBe(false);
  });
});

describe('effectiveStudentPortalLock', () => {
  it('reports unlocked settings', () => {
    expect(
      effectiveStudentPortalLock({
        parentAccountLocked: false,
        headAcademicLocked: false,
      }),
    ).toEqual({ locked: false, sources: [] });
  });

  it('keeps parent and Head academic locks distinguishable', () => {
    expect(
      effectiveStudentPortalLock({
        parentAccountLocked: true,
        headAcademicLocked: true,
      }),
    ).toEqual({
      locked: true,
      primarySource: 'HeadAcademic',
      sources: ['Parent', 'HeadAcademic'],
    });
  });
});

describe('validateStudentPortalUsageLimits', () => {
  it('accepts unlimited daily limits and no off-limit days by default', () => {
    expect(
      validateStudentPortalUsageLimits({
        dailyUsageLimitMinutes: null,
      }),
    ).toEqual({
      dailyUsageLimitMinutes: null,
      offLimitWeekdays: [],
    });
  });

  it('accepts a daily minute limit and sorted off-limit weekdays', () => {
    expect(
      validateStudentPortalUsageLimits({
        dailyUsageLimitMinutes: 120,
        offLimitWeekdays: [6, 0, 3],
      }),
    ).toEqual({
      dailyUsageLimitMinutes: 120,
      offLimitWeekdays: [0, 3, 6],
    });
  });

  it('rejects zero, fractional, negative, and over-window daily limits', () => {
    expect(() => validateStudentPortalUsageLimits({ dailyUsageLimitMinutes: 0 })).toThrow(
      /dailyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ dailyUsageLimitMinutes: 90.5 })).toThrow(
      /dailyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ dailyUsageLimitMinutes: -1 })).toThrow(
      /dailyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ dailyUsageLimitMinutes: 1441 })).toThrow(
      /dailyUsageLimitMinutes/,
    );
  });

  it('rejects invalid and duplicate off-limit weekdays', () => {
    expect(() => validateStudentPortalUsageLimits({ offLimitWeekdays: [-1] })).toThrow(
      /offLimitWeekdays/,
    );
    expect(() => validateStudentPortalUsageLimits({ offLimitWeekdays: [7] })).toThrow(
      /offLimitWeekdays/,
    );
    expect(() => validateStudentPortalUsageLimits({ offLimitWeekdays: [1.5] })).toThrow(
      /offLimitWeekdays/,
    );
    expect(() => validateStudentPortalUsageLimits({ offLimitWeekdays: [2, 2] })).toThrow(
      /offLimitWeekdays/,
    );
  });
});

describe('studentPortalUsageLimitStatus', () => {
  it('allows usage when no configured limit has been reached', () => {
    expect(
      studentPortalUsageLimitStatus(
        {
          dailyUsageLimitMinutes: 90,
          offLimitWeekdays: [],
        },
        {
          dailyUsageMinutes: 45,
        },
        3,
      ),
    ).toEqual({ allowed: true });
  });

  it('blocks off-limit days before checking daily usage', () => {
    expect(
      studentPortalUsageLimitStatus(
        {
          dailyUsageLimitMinutes: 90,
          offLimitWeekdays: [3],
        },
        {
          dailyUsageMinutes: 90,
        },
        3,
      ),
    ).toEqual({
      allowed: false,
      reason: 'OffLimitDay',
      weekday: 3,
    });
  });

  it('blocks when the daily limit has been reached', () => {
    expect(
      studentPortalUsageLimitStatus(
        {
          dailyUsageLimitMinutes: 90,
          offLimitWeekdays: [],
        },
        {
          dailyUsageMinutes: 90,
        },
        3,
      ),
    ).toEqual({
      allowed: false,
      reason: 'DailyLimit',
      window: 'Daily',
      limitMinutes: 90,
      usedMinutes: 90,
    });
  });
});

describe('studentMeritShopAccess', () => {
  it('allows shop access when the account is active and not shop-blocked', () => {
    expect(
      studentMeritShopAccess({
        parentMeritShopBlocked: false,
        parentAccountLocked: false,
        headAcademicLocked: false,
      }),
    ).toEqual({ allowed: true });
  });

  it('blocks merit shop use when the parent shop block is active', () => {
    expect(
      studentMeritShopAccess({
        parentMeritShopBlocked: true,
        parentAccountLocked: false,
        headAcademicLocked: false,
      }),
    ).toEqual({ allowed: false, reason: 'ParentShopBlock' });
  });

  it('blocks merit shop use when the student account is locked', () => {
    expect(
      studentMeritShopAccess({
        parentMeritShopBlocked: false,
        parentAccountLocked: true,
        headAcademicLocked: false,
      }),
    ).toEqual({ allowed: false, reason: 'AccountLocked' });
  });
});
