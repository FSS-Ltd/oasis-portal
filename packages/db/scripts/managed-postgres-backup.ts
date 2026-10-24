import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, link, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('OASISPG01');
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + NONCE_BYTES;

export interface BackupReceipt {
  artifactPath: string;
  sha256: string;
  sizeBytes: number;
}
interface ArchiveOptions {
  artifactPath: string;
  backupKey: Buffer;
}

/** Credentials are passed only through libpq environment variables, never argv. */
export function postgresEnvironment(connectionUrl: string): NodeJS.ProcessEnv {
  let url: URL;
  try {
    url = new URL(connectionUrl);
  } catch {
    throw new Error('Invalid PostgreSQL URL');
  }
  if (!url.hostname || !url.username || url.pathname.length < 2) {
    throw new Error('Invalid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Invalid PostgreSQL URL');
  const sslmode = url.searchParams.get('sslmode') ?? 'require';
  if (!['require', 'verify-ca', 'verify-full'].includes(sslmode))
    throw new Error('PostgreSQL TLS is required');
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('PG'))),
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: sslmode,
    PGCONNECT_TIMEOUT: '30',
  };
}

function checkKey(key: Buffer): void {
  if (key.length !== 32) throw new Error('Backup key must contain exactly 32 bytes');
}

async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (((await stat(path)).mode & 0o077) !== 0)
    throw new Error('Backup directory must have mode 0700');
}

/** All PostgreSQL stderr stays in a private operator artifact; it may contain row data. */
async function runPostgres(options: {
  tool: 'pg_dump' | 'pg_restore';
  args: string[];
  environment?: NodeJS.ProcessEnv;
  input?: Readable;
  output: Writable;
  errorDirectory: string;
}): Promise<void> {
  const errorPath = `${options.errorDirectory}/postgres-${randomBytes(12).toString('hex')}.stderr`;
  const child = spawn(options.tool, options.args, {
    env: options.environment ?? process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', () => {
      reject(new Error('PostgreSQL process could not start'));
    });
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('PostgreSQL process exited unsuccessfully'));
    });
  });
  const operations = [
    completion,
    pipeline(child.stderr, createWriteStream(errorPath, { flags: 'wx', mode: 0o600 })),
    pipeline(child.stdout, options.output),
  ];
  if (options.input) {
    operations.push(
      pipeline(options.input, child.stdin).catch((error: unknown) => {
        // pg_restore may finish selected sections or a TOC without reading trailing data.
        // Its successful exit is still required, and callers authenticate the full archive first.
        if (
          error instanceof Error &&
          'code' in error &&
          (error.code === 'EPIPE' || error.code === 'ERR_STREAM_PREMATURE_CLOSE')
        )
          return;
        throw error;
      }),
    );
  } else child.stdin.end();
  try {
    await Promise.all(operations);
    await unlink(errorPath);
  } catch {
    child.kill('SIGTERM');
    options.input?.destroy();
    options.output.destroy();
    await Promise.allSettled(operations);
    throw new Error(`${options.tool} failed; inspect private operator artifact ${errorPath}`);
  }
}

