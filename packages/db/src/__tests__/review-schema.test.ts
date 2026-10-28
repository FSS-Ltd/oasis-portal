import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviewRlsStatements } from '../../scripts/review-schema.js';

describe('reviewRlsStatements', () => {
  it('maps the only public.* reference in rls.sql to the review schema', () => {
    const rls = readFileSync(join(import.meta.dirname, '..', '..', 'prisma', 'rls.sql'), 'utf8');
    const statements = reviewRlsStatements(rls);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements.join('\n')).not.toMatch(/\bpublic\./u);
    expect(statements.join('\n')).toContain('review.oasis_guardian_can_see_permission_slip(');
  });

  it('refuses rls.sql that gains an unmapped public.* reference', () => {
    expect(() => reviewRlsStatements('SELECT public.something();')).toThrow(/public/);
  });
});
