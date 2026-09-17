import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260917110000_parent_pace_history_index/migration.sql',
);

describe('parent PACE history index migration', () => {
  it('adds the student and chronological history index without modifying PACE data', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE INDEX "PaceRecord_studentId_completedAt_createdAt_idx"');
    expect(sql).toContain('ON "PaceRecord"("studentId", "completedAt", "createdAt")');
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE/iu);
  });
});
