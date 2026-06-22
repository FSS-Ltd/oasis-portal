import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent permission slips mobile wiring', () => {
  it('adds focused production parent permission slip files', () => {
    for (const file of [
      'parent-permission-slips-screen.tsx',
      'parent-permission-slips-detail.tsx',
      'parent-permission-slips-list.tsx',
      'parent-permission-slips-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/parent', file))).toBe(true);
    }
  });

  it('wires the parent portal slips route to the production screen', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentPermissionSlipsScreen/);
    expect(portal).toMatch(/'slips'/);
    expect(portal).toMatch(/route === 'slips'/);
    expect(portal).toMatch(/api\.permissionSlip\.listParent\.useQuery/);
    expect(portal).toMatch(/permissionSlips\.refetch/);
    expect(portal).toMatch(/label: 'Slips'/);
    expect(portal).toMatch(/icon: 'slips'/);
  });

  it('uses parent-safe permission slip APIs and excludes staff administration', () => {
    const screen = readMobile('src/components/parent/parent-permission-slips-screen.tsx');
    const detail = readMobile('src/components/parent/parent-permission-slips-detail.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(detail).toMatch(/api\.permissionSlip\.submitParentResponse\.useMutation/);
    expect(detail).toMatch(/api\.permissionSlip\.parentMarkPaid\.useMutation/);
    expect(detail).toMatch(/utils\.permissionSlip\.listParent\.invalidate/);

    for (const source of [screen, detail, portal]) {
      expect(source).not.toMatch(/permissionSlip\.listAdmin/);
      expect(source).not.toMatch(/permissionSlip\.create/);
      expect(source).not.toMatch(/permissionSlip\.update/);
      expect(source).not.toMatch(/permissionSlip\.archive/);
      expect(source).not.toMatch(/markPhysicalSigned/);
      expect(source).not.toMatch(/confirmPayment/);
      expect(source).not.toMatch(/rejectPayment/);
      expect(source).not.toMatch(/listStudentCandidates/);
    }
  });

  it('keeps review, signing, payment, and terminal states visible', () => {
    const source = [
      'src/components/parent/parent-permission-slips-screen.tsx',
      'src/components/parent/parent-permission-slips-detail.tsx',
      'src/components/parent/parent-permission-slips-list.tsx',
      'src/components/parent/parent-permission-slips-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Permission Slips',
      'Trips and activities',
      'Outstanding',
      'Completed',
      'Open & sign',
      'View',
      'Give permission',
      'Decline permission',
      'Consent statement',
      'Submit signed slip',
      'Submit decline',
      'Permission granted',
      'Response recorded',
      'Payment required',
      'Payment waiting for confirmation',
      'Mark as paid',
      'Paid',
      'Expired',
      'Already answered',
      'Loading permission slips',
      'No permission slips are waiting for your response.',
      'No completed permission slips yet.',
      'Permission slip response could not be submitted.',
      'Payment could not be marked paid.',
    ]) {
      expect(source).toContain(text);
    }
  });
});
