import { createHash } from 'node:crypto';
import type { InventoryClient } from './managed-postgres-inventory.js';

interface GuardState {
  database: string;
  table: string;
  enabled: string | null;
  triggerType: number | null;
  functionSchema: string | null;
  functionName: string | null;
  definition: string | null;
  unconditional: boolean;
}
export interface MaintenanceFreezeReceipt {
  database: string;
  tableCount: number;
  guardDefinitionHash: string;
}

/** Read-only receipt. The operator must still keep DDL/deploys blocked after verification. */
export async function verifyMaintenanceFreeze(
  client: InventoryClient,
  expectedDatabase: string,
  reviewedTables: readonly string[],
  expectedGuardDefinitionHash: string,
): Promise<MaintenanceFreezeReceipt> {
  if (!/^[a-f0-9]{64}$/.test(expectedGuardDefinitionHash)) {
    throw new Error('A reviewed expected guard definition hash is required');
  }
  if (!reviewedTables.length || new Set(reviewedTables).size !== reviewedTables.length) {
    throw new Error('A complete unique reviewed table scope is required');
  }
  const rows = await client.$queryRawUnsafe<GuardState[]>(`
    SELECT current_database() AS database, c.relname AS table,
      t.tgenabled::text AS enabled, t.tgtype::int AS "triggerType",
      fn.nspname AS "functionSchema", p.proname AS "functionName",
      pg_get_functiondef(p.oid) AS definition,
      (t.tgqual IS NULL AND t.tgnargs=0 AND t.tgattr::text=''
        AND t.tgconstraint=0 AND NOT t.tgisinternal
        AND NOT t.tgdeferrable AND NOT t.tginitdeferred
        AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL) AS unconditional
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname='oasis_migration_write_freeze'
    LEFT JOIN pg_proc p ON p.oid=t.tgfoid
    LEFT JOIN pg_namespace fn ON fn.oid=p.pronamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ORDER BY c.relname
  `);
  const scope = new Set(reviewedTables);
  if (
    rows.length !== scope.size ||
    rows.some(
      (row) =>
        row.database !== expectedDatabase ||
        !scope.has(row.table) ||
        row.enabled !== 'A' ||
        !row.unconditional ||
        row.triggerType !== 62 ||
        row.functionSchema !== 'oasis_private' ||
        row.functionName !== 'oasis_migration_reject_write' ||
        !row.definition ||
        row.definition !== rows[0]?.definition,
    )
  ) {
    throw new Error('Source write freeze does not cover the exact reviewed scope');
  }
  const definition = rows[0]?.definition;
  if (!definition) throw new Error('Source write guard definition is missing');
  const guardDefinitionHash = createHash('sha256').update(definition).digest('hex');
  if (guardDefinitionHash !== expectedGuardDefinitionHash) {
    throw new Error('Source write guard definition does not match reviewed hash');
  }
  return {
    database: expectedDatabase,
    tableCount: rows.length,
    guardDefinitionHash,
  };
}
