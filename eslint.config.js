import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'backend/node_modules',
    '.claude/worktrees/**',
    '.worktrees/**',
  ]),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Pure helper modules under src/lib/ are not Fast-Refresh React components.
    files: ['src/lib/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // All frontend API calls must go through src/lib/api.js so cookies,
    // X-Active-Business, and { error: { message } } handling stay consistent.
    files: ['src/**/*.{js,jsx}'],
    ignores: [
      'src/lib/api.js',
      'src/auth/AuthProvider.jsx',
      'src/lib/parcelRouteDirections.js',
      'src/**/*.test.js',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Use apiGet/apiSend from src/lib/api.js instead of raw fetch().',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'fetch',
          message: 'Use apiGet/apiSend from src/lib/api.js instead of window.fetch().',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'Use apiGet/apiSend from src/lib/api.js instead of globalThis.fetch().',
        },
      ],
    },
  },
  {
    // Keep generic UI primitives decoupled from domain features and API calls.
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/lib/api', '**/lib/api.js'],
              message:
                'src/components/ui must stay generic. Pass data/callbacks via props and keep domain logic in src/features/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/src/**/*.js', 'api/**/*.js', 'tests/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Routes and services must share the singleton pool in backend/src/db.js.
    files: ['backend/src/routes/**/*.js', 'backend/src/services/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              message:
                'Import query() or getPool() from ../db.js instead of importing pg directly.',
            },
          ],
        },
      ],
    },
  },
])
