#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const appId = 'uk.oasis.portal';

const flows = [
  {
    credentials: ['E2E_PARENT_EMAIL', 'E2E_PARENT_PASSWORD'],
    file: '.maestro/mobile-parent-smoke.yaml',
    name: 'parent',
  },
  {
    credentials: ['E2E_STUDENT_EMAIL', 'E2E_STUDENT_PASSWORD'],
    file: '.maestro/mobile-student-smoke.yaml',
    name: 'student',
  },
  {
    credentials: ['E2E_SUPERVISOR_EMAIL', 'E2E_SUPERVISOR_PASSWORD'],
    file: '.maestro/mobile-staff-smoke.yaml',
    name: 'staff',
  },
];

function missingEnvironment(names) {
  return names.filter((name) => !process.env[name]);
}

function hasMaestroCli() {
  const result = spawnSync('maestro', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

const runtimeMissing = missingEnvironment([
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_TRPC_URL',
]);
if (runtimeMissing.length > 0) {
  console.log(
    `Skipping mobile e2e because runtime env is missing: ${runtimeMissing.join(', ')}`,
  );
  process.exit(0);
}

if (!hasMaestroCli()) {
  console.log(
    'Skipping mobile e2e. Maestro CLI was not found. Install Maestro and boot a simulator or emulator before running this command.',
  );
  process.exit(0);
}

let ranFlow = false;

for (const flow of flows) {
  const credentialMissing = missingEnvironment(flow.credentials);
  if (credentialMissing.length > 0) {
    console.log(
      `Skipping ${flow.name} mobile e2e because credentials are missing: ${credentialMissing.join(
        ', ',
      )}`,
    );
    continue;
  }

  const flowPath = path.join(mobileRoot, flow.file);
  if (!existsSync(flowPath)) {
    console.error(`Missing Maestro flow: ${flow.file}`);
    process.exit(1);
  }

  ranFlow = true;
  console.log(`Running ${flow.name} mobile e2e against ${appId}: maestro test ${flow.file}`);
  const result = spawnSync('maestro', ['test', flow.file], {
    cwd: mobileRoot,
    env: {
      ...process.env,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!ranFlow) {
  console.log('Skipping mobile e2e because no complete credential set is configured.');
}
