import typescriptEslint from '@typescript-eslint/eslint-plugin'
import {defineConfig, globalIgnores} from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import drizzle from 'eslint-plugin-drizzle'
import promise from 'eslint-plugin-promise'
import react from 'eslint-plugin-react'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unicorn from 'eslint-plugin-unicorn'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Additional ignores:
    'node_modules/**',
    'dist/**',
    'src/components/ui/*',
    'playwright-report/**',
    '.claude/**',
    'drizzle/**',
  ]),
  // Custom rules
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      drizzle,
      promise,
      react,
      'simple-import-sort': simpleImportSort,
      unicorn,
    },
    rules: {
      // React rules
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      // TypeScript rules
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      // Unicorn rules
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/filename-case': 'off',
      // Promise rules
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-native': 'off',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'warn',
      'promise/valid-params': 'warn',
      'promise/avoid-new': 'off',
      // Import sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // General rules
      'no-console': 'off',
      'prefer-template': 'error',
      'no-useless-concat': 'error',
      'no-template-curly-in-string': 'error',
      'no-restricted-properties': [
        'warn',
        {
          object: 'process',
          property: 'env',
          message:
            'N\'utilise pas process.env directement. Utilise le fichier env.ts typé. (import {env} from "@/env")',
        },
      ],
    },
  },
  // Restricted imports for app layer
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@/db/models/*',
            '@/db/repositories/*',
            '@/services/*-service',
            '@/services/interceptors/*-service-interceptor',
            'drizzle-orm',
          ],
        },
      ],
    },
  },
])

export default eslintConfig
