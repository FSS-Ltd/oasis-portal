import { describe, expect, it } from 'vitest';
import {
  APP_REVIEW_SEED_CONFIRMATION,
  buildAppReviewPlan,
  reviewClerkIds,
  validateAppReviewSeedEnvironment,
} from '../../scripts/app-review-seed.js';

const input = { emailDomain: 'appreview.demo.example.com', password: 'review-password-123' };

describe('app review seed', () => {
  it('hands out exactly one staff and one parent login', () => {
    const { plan, logins } = buildAppReviewPlan(input);

    expect(logins.map((login) => login.email)).toEqual([
      'staff@appreview.demo.example.com',
      'parent@appreview.demo.example.com',
    ]);
    const staff = plan.users.find((user) => user.email === logins[0]?.email);
    const parent = plan.users.find((user) => user.email === logins[1]?.email);
    expect(staff?.role).toBe('Head');
    expect(parent?.role).toBe('Parent');
    expect(plan.students.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every non-login user an inert placeholder Clerk id', () => {
    const { plan, logins } = buildAppReviewPlan(input);
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

  it('refuses to seed without the confirmation phrase', () => {
    expect(() => {
      validateAppReviewSeedEnvironment({}, 'review');
    }).toThrow(/CONFIRMATION/);
  });

  it('refuses to seed any schema other than review, including public', () => {
    const env = { OASIS_APP_REVIEW_SEED_CONFIRMATION: APP_REVIEW_SEED_CONFIRMATION };
    expect(() => {
      validateAppReviewSeedEnvironment(env, 'public');
    }).toThrow(/expected "review"/);
    expect(() => {
      validateAppReviewSeedEnvironment(env, 'review');
    }).not.toThrow();
  });
});
