import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** No inherited application credentials or libpq routing settings reach fixture tools. */
export function migrationTestEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(environment).filter(
        ([name]) => !name.startsWith('PG') && !/(?:^|_)(?:DATABASE|DIRECT)_URL$/.test(name),
      ),
    ),
    PGHOST: '127.0.0.1',
    PGPORT: '55441',
    PGUSER: 'postgres',
    PGDATABASE: 'postgres',
    PGPASSFILE: '/dev/null',
    PGCONNECT_TIMEOUT: '5',
    OASIS_MIGRATION_SECURITY_TEST: '1',
  };
}

export function assertMigrationFixture(output: string): void {
  let fixture: unknown;
  try {
    fixture = JSON.parse(output);
  } catch {
    throw new Error('Dedicated migration fixture preflight returned invalid metadata');
  }
  if (
    typeof fixture !== 'object' ||
    fixture === null ||
    !('database' in fixture) ||
    fixture.database !== 'postgres' ||
    !('address' in fixture) ||
    fixture.address !== '127.0.0.1' ||
    !('port' in fixture) ||
    fixture.port !== 55441 ||
    !('serverVersion' in fixture) ||
    typeof fixture.serverVersion !== 'number' ||
    fixture.serverVersion < 170000 ||
    fixture.serverVersion >= 180000 ||
    !('marker' in fixture) ||
    fixture.marker !== true
  ) {
    throw new Error(
      'Dedicated migration fixture requires fixed loopback port 55441, PostgreSQL 17, and NOLOGIN marker',
    );
  }
}

async function fixturePreflight(environment: NodeJS.ProcessEnv): Promise<void> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn('psql', ['-X', '--no-password', '-Atq', '-v', 'ON_ERROR_STOP=1'], {
      env: environment,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    const fail = (): void => {
      reject(new Error('Dedicated migration fixture preflight failed'));
    };
    child.once('error', fail);
    child.stdin.once('error', fail);
    child.stderr.resume();
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.once('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else fail();
    });
    child.stdin.end(`SELECT json_build_object(
      'database', current_database(), 'address', host(inet_server_addr()),
      'port', inet_server_port(), 'serverVersion', current_setting('server_version_num')::int,
      'marker', EXISTS (SELECT FROM pg_roles WHERE rolname='oasis_migration_fixture' AND NOT rolcanlogin)
    );`);
  });
  assertMigrationFixture(output);
}

export async function runManagedMigrationIntegration(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (environment.OASIS_MIGRATION_SECURITY_TEST !== '1') {
    throw new Error(
      'Explicit isolated-fixture write opt-in required: OASIS_MIGRATION_SECURITY_TEST=1',
    );
  }
  const childEnvironment = migrationTestEnvironment(environment);
  await fixturePreflight(childEnvironment);
  const packageDirectory = fileURLToPath(new URL('..', import.meta.url));
  const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        vitest,
        'run',
        '--no-file-parallelism',
        'src/__tests__/managed-postgres-security.integration.test.ts',
        'src/__tests__/managed-postgres-security-ownership.integration.test.ts',
      ],
      {
        cwd: packageDirectory,
        env: childEnvironment,
        stdio: 'inherit',
      },
    );
    child.once('error', () => {
      reject(new Error('Dedicated migration integration runner could not start'));
    });
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Dedicated migration integration suites failed'));
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runManagedMigrationIntegration().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Dedicated migration integration runner failed',
    );
    process.exitCode = 1;
  });
}
