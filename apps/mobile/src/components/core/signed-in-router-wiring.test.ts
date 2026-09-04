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
    expect(router).toContain('We could not refresh your access. Please try again.');
    expect(router).not.toMatch(/health\.error\.message/);
  });

  it('does not route Technical Support accounts into the staff workflow shell', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');
    const supportPortal = readMobile('src/components/support/technical-support-portal-screen.tsx');
    const accessScreen = readMobile('src/components/access/user-access-screen.tsx');
    const accessDetail = readMobile('src/components/access/user-access-account-detail.tsx');
    const staffPortalIndex = router.indexOf('<StaffPortalScreen');
    const supportRoleIndex = router.indexOf("user?.role === 'TechnicalSupport'");
    const supportPortalIndex = router.indexOf('<TechnicalSupportPortalScreen');

    expect(
      existsSync(
        path.join(mobileRoot, 'src/components/support/technical-support-portal-screen.tsx'),
      ),
    ).toBe(true);
    expect(router).toContain("user?.role === 'Supervisor'");
    expect(router).toContain('TechnicalSupportPortalScreen');
    expect(router).toContain("user?.role === 'TechnicalSupport'");
    expect(staffPortalIndex).toBeGreaterThan(-1);
    expect(supportRoleIndex).toBeGreaterThan(staffPortalIndex);
    expect(supportPortalIndex).toBeGreaterThan(supportRoleIndex);
    expect(supportPortal).toContain('UserAccessScreen');
    expect(accessScreen).toContain('api.admin.listUserAccounts.useQuery');
    expect(accessScreen).toContain('api.admin.listUserInvitations.useQuery');
    expect(accessScreen).toContain('api.admin.inviteUser.useMutation');
    expect(accessDetail).toContain('api.admin.updateUserAccountProfile.useMutation');
    expect(accessDetail).toContain('api.admin.updateUserAccountStatus.useMutation');
    expect(supportPortal).not.toMatch(/staffHome\.summary/);
  });

  it('allows linked-child staff and support users to switch into parent mode', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');
    const parentPortal = readMobile('src/components/parent/parent-portal-screen.tsx');
    const staffPortal = readMobile('src/components/staff/staff-portal-screen.tsx');
    const staffHome = readMobile('src/components/staff/staff-home-screen.tsx');
    const supportPortal = readMobile('src/components/support/technical-support-portal-screen.tsx');

    expect(router).toMatch(/useState<MobilePortalView>\('default'\)/);
    expect(router).toMatch(/const linkedChildCount = health\.data\?\.linkedChildCount \?\? 0/);
    expect(router).toMatch(/canSwitchToParent/);
    expect(router).toMatch(/linkedChildCount > 0/);
    expect(router).toMatch(/setPortalView\('parent'\)/);
    expect(router).toMatch(/setPortalView\('default'\)/);
    expect(router).toMatch(/<ParentPortalScreen[\s\S]*user=\{user\}[\s\S]*onSwitchToStaff=/);
    expect(router).toMatch(/<StaffPortalScreen[\s\S]*onSwitchToParent=/);
    expect(router).toMatch(/<TechnicalSupportPortalScreen[\s\S]*onSwitchToParent=/);

    expect(parentPortal).toMatch(/onSwitchToStaff\?: \(\) => void/);
    expect(parentPortal).toMatch(/actionLabel=\{onSwitchToStaff \? 'Staff' : 'Out'\}/);
    expect(parentPortal).toMatch(/Switch back to staff mode/);
    expect(staffPortal).toMatch(/onSwitchToParent\?: \(\) => void/);
    expect(staffHome).toMatch(/onSwitchToParent\?: \(\) => void/);
    expect(staffHome).toMatch(/Parent mode/);
    expect(supportPortal).toMatch(/onSwitchToParent\?: \(\) => void/);
    expect(supportPortal).toMatch(/Parent mode/);
    expect(supportPortal).toMatch(/Switch to parent mode/);
  });

  it('keeps Technical Support mobile surfaces in parity with the web support shell', () => {
    const supportPortal = readMobile('src/components/support/technical-support-portal-screen.tsx');
    const accessScreen = readMobile('src/components/access/user-access-screen.tsx');

    expect(supportPortal).toMatch(/type SupportPortalRoute =/);
    expect(supportPortal).toMatch(/'attendance'/);
    expect(supportPortal).toMatch(/'behaviour'/);
    expect(supportPortal).toMatch(/'communications'/);
    expect(supportPortal).toMatch(/'clubs'/);
    expect(supportPortal).toMatch(/'incidents'/);
    expect(supportPortal).toMatch(/'pace'/);
    expect(supportPortal).toMatch(/'shop'/);
    expect(supportPortal).not.toMatch(/StaffRotaScreen/);
    expect(supportPortal).toMatch(/api\.calendar\.listVisible\.useQuery/);
    expect(supportPortal).toMatch(/ParentCalendarScreen/);
    expect(supportPortal).not.toMatch(/mobile-app|Mobile app|TechnicalSupportMobileAppScreen/);
    expect(
      existsSync(
        path.join(mobileRoot, 'src/components/support/technical-support-mobile-app-screen.tsx'),
      ),
    ).toBe(false);
    expect(supportPortal).toContain('UserAccessScreen');
    expect(accessScreen).toMatch(/type AccessFilter/);
    expect(accessScreen).toMatch(/accessFilters/);
    expect(accessScreen).toMatch(/rowMatchesFilter/);
    expect(accessScreen).toMatch(/setFilter\(option\.id\)/);
    expect(accessScreen).toMatch(/Active/);
    expect(accessScreen).toMatch(/Inactive/);
    expect(supportPortal).toMatch(/Technical Support/);
  });
});
