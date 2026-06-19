import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent profile and registration mobile wiring', () => {
  it('adds a focused parent profile and registration maintenance screen', () => {
    expect(
      existsSync(
        path.join(mobileRoot, 'src/components/parent/parent-profile-registration-screen.tsx'),
      ),
    ).toBe(true);
  });

  it('wires the parent portal to the profile and registration maintenance route', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentProfileRegistrationScreen/);
    expect(portal).toMatch(/'profile'/);
    expect(portal).toMatch(/label: 'Profile'/);
    expect(portal).toMatch(/route === 'profile'/);
  });

  it('uses existing parent-scoped profile, spouse, registration, and link request APIs', () => {
    const screen = readMobile('src/components/parent/parent-profile-registration-screen.tsx');

    expect(screen).toMatch(/api\.profile\.me\.useQuery/);
    expect(screen).toMatch(/api\.profile\.updateMe\.useMutation/);
    expect(screen).toMatch(/api\.profile\.spouseInviteStatus\.useQuery/);
    expect(screen).toMatch(/api\.profile\.inviteSpouse\.useMutation/);
    expect(screen).toMatch(/api\.registration\.mine\.useQuery/);
    expect(screen).toMatch(/api\.registration\.updateMine\.useMutation/);
    expect(screen).toMatch(/api\.registration\.addSiblings\.useMutation/);
    expect(screen).toMatch(/api\.registration\.listMyStudentParentLinkRequests\.useQuery/);
    expect(screen).toMatch(/api\.registration\.confirmStudentParentLinkRequest\.useMutation/);
    expect(screen).toMatch(/api\.registration\.rejectStudentParentLinkRequest\.useMutation/);
  });

  it('keeps required states and secret-safe invitation handling visible', () => {
    const screen = readMobile('src/components/parent/parent-profile-registration-screen.tsx');

    for (const text of [
      'Parent Profile',
      'Registration maintenance',
      'Spouse invite',
      'Pending student links',
      'No linked children',
      'Registration unavailable',
      'Profile saved',
      'Sibling added',
      'Confirm link',
      'Reject',
    ]) {
      expect(screen).toContain(text);
    }
    expect(screen).not.toMatch(/inviteUrl/);
    expect(screen).not.toMatch(/clerkInvitationId/);
    expect(screen).not.toMatch(/label=["'][^"']*Password/);
  });
});
