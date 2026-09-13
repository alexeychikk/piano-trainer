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
    // Layering, part 1 (ADR §9): non-UI modules never import Svelte
    // *components*. Components are PascalCase `.svelte` files; the runes state
    // modules (`foo.svelte.ts`, imported as `./foo.svelte`) are plain TS and
    // are exactly what shared reactive state is supposed to live in.
    files: ['apps/web/src/lib/**/*.ts'],
    ignores: ['apps/web/src/lib/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)[A-Z][A-Za-z0-9]*\\.svelte$',
              caseSensitive: true,
              message:
                'Non-UI modules must not import Svelte components (ADR 0001 §9).',
            },
          ],
        },
      ],
    },
  },
  {
    // Layering, part 2 (ADR §4): `theory` is pure TypeScript that imports
    // nothing local — no DOM, no Svelte, no app modules.
    files: ['apps/web/src/lib/theory/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['$lib/**', '$app/**', '../**'],
              message:
                '$lib/theory must not import anything local (ADR 0001 §4).',
            },
          ],
        },
      ],
    },
  },
);
