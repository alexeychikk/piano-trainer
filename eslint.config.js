import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './apps/web/svelte.config.js';

/**
 * Flat config for the workspace. `legacy/` (the frozen Electron app) keeps its
 * own eslintrc and is never linted here.
 */
export default ts.config(
  {
    ignores: [
      'legacy/**',
      '**/.svelte-kit/**',
      '**/build/**',
      '**/dist/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: ts.parser, svelteConfig },
    },
  },
  {
    // The layering rule from the ADR (§9): non-UI modules never import Svelte
    // components, and `theory` imports nothing local.
    files: ['apps/web/src/lib/**/*.ts'],
    ignores: ['apps/web/src/lib/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/*.svelte'],
              message:
                'Non-UI modules must not import Svelte components (ADR 0001 §9).',
            },
          ],
        },
      ],
    },
  },
);
