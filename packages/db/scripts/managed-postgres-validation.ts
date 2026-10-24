import { createHash } from 'node:crypto';
import {
  quoteIdentifier,
  readCatalog,
  verifyManifest,
  type InventoryClient,
  type CatalogObject,
  type MigrationManifest,
  type MigrationTable,
} from './managed-postgres-inventory.js';

export interface ValidationClient {
  $transaction<T>(
    callback: (transaction: InventoryClient) => Promise<T>,
    options?: { isolationLevel: 'RepeatableRead'; timeout: number; maxWait: number },
  ): Promise<T>;
}
interface TableDigest {
  schema: string;
  name: string;
  count: string;
  digest: string;
}
interface SequenceState {
  schema: string;
  name: string;
  lastValue: string;
  isCalled: boolean;
}
export interface ApplicationBaseline {
  version: number;
  manifestHash: string;
  tables: readonly TableDigest[];
  sequences: readonly SequenceState[];
}
export interface ValidationReport {
  valid: boolean;
  tables: readonly {
    schema: string;
    name: string;
    sourceCount: string;
    targetCount: string;
    countMatch: boolean;
    contentMatch: boolean;
  }[];
  sequences: readonly { schema: string; name: string; matches: boolean }[];
  schemaMatches: boolean;
  constraintsValid: boolean;
  notificationsEmpty: boolean;
  failures: readonly string[];
}
interface Snapshot extends ApplicationBaseline {
  schemaMatches: boolean;
  constraintsValid: boolean;
  notificationsEmpty: boolean;
}
function qualified(schema: string, name: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
}

export interface BaselineOptions {
  snapshot?: string;
}
interface CaptureOptions extends BaselineOptions {
  rehearsalDatabase?: string;
}

/** Logical restores compact attnum gaps left by dropped columns; relative column order remains authoritative. */
function semanticTables(tables: readonly MigrationTable[]): readonly MigrationTable[] {
  return tables.map((table) => ({
    ...table,
    columns: table.columns.map((column, index) => ({ ...column, ordinal: index + 1 })),
  }));
}

function isExcludedMaintenanceObject(object: CatalogObject, manifest: MigrationManifest): boolean {
  const reviewed = (manifest.excludedMaintenanceObjects ?? []).some(
    (excluded) =>
      excluded.kind === object.kind &&
      excluded.schema === object.schema &&
      excluded.name === object.name,
  );
  if (!reviewed || object.kind !== 'trigger') return reviewed;
  try {
    const trigger: unknown = JSON.parse(object.definition);
    return (
      typeof trigger === 'object' &&
      trigger !== null &&
      'definition' in trigger &&
      typeof trigger.definition === 'string' &&
      'enabled' in trigger &&
      trigger.enabled === 'A'
    );
  } catch {
    return false;
  }
}

