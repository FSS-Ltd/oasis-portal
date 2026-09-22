import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260922113000_library_book_quantity/migration.sql',
);

describe('library book quantity migration', () => {
  it('adds a one-copy default and rejects invalid quantities', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1');
    expect(sql).toContain('CHECK ("quantity" >= 1)');
  });
});
