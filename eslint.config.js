import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // ── Ignored paths ──────────────────────────────────────────────────
  { ignores: ['dist/', 'node_modules/', 'scripts/'] },

  // ── Base JS rules ──────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript rules ───────────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ── Project-wide settings ──────────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // React hooks — classic two rules only.
      // The v5 "recommended" preset includes React Compiler rules that
      // are too strict for a non-compiled codebase. We pick only the
      // two classic rules explicitly.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Relax rules that conflict with current codebase patterns.
      // These can be tightened over time.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
    },
  },
);
