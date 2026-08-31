import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(webRoot, '..', '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function readRepository(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

const adminNavSource = readWeb('src/components/admin/admin-nav.tsx');
const supervisorNavSource = readWeb('src/components/supervisor/supervisor-nav.tsx');

test('staff can open their personal tasks from Daily Ops in both staff portals', () => {
  assert.match(
    adminNavSource,
    /label: 'Daily Ops'[\s\S]*href: '\/admin\/tasks'[\s\S]*label: 'My tasks'/,
  );
  assert.match(
    supervisorNavSource,
    /label: 'Daily Ops'[\s\S]*href: '\/supervisor\/tasks'[\s\S]*label: 'My tasks'/,
  );
  assert.equal(existsSync(path.join(webRoot, 'src/app/(admin)/admin/tasks/page.tsx')), true);
  assert.equal(
    existsSync(path.join(webRoot, 'src/app/(supervisor)/supervisor/tasks/page.tsx')),
    true,
  );
});

test('the task page exposes the required personal task workflow', () => {
  const taskPage = readWeb('src/components/personal-tasks/personal-tasks-client.tsx');

  assert.match(taskPage, /Add task/);
  assert.match(taskPage, /Deadline/);
  assert.match(taskPage, /Reminder/);
  assert.match(taskPage, /Added /);
  assert.match(taskPage, /aria-label=\{`Mark \$\{task\.title\} as /);
  assert.match(taskPage, /aria-invalid=\{formError \? true : undefined\}/);
  assert.match(taskPage, /aria-required="true"/);
  assert.match(taskPage, /required/);
  assert.match(taskPage, /id="personal-task-title-error"/);
});

test('personal tasks are persisted with owner-only row access', () => {
  const schema = readRepository('packages/db/prisma/schema.prisma');
  const rls = readRepository('packages/db/prisma/rls.sql');

  assert.match(schema, /personalTasks\s+PersonalTask\[\]/);
  assert.match(schema, /model PersonalTask[\s\S]*ownerId\s+String[\s\S]*owner\s+User/);
  assert.match(rls, /CREATE POLICY personal_task_owner_only ON "PersonalTask"/);
  assert.match(rls, /"ownerId" = current_setting\('app\.user_id', true\)/);
});
