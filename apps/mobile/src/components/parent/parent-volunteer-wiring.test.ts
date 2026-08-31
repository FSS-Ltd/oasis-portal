import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent volunteer mobile wiring', () => {
  it('adds a parent volunteer route with private availability and save controls', () => {
    const screenPath = path.join(mobileRoot, 'src/components/parent/parent-volunteer-screen.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');
    const screen = readFileSync(screenPath, 'utf8');

    expect(existsSync(screenPath)).toBe(true);
    expect(portal).toMatch(/ParentVolunteerScreen/);
    expect(portal).toMatch(/'volunteer'/);
    expect(portal).toMatch(/api\.rota\.parentVolunteerSlots\.useQuery/);
    expect(portal).toMatch(/route === 'volunteer'/);
    expect(screen).toMatch(/api\.rota\.setMyParentVolunteerDays\.useMutation/);
    expect(screen).toContain('two volunteer spaces per day');
    expect(screen).not.toMatch(/parent\.fullName/);
  });
});
