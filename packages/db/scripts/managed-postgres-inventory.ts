import { createHash } from 'node:crypto';

/** Structural Prisma client subset; permits injected transaction clients and test databases. */
export interface InventoryClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}
export interface MigrationColumn {
  name: string;
  dataType: string;
  ordinal: number;
  notNull?: boolean;
  defaultExpression?: string | null;
  identity?: string;
  generated?: string;
}
export interface MigrationTable {
  schema: string;
  name: string;
  columns: readonly MigrationColumn[];
  primaryKey: readonly string[];
}
export interface MigrationSequence {
  schema: string;
  name: string;
  configuration?: {
    dataType: string;
    start: string;
    increment: string;
    min: string;
    max: string;
    cache: string;
    cycle: boolean;
  };
}
export interface CatalogObject {
  kind: string;
  schema: string;
  name: string;
  definition: string;
  owner: string;
  acl: readonly string[];
}
export interface CatalogSnapshot {
  database: string;
  serverVersion: string;
  tables: readonly MigrationTable[];
  sequences: readonly MigrationSequence[];
  objects: readonly CatalogObject[];
  extensions: readonly { name: string; version: string; schema: string }[];
  migrations: readonly { name: string; checksum: string; finished: boolean; rolledBack: boolean }[];
  crossSchemaDependencies: readonly string[];
  largeObjectCount: number;
}
export interface InventoryOptions {
  projectReference: string;
  sourceUrl: string;
  targetUrl: string;
  expectedSourceDatabase: string;
  expectedTargetDatabase: string;
  sourceGitCommit: string;
  maintenanceGuardSourceHash?: string;
}
export interface MigrationManifest {
  version: 1;
  projectReference: string;
  source: { database: string; serverVersion: string };
  target: { database: string; serverVersion: string };
  sourceGitCommit: string;
  tables: readonly MigrationTable[];
  sequences: readonly MigrationSequence[];
  objects: readonly (CatalogObject & { fingerprint: string })[];
  extensions: CatalogSnapshot['extensions'];
  migrations: CatalogSnapshot['migrations'];
  excludedMaintenanceObjects?: readonly {
    kind: 'function' | 'trigger';
    schema: string;
    name: string;
    securitySourceHash: string;
  }[];
  artifactHash: string;
}
export function quoteIdentifier(value: string): string {
  if (!value || value.includes('\0')) throw new Error('Invalid SQL identifier');
  return `"${value.replaceAll('"', '""')}"`;
}
export function parseProjectIdentity(connectionUrl: string): string {
  let url: URL;
  try {
    url = new URL(connectionUrl);
  } catch {
    throw new Error('Invalid database connection identity');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Invalid database connection identity');
  const direct = /^db\.([a-z0-9-]+)\.supabase\.co$/.exec(url.hostname);
  const pooled = /\.pooler\.supabase\.com$/.test(url.hostname)
    ? /^postgres\.([a-z0-9-]+)$/.exec(decodeURIComponent(url.username))
    : null;
  const reference = direct?.[1] ?? pooled?.[1];
  if (!reference) throw new Error('Unsupported database project identity');
  return reference;
}
function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function verifyManifest(manifest: MigrationManifest): void {
  if (manifest.source.database === manifest.target.database)
    throw new Error('Source and target databases must differ');
  const { artifactHash, ...payload } = manifest;
  if (hash(payload) !== artifactHash) throw new Error('Migration manifest fingerprint mismatch');
  for (const table of manifest.tables) {
    if (
      !['public', 'oasis_private'].includes(table.schema) ||
      !table.primaryKey.length ||
      !table.columns.length ||
      table.primaryKey.some((key) => !table.columns.some((column) => column.name === key))
    )
      throw new Error('Unreviewed table or unstable table ordering');
  }
  for (const object of manifest.excludedMaintenanceObjects ?? []) {
    const knownFunction =
      object.kind === 'function' &&
      object.schema === 'oasis_private' &&
      object.name === 'oasis_private.oasis_migration_reject_write()';
    const knownTrigger =
      object.kind === 'trigger' &&
      object.schema === 'public' &&
      manifest.tables.some(
        (table) =>
          table.schema === 'public' && object.name === `${table.name}:oasis_migration_write_freeze`,
      );
    if ((!knownFunction && !knownTrigger) || !/^[a-f0-9]{64}$/.test(object.securitySourceHash))
      throw new Error('Unreviewed maintenance object exclusion');
  }
  if (manifest.sequences.some((sequence) => !['public', 'oasis_private'].includes(sequence.schema)))
    throw new Error('Unreviewed sequence');
}

/** Metadata only. Application row contents never enter the catalog inventory. */
export const CATALOG_SQL = `WITH app_relations AS (
 SELECT c.*, n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','oasis_private')
), app_objects AS (
 SELECT 'pg_class'::regclass::oid classid, oid objid FROM app_relations
 UNION ALL SELECT 'pg_proc'::regclass::oid, p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','oasis_private')
 UNION ALL SELECT 'pg_type'::regclass::oid, t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','oasis_private')
 UNION ALL SELECT 'pg_constraint'::regclass::oid, c.oid FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','oasis_private')
 UNION ALL SELECT 'pg_trigger'::regclass::oid, t.oid FROM pg_trigger t JOIN app_relations c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'pg_policy'::regclass::oid, p.oid FROM pg_policy p JOIN app_relations c ON c.oid=p.polrelid
 UNION ALL SELECT 'pg_rewrite'::regclass::oid, r.oid FROM pg_rewrite r JOIN app_relations c ON c.oid=r.ev_class
), objects AS (
 SELECT 'relation'::text kind, nspname::text schema, relname::text name, jsonb_build_object('kind',relkind,'rls',relrowsecurity,'forceRls',relforcerowsecurity,'options',reloptions,'view',CASE WHEN relkind IN ('v','m') THEN pg_get_viewdef(oid,true) END)::text definition, pg_get_userbyid(relowner)::text owner, coalesce(to_jsonb(relacl),'[]'::jsonb) acl FROM app_relations
 UNION ALL SELECT 'function'::text, n.nspname::text, p.oid::regprocedure::text, pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner)::text, coalesce(to_jsonb(p.proacl),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','oasis_private') AND p.prokind IN ('f','p')
 UNION ALL SELECT 'constraint'::text, n.nspname::text, c.conrelid::regclass::text || ':' || c.conname, pg_get_constraintdef(c.oid,true) || ';validated=' || c.convalidated::text, '', '[]'::jsonb FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','oasis_private')
 UNION ALL SELECT 'index'::text, nspname::text, relname::text, pg_get_indexdef(oid), '', '[]'::jsonb FROM app_relations WHERE relkind='i'
 UNION ALL SELECT 'trigger'::text, c.nspname::text, c.relname || ':' || t.tgname, jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)::text, '', '[]'::jsonb FROM pg_trigger t JOIN app_relations c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'type'::text, n.nspname::text, t.typname::text, jsonb_build_object('kind',t.typtype,'base',format_type(t.typbasetype,t.typtypmod),'notNull',t.typnotnull,'default',t.typdefault,'enum',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid))::text, pg_get_userbyid(t.typowner)::text, coalesce(to_jsonb(t.typacl),'[]'::jsonb) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','oasis_private') AND t.typtype IN ('e','d')
 UNION ALL SELECT 'policy'::text, schemaname::text, tablename || ':' || policyname, jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)::text, '', '[]'::jsonb FROM pg_policies WHERE schemaname IN ('public','oasis_private')
) SELECT jsonb_build_object(
 'database', current_database(), 'serverVersion', current_setting('server_version_num'),
 'tables', coalesce((SELECT jsonb_agg(jsonb_build_object('schema',nspname,'name',relname,'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'dataType',format_type(a.atttypid,a.atttypmod),'ordinal',a.attnum,'notNull',a.attnotnull,'defaultExpression',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=c.oid AND d.adnum=a.attnum),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'primaryKey',coalesce((SELECT jsonb_agg(a.attname ORDER BY k.ordinality) FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum WHERE i.indrelid=c.oid AND i.indisprimary),'[]'::jsonb)) ORDER BY nspname,relname) FROM app_relations c WHERE relkind IN ('r','p')), '[]'::jsonb),
 'sequences', coalesce((SELECT jsonb_agg(jsonb_build_object('schema',c.nspname,'name',c.relname,'configuration',jsonb_build_object('dataType',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle)) ORDER BY c.nspname,c.relname) FROM app_relations c JOIN pg_sequence s ON s.seqrelid=c.oid WHERE c.relkind='S'),'[]'::jsonb),
 'objects', coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY kind,schema,name) FROM objects o),'[]'::jsonb),
 'extensions', coalesce((SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),'[]'::jsonb),
 'migrations', '[]'::jsonb,
 'crossSchemaDependencies', coalesce((SELECT jsonb_agg(DISTINCT r.identity ORDER BY r.identity) FROM app_objects a JOIN pg_depend d ON d.classid=a.classid AND d.objid=a.objid CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) r WHERE r.schema IS NOT NULL AND r.schema NOT IN ('public','oasis_private','pg_catalog','information_schema')), '[]'::jsonb),
 'largeObjectCount', (SELECT count(*)::int FROM pg_largeobject_metadata)
) snapshot`;
export async function readCatalog(client: InventoryClient): Promise<CatalogSnapshot> {
  const rows = await client.$queryRawUnsafe<{ snapshot: CatalogSnapshot }[]>(CATALOG_SQL);
  if (!rows[0]) throw new Error('Database catalog unavailable');
  const snapshot = rows[0].snapshot;
  if (
    !snapshot.tables.some(
      (table) => table.schema === 'public' && table.name === '_prisma_migrations',
    )
  )
    return snapshot;
  const migrations = await client.$queryRawUnsafe<CatalogSnapshot['migrations']>(
    `SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS "rolledBack" FROM public._prisma_migrations ORDER BY migration_name, checksum`,
  );
  return { ...snapshot, migrations };
}
export async function buildMigrationManifest(
  source: InventoryClient,
  target: InventoryClient,
  options: InventoryOptions,
): Promise<MigrationManifest> {
  if (
    parseProjectIdentity(options.sourceUrl) !== options.projectReference ||
    parseProjectIdentity(options.targetUrl) !== options.projectReference
  )
    throw new Error('Database project mismatch');
  const [from, to] = await Promise.all([readCatalog(source), readCatalog(target)]);
  if (
    from.database === to.database ||
    from.database !== options.expectedSourceDatabase ||
    to.database !== options.expectedTargetDatabase
  )
    throw new Error('Unexpected source or target database');
  if (
    new URL(options.sourceUrl).pathname !== '/' + from.database ||
    new URL(options.targetUrl).pathname !== '/' + to.database
  )
    throw new Error('Connection database identity mismatch');
  if (to.tables.length || to.objects.length || to.sequences.length)
    throw new Error('Target application schemas must be empty');
  if (from.migrations.some((migration) => !migration.finished && !migration.rolledBack))
    throw new Error('Unfinished source migration history');
  if (from.crossSchemaDependencies.length || from.largeObjectCount)
    throw new Error('Unclassified external dependencies or large objects require review');
  for (const name of ['TimetableAgeGroupMembership', '_prisma_migrations'])
    if (!from.tables.some((table) => table.schema === 'public' && table.name === name))
      throw new Error('Required application table missing');
  const payload = {
    version: 1 as const,
    projectReference: options.projectReference,
    source: { database: from.database, serverVersion: from.serverVersion },
    target: { database: to.database, serverVersion: to.serverVersion },
    sourceGitCommit: options.sourceGitCommit,
    tables: from.tables,
    sequences: from.sequences,
    objects: from.objects.map((object) => ({ ...object, fingerprint: hash(object) })),
    extensions: from.extensions,
    migrations: from.migrations,
    ...(options.maintenanceGuardSourceHash
      ? {
          excludedMaintenanceObjects: [
            {
              kind: 'function' as const,
              schema: 'oasis_private',
              name: 'oasis_private.oasis_migration_reject_write()',
              securitySourceHash: options.maintenanceGuardSourceHash,
            },
            ...from.tables
              .filter((table) => table.schema === 'public')
              .map((table) => ({
                kind: 'trigger' as const,
                schema: table.schema,
                name: `${table.name}:oasis_migration_write_freeze`,
                securitySourceHash: options.maintenanceGuardSourceHash ?? '',
              })),
          ],
        }
      : {}),
  };
  const manifest = { ...payload, artifactHash: hash(payload) };
  verifyManifest(manifest);
  return manifest;
}
