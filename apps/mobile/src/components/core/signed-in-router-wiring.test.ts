import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('signed-in mobile routing', () => {
  it('keeps health query failures inside the signed-in session instead of signing out', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');

    expect(router).toMatch(/api\.health\.me\.useQuery\(undefined, \{ retry: false \}\)/);
    expect(router).not.toMatch(/useClerk/);
    expect(router).not.toMatch(/signOut/);
    expect(router).toContain('Could not load session. Please try again.');
  });

  it('does not route Technical Support accounts into the staff workflow shell', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');
    const supportPortal = readMobile(
      'src/components/support/technical-support-portal-screen.tsx',
    );
    const staffPortalIndex = router.indexOf('return <StaffPortalScreen user={user} />;');
    const supportRoleIndex = router.indexOf("user?.role === 'TechnicalSupport'");
    const supportPortalIndex = router.indexOf('return <TechnicalSupportPortalScreen user={user} />;');

    expect(
      existsSync(path.join(mobileRoot, 'src/components/support/technical-support-portal-screen.tsx')),
    ).toBe(true);
    expect(router).toContain("user?.role === 'Supervisor'");
    expect(router).toContain('TechnicalSupportPortalScreen');
    expect(router).toContain("user?.role === 'TechnicalSupport'");
    expect(staffPortalIndex).toBeGreaterThan(-1);
    expect(supportRoleIndex).toBeGreaterThan(staffPortalIndex);
    expect(supportPortalIndex).toBeGreaterThan(supportRoleIndex);
    expect(supportPortal).toContain('api.admin.listUserAccounts.useQuery');
    expect(supportPortal).toContain('api.admin.listUserInvitations.useQuery');
    expect(supportPortal).toContain('api.admin.inviteUser.useMutation');
    expect(supportPortal).toContain('api.admin.updateUserAccountProfile.useMutation');
    expect(supportPortal).toContain('api.admin.updateUserAccountStatus.useMutation');
    expect(supportPortal).not.toMatch(/staffHome\.summary/);
  });
});
