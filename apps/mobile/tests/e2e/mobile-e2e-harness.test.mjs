import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');
const repoRoot = path.resolve(mobileRoot, '../..');

function readMobile(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function runHarness(env = {}) {
  return spawnSync(process.execPath, ['scripts/run-maestro-e2e.mjs'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    env: {
      PATH: '',
      ...env,
    },
  });
}

test('mobile e2e harness exposes the package command and runner', () => {
  const pkg = JSON.parse(readMobile('package.json'));

  assert.equal(
    pkg.scripts['test:e2e'],
    'node ../../scripts/with-env.mjs node scripts/run-maestro-e2e.mjs',
  );
  assert.ok(existsSync(path.join(mobileRoot, 'scripts/run-maestro-e2e.mjs')));

  const runner = readMobile('scripts/run-maestro-e2e.mjs');
  assert.match(runner, /maestro test/);
  assert.match(runner, /E2E_PARENT_EMAIL/);
  assert.match(runner, /E2E_STUDENT_EMAIL/);
  assert.match(runner, /E2E_SUPERVISOR_EMAIL/);
  assert.match(runner, /uk\.oasis\.portal/);
  assert.match(runner, /Skipping .* credentials/);
  assert.match(runner, /Maestro CLI was not found/);
});

test('mobile e2e runner skips safely when runtime env or Maestro are unavailable', () => {
  const missingRuntime = runHarness();
  assert.equal(missingRuntime.status, 0);
  assert.match(missingRuntime.stdout, /Skipping mobile e2e because runtime env is missing/);
  assert.match(missingRuntime.stdout, /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(missingRuntime.stdout, /EXPO_PUBLIC_TRPC_URL/);

  const missingMaestro = runHarness({
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    EXPO_PUBLIC_TRPC_URL: 'http://127.0.0.1:3000/api/trpc',
  });
  assert.equal(missingMaestro.status, 0);
  assert.match(missingMaestro.stdout, /Maestro CLI was not found/);
});

test('mobile e2e runner invokes only flows with complete credentials', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'oasis-maestro-'));
  const capturePath = path.join(tempDir, 'maestro-args.txt');
  const maestroPath = path.join(tempDir, 'maestro');
  writeFileSync(
    maestroPath,
    ['#!/bin/sh', 'printf "%s\\n" "$*" >> "$MAESTRO_CAPTURE"', 'exit 0', ''].join('\n'),
  );
  chmodSync(maestroPath, 0o755);
  mkdirSync(path.dirname(capturePath), { recursive: true });

  try {
    const result = runHarness({
      E2E_PARENT_EMAIL: 'parent@example.test',
      E2E_PARENT_PASSWORD: 'example-password',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      EXPO_PUBLIC_TRPC_URL: 'http://127.0.0.1:3000/api/trpc',
      MAESTRO_CAPTURE: capturePath,
      PATH: tempDir,
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Running parent mobile e2e/);
    assert.match(result.stdout, /Skipping student mobile e2e because credentials are missing/);
    assert.match(result.stdout, /Skipping staff mobile e2e because credentials are missing/);

    const captured = readFileSync(capturePath, 'utf8');
    assert.match(captured, /--version/);
    assert.match(captured, /test \.maestro\/mobile-parent-smoke\.yaml/);
    assert.doesNotMatch(captured, /mobile-student-smoke/);
    assert.doesNotMatch(captured, /mobile-staff-smoke/);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test('mobile e2e harness defines parent, student, and staff smoke flows', () => {
  const flows = [
    ['parent', 'E2E_PARENT_EMAIL', 'E2E_PARENT_PASSWORD', 'Parent Portal', 'Home'],
    ['student', 'E2E_STUDENT_EMAIL', 'E2E_STUDENT_PASSWORD', 'Student Portal', 'Wallet'],
    ['staff', 'E2E_SUPERVISOR_EMAIL', 'E2E_SUPERVISOR_PASSWORD', 'Staff Portal', 'Home'],
  ];

  for (const [name, emailEnv, passwordEnv, portalText, tabText] of flows) {
    const flowPath = `.maestro/mobile-${name}-smoke.yaml`;
    assert.ok(existsSync(path.join(mobileRoot, flowPath)), `${flowPath} should exist`);

    const flow = readMobile(flowPath);
    assert.match(flow, /appId: uk\.oasis\.portal/);
    assert.match(flow, new RegExp(`\\$\\{${emailEnv}\\}`));
    assert.match(flow, new RegExp(`\\$\\{${passwordEnv}\\}`));
    assert.match(flow, /tapOn: Sign in/);
    assert.match(flow, new RegExp(`assertVisible: ${portalText}`));
    assert.match(flow, new RegExp(`assertVisible: ${tabText}`));
  }
});

test('mobile e2e documentation explains setup, credentials, and safe skipping', () => {
  const docs = readRepo('docs/mobile-e2e.md');

  for (const text of [
    'pnpm --filter @oasis/mobile test:e2e',
    'Maestro',
    'E2E_PARENT_EMAIL',
    'E2E_STUDENT_EMAIL',
    'E2E_SUPERVISOR_EMAIL',
    'E2E_PARENT_PASSWORD',
    'E2E_STUDENT_PASSWORD',
    'E2E_SUPERVISOR_PASSWORD',
    'uk.oasis.portal',
    'skip',
  ]) {
    assert.match(docs, new RegExp(text));
  }

  assert.doesNotMatch(docs, /password\s*=\s*['"][^'"]+['"]/i);
});
