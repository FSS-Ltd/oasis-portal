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
  assert.match(workflow, /environment:\s*Prod Maintenance/);
  assert.match(workflow, /DATABASE_URL: \$\{\{ secrets\.PROD_DATABASE_URL \}\}/);
  assert.match(workflow, /CLERK_SECRET_KEY: \$\{\{ secrets\.PROD_CLERK_SECRET_KEY \}\}/);
  assert.match(workflow, /OASIS_MASTER_KEY: \$\{\{ secrets\.PROD_OASIS_MASTER_KEY \}\}/);
  assert.match(workflow, /OASIS_MASTER_KEY_VERSION: \$\{\{ secrets\.PROD_OASIS_MASTER_KEY_VERSION \}\}/);
  assert.match(workflow, /OASIS_BIDX_PEPPER: \$\{\{ secrets\.PROD_OASIS_BIDX_PEPPER \}\}/);
  assert.match(workflow, /pnpm --filter @oasis\/api exec tsx/);
  assert.match(workflow, /reconcile-accepted-parent-invitations\.ts/);
  assert.match(workflow, /--apply/);
  assert.doesNotMatch(workflow, /vercel pull/);
  assert.doesNotMatch(workflow, /VERCEL_TOKEN/);
});
