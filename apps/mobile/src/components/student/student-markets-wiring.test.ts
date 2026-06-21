import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student Merit Markets mobile wiring', () => {
  it('adds focused student Markets files', () => {
    for (const file of [
      'student-markets-browse-card.tsx',
      'student-markets-fund-cash-card.tsx',
      'student-markets-portfolio-cards.tsx',
      'student-markets-screen.tsx',
      'student-markets-summary.tsx',
      'student-markets-utils.ts',
      'student-markets-wiring.test.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('exposes Markets through the student mobile More navigation', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/\|\s*'markets'/);
    expect(portal).toMatch(/id: 'markets'/);
    expect(portal).toMatch(/label: 'Markets'/);
    expect(portal).toMatch(/activeTab === 'markets'/);
    expect(portal).toMatch(/<StudentMarketsScreen/);
  });

  it('uses self-scoped investment APIs for account, market data, and cash funding only', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-markets-browse-card.tsx',
      'src/components/student/student-markets-fund-cash-card.tsx',
      'src/components/student/student-markets-portfolio-cards.tsx',
      'src/components/student/student-markets-screen.tsx',
      'src/components/student/student-markets-summary.tsx',
      'src/components/student/student-markets-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.investment\.account\.useQuery/,
      /api\.investment\.marketData\.useQuery/,
      /api\.investment\.fundCash\.useMutation/,
      /handleFundMarketCash/,
      /investmentAccount\.refetch/,
      /studentDashboard\.refetch/,
    ]) {
      expect(source).toMatch(required);
    }

    for (const forbidden of [
      /api\.investment\.(buyHolding|sellHolding|withdrawPortfolio|refreshMarketData)/,
      /onBuyHolding/,
      /onSellHolding/,
      /Buy investment/,
      /Sell investment/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps market overview, funding, browse, portfolio, and activity states visible', () => {
    const source = [
      'src/components/student/student-markets-browse-card.tsx',
      'src/components/student/student-markets-fund-cash-card.tsx',
      'src/components/student/student-markets-portfolio-cards.tsx',
      'src/components/student/student-markets-screen.tsx',
      'src/components/student/student-markets-summary.tsx',
      'src/components/student/student-markets-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Merit Markets',
      'Investment account',
      'Loading Merit Markets',
      'Markets unavailable',
      'Fund Markets cash',
      'Funding pending',
      'Fund balance',
      'Not enough Spend merits.',
      'Browse market',
      'Prices delayed',
      'No market instruments match this filter.',
      'Your holdings',
      'No holdings yet.',
      'Recent activity',
      'Buy and sell confirmations are intentionally held for the next mobile slice.',
    ]) {
      expect(source).toContain(text);
    }
  });
});
