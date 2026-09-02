import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('mobile access revocation', () => {
  it('routes an explicit deactivated account state to the access-revoked screen before regular portal routing', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');
    const revokedRouteIndex = router.indexOf("health.data?.accountAccessState === 'deactivated'");
    const parentRouteIndex = router.indexOf("user?.role === 'Parent'");

    expect(
      existsSync(path.join(mobileRoot, 'src/components/core/mobile-access-revoked-screen.tsx')),
    ).toBe(true);
    expect(router).toContain("health.data?.accountAccessState === 'deactivated'");
    expect(router).toContain('<MobileAccessRevokedScreen');
    expect(revokedRouteIndex).toBeGreaterThan(-1);
    expect(revokedRouteIndex).toBeLessThan(parentRouteIndex);
  });

  it('uses a deadline-based sixty-second countdown and Clerk sign-out with timer cleanup', () => {
    const screen = readMobile('src/components/core/mobile-access-revoked-screen.tsx');

    expect(screen).toContain('ACCESS_REVOCATION_DELAY_MS = 60_000');
    expect(screen).toContain('Date.now()');
    expect(screen).toContain('setInterval');
    expect(screen).toContain('setTimeout');
    expect(screen).toContain('clearInterval');
    expect(screen).toContain('clearTimeout');
    expect(screen).toContain('await signOut()');
    expect(screen).toContain('You no longer have access to the portal.');
    expect(screen).toContain('accessibilityRole="progressbar"');
    expect(screen).toContain('Seconds remaining');
  });
});
