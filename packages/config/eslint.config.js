// Shared flat ESLint config for the Oasis monorepo.
// Consumed by apps and packages. Strict TS; no explicit `any` anywhere per AGENTS.md §5.2.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['eslint.config.mjs', 'apps/web/eslint.config.mjs', 'packages/config/eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
