import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260831110000_student_pace_supply/migration.sql',
);
const orderRangeMigrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260831155810_pace_inventory_order_range/migration.sql',
);

describe('student PACE supply migration', () => {
  it('persists student-specific supply, preserves delivered history, and soft-deletes diagnostics', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TYPE "StudentPaceSupplySource"');
    expect(sql).toContain('CREATE TABLE "StudentPaceSupply"');
    expect(sql).toContain('UNIQUE ("studentId", "subjectId", "paceNumber")');
    expect(sql).toContain('CHECK ("paceNumber" BETWEEN 1001 AND 1144)');
    expect(sql).toContain('INSERT INTO "StudentPaceSupply"');
    expect(sql).toContain("'DeliveredOrder'");
    expect(sql).toContain('FROM "PaceInventoryOrder"');
    expect(sql).toContain('WHERE "status" = \'Delivered\'');
    expect(sql).toContain('AND "paceNumber" BETWEEN 1001 AND 1144');
    expect(sql).toContain('ON CONFLICT ("studentId", "subjectId", "paceNumber") DO NOTHING');
    expect(sql).toContain('ADD COLUMN "deletedAt" TIMESTAMP(3)');
    expect(sql).toContain('ADD COLUMN "deletedById" TEXT');
    expect(sql).toContain('DiagnosticResult_deletedById_fkey');
    expect(sql).toContain('ALTER TABLE "StudentPaceSupply" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "StudentPaceSupply" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('student_pace_supply_head_all');
    expect(sql).toContain("current_setting('app.user_role', true) = 'Head'");
    expect(sql).not.toContain("current_setting('app.full_admin', true)");
  });

  it('rejects invalid legacy orders before enforcing the PACE order range', () => {
    expect(existsSync(orderRangeMigrationPath)).toBe(true);
    if (!existsSync(orderRangeMigrationPath)) return;

    const sql = readFileSync(orderRangeMigrationPath, 'utf8');
    const preflightIndex = sql.indexOf('IF EXISTS');
    const constraintIndex = sql.indexOf('ADD CONSTRAINT "PaceInventoryOrder_paceNumber_check"');

    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(sql).toContain('"paceNumber" NOT BETWEEN 1001 AND 1144');
    expect(sql).toContain('Invalid PaceInventoryOrder paceNumber values must be remediated');
    expect(sql).toContain('DROP CONSTRAINT "PaceInventoryOrder_paceNumber_check"');
    expect(constraintIndex).toBeGreaterThan(preflightIndex);
    expect(sql).toContain('CHECK ("paceNumber" BETWEEN 1001 AND 1144)');
    expect(sql).not.toMatch(/DELETE\s+FROM\s+"PaceInventoryOrder"/iu);
    expect(sql).not.toMatch(/UPDATE\s+"PaceInventoryOrder"/iu);
  });
});
