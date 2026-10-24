import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../prisma/migrations');
const migration = (name: string): string =>
  readFileSync(resolve(root, name, 'migration.sql'), 'utf8');

describe('transactional application events', () => {
  it('uses a private, fail-closed configuration and grants no client publication', () => {
    const sql = migration('20261023150000_realtime_private_delivery');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS oasis_private');
    expect(sql).toContain('enforce_2fa boolean');
    expect(sql).toContain('REVOKE ALL ON SCHEMA oasis_private FROM PUBLIC');
    expect(sql).toContain("jsonb_typeof(claims->'fva'->0) = 'number'");
    expect(sql).not.toMatch(/ALTER TABLE realtime\./i);
    expect(sql).toContain('AS RESTRICTIVE FOR INSERT TO authenticated');
    expect(sql).toContain('AS RESTRICTIVE FOR SELECT TO authenticated');
  });

  it('deduplicates recipient and area inside each transaction and drains before commit', () => {
    const sql = migration('20261023150200_realtime_change_capture');
    expect(sql).toContain('PRIMARY KEY (transaction_id, clerk_id, area)');
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('ON CONFLICT DO NOTHING');
    expect(sql).toContain('DELETE FROM oasis_private.pending_change');
    expect(sql).toContain("'oasis.data_changed'");
    expect(sql).toContain("- 'updatedAt'");
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE');
    expect(sql).toContain('AFTER INSERT OR UPDATE');
  });
});
