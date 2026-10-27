import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string) => readFileSync(resolve(testDir, relativePath), 'utf8');
const sql = read('../../prisma/migrations/20261027120000_diagnostic_pace_chart/migration.sql');
const schema = read('../../prisma/schema.prisma');

describe('diagnostic PACE chart migration', () => {
  it('adds the test, chart arrays and nullable result columns without rewriting rows', () => {
    expect(sql).toContain(
      `CREATE TYPE "DiagnosticTest" AS ENUM ('Math', 'English', 'WordBuilding', 'Reading')`,
    );
    expect(sql).toContain('ADD COLUMN "test" "DiagnosticTest"');
    expect(sql).toContain(
      'ADD COLUMN "attemptedPaceNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]',
    );
    expect(sql).toContain(
      'ADD COLUMN "circledPaceNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]',
    );
    for (const column of ['subjectId', 'level', 'outcome']) {
      expect(sql).toContain(`ALTER COLUMN "${column}" DROP NOT NULL`);
    }
    // Existing rows are left alone: a null test marks a legacy level result.
    expect(sql).not.toMatch(/\bUPDATE\b/);
  });

  it('widens the level range to 9 and constrains the chart arrays', () => {
    expect(sql).toContain('DROP CONSTRAINT "DiagnosticResult_level_check"');
    expect(sql).toContain(`"level" IS NULL OR ("level" >= 1 AND "level" <= 9)`);
    expect(sql).toContain(`1001 <= ALL ("attemptedPaceNumbers")`);
    expect(sql).toContain(`1144 >= ALL ("attemptedPaceNumbers")`);
    expect(sql).toContain(`"circledPaceNumbers" <@ "attemptedPaceNumbers"`);
    expect(sql).toContain('DiagnosticResult_shape_check');
  });

  it('stores a level sitting as passed and failed level lists', () => {
    expect(sql).toContain(
      'ADD COLUMN "passedLevels" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]',
    );
    expect(sql).toContain(
      'ADD COLUMN "failedLevels" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]',
    );
    expect(sql).toContain('DiagnosticResult_levels_check');
    expect(sql).toContain('1 <= ALL ("passedLevels")');
    expect(sql).toContain('9 >= ALL ("failedLevels")');
    expect(sql).toContain('NOT ("passedLevels" && "failedLevels")');
    // A Reading or Word Building row is either one legacy level result or a sitting.
    expect(sql).toContain('cardinality("passedLevels") + cardinality("failedLevels") > 0');
  });

  it('keeps Head-only access and matches the Prisma model', () => {
    expect(sql).not.toContain('POLICY');
    expect(schema).toMatch(/enum DiagnosticTest \{\s*Math\s*English\s*WordBuilding\s*Reading\s*\}/);
    expect(schema).toMatch(
      /model DiagnosticResult \{[\s\S]*subjectId\s+String\?[\s\S]*test\s+DiagnosticTest\?/,
    );
    expect(schema).toMatch(/attemptedPaceNumbers\s+Int\[\]\s+@default\(\[\]\)/);
    expect(schema).toMatch(/passedLevels\s+Int\[\]\s+@default\(\[\]\)/);
    expect(schema).toMatch(/failedLevels\s+Int\[\]\s+@default\(\[\]\)/);
  });
});
