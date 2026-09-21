import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

// TypeScript is held at 6.x on purpose: typescript-eslint hard-blocks
// TypeScript 7 at runtime, and the no-restricted-imports rules below (the
// mechanical proof for two of CLAUDE.md's "known traps") only fire if
// .ts/.tsx files are actually linted. Revisit once
// https://github.com/typescript-eslint/typescript-eslint/issues/10940 ships
// TS7 support.
export default tseslint.config(
  { ignores: ['dist/**', 'server/dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['*.config.js', 'vitest.setup.mjs', 'scripts/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // shared/ is bundled into the client, so a Node/server import here is a
    // live risk that would only surface at runtime in the browser.
    files: ['shared/**/*.ts', 'src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['better-sqlite3', 'fs', 'path'],
          patterns: ['node:*', '**/server/*'],
        },
      ],
    },
  },
  {
    // Static imports here are hoisted above dotenv.config(), so anything
    // that reads process.env at module-load time (db.ts's DATA_DIR) would
    // see it before $CONFIG_DIR/.env was loaded. Keep these dynamic.
    files: ['server/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: './db.js',
              message: 'Import dynamically (await import) so it evaluates after dotenv.config().',
            },
            {
              name: './migrate.js',
              message: 'Import dynamically (await import) so it evaluates after dotenv.config().',
            },
            {
              name: './app.js',
              message: 'Import dynamically (await import) so it evaluates after dotenv.config().',
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);
