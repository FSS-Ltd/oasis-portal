import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, chmod, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEncryptedBackup,
  verifyEncryptedBackup,
  restoreEncryptedBackup,
  readArchiveList,
  readArchiveSchema,
  assertSafeRestoreList,
  postgresEnvironment,
  restoreReviewedApplication,
} from '../../scripts/managed-postgres-copy.js';

let directory: string;
let previousPath: string | undefined;
const backupKey = randomBytes(32);
const sourceUrl = 'postgresql://operator:private-password@localhost:5432/source?sslmode=require';
const archive = 'PGDMP fixture archive contents';

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'oasis-backup-test-'));
  previousPath = process.env.PATH;
  process.env.PATH = `${directory}:${previousPath ?? ''}`;
  await writeFile(
    join(directory, 'pg_dump'),
    `#!/usr/bin/env node
if(process.argv.includes('--version')) { console.log('pg_dump (PostgreSQL) 17.7'); process.exit(0); }
if(process.argv.some(x=>x.includes('private-password'))) process.exit(3);
process.stdout.write(${JSON.stringify(archive)}.repeat(process.env.OASIS_TEST_LARGE_DUMP ? 100000 : 1));
if(process.env.OASIS_TEST_DUMP_FAILURE) process.exitCode=1;
`,
  );
  await writeFile(
    join(directory, 'pg_restore'),
    `#!/usr/bin/env node
if(process.argv.includes('--version')) { console.log('pg_restore (PostgreSQL) 17.7'); process.exit(0); }
if(!process.argv.includes('--list') && !process.argv.includes('--schema-only')) require('node:fs').writeFileSync(${JSON.stringify(join(directory, 'restore-started'))}, 'started');
if(process.env.OASIS_TEST_RESTORE_EARLY) { console.log('1; 1259 100 TABLE public User operator'); process.exit(0); }
let data=''; process.stdin.on('data', c=>data+=c); process.stdin.on('end',()=>{
if(data!==${JSON.stringify(archive)}) process.exit(2);
if(process.argv.includes('--list')) console.log('1; 1259 100 TABLE public User operator');
else if(process.argv.includes('--schema-only')) console.log('CREATE TABLE public."User" (id text);');
else if(!process.argv.includes('--dbname=')) process.exitCode=4;
else if(process.env.OASIS_TEST_REQUIRED_ROLE && !process.argv.includes('--role=oasis_owner')) process.exitCode=5;
else if(process.env.OASIS_TEST_RESTORE_FAILURE) { console.error('sensitive row value'); process.exitCode=1; }
});
`,
  );
  await Promise.all(['pg_dump', 'pg_restore'].map((name) => chmod(join(directory, name), 0o700)));
});
afterEach(async () => {
  process.env.PATH = previousPath;
  delete process.env.OASIS_TEST_DUMP_FAILURE;
  delete process.env.OASIS_TEST_RESTORE_FAILURE;
  delete process.env.OASIS_TEST_REQUIRED_ROLE;
  delete process.env.OASIS_TEST_LARGE_DUMP;
  delete process.env.OASIS_TEST_RESTORE_EARLY;
  await rm(directory, { recursive: true, force: true });
});

async function backup() {
  const artifactPath = join(directory, 'protected', 'backup.enc');
  return createEncryptedBackup({ sourceUrl, artifactPath, backupKey });
}

