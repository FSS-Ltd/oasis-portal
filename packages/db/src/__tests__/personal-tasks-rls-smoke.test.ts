import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const smokePath = resolve(testDir, '../../scripts/smoke-rls.ts');

describe('personal task RLS smoke coverage', () => {
  it('checks cross-owner read, insert, and update isolation with the runtime role', () => {
    const source = readFileSync(smokePath, 'utf8');

    expect(source).toContain('"PersonalTask"');
    expect(source).toContain('ci-task-author');
    expect(source).toContain('ci-task-other');
    expect(source).toContain('cross-owner personal task insert');
    expect(source).toContain('cross-owner personal task update');
  });
});
