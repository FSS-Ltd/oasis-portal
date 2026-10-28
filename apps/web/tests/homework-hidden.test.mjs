import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const flags = read('packages/domain/src/portal-visibility.ts');
const middleware = read('apps/web/src/middleware.ts');
const adminNav = read('apps/web/src/components/admin/admin-nav.tsx');
const studentNav = read('apps/web/src/components/student/student-nav.tsx');
const mobileShell = read('apps/mobile/src/components/core/portal-mobile-shell.tsx');
const studentScreen = read('apps/mobile/src/components/student/student-portal-screen.tsx');
const clubCategories = read('apps/web/src/components/behaviour/behaviour-categories.ts');
const clubDetail = read('apps/web/src/components/clubs/linked-child-club-detail-client.tsx');

test('homework is switched off for every role with one flag', () => {
  assert.match(flags, /export const HOMEWORK_VISIBLE: boolean = false;/);
});

test('web redirects homework routes and hides both nav entries', () => {
  assert.match(middleware, /'\/admin\/homework\(\.\*\)'/);
  assert.match(middleware, /'\/student\/homework\(\.\*\)'/);
  assert.match(middleware, /!HOMEWORK_VISIBLE && isHomeworkRoute\(request\)/);
  assert.match(
    adminNav,
    /item\.label === 'Homework'\) return HOMEWORK_VISIBLE && access\.fullAdmin/,
  );
  assert.match(studentNav, /HOMEWORK_VISIBLE \|\| item\.href !== '\/student\/homework'/);
});

test('web also refuses the homework upload and image API routes with a 404', () => {
  assert.match(middleware, /createRouteMatcher\(\['\/api\/homework\(\.\*\)'\]\)/);
  assert.match(
    middleware,
    /!HOMEWORK_VISIBLE && isHomeworkApiRoute\(request\)\) \{\s*return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/,
  );
});

test('mobile drops the Activity tab and stops loading homework when hidden', () => {
  assert.match(mobileShell, /HOMEWORK_VISIBLE \|\| item\.id !== 'activity'/);
  assert.match(
    studentScreen,
    /api\.homework\.studentDue\.useQuery\(undefined, \{\s*enabled: HOMEWORK_VISIBLE/,
  );
  assert.match(
    studentScreen,
    /api\.homework\.studentGraded\.useQuery\(undefined, \{\s*enabled: HOMEWORK_VISIBLE/,
  );
  assert.match(studentScreen, /HOMEWORK_VISIBLE \? studentHomeworkDue\.refetch\(\)/);
});

test('no homework wording is left in club copy or merit categories', () => {
  assert.doesNotMatch(clubCategories, /'Homework'/);
  assert.doesNotMatch(clubDetail, /homework/i);
});
