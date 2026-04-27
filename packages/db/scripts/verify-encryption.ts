import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_PLAINTEXT_FIXTURES = [
  'CI Head',
  'CI Student',
  'Context Head',
  'Context Supervisor',
  'Context Student',
  'E2E Student',
  'Jane Learner',
  'Jane Parent',
  '12 Oasis Road',
  '2014-02-03',
  '2015-01-01',
  'head@example.test',
  'ctx-head@example.test',
  'ctx-sup@example.test',
  'jane@example.com',
  'parent.',
] as const;

export interface PlaintextFinding {
  fixture: string;
  index: number;
}

export function findPlaintextFixtures(
  dump: string,
  fixtures: readonly string[] = DEFAULT_PLAINTEXT_FIXTURES,
): PlaintextFinding[] {
  const findings: PlaintextFinding[] = [];
  for (const fixture of fixtures) {
    const index = dump.indexOf(fixture);
    if (index >= 0) findings.push({ fixture, index });
  }
  return findings;
}

function dumpDatabase(databaseUrl: string): string {
  return execFileSync(
    'pg_dump',
    ['--data-only', '--no-owner', '--no-privileges', '--dbname', databaseUrl],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 128,
    },
  );
}

function main() {
  const databaseUrl = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL for encryption verification');
  }

  const dump = dumpDatabase(databaseUrl);
  const findings = findPlaintextFixtures(dump);
  if (findings.length > 0) {
    const fixtureList = findings.map((finding) => `"${finding.fixture}"`).join(', ');
    throw new Error(`Plaintext fixture values found in database dump: ${fixtureList}`);
  }

  console.warn(
    `Encryption verification passed: ${String(DEFAULT_PLAINTEXT_FIXTURES.length)} plaintext fixture values absent from pg_dump data.`,
  );
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error);
    process.exit(1);
  }
}
