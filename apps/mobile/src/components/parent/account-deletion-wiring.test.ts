import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('account deletion mobile wiring', () => {
  it('lets a parent request deletion of their own account from Profile', () => {
    const profile = readMobile('src/components/parent/parent-profile-registration-screen.tsx');
    expect(profile).toContain('AccountDeletionCard');
    expect(profile).toContain('title="Delete my account"');
  });

  it("lets a parent request deletion of the selected child's account from Settings", () => {
    const settings = readMobile('src/components/parent/parent-student-settings-screen.tsx');
    expect(settings).toContain('AccountDeletionCard');
    expect(settings).toContain('studentId={selectedChild.studentId}');
  });

  it('lets staff and adult students request deletion of their own account', () => {
    for (const file of [
      'src/components/staff/staff-home-screen.tsx',
      'src/components/student/student-notifications-screen.tsx',
    ]) {
      const screen = readMobile(file);
      expect(screen).toContain('<AccountDeletionCard title="Delete my account" />');
    }
  });

  it('lets account admins approve or decline requests from User Access on mobile', () => {
    const access = readMobile('src/components/access/user-access-screen.tsx');
    expect(access).toContain('<DeletionRequestsCard />');
    const card = readMobile('src/components/access/deletion-requests-card.tsx');
    expect(card).toContain('api.accountDeletion.queue.useQuery');
    expect(card).toContain('api.accountDeletion.approve.useMutation');
    expect(card).toContain('api.accountDeletion.decline.useMutation');
    expect(card).toContain('Confirm deletion');
  });

  it('uses the request, cancel and status procedures and asks for confirmation first', () => {
    const card = readMobile('src/components/core/account-deletion-card.tsx');
    expect(card).toContain('api.accountDeletion.status.useQuery');
    expect(card).toContain('api.accountDeletion.request.useMutation');
    expect(card).toContain('api.accountDeletion.cancel.useMutation');
    expect(card).toContain('Yes, request deletion');
  });
});
