import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent child detail mobile wiring', () => {
  it('adds a focused parent child detail screen', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/parent/parent-child-detail-screen.tsx')),
    ).toBe(true);
  });

  it('wires the parent portal to the child detail route', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentChildDetailScreen/);
    expect(portal).toMatch(/'child'/);
    expect(portal).toMatch(/label: 'Child'/);
    expect(portal).toMatch(/route === 'child'/);
  });

  it('uses parent-safe projections and avoids staff-only workflows', () => {
    const screen = readMobile('src/components/parent/parent-child-detail-screen.tsx');

    expect(screen).toMatch(/api\.report\.listForStudent\.useQuery/);
    expect(screen).toMatch(/ParentChildSwitcher/);
    expect(screen).toMatch(/ParentChildHero/);
    expect(screen).toMatch(/ParentMeritWalletPreview/);
    expect(screen).not.toMatch(/api\.childLog\.drillThrough\.useQuery/);
    expect(screen).not.toMatch(/api\.report\.draft\.useMutation/);
    expect(screen).not.toMatch(/api\.report\.review\.useMutation/);
    expect(screen).not.toMatch(/api\.report\.send\.useMutation/);
    expect(screen).not.toMatch(/api\.meritLedger\.transfer\.useMutation/);
    expect(screen).not.toMatch(/CorrectionModal/);
    expect(screen).not.toMatch(/Sensitive/);
  });

  it('keeps expected read-only states visible', () => {
    const screen = readMobile('src/components/parent/parent-child-detail-screen.tsx');

    for (const text of [
      'Child detail',
      'Oasis attendance',
      'Current PACE',
      'Visible behaviour',
      'Visible notes',
      'Report summary',
      'Merit wallet',
      'No linked children',
      'No attendance records',
      'No active PACE subjects are assigned.',
      'View Full PACE',
      'No visible behaviour',
      'No visible notes',
      'No sent reports',
      'Read-only',
    ]) {
      expect(screen).toContain(text);
    }
  });
});