describe('protected PostgreSQL archives', () => {
  it('removes inherited libpq routing overrides and rejects plaintext transport', () => {
    process.env.PGHOSTADDR = '192.0.2.1';
    try {
      const environment = postgresEnvironment(sourceUrl);
      expect(environment.PGHOSTADDR).toBeUndefined();
      expect(environment.PGSERVICE).toBeUndefined();
      expect(environment.PGSERVICEFILE).toBeUndefined();
      expect(environment.PGOPTIONS).toBeUndefined();
      expect(() =>
        postgresEnvironment(sourceUrl.replace('sslmode=require', 'sslmode=disable')),
      ).toThrow('TLS');
    } finally {
      delete process.env.PGHOSTADDR;
    }
  });
  it('does not expose malformed URL credentials through parse errors', () => {
    expect(() => postgresEnvironment('postgresql://operator:private-password@[invalid')).toThrow(
      'Invalid PostgreSQL URL',
    );
    try {
      postgresEnvironment('postgresql://operator:private-password@[invalid');
    } catch (error) {
      expect(String(error)).not.toContain('private-password');
    }
  });
  it('encrypts stream, hashes ciphertext, and restricts permissions', async () => {
    const receipt = await backup();
    expect(await verifyEncryptedBackup({ artifactPath: receipt.artifactPath, backupKey })).toEqual(
      receipt,
    );
    expect((await readFile(receipt.artifactPath)).includes(Buffer.from(archive))).toBe(false);
    expect((await stat(receipt.artifactPath)).mode & 0o777).toBe(0o600);
    expect((await stat(join(directory, 'protected'))).mode & 0o777).toBe(0o700);
    expect(receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects wrong keys and corrupted authenticated archives', async () => {
    const { artifactPath } = await backup();
    await expect(
      verifyEncryptedBackup({ artifactPath, backupKey: randomBytes(32) }),
    ).rejects.toThrow();
    const bytes = await readFile(artifactPath);
    bytes[bytes.length - 18] = (bytes[bytes.length - 18] ?? 0) ^ 1;
    await writeFile(artifactPath, bytes);
    await expect(verifyEncryptedBackup({ artifactPath, backupKey })).rejects.toThrow();
    const listPath = join(directory, 'reviewed.list');
    await writeFile(listPath, '1; 1259 100 TABLE public User operator\n');
    await expect(
      restoreEncryptedBackup({
        targetUrl: sourceUrl,
        artifactPath,
        backupKey,
        phase: 'data',
        listPath,
      }),
    ).rejects.toThrow();
    await expect(stat(join(directory, 'restore-started'))).rejects.toThrow();
  });
  it('does not publish a failed or partial dump', async () => {
    process.env.OASIS_TEST_DUMP_FAILURE = '1';
    await expect(backup()).rejects.toThrow('pg_dump failed');
    await expect(stat(join(directory, 'protected', 'backup.enc'))).rejects.toThrow();
  });
  it('accepts successful metadata readers that close input before the archive ends', async () => {
    process.env.OASIS_TEST_LARGE_DUMP = '1';
    const { artifactPath } = await backup();
    process.env.OASIS_TEST_RESTORE_EARLY = '1';
    expect(await readArchiveList({ artifactPath, backupKey })).toContain('TABLE public User');
  }, 15_000);
  it('reads TOC and schema without writing plaintext archives', async () => {
    const { artifactPath } = await backup();
    expect(await readArchiveList({ artifactPath, backupKey })).toContain('TABLE public User');
    expect(await readArchiveSchema({ artifactPath, backupKey })).toContain('CREATE TABLE');
  });
  it('passes a validated restore owner role without SQL interpolation', async () => {
    process.env.OASIS_TEST_REQUIRED_ROLE = '1';
    const { artifactPath } = await backup();
    const listPath = join(directory, 'reviewed.list');
    await writeFile(listPath, '1; 1259 100 TABLE public User operator\n');
    await restoreEncryptedBackup({
      targetUrl: sourceUrl,
      artifactPath,
      backupKey,
      phase: 'pre-data',
      listPath,
      role: 'oasis_owner',
    });
    await expect(
      restoreEncryptedBackup({
        targetUrl: sourceUrl,
        artifactPath,
        backupKey,
        phase: 'pre-data',
        listPath,
        role: 'postgres; DROP SCHEMA public',
      }),
    ).rejects.toThrow('role');
  });
  it('rejects a changed encrypted backup receipt before starting restore', async () => {
    const receipt = await backup();
    const payload = {
      version: 1 as const,
      projectReference: 'project',
      source: { database: 'source', serverVersion: '170006' },
      target: { database: 'postgres', serverVersion: '170006' },
      sourceGitCommit: 'a'.repeat(40),
      tables: [],
      sequences: [],
      objects: [],
      extensions: [],
      migrations: [],
    };
    const manifest = {
      ...payload,
      artifactHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    };
    await expect(
      restoreReviewedApplication({
        manifest,
        receipt: { ...receipt, sha256: '0'.repeat(64) },
        backupKey,
        targetUrl: sourceUrl,
        phase: 'data',
        approvedArchiveEntries: [],
      }),
    ).rejects.toThrow('receipt mismatch');
    await expect(stat(join(directory, 'restore-started'))).rejects.toThrow();
  });
  it('requires reviewed list and protects restore error details', async () => {
    const { artifactPath } = await backup();
    await expect(
      restoreEncryptedBackup({ targetUrl: sourceUrl, artifactPath, backupKey, phase: 'data' }),
    ).rejects.toThrow('reviewed');
    const listPath = join(directory, 'reviewed.list');
    await writeFile(listPath, '1; 1259 100 TABLE public User operator\n');
    await restoreEncryptedBackup({
      targetUrl: sourceUrl,
      artifactPath,
      backupKey,
      phase: 'data',
      listPath,
    });
    process.env.OASIS_TEST_RESTORE_FAILURE = '1';
    await expect(
      restoreEncryptedBackup({
        targetUrl: sourceUrl,
        artifactPath,
        backupKey,
        phase: 'data',
        listPath,
      }),
    ).rejects.toThrow('pg_restore failed');
    await expect(
      restoreEncryptedBackup({
        targetUrl: sourceUrl,
        artifactPath,
        backupKey,
        phase: 'data',
        listPath,
      }),
    ).rejects.not.toThrow('sensitive row');
  });
  it.each([
    '1; 0 0 ACL public TABLE User operator',
    '1; 0 0 SCHEMA - public operator',
    '1; 0 0 TABLE auth users operator',
    '1; 0 0 TABLE auth public operator',
    '1; 0 0 TRIGGER public maintenance_guard operator',
  ])('rejects unsafe restore entry %s', (entry) => {
    expect(() => {
      assertSafeRestoreList(entry);
    }).toThrow();
  });
});
