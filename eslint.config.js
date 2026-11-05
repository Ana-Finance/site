import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '_site/**', 'node_modules/**', 'assets/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['admin-app/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  { files: ['cms/**/*.js'], languageOptions: { globals: { ...globals.browser } } },
  { files: ['scripts/**/*.mjs', 'tests/**/*.{mjs,ts}', '*.js', '*.mjs'], languageOptions: { globals: { ...globals.node, ...(/* code évalué dans le navigateur par Playwright */ {}) } }, rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  { files: ['tests/e2e/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ['supabase/functions/**/*.ts'], languageOptions: { globals: { Deno: 'readonly' } } },
);
