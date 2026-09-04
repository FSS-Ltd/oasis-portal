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
export const mobileTestRenderer = require('react-test-renderer') as unknown as MobileTestRendererModule;
