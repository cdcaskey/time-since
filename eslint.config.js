import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

// typescript-eslint hard-blocks TypeScript 7 at runtime (not just an
// unbumped peer range — it throws), and this template pins
// typescript@^7. So .ts/.tsx files aren't linted here at all yet;
// `npm run typecheck` (tsc --noEmit) is what catches type and
// syntax errors in them in the meantime. Revisit once
// https://github.com/typescript-eslint/typescript-eslint/issues/10940
// ships TS7 support, and reintroduce typescript-eslint +
// eslint-plugin-react-hooks/react-refresh for src/ and server/.
export default [
  { ignores: ['dist/**', 'server/dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['*.config.js', 'vitest.setup.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettierConfig,
];
