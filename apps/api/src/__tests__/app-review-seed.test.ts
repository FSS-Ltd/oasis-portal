import { randomBytes } from 'node:crypto';
import { blindIndex, encryptField } from '@oasis/db';
import { describe, expect, it } from 'vitest';
import {
  APP_REVIEW_SEED_CONFIRMATION,
  assertProductionKeys,
  buildAppReviewPlan,
  reviewClerkIds,
  validateAppReviewSeedEnvironment,
} from '../../scripts/app-review-seed.js';

const env = {
  OASIS_APP_REVIEW_STAFF_PASSWORD: 'staff-password-123',
  OASIS_APP_REVIEW_PARENT_PASSWORD: 'parent-password-456',
  OASIS_APP_REVIEW_DELETE_PASSWORD: 'delete-password-789',
};

describe('app review seed', () => {
  it('hands out staff, parent and deletion-demo usernames, each with its own password', () => {
    const { plan, logins } = buildAppReviewPlan(env);

    expect(logins.map(({ username, password }) => ({ username, password }))).toEqual([
      { username: 'oasis-review-staff', password: 'staff-password-123' },
      { username: 'oasis-review-parent', password: 'parent-password-456' },
      { username: 'oasis-review-delete', password: 'delete-password-789' },
    ]);
    const staff = plan.users.find((user) => user.id === logins[0]?.userId);
    const parent = plan.users.find((user) => user.id === logins[1]?.userId);
    expect(staff?.role).toBe('Head');
    expect(parent?.role).toBe('Parent');
    const deletion = plan.users.find((user) => user.id === logins[2]?.userId);
    expect(deletion?.role).toBe('Parent');
    expect(deletion?.email).toBe('oasis-review-delete@appreview.demo.oasisportal.space');
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
    expect(real).toHaveLength(3);
    for (const [userId, clerkId] of ids) {
      if (!clerkId.startsWith('user_real_')) expect(clerkId).toBe(`review_noclerk_${userId}`);
    }
  });

  it('never links the deletion-demo login to a child, so deleting it touches no child record', () => {
    const { plan, logins } = buildAppReviewPlan(env);
    const deletion = plan.users.find((user) => user.id === logins[2]?.userId);
    expect(deletion?.linkedAsGuardian).toBeFalsy();
    expect(plan.students.some((student) => student.userId === deletion?.id)).toBe(false);
  });

  it('requires a strong password for each login', () => {
    expect(() => buildAppReviewPlan({ ...env, OASIS_APP_REVIEW_DELETE_PASSWORD: '' })).toThrow(
      /OASIS_APP_REVIEW_DELETE_PASSWORD/,
    );
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

describe('assertProductionKeys', () => {
  function liveRowWithFreshKeys() {
    process.env['OASIS_MASTER_KEY'] = randomBytes(32).toString('base64');
    process.env['OASIS_MASTER_KEY_VERSION'] = '1';
    process.env['OASIS_BIDX_PEPPER'] = randomBytes(32).toString('hex');
    return {
      emailEnc: encryptField('live.parent@example.com'),
      emailBidx: blindIndex('live.parent@example.com'),
    };
  }

  it('accepts keys that decrypt a live row and reproduce its blind index', () => {
    const row = liveRowWithFreshKeys();
    expect(() => {
      assertProductionKeys(row);
    }).not.toThrow();
  });

  it('refuses a master key that cannot decrypt live data', () => {
    const row = liveRowWithFreshKeys();
    process.env['OASIS_MASTER_KEY'] = randomBytes(32).toString('base64');
    expect(() => {
      assertProductionKeys(row);
    }).toThrow(/OASIS_MASTER_KEY does not match/);
  });

  it('refuses a pepper that does not reproduce live blind indexes', () => {
    const row = liveRowWithFreshKeys();
    process.env['OASIS_BIDX_PEPPER'] = randomBytes(32).toString('hex');
    expect(() => {
      assertProductionKeys(row);
    }).toThrow(/OASIS_BIDX_PEPPER does not match/);
  });
});
