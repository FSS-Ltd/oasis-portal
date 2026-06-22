import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = process.cwd();
const serviceWorkerGeneratorPath = path.join(projectRoot, 'scripts', 'generate-service-worker.mjs');

test('service-worker generation includes browser notification event handlers', () => {
  const generator = fs.readFileSync(serviceWorkerGeneratorPath, 'utf8');

  assert.match(generator, /addEventListener\(['"]push['"]/);
  assert.match(generator, /showNotification/);
  assert.match(generator, /addEventListener\(['"]notificationclick['"]/);
  assert.match(generator, /clients\.openWindow/);
});
