import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeErrorModules = [
  new URL('../src/app/api/notices/route-errors.ts', import.meta.url),
  new URL('../src/app/api/invoices/route-errors.ts', import.meta.url),
];

test('route error helpers log unexpected server failures', async () => {
  const sources = await Promise.all(routeErrorModules.map((moduleUrl) => readFile(moduleUrl, 'utf8')));

  for (const source of sources) {
    assert.match(source, /logOperationalEvent/);
    assert.match(source, /route\.unexpected_failure/);
  }
});
