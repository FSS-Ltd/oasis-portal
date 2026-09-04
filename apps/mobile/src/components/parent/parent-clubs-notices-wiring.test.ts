import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent clubs and notices mobile wiring', () => {
  it('adds focused production parent clubs and notices screens', () => {
    for (const file of ['parent-clubs-screen.tsx', 'parent-notices-screen.tsx']) {
      expect(existsSync(path.join(mobileRoot, 'src/components/parent', file))).toBe(true);
    }
  });

  it('wires the parent portal to production clubs and notices screens', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentClubsScreen/);
    expect(portal).toMatch(/ParentNoticesScreen/);
    expect(portal).toMatch(/route === 'clubs'/);
    expect(portal).toMatch(/route === 'notices'/);
    expect(portal).not.toMatch(/parent-smoke-clubs/);
    expect(portal).not.toMatch(/parent-smoke-notices/);
  });

  it('uses parent-safe club and notice APIs without staff or manager workflows', () => {
    const clubs = readMobile('src/components/parent/parent-clubs-screen.tsx');
    const notices = readMobile('src/components/parent/parent-notices-screen.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/api\.club\.myClubNotices\.useQuery/);
    expect(clubs).toMatch(/api\.club\.signUp\.useMutation/);
    expect(clubs).toMatch(/api\.club\.withdraw\.useMutation/);
    expect(clubs).toMatch(/utils\.club\.linkedChildSignupContext\.invalidate/);
    expect(clubs).toMatch(/utils\.club\.myClubNotices\.invalidate/);
    expect(notices).toMatch(/api\.notice\.markRead\.useMutation/);
    expect(notices).toMatch(/utils\.notice\.listForParents\.invalidate/);

    for (const source of [clubs, notices, portal]) {
      expect(source).not.toMatch(/listForStaff/);
      expect(source).not.toMatch(/listForAdmin/);
      expect(source).not.toMatch(/createClub/);
      expect(source).not.toMatch(/updateClub/);
      expect(source).not.toMatch(/postNotice/);
      expect(source).not.toMatch(/assignLead/);
      expect(source).not.toMatch(/StaffClubManager/);
    }
  });

  it('keeps expected club signup, club notice, staff notice, and empty states visible', () => {
    const clubs = readMobile('src/components/parent/parent-clubs-screen.tsx');
    const notices = readMobile('src/components/parent/parent-notices-screen.tsx');

    for (const text of [
      'Clubs',
      'All Clubs',
      'My Clubs',
      'Latest updates',
      'Sign up',
      'Withdraw',
      'Full',
      'No linked children',
      'No eligible clubs',
      'No clubs yet',
      'Loading club notices',
      'Club signup failed.',
      'Club withdrawal failed.',
      'Notices',
      'Updates from the centre team.',
      'Unread',
      'Read',
      'Mark read',
      'No notices',
      'Marking...',
    ]) {
      expect(`${clubs}\n${notices}`).toContain(text);
    }
  });
});
