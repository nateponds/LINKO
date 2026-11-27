import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const FRONTEND_RESTRICTED_IMPORT_PATHS = [
  {
    name: 'react-icons',
    message: 'Use lucide-react per DESIGN.md',
  },
]

const FRONTEND_RESTRICTED_IMPORT_PATTERNS = [
  {
    group: ['react-icons/*'],
    message: 'Use lucide-react per DESIGN.md',
  },
  {
    group: ['**/backend/**'],
    message: 'Frontend code in src/ must not import from backend/.',
  },
]

const STATUS_CODE_SYNTAX = {
  selector: 'MemberExpression[property.name="statusCode"]',
  message: 'src/lib/api.js throws error.status, not error.statusCode',
}

const INLINE_ROLE_CHECK_SYNTAX = [
  {
    selector:
      'CallExpression[callee.property.name="includes"][callee.object.name="roles"][arguments.0.value=/^(buyer|wholesaler|platform_admin|courier|logistics_coordinator)$/]',
    message:
      'Avoid inline role string checks; centralize role access logic in roleAccess helpers.',
  },
  {
    selector:
      'CallExpression[callee.property.name="includes"][callee.object.property.name="roles"][arguments.0.value=/^(buyer|wholesaler|platform_admin|courier|logistics_coordinator)$/]',
    message:
      'Avoid inline role string checks; centralize role access logic in roleAccess helpers.',
  },
]

const STATIC_HEX_STYLE_SYNTAX = {
  selector:
    'JSXAttribute[name.name="style"] ObjectExpression Property[value.type="Literal"][value.value=/#[0-9a-fA-F]{3,8}\\b/]',
  message:
    'Avoid static hex color literals in inline JSX style={{}}; use design tokens / CSS classes instead.',
}

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
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          paths: FRONTEND_RESTRICTED_IMPORT_PATHS,
          patterns: FRONTEND_RESTRICTED_IMPORT_PATTERNS,
        },
      ],
      'no-restricted-syntax': ['error', STATUS_CODE_SYNTAX],
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
    // Warn on inline role string checks outside src/auth/roleAccess.js.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/auth/roleAccess.js'],
    rules: {
      'no-restricted-syntax': ['warn', STATUS_CODE_SYNTAX, ...INLINE_ROLE_CHECK_SYNTAX],
    },
  },
  {
    // Warn on static inline style={{}} hex color literals in JSX (excluding Skeleton.jsx).
    files: ['src/**/*.jsx'],
    ignores: ['src/components/ui/Skeleton.jsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        STATUS_CODE_SYNTAX,
        ...INLINE_ROLE_CHECK_SYNTAX,
        STATIC_HEX_STYLE_SYNTAX,
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
          paths: FRONTEND_RESTRICTED_IMPORT_PATHS,
          patterns: [
            ...FRONTEND_RESTRICTED_IMPORT_PATTERNS,
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
    // Warn on deep sibling feature imports across src/features/*/**.
    files: ['src/features/*/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: FRONTEND_RESTRICTED_IMPORT_PATHS,
          patterns: [
            ...FRONTEND_RESTRICTED_IMPORT_PATTERNS,
            {
              regex: '^\\.\\./(?!\\.\\.)[^/]+/.+',
              message:
                'Avoid deep sibling feature imports (../<other-feature>/*). Extract shared modules to src/components/ or src/lib/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'backend/src/**/*.js',
      'backend/scripts/**/*.js',
      'backend/seeds/**/*.js',
      'api/**/*.js',
      'tests/**/*.js',
      'vite.config.js',
      'eslint.config.js',
    ],
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
  {
    // Warn on inline role string checks in backend routes.
    files: ['backend/src/routes/**/*.js'],
    rules: {
      'no-restricted-syntax': ['warn', ...INLINE_ROLE_CHECK_SYNTAX],
    },
  },
  {
    // Seed scripts must reuse createPool() from backend/src/db.js.
    files: ['backend/seeds/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              message: 'Use createPool() from ../src/db.js',
            },
          ],
        },
      ],
    },
  },
])
