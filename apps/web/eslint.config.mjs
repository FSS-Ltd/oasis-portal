import { createRequire } from 'node:module';
import config from '../../eslint.config.mjs';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('eslint-config-next/package.json'));
const nextPlugin = nextRequire('@next/eslint-plugin-next');
const nextRules = {
  ...nextPlugin.configs.recommended.rules,
  ...nextPlugin.configs['core-web-vitals'].rules,
};

export default [
  ...config,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: nextRules,
    settings: {
      next: {
        rootDir: ['.'],
      },
    },
  },
];
