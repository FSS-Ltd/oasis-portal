import { randomBytes } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  assertSafeRestoreList,
  postgresEnvironment,
  readArchiveList,
  restoreEncryptedBackup,
  verifyEncryptedBackup,
  type BackupReceipt,
} from './managed-postgres-backup.js';
import {
  parseProjectIdentity,
  verifyManifest,
  type MigrationManifest,
} from './managed-postgres-inventory.js';

interface ReviewedRestoreBoundary {
  manifest: MigrationManifest;
  targetUrl: string;
  /** Exact non-comment TOC lines approved against the reviewed archive. */
  approvedArchiveEntries: readonly string[];
  rehearsal?: { host: '127.0.0.1' | 'localhost' | '[::1]'; port: number; database: string };
}
export interface ReviewedRestoreOptions extends ReviewedRestoreBoundary {
  receipt: BackupReceipt;
  backupKey: Buffer;
  phase: 'pre-data' | 'data' | 'post-data';
}
interface ArchiveEntry {
  kind: string;
  schema: string;
  name: string;
}

function entryIdentity(line: string): ArchiveEntry {
  const match =
    /^\d+; \d+ \d+ (TABLE DATA|SEQUENCE SET|SEQUENCE OWNED BY|MATERIALIZED VIEW DATA|FK CONSTRAINT|CHECK CONSTRAINT|DOMAIN CONSTRAINT|ROW SECURITY|TABLE ATTACH|INDEX ATTACH|MATERIALIZED VIEW|TABLE|SEQUENCE|TYPE|DOMAIN|FUNCTION|PROCEDURE|AGGREGATE|VIEW|DEFAULT|INDEX|TRIGGER|RULE|POLICY|COMMENT|STATISTICS|CONSTRAINT) (public|oasis_private) (.+) [^ ]+$/.exec(
      line,
    );
  if (!match?.[1] || !match[2] || !match[3]) throw new Error('Unsupported reviewed archive entry');
  return { kind: match[1], schema: match[2], name: match[3] };
}
function normalizedIdentity(name: string, schema: string): string {
  return name
    .replace(new RegExp(`^${schema}\\.`), '')
    .replaceAll('"', '')
    .replace(/,\s+/g, ',');
}
function isManifestEntry(entry: ArchiveEntry, manifest: MigrationManifest): boolean {
  const { kind, schema, name } = entry;
  const hasTable = (tableName: string): boolean =>
    manifest.tables.some((table) => table.schema === schema && table.name === tableName);
  const hasSequence = (): boolean =>
    manifest.sequences.some((sequence) => sequence.schema === schema && sequence.name === name);
  const hasObject = (objectKind: string, objectName = name): boolean =>
    manifest.objects.some(
      (object) =>
        object.schema === schema &&
        object.kind === objectKind &&
        normalizedIdentity(object.name, schema) === normalizedIdentity(objectName, schema),
    );
  if (['TABLE', 'TABLE DATA', 'ROW SECURITY'].includes(kind)) return hasTable(name);
  if (['SEQUENCE', 'SEQUENCE SET', 'SEQUENCE OWNED BY'].includes(kind)) return hasSequence();
  if (['TYPE', 'DOMAIN'].includes(kind)) return hasObject('type');
  if (['FUNCTION', 'PROCEDURE'].includes(kind)) return hasObject('function');
  if (kind === 'INDEX') return hasObject('index');
  if (['VIEW', 'MATERIALIZED VIEW', 'MATERIALIZED VIEW DATA'].includes(kind))
    return hasObject('relation');
  const parts = name.split(' ');
  if (kind === 'DEFAULT') {
    const [tableName, columnName] = parts;
    return manifest.tables.some(
      (table) =>
        table.schema === schema &&
        table.name === tableName &&
        table.columns.some(
          (column) =>
            column.name === columnName &&
            column.defaultExpression !== null &&
            column.defaultExpression !== undefined,
        ),
    );
  }
  const compoundKind =
    kind === 'TRIGGER'
      ? 'trigger'
      : kind === 'POLICY'
        ? 'policy'
        : ['CONSTRAINT', 'FK CONSTRAINT', 'CHECK CONSTRAINT', 'DOMAIN CONSTRAINT'].includes(kind)
          ? 'constraint'
          : null;
  const [parentName, childName] = parts;
  if (compoundKind && parts.length === 2 && parentName && childName)
    return hasObject(compoundKind, `${parentName}:${childName}`);
  if (kind === 'COMMENT') {
    const separator = name.indexOf(' ');
    if (separator < 0) return false;
    const subjectKind = name.slice(0, separator);
    const subjectName = name.slice(separator + 1);
    if (subjectKind === 'COLUMN') {
      return manifest.tables.some(
        (table) =>
          table.schema === schema &&
          table.columns.some((column) => `${table.name}.${column.name}` === subjectName),
      );
    }
    return isManifestEntry({ kind: subjectKind, schema, name: subjectName }, manifest);
  }
  return false;
}

