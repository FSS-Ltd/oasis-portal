import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent student settings mobile wiring', () => {
  it('adds a focused parent student settings controls screen', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/parent/parent-student-settings-screen.tsx')),
    ).toBe(true);
  });

  it('wires the parent portal to the student settings route', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentStudentSettingsScreen/);
    expect(portal).toMatch(/'settings'/);
    expect(portal).toMatch(/label: 'Settings'/);
    expect(portal).toMatch(/route === 'settings'/);
  });

  it('uses existing parent-scoped student settings APIs', () => {
    const screen = readMobile('src/components/parent/parent-student-settings-screen.tsx');

    expect(screen).toMatch(/api\.studentSettings\.listLinkedChildren\.useQuery/);
    expect(screen).toMatch(/api\.studentSettings\.setLoginHandle\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.createChildLogin\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.setChildPassword\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.setPasswordControl\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.setUsageLimits\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.prepareChildIconPhotoUpload\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.updateChildIconPhoto\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.setParentLock\.useMutation/);
    expect(screen).toMatch(/api\.studentSettings\.setMeritShopBlock\.useMutation/);
  });

  it('keeps expected settings states visible without displaying credential secrets', () => {
    const screen = readMobile('src/components/parent/parent-student-settings-screen.tsx');

    for (const text of [
      'Student settings',
      'Linked-child settings',
      'Child login',
      'Create login',
      'Reset password',
      'Usage limits',
      'Child icon',
      'Parent lock',
      'Merit shop',
      'Adult child',
      'No linked children',
      'Access denied',
      'Settings saved',
      'Settings unavailable',
    ]) {
      expect(screen).toContain(text);
    }
    expect(screen).not.toMatch(/token/);
    expect(screen).not.toMatch(/clerkUserId/);
    expect(screen).not.toMatch(/adminReadinessReport/);
    expect(screen).not.toMatch(/adminCreateStudentLogin/);
    expect(screen).not.toMatch(/password.*\{password\}/is);
  });
});
