import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('shared mobile User Access', () => {
  it('keeps directory, invitation, profile, role, tag, and status controls in one shared screen', () => {
    const screen = readMobile('src/components/access/user-access-screen.tsx');
    const detail = readMobile('src/components/access/user-access-account-detail.tsx');

    expect(screen).toContain("import { ROLES, type Role } from '@oasis/domain'");
    expect(screen).toContain('api.admin.listUserAccounts.useQuery');
    expect(screen).toContain('api.admin.listUserInvitations.useQuery');
    expect(screen).toContain('api.admin.inviteUser.useMutation');
    expect(detail).toContain('import { ADULT_USER_ACCOUNT_ROLES, PERMISSION_TAGS');
    expect(detail).toContain('api.admin.updateUserAccountProfile.useMutation');
    expect(detail).toContain('api.admin.updateUserRole.useMutation');
    expect(detail).toContain('api.admin.updateUserTags.useMutation');
    expect(detail).toContain('api.admin.updateUserAccountStatus.useMutation');
    expect(screen).toContain('ROLES.map');
    expect(detail).toContain('PERMISSION_TAGS.map');
    expect(detail).toContain('Deactivate');
    expect(detail).toContain('Reactivate');
  });

  it('uses the shared User Access screen from both support and the Head-only staff route', () => {
    const supportPortal = readMobile('src/components/support/technical-support-portal-screen.tsx');
    const staffPortal = readMobile('src/components/staff/staff-portal-screen.tsx');
    const staffHome = readMobile('src/components/staff/staff-home-screen.tsx');

    expect(existsSync(path.join(mobileRoot, 'src/components/access/user-access-screen.tsx'))).toBe(
      true,
    );
    expect(supportPortal).toContain('UserAccessScreen');
    expect(supportPortal).not.toContain('api.admin.listUserAccounts.useQuery');
    expect(staffPortal).toContain("| 'user-access'");
    expect(staffPortal).toContain('<UserAccessScreen');
    expect(staffPortal).toContain("user?.role === 'Head'");
    expect(staffHome).toContain('onOpenUserAccess');
    expect(staffHome).toContain('User Access');
  });
});