/** Pure review gate: never opens a database connection or changes data. */
export function validateReviewedRestore(
  options: ReviewedRestoreBoundary,
  archiveContents: string,
): void {
  verifyManifest(options.manifest);
  const environment = postgresEnvironment(options.targetUrl);
  let identityMatches = false;
  if (options.rehearsal) {
    const { host, port, database } = options.rehearsal;
    identityMatches =
      ['127.0.0.1', 'localhost', '[::1]'].includes(host) &&
      environment.PGHOST === host &&
      environment.PGPORT === String(port) &&
      environment.PGDATABASE === database &&
      database !== options.manifest.source.database;
  } else {
    identityMatches =
      options.manifest.target.database === 'postgres' &&
      environment.PGDATABASE === options.manifest.target.database &&
      parseProjectIdentity(options.targetUrl) === options.manifest.projectReference;
  }
  if (!identityMatches) throw new Error('Reviewed target identity mismatch');
  const actual = new Set(
    archiveContents.split('\n').filter((line) => line.trim() && !line.trimStart().startsWith(';')),
  );
  const approved = new Set(options.approvedArchiveEntries);
  if (approved.size !== options.approvedArchiveEntries.length)
    throw new Error('Duplicate reviewed archive entry');
  assertSafeRestoreList(options.approvedArchiveEntries.join('\n'));
  for (const line of actual) {
    if (approved.has(line)) continue;
    // These objects are deliberately managed by the target installer, never restored.
    if (
      /^\d+; \d+ \d+ (?:SCHEMA|ACL|DEFAULT ACL|EXTENSION|DATABASE|DATABASE PROPERTIES) /.test(
        line,
      ) ||
      /^\d+; \d+ \d+ COMMENT - (?:EXTENSION|SCHEMA) /.test(line)
    )
      continue;
    const entry = entryIdentity(line);
    const excludedGuard = (options.manifest.excludedMaintenanceObjects ?? []).some((object) => {
      if (object.schema !== entry.schema) return false;
      if (object.kind === 'function' && entry.kind === 'FUNCTION') {
        return (
          normalizedIdentity(object.name, object.schema) ===
          normalizedIdentity(entry.name, entry.schema)
        );
      }
      return (
        object.kind === 'trigger' &&
        entry.kind === 'TRIGGER' &&
        object.name === entry.name.replace(' ', ':')
      );
    });
    if (!excludedGuard) throw new Error('Authenticated archive contains an unreviewed entry');
  }

  const identities = options.approvedArchiveEntries.map((line) => {
    if (!actual.has(line))
      throw new Error('Reviewed archive entry does not match authenticated archive');
    const entry = entryIdentity(line);
    if (!isManifestEntry(entry, options.manifest))
      throw new Error(
        `Reviewed archive entry is absent from manifest: ${entry.kind} ${entry.schema} ${entry.name}`,
      );
    return entry;
  });
  for (const table of options.manifest.tables) {
    if (
      !identities.some(
        (entry) =>
          entry.kind === 'TABLE' && entry.schema === table.schema && entry.name === table.name,
      ) ||
      !identities.some(
        (entry) =>
          entry.kind === 'TABLE DATA' && entry.schema === table.schema && entry.name === table.name,
      )
    ) {
      throw new Error('Reviewed archive is missing required table schema or data');
    }
  }
  for (const sequence of options.manifest.sequences) {
    if (
      !identities.some(
        (entry) =>
          entry.kind === 'SEQUENCE SET' &&
          entry.schema === sequence.schema &&
          entry.name === sequence.name,
      )
    ) {
      throw new Error('Reviewed archive is missing required sequence state');
    }
  }
}

/** Application mutation entry point. Always uses the restricted application object owner. */
export async function restoreReviewedApplication(options: ReviewedRestoreOptions): Promise<void> {
  verifyManifest(options.manifest);
  const verified = await verifyEncryptedBackup({
    artifactPath: options.receipt.artifactPath,
    backupKey: options.backupKey,
  });
  if (
    verified.artifactPath !== options.receipt.artifactPath ||
    verified.sha256 !== options.receipt.sha256 ||
    verified.sizeBytes !== options.receipt.sizeBytes
  ) {
    throw new Error('Reviewed encrypted backup receipt mismatch');
  }
  const archiveContents = await readArchiveList({
    artifactPath: verified.artifactPath,
    backupKey: options.backupKey,
  });
  validateReviewedRestore(options, archiveContents);
  const listPath = join(
    dirname(verified.artifactPath),
    `reviewed-${randomBytes(12).toString('hex')}.list`,
  );
  await writeFile(listPath, options.approvedArchiveEntries.join('\n') + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  try {
    await restoreEncryptedBackup({
      targetUrl: options.targetUrl,
      artifactPath: verified.artifactPath,
      backupKey: options.backupKey,
      phase: options.phase,
      listPath,
      role: 'oasis_owner',
    });
  } finally {
    await unlink(listPath);
  }
}
