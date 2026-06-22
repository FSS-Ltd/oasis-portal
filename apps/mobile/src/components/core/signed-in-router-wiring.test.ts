import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('signed-in mobile routing', () => {
  it('keeps health query failures inside the signed-in session instead of signing out', () => {
    const router = readMobile('src/components/core/signed-in-router.tsx');

    expect(router).toMatch(/api\.health\.me\.useQuery\(undefined, \{ retry: false \}\)/);
    expect(router).not.toMatch(/useClerk/);
    expect(router).not.toMatch(/signOut/);
    expect(router).toContain('Could not load session. Please try again.');
  });
});
