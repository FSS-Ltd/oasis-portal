import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('PWA UI wiring', () => {
  it('adds a web-only install panel to the sign-in screen', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/pwa/install-app-button.tsx')),
      true,
    );

    const signInPanel = read('src/components/smoke/sign-in-panel.tsx');
    assert.match(signInPanel, /InstallAppButton/);

    const installButton = read('src/components/pwa/install-app-button.tsx');
    assert.match(installButton, /Platform\.OS !== 'web'/);
    assert.match(installButton, /beforeinstallprompt/);
    assert.match(installButton, /Add to Home Screen/);
  });
});
