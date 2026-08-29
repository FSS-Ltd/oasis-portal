import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260829130000_pace_inventory_diagnostics/migration.sql',
);

describe('PACE inventory and diagnostics migration', () => {
  it('persists inventory orders and diagnostic history with Head-only access', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TYPE "PaceInventoryOrderStatus"');
    expect(sql).toContain('CREATE TYPE "DiagnosticOutcome"');
    expect(sql).toContain('CREATE TABLE "PaceInventoryOrder"');
    expect(sql).toContain('CREATE TABLE "DiagnosticResult"');
    expect(sql).toContain('CHECK ("paceNumber" > 0)');
    expect(sql).toContain('CHECK ("level" >= 1 AND "level" <= 5)');
    expect(sql).toContain('pace_inventory_orders_head_all');
    expect(sql).toContain('diagnostic_results_head_all');
    expect(sql).toContain("current_setting('app.user_role', true) = 'Head'");
    expect(sql).not.toContain("current_setting('app.full_admin', true)");
  });
});
