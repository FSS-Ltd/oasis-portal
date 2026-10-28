import { createRequire } from 'node:module';
import type { ReactElement } from 'react';

export interface MobileTestInstance {
  find(predicate: (node: MobileTestInstance) => boolean): MobileTestInstance;
  props: unknown;
  type: unknown;
}

export interface MobileTestRenderer {
  root: MobileTestInstance;
  toJSON(): unknown;
  unmount(): void;
  update(element: ReactElement): void;
}

interface MobileTestRendererModule {
  act(callback: () => Promise<void>): Promise<void>;
  act(callback: () => void): void;
  create(element: ReactElement): MobileTestRenderer;
}

const require = createRequire(import.meta.url);

// React's test renderer does not ship declarations, and the community declarations mark this
// supported React 18 API as deprecated. Keep the narrow runtime contract local to mobile tests.
const rawRenderer = require('react-test-renderer') as unknown as MobileTestRendererModule;

// React 19's test renderer only commits inside act(). Route create/update/unmount through it so
// tests keep reading `renderer.root` right after mounting, as they did on React 18.
export const mobileTestRenderer: MobileTestRendererModule = {
  act: rawRenderer.act.bind(rawRenderer),
  create(element) {
    let renderer: MobileTestRenderer | undefined;
    rawRenderer.act(() => {
      renderer = rawRenderer.create(element);
    });
    if (!renderer) throw new Error('react-test-renderer did not mount the element.');
    const mounted = renderer;
    return {
      get root() {
        return mounted.root;
      },
      toJSON: () => mounted.toJSON(),
      unmount: () => {
        rawRenderer.act(() => {
          mounted.unmount();
        });
      },
      update: (next) => {
        rawRenderer.act(() => {
          mounted.update(next);
        });
      },
    };
  },
};
