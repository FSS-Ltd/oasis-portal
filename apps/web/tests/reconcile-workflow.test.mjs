import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = path.join(
  workspaceRoot,
  '.github/workflows/reconcile-accepted-parent-invitations.yml',
);

test('accepted parent invitation reconciliation is manually invoked and main-branch-only', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /apply:\s*[\s\S]*type: boolean/);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/);
  assert.match(workflow, /VERCEL_CLI_VERSION: '53\.0\.1'/);
  assert.match(workflow, /vercel pull --yes --environment=production/);
  assert.match(workflow, /pnpm --filter @oasis\/api exec node/);
  assert.match(workflow, /reconcile-accepted-parent-invitations\.ts/);
  assert.match(workflow, /--apply/);
});
