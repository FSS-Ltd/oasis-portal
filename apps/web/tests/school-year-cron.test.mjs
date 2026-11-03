import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadRoute(reconcile) {
  const db = {};
  const events = [];
  const exports = {};
  const path = new URL('../src/app/api/cron/school-year-progression/route.ts', import.meta.url);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    Response,
    process: { env: { CRON_SECRET: 'test-secret' } },
    require: (name) => {
      if (name === '@oasis/api')
        return {
          reconcileStudentSchoolYears: reconcile,
          logOperationalEvent: (event) => events.push(event),
        };
      if (name === '@oasis/db') return { prisma: db };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { get: exports.GET, db, events };
}

test('school-year cron authenticates before touching any student data', async () => {
  const route = loadRoute(() => {
    throw new Error('Must not run');
  });
  for (const authorization of ['', 'Bearer wrong']) {
    const response = await route.get(
      new Request('https://example.test/api/cron/school-year-progression', {
        headers: { authorization },
      }),
    );
    assert.equal(response.status, 401);
  }
});

test('school-year cron uses its own current-time reconciliation and returns counts', async () => {
  const calls = [];
  const route = loadRoute((...args) => {
    calls.push(args);
    return Promise.resolve({ updatedCount: 2 });
  });
  const response = await route.get(
    new Request('https://example.test/api/cron/school-year-progression?asOf=2035-09-01', {
      headers: { authorization: 'Bearer test-secret' },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, updatedCount: 2 });
  assert.equal(calls[0].length, 1);
  assert.equal(calls[0][0], route.db);
});

test('school-year cron reports failure without exposing encrypted student data', async () => {
  const route = loadRoute(() => Promise.reject(new Error('sensitive detail')));
  const response = await route.get(
    new Request('https://example.test/api/cron/school-year-progression', {
      headers: { authorization: 'Bearer test-secret' },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('sensitive detail'), false);
  assert.equal(route.events.length, 1);
});
