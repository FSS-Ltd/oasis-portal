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
      'student-markets-trade-ticket.tsx',
      'student-markets-trend-card.tsx',
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

  it('uses self-scoped investment APIs for account, market data, cash funding, and reviewed trades', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-markets-browse-card.tsx',
      'src/components/student/student-markets-fund-cash-card.tsx',
      'src/components/student/student-markets-portfolio-cards.tsx',
      'src/components/student/student-markets-screen.tsx',
      'src/components/student/student-markets-summary.tsx',
      'src/components/student/student-markets-trade-ticket.tsx',
      'src/components/student/student-markets-trend-card.tsx',
      'src/components/student/student-markets-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.investment\.account\.useQuery/,
      /api\.investment\.marketData\.useQuery/,
      /api\.investment\.fundCash\.useMutation/,
      /api\.investment\.buyHolding\.useMutation/,
      /api\.investment\.sellHolding\.useMutation/,
      /handleFundMarketCash/,
      /handleBuyMarketHolding/,
      /handleSellMarketHolding/,
      /investmentAccount\.refetch/,
      /investmentMarket\.refetch/,
      /studentDashboard\.refetch/,
      /onBuyHolding/,
      /onSellHolding/,
    ]) {
      expect(source).toMatch(required);
    }

    for (const forbidden of [
      /api\.investment\.(withdrawPortfolio|refreshMarketData)/,
      /api\.investment\.(buy|sell)\.useMutation/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps market overview, funding, trade review, portfolio, and activity states visible', () => {
    const source = [
      'src/components/student/student-markets-browse-card.tsx',
      'src/components/student/student-markets-fund-cash-card.tsx',
      'src/components/student/student-markets-portfolio-cards.tsx',
      'src/components/student/student-markets-screen.tsx',
      'src/components/student/student-markets-summary.tsx',
      'src/components/student/student-markets-trade-ticket.tsx',
      'src/components/student/student-markets-trend-card.tsx',
      'src/components/student/student-markets-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Merit Markets',
      'Investment account',
      'Portfolio trend',
      'Daily',
      'Weekly',
      'Month',
      '3 months',
      'Loading Merit Markets',
      'Markets unavailable',
      'Fund Markets cash',
      'Funding pending',
      'Fund balance',
      'Not enough Spend merits.',
      'Browse market',
      'Prices delayed',
      'No market instruments match this filter.',
      'Trade ticket',
      'Review buy',
      'Confirm buy',
      'Review sell',
      'Confirm sell',
      'Trading paused until fresh prices are available.',
      'Not enough Markets cash.',
      'Not enough units.',
      'Your holdings',
      'Today',
      'Total return',
      'No holdings yet.',
      'Recent activity',
      'Buy opens a review ticket before the trade is placed.',
    ]) {
      expect(source).toContain(text);
    }
  });
});
