import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent reports and ranks mobile wiring', () => {
  it('adds a focused parent reports and ranks screen', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/parent/parent-reports-ranks-screen.tsx')),
    ).toBe(true);
  });

  it('wires the parent portal to the reports route', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentReportsRanksScreen/);
    expect(portal).toMatch(/'reports'/);
    expect(portal).toMatch(/label: 'Reports'/);
    expect(portal).toMatch(/route === 'reports'/);
  });

  it('uses sent-report and positive-rank APIs without staff-only workflows', () => {
    const screen = readMobile('src/components/parent/parent-reports-ranks-screen.tsx');

    expect(screen).toMatch(/api\.report\.listForStudent\.useQuery/);
    expect(screen).toMatch(/api\.leaderboard\.get\.useQuery/);
    expect(screen).toMatch(/includeViewerRows: true/);
    expect(screen).toMatch(/ParentChildSwitcher/);
    expect(screen).not.toMatch(/api\.report\.draft\.useMutation/);
    expect(screen).not.toMatch(/api\.report\.review\.useMutation/);
    expect(screen).not.toMatch(/api\.report\.send\.useMutation/);
    expect(screen).not.toMatch(/api\.leaderboard\.charityPot\.updateGoal\.useMutation/);
    expect(screen).not.toMatch(/HighestDemerits/);
    expect(screen).not.toMatch(/scope: 'full'/);
    expect(screen).not.toMatch(/includeAdminDemerits/);
  });

  it('keeps expected read-only report and rank states visible', () => {
    const screen = readMobile('src/components/parent/parent-reports-ranks-screen.tsx');

    for (const text of [
      'Reports and ranks',
      'Term reports',
      'Report detail',
      'Positive ranks',
      'Linked child ranks',
      'Top Savers',
      'Top Investors',
      'Top Tithers',
      'No linked children',
      'No sent reports',
      'No rankings available',
      'Read-only',
      'Head Summary',
    ]) {
      expect(screen).toContain(text);
    }
  });
});
