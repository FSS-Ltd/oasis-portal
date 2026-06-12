import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260612120000_merit_market_gbp_per_merit_100/migration.sql',
);

describe('merit market GBP-per-merit migration', () => {
  it('rescales live-market stock units and prices without touching legacy NAV accounts', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('UPDATE "InvestmentHolding"');
    expect(sql).toContain('SET "units" = "units" * 10');
    expect(sql).toContain('UPDATE "InvestmentTransaction"');
    expect(sql).toContain('"units" = "units" * 10');
    expect(sql).toContain('"nav" = "nav" / 10');
    expect(sql).toContain('WHERE "instrumentId" IS NOT NULL');
    expect(sql).toContain('UPDATE "InvestmentDividendPayment"');
    expect(sql).toContain('UPDATE "InvestmentDividendEvent"');
    expect(sql).toContain('SET "amountMerits" = "amountMerits" / 10');
    expect(sql).not.toContain('UPDATE "InvestmentAccount"');
    expect(sql).not.toContain('UPDATE "InvestmentNav"');
  });
});
