import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student wallet actions mobile wiring', () => {
  it('adds focused wallet action coverage without adding new files outside student wallet surfaces', () => {
    expect(existsSync(path.join(mobileRoot, 'src/components/student/student-wallet-screen.tsx'))).toBe(
      true,
    );
    expect(
      existsSync(path.join(mobileRoot, 'src/components/student/student-wallet-actions-wiring.test.ts')),
    ).toBe(true);
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
      'insufficient source balance',
      'Investment remains read-only',
    ]) {
      expect(source).toContain(text);
    }
  });

  it('keeps out-of-scope wallet actions disabled or absent', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-wallet-screen.tsx',
      'src/components/student/student-wallet-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const forbidden of [
      /api\.meritLedger\.giveToCharity\.useMutation/,
      /api\.investment\.(buy|sell|fundCash|buyHolding|sellHolding)/,
      /api\.tithe\.(updatePreference|payDue)/,
      /from:\s*'Investment'/,
      /to:\s*'Investment'/,
      /Give to charity/,
      /Buy investment/,
      /Sell investment/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});
