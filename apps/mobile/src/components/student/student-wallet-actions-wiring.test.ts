import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student wallet actions mobile wiring', () => {
  it('adds focused wallet action coverage without adding new files outside student wallet surfaces', () => {
    for (const file of [
      'student-wallet-screen.tsx',
      'student-wallet-tithe-panel.tsx',
      'student-wallet-charity-panel.tsx',
      'student-wallet-actions-wiring.test.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('wires Spend and Saving transfers through the existing self-scoped wallet mutation', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');
    const wallet = readMobile('src/components/student/student-wallet-screen.tsx');

    expect(portal).toMatch(/api\.meritLedger\.transfer\.useMutation/);
    expect(portal).toMatch(/handleWalletTransfer/);
    expect(portal).toMatch(/studentWallet\.refetch/);
    expect(portal).toMatch(/studentDashboard\.refetch/);
    expect(portal).toMatch(/studentWallet\.data\.studentId/);
    expect(wallet).toMatch(/onTransfer/);
    expect(wallet).toMatch(/'Spend'/);
    expect(wallet).toMatch(/'Saving'/);
    expect(wallet).toMatch(/Move to Saving/);
    expect(wallet).toMatch(/Move to Spend/);
  });

  it('keeps invalid, pending, success, denied, and insufficient balance states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-wallet-screen.tsx',
      'src/components/student/student-wallet-utils.ts',
      'src/components/student/student-wallet-tithe-panel.tsx',
      'src/components/student/student-wallet-charity-panel.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Amount',
      'Enter a positive whole number of merits.',
      'Not enough Spend merits.',
      'Not enough Saving merits.',
      'Transfer pending',
      'Transfer complete',
      'Transfer failed',
      'Tithe preference saved',
      'Tithe preference failed',
      'Tithe paid',
      'Tithe payment failed',
      'Charity gift added',
      'Charity gift failed',
      'Gift pending',
      'insufficient source balance',
      'insufficient Spend balance',
      'Investment remains read-only',
    ]) {
      expect(source).toContain(text);
    }
  });

  it('wires tithe preference and manual payment through the self-scoped tithe API', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-wallet-screen.tsx',
      'src/components/student/student-wallet-tithe-panel.tsx',
      'src/components/student/student-wallet-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.tithe\.getStatus\.useQuery/,
      /api\.tithe\.updatePreference\.useMutation/,
      /api\.tithe\.payDue\.useMutation/,
      /handleSaveTithePreference/,
      /handlePayTitheDue/,
      /onSaveTithePreference/,
      /onPayTitheDue/,
      /Save tithe/,
      /Pay \$\{formatMerits\(status\.selectedAmount\)\}/,
      /Percentage must be a whole number from 10 to 100\./,
      /Fixed amount must be a positive whole number of merits\./,
      /Monthly tithe date must be between 1 and 31\./,
      /status\.canPay/,
      /payPending/,
      /savePending/,
    ]) {
      expect(source).toMatch(required);
    }
  });

  it('wires charity giving through the Spend-scoped merit ledger API', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-wallet-screen.tsx',
      'src/components/student/student-wallet-charity-panel.tsx',
      'src/components/student/student-wallet-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.meritLedger\.giveToCharity\.useMutation/,
      /handleGiveToCharity/,
      /onGiveToCharity/,
      /Give to charity/,
      /wallet\.balances\.Spend/,
      /wallet\.balances\.Given/,
      /Not enough Spend merits\./,
      /charityPending/,
    ]) {
      expect(source).toMatch(required);
    }
  });

  it('keeps investment and Merit Markets actions disabled or absent', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-wallet-screen.tsx',
      'src/components/student/student-wallet-utils.ts',
      'src/components/student/student-wallet-tithe-panel.tsx',
      'src/components/student/student-wallet-charity-panel.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const forbidden of [
      /api\.investment\.(buy|sell|fundCash|buyHolding|sellHolding)/,
      /from:\s*'Investment'/,
      /to:\s*'Investment'/,
      /Buy investment/,
      /Sell investment/,
      /Merit Markets/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});
