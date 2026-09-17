import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260917100000_parent_email_notification_preferences/migration.sql',
);

describe('parent email notification preferences migration', () => {
  it('keeps existing users opted into optional parent notifications by default', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TYPE "ParentEmailNotificationCategory"');
    expect(sql).toContain(
      'ADD COLUMN "parentEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true',
    );
    expect(sql).toContain('ADD COLUMN "parentEmailNotificationOptOuts"');
    expect(sql).toContain('NOT NULL DEFAULT ARRAY[]::"ParentEmailNotificationCategory"[]');
  });
});
