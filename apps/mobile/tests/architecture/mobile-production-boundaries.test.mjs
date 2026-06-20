import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function listSourceFiles(relativeDir) {
  const absoluteDir = path.join(mobileRoot, relativeDir);
  const entries = readdirSync(absoluteDir);
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path.relative(mobileRoot, absolutePath);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listSourceFiles(relativePath));
      continue;
    }

    if (/\.[cm]?[tj]sx?$/.test(entry)) {
      files.push(relativePath);
    }
  }

  return files;
}

function readMobile(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('production mobile entrypoints and role surfaces do not import smoke modules', () => {
  const productionRoots = [
    'app',
    'src/components/core',
    'src/components/messages',
    'src/components/parent',
    'src/components/pwa',
    'src/components/staff',
    'src/components/student',
  ];
  const productionFiles = productionRoots.flatMap(listSourceFiles);

  for (const file of productionFiles) {
    const source = readMobile(file);
    assert.doesNotMatch(source, /components\/smoke|\.\.\/smoke|from ['"]\.\/smoke/, file);
  }
});

test('signed-in mobile routing is owned by production core components', () => {
  const entrypoint = readMobile('app/index.tsx');
  assert.match(entrypoint, /src\/components\/core\/signed-in-router/);
  assert.match(readMobile('src/components/core/signed-in-router.tsx'), /export function SignedInRouter/);
});
