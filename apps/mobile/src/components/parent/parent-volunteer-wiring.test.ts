import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent volunteer mobile wiring', () => {
  it('adds Centre Volunteer and Lunch + Clubs choices with private availability and save controls', () => {
    const screenPath = path.join(mobileRoot, 'src/components/parent/parent-volunteer-screen.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');
    const screen = readFileSync(screenPath, 'utf8');

    expect(existsSync(screenPath)).toBe(true);
    expect(portal).toMatch(/ParentVolunteerScreen/);
    expect(portal).toMatch(/'volunteer'/);
    expect(portal).toMatch(/api\.rota\.parentVolunteerSlots\.useQuery/);
    expect(portal).toMatch(/parentVolunteerAccess: ParentVolunteerAccess/);
    expect(portal).toMatch(
      /const canUseParentVolunteer = canUseParentVolunteerNavigation\(parentVolunteerAccess\)/,
    );
    expect(portal).toMatch(/enabled: canUseParentVolunteer && route === 'volunteer'/);
    expect(portal).toMatch(/const visibleParentTabs = parentTabs\.filter/);
    expect(portal).toMatch(/canUseParentVolunteer \|\| tab\.id !== 'volunteer'/);
    expect(portal).toMatch(/route === 'volunteer'/);
    expect(screen).toMatch(/api\.rota\.setMyParentVolunteerDays\.useMutation/);
    expect(screen).toContain('Centre Volunteer');
    expect(screen).toContain('Lunch + Clubs');
    expect(screen).toContain('Primary · 3 spaces daily');
    expect(screen).toContain('Secondary · 2 spaces daily');
    expect(screen).toMatch(/centreDates/);
    expect(screen).toMatch(/primaryLunchAndClubsDates/);
    expect(screen).toMatch(/secondaryLunchAndClubsDates/);
    expect(screen).not.toMatch(/parent\.fullName/);
  });

  it('keeps staff volunteer access scoped to Lunch + Clubs', () => {
    const screen = readMobile('src/components/parent/parent-volunteer-screen.tsx');
    const staffScheduleStart = screen.indexOf('function StaffVolunteerSchedule');
    const screenExportStart = screen.indexOf('export function ParentVolunteerScreen');
    const staffSchedule = screen.slice(staffScheduleStart, screenExportStart);

    expect(screen).toMatch(/Extract<ParentVolunteerSlots, \{ scope: 'parent' \}>/);
    expect(screen).toMatch(/Extract<ParentVolunteerSlots, \{ scope: 'staff' \}>/);
    expect(screen).toContain('Lunch + Clubs-only access for staff volunteers.');
    expect(screen).toMatch(/slots\?\.scope === 'parent'/);
    expect(screen).toMatch(/slots\?\.scope === 'staff'/);
    expect(staffSchedule).not.toMatch(/centreDates|CentreVolunteerCard|centreVolunteer/);
  });

  it('passes the server-resolved staff entitlement into parent portal tab and query gating', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(router).toMatch(
      /const parentVolunteerAccess = health\.data\?\.parentVolunteerAccess \?\? null/,
    );
    expect(router).toMatch(/<ParentPortalScreen[\s\S]*parentVolunteerAccess=\{parentVolunteerAccess\}/);
    expect(router).toMatch(/AppState\.addEventListener\('change'/);
    expect(router).toMatch(/void health\.refetch\(\)/);
    expect(router).toMatch(/onRefreshEntitlement=\{health\.refetch\}/);
    expect(portal).toMatch(
      /enabled: canUseParentVolunteer && route === 'volunteer'/,
    );
    expect(portal).toMatch(/canUseParentVolunteer \|\| tab\.id !== 'volunteer'/);
    expect(portal).toMatch(/onRefreshEntitlement\(\)/);
    expect(portal).toMatch(/!canUseParentVolunteer && route === 'volunteer'/);
    expect(portal).toMatch(/setRoute\('home'\)/);
    expect(portal).toMatch(/canUseParentVolunteer && route === 'volunteer'/);
  });
});
