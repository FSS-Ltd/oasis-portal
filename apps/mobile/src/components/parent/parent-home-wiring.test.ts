import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent home mobile wiring', () => {
  it('adds focused production parent home components', () => {
    const parentFiles = [
      'parent-portal-screen.tsx',
      'parent-home-screen.tsx',
      'parent-child-switcher.tsx',
      'parent-child-hero.tsx',
      'parent-home-summary-cards.tsx',
      'parent-home-utils.ts',
    ];

    for (const file of parentFiles) {
      expect(existsSync(path.join(mobileRoot, 'src/components/parent', file))).toBe(true);
    }
  });

  it('routes Parent users into the production parent portal home route', () => {
    const router = readMobile('src/components/smoke/signed-in-smoke-router.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(router).toMatch(/ParentPortalScreen/);
    expect(router).not.toMatch(/ParentPortalSmokeScreen/);
    expect(portal).toMatch(/ParentHomeScreen/);
    expect(portal).toMatch(/type ParentPortalRoute/);
    for (const route of ["'home'", "'notices'", "'messages'", "'clubs'", "'shop'"]) {
      expect(portal).toMatch(new RegExp(route));
    }
    expect(portal).toMatch(/useState<ParentPortalRoute>\('home'\)/);
    expect(portal).toMatch(/ParentNoticesScreen/);
    expect(portal).toMatch(/ParentMessagesScreen/);
    expect(portal).toMatch(/ParentClubsScreen/);
    expect(portal).toMatch(/MobileShopReservationPanel/);
  });

  it('uses linked-child parent APIs and avoids staff or admin APIs', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');
    const home = readMobile('src/components/parent/parent-home-screen.tsx');

    expect(portal).toMatch(/api\.profile\.me\.useQuery/);
    expect(portal).toMatch(/api\.childLog\.parentDashboard\.useQuery/);
    expect(portal).toMatch(/api\.registration\.status\.useQuery/);
    expect(home).toMatch(/api\.notice\.listForParents\.useQuery/);
    expect(home).toMatch(/api\.message\.listConversations\.useQuery/);
    expect(home).toMatch(/kinds: \['ParentStaff'\]/);
    expect(home).toMatch(/api\.club\.linkedChildSignupContext\.useQuery/);
    expect(home).toMatch(/api\.invoice\.listParent\.useQuery/);
    expect(home).toMatch(/api\.permissionSlip\.listParent\.useQuery/);

    for (const source of [portal, home]) {
      expect(source).not.toMatch(/staffHome\.summary/);
      expect(source).not.toMatch(/childLog\.snapshot/);
      expect(source).not.toMatch(/childLog\.centreSnapshot/);
      expect(source).not.toMatch(/notice\.listForStaff/);
      expect(source).not.toMatch(/invoice\.listAdmin/);
      expect(source).not.toMatch(/permissionSlip\.listAdmin/);
      expect(source).not.toMatch(/StaffPortalScreen/);
    }
  });

  it('keeps parent home, child switching, urgent actions, and empty states visible', () => {
    const home = readMobile('src/components/parent/parent-home-screen.tsx');
    const switcher = readMobile('src/components/parent/parent-child-switcher.tsx');
    const hero = readMobile('src/components/parent/parent-child-hero.tsx');
    const summary = readMobile('src/components/parent/parent-home-summary-cards.tsx');

    expect(home).toMatch(/Parent Home/);
    expect(home).toMatch(/Loading parent dashboard/);
    expect(home).toMatch(/No linked children/);
    expect(home).toMatch(/Child registration needed/);
    expect(summary).toMatch(/Unread messages/);
    expect(summary).toMatch(/Unread notices/);
    expect(summary).toMatch(/Club prompts/);
    expect(summary).toMatch(/Fees due/);
    expect(summary).toMatch(/Permission slips/);
    expect(switcher).toMatch(/Switch child/);
    expect(hero).toMatch(/total merits/);
    expect(summary).toMatch(/Recent behaviour/);
    expect(summary).toMatch(/Merit Wallet/);
  });
});
