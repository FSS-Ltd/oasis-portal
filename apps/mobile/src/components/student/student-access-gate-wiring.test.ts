import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student mobile access gate wiring', () => {
  it('adds a reusable student mobile access gate', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/student/student-mobile-access-gate.tsx')),
    ).toBe(true);
  });

  it('calls student access, usage, and heartbeat procedures before rendering feature content', () => {
    const gate = readMobile('src/components/student/student-mobile-access-gate.tsx');
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(gate).toMatch(/api\.student\.portalUsage\.useQuery/);
    expect(gate).toMatch(/api\.student\.heartbeat\.useMutation/);
    expect(gate).toMatch(/StudentMobileAccessGate/);
    expect(gate).toMatch(/studentAccess\.refetch/);
    expect(gate).toMatch(/studentHeartbeat\.(mutateAsync|mutate)/);
    expect(gate).toMatch(/accessStateFromUsageStatus/);
    expect(gate).toMatch(/accessStateFromStudentAccessError/);

    expect(portal).toMatch(/StudentMobileAccessGate/);
    expect(portal).toMatch(/<StudentMobileAccessGate/);
    expect(portal).toMatch(/<StudentPortalContent user=\{user\} \/>/);
    expect(portal).toMatch(/function StudentPortalContent/);
    expect(portal.indexOf('StudentMobileAccessGate')).toBeLessThan(
      portal.indexOf('StudentPortalContent user={user}'),
    );
  });

  it('renders locked, off-limit, usage-limit, denied, no-profile, loading, retry, and normal states', () => {
    const gate = readMobile('src/components/student/student-mobile-access-gate.tsx');

    for (const text of [
      'Loading student portal',
      'Student portal locked',
      'Off-limit day',
      'Usage limit reached',
      'Student portal not ready',
      'Student portal unavailable',
      'Heartbeat failed',
      'Retry',
      'Enter student portal',
      'No active student profile is linked to this account.',
      'Daily student portal usage limit reached.',
      'Student portal is off limits today.',
    ]) {
      expect(gate).toContain(text);
    }
  });

  it('keeps the gate student-only and does not expose parent or staff route boundaries', () => {
    const gate = readMobile('src/components/student/student-mobile-access-gate.tsx');
    const router = readMobile('src/components/core/signed-in-router.tsx');

    expect(router).toMatch(/user\?\.role === 'Student'/);
    expect(router).toMatch(/<StudentPortalScreen user=\{user\} \/>/);

    for (const forbidden of [
      /api\.profile\.me\.useQuery/,
      /api\.childLog\.parentDashboard/,
      /api\.staffHome\.summary/,
      /ParentPortalScreen/,
      /StaffPortalScreen/,
      /role === 'Parent'/,
      /role === 'Supervisor'/,
    ]) {
      expect(gate).not.toMatch(forbidden);
    }
  });
});
