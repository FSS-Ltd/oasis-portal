import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('portal mobile navigation icons', () => {
  it('uses Lucide web icons instead of the old text-symbol fallback', () => {
    const shell = readMobile('src/components/core/portal-mobile-shell.tsx');
    const nativeIconPath = 'src/components/core/portal-mobile-nav-icon.tsx';
    const webIconPath = 'src/components/core/portal-mobile-nav-icon.web.tsx';

    expect(existsSync(path.join(mobileRoot, nativeIconPath))).toBe(true);
    expect(existsSync(path.join(mobileRoot, webIconPath))).toBe(true);
    expect(shell).toMatch(/from '\.\/portal-mobile-nav-icon'/);
    expect(shell).not.toMatch(/webIconSymbol/);
    expect(shell).not.toMatch(/fontFamily: 'Arial, Helvetica, sans-serif'/);

    const nativeIcon = readMobile(nativeIconPath);
    const webIcon = readMobile(webIconPath);

    expect(nativeIcon).toMatch(/@expo\/vector-icons\/Feather/);
    expect(nativeIcon).toMatch(/Feather\.loadFont\(\)/);
    expect(webIcon).toMatch(/import type \{ LucideIcon \} from 'lucide-react'/);
    expect(webIcon).toMatch(/from 'lucide-react\/dist\/esm\/icons\/home\.mjs'/);
    expect(webIcon).toMatch(/LucideIcon/);
    expect(webIcon).toMatch(/strokeWidth=\{2\.25\}/);
  });
});
