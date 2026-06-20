import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff home mobile wiring', () => {
  it('routes signed-in staff users to the production Staff Home screen', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-home-screen.tsx')),
      true,
      'StaffHomeScreen should exist outside the smoke component folder',
    );

    const router = read('src/components/smoke/signed-in-smoke-router.tsx');
    const staffPortal = read('src/components/staff/staff-portal-screen.tsx');
    assert.match(router, /StaffPortalScreen/);
    assert.match(staffPortal, /StaffHomeScreen/);
    assert.match(router, /StudentPortalScreen/);
    assert.match(router, /student-portal-screen/);
    assert.doesNotMatch(router, /StudentPortalSmokeScreen/);
    assert.doesNotMatch(router, /return <SupervisorSmokeScreen \/>/);
  });

  it('keeps Staff Home read-only and backed by the compact staff summary query', () => {
    const screen = read('src/components/staff/staff-home-screen.tsx');

    assert.match(screen, /api\.staffHome\.summary\.useQuery/);
    assert.match(screen, /schoolTimeZone = 'Europe\/London'/);
    assert.match(screen, /timeZone: 'UTC'/);
    assert.doesNotMatch(screen, /PortalMobileBottomNav/);
    assert.doesNotMatch(screen, /useMutation/);
    assert.doesNotMatch(screen, /attendance\.mark/);
    assert.doesNotMatch(screen, /behaviour\.log/);
    assert.doesNotMatch(screen, /pace\.record/);
  });
});