async function decryptedStream({ artifactPath, backupKey }: ArchiveOptions): Promise<Readable> {
  checkKey(backupKey);
  const file = await open(artifactPath, 'r');
  try {
    const size = (await file.stat()).size;
    if (size <= HEADER_BYTES + TAG_BYTES) throw new Error('Encrypted archive is truncated');
    const header = Buffer.alloc(HEADER_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    await file.read(header, 0, header.length, 0);
    await file.read(tag, 0, tag.length, size - TAG_BYTES);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error('Unsupported encrypted archive format');
    const decipher = createDecipheriv('aes-256-gcm', backupKey, header.subarray(MAGIC.length));
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const source = createReadStream(artifactPath, {
      start: HEADER_BYTES,
      end: size - TAG_BYTES - 1,
    });
    // pipeline owns both streams and propagates read/authentication failures to consumers.
    const result = Readable.from(
      (async function* () {
        const finished = pipeline(source, decipher);
        // Attach rejection handling immediately, including before iteration starts.
        void finished.catch(() => undefined);
        try {
          for await (const chunk of decipher) yield chunk;
          await finished;
        } finally {
          source.destroy();
          decipher.destroy();
          await finished;
        }
      })(),
    );
    return result;
  } finally {
    await file.close();
  }
}

export async function verifyEncryptedBackup(options: ArchiveOptions): Promise<BackupReceipt> {
  await pipeline(
    await decryptedStream(options),
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
  );
  const hash = createHash('sha256');
  let sizeBytes = 0;
  await pipeline(
    createReadStream(options.artifactPath),
    new Writable({
      write(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        sizeBytes += chunk.length;
        callback();
      },
    }),
  );
  return { artifactPath: options.artifactPath, sha256: hash.digest('hex'), sizeBytes };
}

export async function createEncryptedBackup(
  options: ArchiveOptions & {
    sourceUrl: string;
    snapshot?: string;
  },
): Promise<BackupReceipt> {
  checkKey(options.backupKey);
  const directory = dirname(options.artifactPath);
  await privateDirectory(directory);
  const temporaryPath = `${options.artifactPath}.${randomBytes(12).toString('hex')}.partial`;
  const header = Buffer.concat([MAGIC, randomBytes(NONCE_BYTES)]);
  const cipher = createCipheriv('aes-256-gcm', options.backupKey, header.subarray(MAGIC.length));
  cipher.setAAD(header);
  const output = createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
  output.write(header);
  const encryption = pipeline(cipher, output);
  void encryption.catch(() => undefined);
  try {
    const args = [
      '--format=custom',
      '--schema=public',
      '--schema=oasis_private',
      '--no-owner',
      '--no-privileges',
      '--no-password',
    ];
    if (options.snapshot) args.push(`--snapshot=${options.snapshot}`);
    await runPostgres({
      tool: 'pg_dump',
      args,
      environment: postgresEnvironment(options.sourceUrl),
      output: cipher,
      errorDirectory: directory,
    });
    await encryption;
    await appendFile(temporaryPath, cipher.getAuthTag());
    const verified = await verifyEncryptedBackup({
      artifactPath: temporaryPath,
      backupKey: options.backupKey,
    });
    const file = await open(temporaryPath, 'r');
    try {
      await file.sync();
    } finally {
      await file.close();
    }
    // Publishing a hard link is atomic and cannot overwrite an existing backup.
    await link(temporaryPath, options.artifactPath);
    await unlink(temporaryPath);
    const parent = await open(directory, 'r');
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
    return { ...verified, artifactPath: options.artifactPath };
  } catch (error) {
    cipher.destroy();
    output.destroy();
    await Promise.allSettled([encryption, unlink(temporaryPath)]);
    throw error;
  }
}

/** Defense in depth. The operator must additionally approve every entry against the manifest. */
export function assertSafeRestoreList(contents: string): void {
  let entries = 0;
  for (const line of contents.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith(';')) continue;
    if (
      !/^\d+; \d+ \d+ (?:TABLE DATA|SEQUENCE SET|SEQUENCE OWNED BY|MATERIALIZED VIEW DATA|FK CONSTRAINT|CHECK CONSTRAINT|DOMAIN CONSTRAINT|ROW SECURITY|TABLE ATTACH|INDEX ATTACH|MATERIALIZED VIEW|TABLE|SEQUENCE|TYPE|DOMAIN|FUNCTION|PROCEDURE|AGGREGATE|VIEW|DEFAULT|INDEX|TRIGGER|RULE|POLICY|COMMENT|STATISTICS|CONSTRAINT) (?:public|oasis_private) /.test(
        line,
      ) ||
      /\b(?:ACL|DEFAULT ACL|SCHEMA|DATABASE|EXTENSION|PUBLICATION|SUBSCRIPTION|BLOB|LARGE OBJECT)\b/.test(
        line,
      ) ||
      /\boasis_migration_/i.test(line) ||
      /maintenance_guard/i.test(line)
    ) {
      throw new Error('Restore list contains an unsafe or unreviewed entry');
    }
    entries++;
  }
  if (entries === 0) throw new Error('Restore list has no approved entries');
}

async function archiveText(options: ArchiveOptions, args: string[]): Promise<string> {
  await verifyEncryptedBackup(options);
  const chunks: Buffer[] = [];
  await runPostgres({
    tool: 'pg_restore',
    args,
    input: await decryptedStream(options),
    output: new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
    errorDirectory: dirname(options.artifactPath),
  });
  return Buffer.concat(chunks).toString('utf8');
}

export async function readArchiveList(options: ArchiveOptions): Promise<string> {
  return archiveText(options, ['--list']);
}

export async function readArchiveSchema(options: ArchiveOptions): Promise<string> {
  return archiveText(options, ['--schema-only', '--no-owner', '--no-privileges', '--file=-']);
}

export async function restoreEncryptedBackup(
  options: ArchiveOptions & {
    targetUrl: string;
    phase: 'pre-data' | 'data' | 'post-data';
    listPath?: string;
    role?: string;
  },
): Promise<void> {
  if (options.role !== undefined && !/^[a-z_][a-z0-9_]{0,62}$/.test(options.role)) {
    throw new Error('Invalid restore role');
  }
  if (!options.listPath) throw new Error('Restore requires a reviewed archive list');
  assertSafeRestoreList(await readFile(options.listPath, 'utf8'));
  await verifyEncryptedBackup(options);
  await runPostgres({
    tool: 'pg_restore',
    args: [
      '--dbname=',
      '--no-owner',
      '--no-privileges',
      '--no-password',
      '--exit-on-error',
      '--single-transaction',
      `--section=${options.phase}`,
      `--use-list=${options.listPath}`,
      ...(options.role ? [`--role=${options.role}`] : []),
    ],
    environment: postgresEnvironment(options.targetUrl),
    input: await decryptedStream(options),
    output: new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
    errorDirectory: dirname(options.artifactPath),
  });
}
