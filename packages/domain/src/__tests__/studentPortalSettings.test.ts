import { describe, expect, it } from 'vitest';
import {
  canParentControlStudent,
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
  it('accepts null limits and positive minute limits within their windows', () => {
    expect(
      validateStudentPortalUsageLimits({
        hourlyUsageLimitMinutes: 30,
        dailyUsageLimitMinutes: 120,
        weeklyUsageLimitMinutes: null,
      }),
    ).toEqual({
      hourlyUsageLimitMinutes: 30,
      dailyUsageLimitMinutes: 120,
      weeklyUsageLimitMinutes: null,
    });
  });

  it('rejects zero, fractional, negative, and over-window usage limits', () => {
    expect(() => validateStudentPortalUsageLimits({ hourlyUsageLimitMinutes: 0 })).toThrow(
      /hourlyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ dailyUsageLimitMinutes: 90.5 })).toThrow(
      /dailyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ weeklyUsageLimitMinutes: -1 })).toThrow(
      /weeklyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ hourlyUsageLimitMinutes: 61 })).toThrow(
      /hourlyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ dailyUsageLimitMinutes: 1441 })).toThrow(
      /dailyUsageLimitMinutes/,
    );
    expect(() => validateStudentPortalUsageLimits({ weeklyUsageLimitMinutes: 10081 })).toThrow(
      /weeklyUsageLimitMinutes/,
    );
  });
});

describe('studentPortalUsageLimitStatus', () => {
  it('allows usage when no configured limit has been reached', () => {
    expect(
      studentPortalUsageLimitStatus(
        {
          hourlyUsageLimitMinutes: 30,
          dailyUsageLimitMinutes: 90,
          weeklyUsageLimitMinutes: 300,
        },
        {
          hourlyUsageMinutes: 12,
          dailyUsageMinutes: 45,
          weeklyUsageMinutes: 120,
        },
      ),
    ).toEqual({ allowed: true });
  });

  it('reports the shortest reached usage window first', () => {
    expect(
      studentPortalUsageLimitStatus(
        {
          hourlyUsageLimitMinutes: 30,
          dailyUsageLimitMinutes: 90,
          weeklyUsageLimitMinutes: 300,
        },
        {
          hourlyUsageMinutes: 30,
          dailyUsageMinutes: 90,
          weeklyUsageMinutes: 300,
        },
      ),
    ).toEqual({
      allowed: false,
      window: 'Hourly',
      limitMinutes: 30,
      usedMinutes: 30,
    });
  });

  it('checks daily and weekly limits independently when shorter limits are not configured', () => {
    expect(
      studentPortalUsageLimitStatus(
        {
          hourlyUsageLimitMinutes: null,
          dailyUsageLimitMinutes: 90,
          weeklyUsageLimitMinutes: 300,
        },
        {
          hourlyUsageMinutes: 60,
          dailyUsageMinutes: 90,
          weeklyUsageMinutes: 120,
        },
      ),
    ).toEqual({
      allowed: false,
      window: 'Daily',
      limitMinutes: 90,
      usedMinutes: 90,
    });

    expect(
      studentPortalUsageLimitStatus(
        {
          hourlyUsageLimitMinutes: null,
          dailyUsageLimitMinutes: null,
          weeklyUsageLimitMinutes: 300,
        },
        {
          hourlyUsageMinutes: 60,
          dailyUsageMinutes: 120,
          weeklyUsageMinutes: 300,
        },
      ),
    ).toEqual({
      allowed: false,
      window: 'Weekly',
      limitMinutes: 300,
      usedMinutes: 300,
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