async function capture(
  client: ValidationClient,
  manifest: MigrationManifest,
  database: string,
  options: CaptureOptions = {},
): Promise<Snapshot> {
  verifyManifest(manifest);
  if (options.snapshot && !/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}-[0-9]+$/.test(options.snapshot))
    throw new Error('Invalid exported snapshot identifier');
  if (
    options.rehearsalDatabase &&
    !/^oasis_migration_rehearsal(?:_[a-z0-9_]+)?$/.test(options.rehearsalDatabase)
  )
    throw new Error('Unsafe rehearsal database identity');
  return client.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe('SET TRANSACTION READ ONLY');
      if (options.snapshot)
        await tx.$queryRawUnsafe(`SET TRANSACTION SNAPSHOT '${options.snapshot}'`);
      await tx.$queryRawUnsafe(`SET LOCAL timezone = 'UTC'`);
      await tx.$queryRawUnsafe(`SET LOCAL datestyle = 'ISO, YMD'`);
      await tx.$queryRawUnsafe(`SET LOCAL intervalstyle = 'postgres'`);
      await tx.$queryRawUnsafe(`SET LOCAL extra_float_digits = 3`);
      await tx.$queryRawUnsafe(`SET LOCAL bytea_output = 'hex'`);
      const identity = await tx.$queryRawUnsafe<
        { database: string; serverAddress: string | null }[]
      >('SELECT current_database() AS database, host(inet_server_addr()) AS "serverAddress"');
      if (identity[0]?.database !== database)
        throw new Error('Validation database identity mismatch');
      if (
        options.rehearsalDatabase &&
        !['127.0.0.1', '::1'].includes(identity[0].serverAddress ?? '')
      )
        throw new Error('Rehearsal validation requires loopback PostgreSQL');
      const catalog = await readCatalog(tx);
      const objects =
        database === manifest.source.database
          ? catalog.objects.filter((object) => !isExcludedMaintenanceObject(object, manifest))
          : catalog.objects;
      const schemaMatches =
        JSON.stringify(semanticTables(catalog.tables)) ===
          JSON.stringify(semanticTables(manifest.tables)) &&
        JSON.stringify(catalog.sequences) === JSON.stringify(manifest.sequences) &&
        !catalog.largeObjectCount &&
        !catalog.crossSchemaDependencies.length &&
        manifest.objects.every((expected) =>
          objects.some(
            (actual) =>
              actual.kind === expected.kind &&
              actual.schema === expected.schema &&
              actual.name === expected.name &&
              actual.definition === expected.definition,
          ),
        ) &&
        objects.length === manifest.objects.length;
      const tables: TableDigest[] = [];
      let notificationsEmpty = true;
      for (const table of manifest.tables) {
        const relation = qualified(table.schema, table.name);
        // Cast every column to its deterministic PostgreSQL text representation before JSON framing.
        // This preserves numeric precision, bytea bytes, NULLs, array order, and embedded newlines.
        const columns = table.columns
          .map((column) => `${quoteIdentifier(column.name)}::text`)
          .join(', ');
        const order = table.primaryKey
          .map((column) => `${quoteIdentifier(column)}::text COLLATE "C"`)
          .join(', ');
        await tx.$queryRawUnsafe(
          `DECLARE oasis_validation_cursor NO SCROLL CURSOR FOR SELECT json_build_array(${columns})::text AS canonical FROM ${relation} ORDER BY ${order}`,
        );
        const digest = createHash('sha256');
        let count = 0n;
        try {
          for (;;) {
            const rows = await tx.$queryRawUnsafe<{ canonical: string }[]>(
              'FETCH FORWARD 500 FROM oasis_validation_cursor',
            );
            if (!rows.length) break;
            for (const row of rows) {
              digest
                .update(String(Buffer.byteLength(row.canonical)))
                .update(':')
                .update(row.canonical);
              count += 1n;
            }
          }
        } finally {
          await tx.$queryRawUnsafe('CLOSE oasis_validation_cursor');
        }
        tables.push({
          schema: table.schema,
          name: table.name,
          count: String(count),
          digest: digest.digest('hex'),
        });
        if (
          table.schema === 'oasis_private' &&
          /pending|accumulator/i.test(table.name) &&
          count > 0n
        )
          notificationsEmpty = false;
      }
      const sequences: SequenceState[] = [];
      for (const sequence of manifest.sequences) {
        const rows = await tx.$queryRawUnsafe<{ lastValue: string; isCalled: boolean }[]>(
          `SELECT last_value::text AS "lastValue", is_called AS "isCalled" FROM ${qualified(sequence.schema, sequence.name)}`,
        );
        if (!rows[0]) throw new Error('Sequence state unavailable');
        sequences.push({ ...sequence, ...rows[0] });
      }
      const invalid = await tx.$queryRawUnsafe<{ invalid_count: number }[]>(`SELECT (
      (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','oasis_private') AND NOT c.convalidated)
      + (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','oasis_private') AND (NOT i.indisvalid OR NOT i.indisready))
    )::int AS invalid_count`);
      return {
        version: 1,
        manifestHash: manifest.artifactHash,
        tables,
        sequences,
        schemaMatches,
        constraintsValid:
          invalid[0]?.invalid_count === 0 &&
          catalog.migrations.every((migration) => migration.finished || migration.rolledBack),
        notificationsEmpty,
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 3_600_000, maxWait: 30_000 },
  );
}
/** Use frozen writers or a shared exported dump snapshot so both artifacts describe the same committed dataset. */
export async function captureApplicationBaseline(
  source: ValidationClient,
  manifest: MigrationManifest,
  options: BaselineOptions = {},
): Promise<ApplicationBaseline> {
  const snapshot = await capture(source, manifest, manifest.source.database, options);
  if (!snapshot.schemaMatches || !snapshot.constraintsValid || !snapshot.notificationsEmpty)
    throw new Error('Source application baseline safety checks failed');
  return {
    version: 1,
    manifestHash: snapshot.manifestHash,
    tables: snapshot.tables,
    sequences: snapshot.sequences,
  };
}
async function compareBaseline(
  target: ValidationClient,
  manifest: MigrationManifest,
  baseline: ApplicationBaseline,
  options: CaptureOptions = {},
): Promise<ValidationReport> {
  if (
    baseline.version !== 1 ||
    baseline.manifestHash !== manifest.artifactHash ||
    baseline.tables.length !== manifest.tables.length ||
    baseline.sequences.length !== manifest.sequences.length
  )
    throw new Error('Baseline manifest mismatch');
  const actual = await capture(
    target,
    manifest,
    options.rehearsalDatabase ?? manifest.target.database,
    options,
  );
  const tables = manifest.tables.map((table) => {
    const expected = baseline.tables.find(
      (item) => item.schema === table.schema && item.name === table.name,
    );
    const observed = actual.tables.find(
      (item) => item.schema === table.schema && item.name === table.name,
    );
    return {
      schema: table.schema,
      name: table.name,
      sourceCount: expected?.count ?? 'missing',
      targetCount: observed?.count ?? 'missing',
      countMatch: !!expected && expected.count === observed?.count,
      contentMatch: !!expected && expected.digest === observed?.digest,
    };
  });
  const sequences = manifest.sequences.map((sequence) => {
    const expected = baseline.sequences.find(
      (item) => item.schema === sequence.schema && item.name === sequence.name,
    );
    const observed = actual.sequences.find(
      (item) => item.schema === sequence.schema && item.name === sequence.name,
    );
    return {
      ...sequence,
      matches:
        !!expected &&
        expected.lastValue === observed?.lastValue &&
        expected.isCalled === observed.isCalled,
    };
  });
  const failures: string[] = [];
  if (tables.some((table) => !table.countMatch || !table.contentMatch))
    failures.push('Application table content mismatch');
  if (sequences.some((sequence) => !sequence.matches))
    failures.push('Application sequence state mismatch');
  if (!actual.schemaMatches) failures.push('Application schema definitions mismatch');
  if (!actual.constraintsValid)
    failures.push('Unvalidated constraints, invalid indexes, or unfinished migrations');
  if (!actual.notificationsEmpty) failures.push('Pending notification rows remain');
  return {
    valid: failures.length === 0,
    tables,
    sequences,
    schemaMatches: actual.schemaMatches,
    constraintsValid: actual.constraintsValid,
    notificationsEmpty: actual.notificationsEmpty,
    failures,
  };
}
export async function compareApplicationBaseline(
  target: ValidationClient,
  manifest: MigrationManifest,
  baseline: ApplicationBaseline,
): Promise<ValidationReport> {
  return compareBaseline(target, manifest, baseline);
}
export async function compareRehearsalBaseline(
  target: ValidationClient,
  manifest: MigrationManifest,
  baseline: ApplicationBaseline,
  database: string,
): Promise<ValidationReport> {
  return compareBaseline(target, manifest, baseline, { rehearsalDatabase: database });
}
export async function validateApplicationCopy(
  source: ValidationClient,
  target: ValidationClient,
  manifest: MigrationManifest,
): Promise<ValidationReport> {
  return compareApplicationBaseline(
    target,
    manifest,
    await captureApplicationBaseline(source, manifest),
  );
}
