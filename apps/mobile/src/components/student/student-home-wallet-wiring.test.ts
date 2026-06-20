import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student home and wallet mobile wiring', () => {
  it('adds focused production student home and wallet files', () => {
    for (const file of [
      'student-portal-screen.tsx',
      'student-home-screen.tsx',
      'student-wallet-screen.tsx',
      'student-wallet-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('routes student users to the production mobile student portal', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');

    expect(router).toMatch(/StudentPortalScreen/);
    expect(router).toMatch(/from '..\/student\/student-portal-screen'/);
    expect(router).toMatch(/user\?\.role === 'Student'/);
    expect(router).toMatch(/<StudentPortalScreen user=\{user\} \/>/);
    expect(router).not.toMatch(/StudentPortalSmokeScreen/);
    expect(router).not.toMatch(/student-portal-smoke-screen/);
  });

  it('uses self-scoped student read APIs and keeps wallet actions out of scope', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');
    const wallet = readMobile('src/components/student/student-wallet-screen.tsx');
    const home = readMobile('src/components/student/student-home-screen.tsx');
    const source = [portal, wallet, home].join('\n');

    expect(portal).toMatch(/api\.student\.dashboard\.useQuery/);
    expect(portal).toMatch(/api\.student\.wallet\.useQuery/);
    expect(portal).toMatch(/studentDashboard\.refetch/);
    expect(portal).toMatch(/studentWallet\.refetch/);
    expect(portal).toMatch(/type StudentMobileTab = 'home' \| 'wallet'/);
    expect(portal).toMatch(/useState<StudentMobileTab>\('home'\)/);
    expect(portal).toMatch(/activeTab === 'home'/);
    expect(portal).toMatch(/activeTab === 'wallet'/);

    for (const forbidden of [
      /studentId:\s*selected/i,
      /api\.student\.me\.useQuery/,
      /api\.student\.heartbeat\.useMutation/,
      /api\.meritLedger\.balances\.useQuery/,
      /api\.meritLedger\.activity\.useQuery/,
      /api\.meritLedger\.giveToCharity\.useMutation/,
      /api\.investment\.(buy|sell|fundCash|buyHolding|sellHolding)/,
      /api\.shop\.(reserve|reserveItem|purchase|collectReservation|cancelReservation)/,
      /api\.profile\.me\.useQuery/,
      /api\.childLog\.parentDashboard/,
      /api\.staffHome\.summary/,
      /api\.invoice\.listAdmin/,
      /api\.permissionSlip\.listAdmin/,
      /Give to charity/,
      /Reserve item/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps student home, wallet, balance, activity, and empty states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-home-screen.tsx',
      'src/components/student/student-wallet-screen.tsx',
      'src/components/student/student-wallet-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Student Portal',
      'Home',
      'Wallet',
      'Hi,',
      'Merit wallet',
      'Total merits',
      'Spend',
      'Saving',
      'Investment',
      'TithePaid',
      'Recent activity',
      'Next learning signal',
      'This week',
      'This month',
      'Shop',
      'Loading student dashboard',
      'Wallet unavailable',
      'No active student profile is linked to this account.',
      'No wallet activity yet.',
    ]) {
      expect(source).toContain(text);
    }
  });
});
