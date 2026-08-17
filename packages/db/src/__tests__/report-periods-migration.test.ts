import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260817120000_report_periods_and_pdfs/migration.sql',
);

describe('report periods and PDFs migration', () => {
  it('backfills every legacy term before making period fields required', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const backfill = sql.indexOf('UPDATE "TermReport"');
    const notNull = sql.indexOf('ALTER COLUMN "periodLabel" SET NOT NULL');

    expect(sql).toContain('CREATE TYPE "ReportPeriodType"');
    expect(sql).toContain('WHEN "term" LIKE \'%-Spring\'');
    expect(sql).toContain('WHEN "term" LIKE \'%-Summer\'');
    expect(sql).toContain('WHEN "term" LIKE \'%-Autumn\'');
    expect(sql).toContain('ADD COLUMN "pdfBytesEnc" TEXT');
    expect(backfill).toBeGreaterThan(-1);
    expect(notNull).toBeGreaterThan(backfill);
    expect(sql).not.toContain('DROP COLUMN "term"');
  });
});
