import { describe, expect, it } from 'vitest';
import {
  APP_REVIEW_SEED_CONFIRMATION,
  buildAppReviewPlan,
  reviewClerkIds,
  validateAppReviewSeedEnvironment,
} from '../../scripts/app-review-seed.js';

const env = {
  OASIS_APP_REVIEW_STAFF_PASSWORD: 'staff-password-123',
  OASIS_APP_REVIEW_PARENT_PASSWORD: 'parent-password-456',
};

describe('app review seed', () => {
  it('hands out exactly one staff and one parent username, each with its own password', () => {
    const { plan, logins } = buildAppReviewPlan(env);

    expect(logins.map(({ username, password }) => ({ username, password }))).toEqual([
      { username: 'oasis-review-staff', password: 'staff-password-123' },
      { username: 'oasis-review-parent', password: 'parent-password-456' },
    ]);
    const staff = plan.users.find((user) => user.id === logins[0]?.userId);
    const parent = plan.users.find((user) => user.id === logins[1]?.userId);
    expect(staff?.role).toBe('Head');
    expect(parent?.role).toBe('Parent');
    expect(plan.students.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every non-login user an inert placeholder Clerk id', () => {
    const { plan, logins } = buildAppReviewPlan(env);
    const ids = reviewClerkIds(
      plan,
      new Map(logins.map((login) => [login.userId, `user_real_${login.userId}`])),
    );

    expect(ids.size).toBe(plan.users.length);
    const real = [...ids.values()].filter((id) => id.startsWith('user_real_'));
    expect(real).toHaveLength(2);
    for (const [userId, clerkId] of ids) {
      if (!clerkId.startsWith('user_real_')) expect(clerkId).toBe(`review_noclerk_${userId}`);
    }
  });

  it('requires a strong password for each login', () => {
    expect(() => buildAppReviewPlan({ ...env, OASIS_APP_REVIEW_PARENT_PASSWORD: '' })).toThrow(
      /OASIS_APP_REVIEW_PARENT_PASSWORD/,
    );
    expect(() => buildAppReviewPlan({ ...env, OASIS_APP_REVIEW_PARENT_PASSWORD: 'short' })).toThrow(
      /at least 12/,
    );
  });

  it('refuses to seed without the confirmation phrase', () => {
    expect(() => {
      validateAppReviewSeedEnvironment({}, 'review');
    }).toThrow(/CONFIRMATION/);
  });

  it('refuses to seed any schema other than review, including public', () => {
    const seedEnv = { OASIS_APP_REVIEW_SEED_CONFIRMATION: APP_REVIEW_SEED_CONFIRMATION };
    expect(() => {
      validateAppReviewSeedEnvironment(seedEnv, 'public');
    }).toThrow(/expected "review"/);
    expect(() => {
      validateAppReviewSeedEnvironment(seedEnv, 'review');
    }).not.toThrow();
  });
});
