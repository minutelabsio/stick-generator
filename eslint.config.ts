import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'

// Each rule block below maps to a section of .claude/skills/coding-preferences/SKILL.md.

const NAMING_RULES = [
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
  // Module-level constants are UPPER_SNAKE_CASE. zod schemas and components are PascalCase.
  { selector: 'variable', modifiers: ['const', 'global'], format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
  { selector: 'variable', modifiers: ['destructured'], format: null },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['PascalCase'] },
  // Property names mirror external shapes (SQL columns, HTTP headers, JSON payloads).
  { selector: ['objectLiteralProperty', 'typeProperty', 'objectLiteralMethod'], format: null },
] as const

const RESTRICTED_SYNTAX = [
  { selector: 'ForStatement', message: 'Use for...of or array methods instead of C-style for loops.' },
  { selector: 'SwitchStatement', message: 'Use a dispatch table (object map) instead of switch.' },
  { selector: 'TSEnumDeclaration[const=true]', message: 'Use a plain enum (or a union), not const enum.' },
] as const

export default defineConfigWithVueTs(
  {
    ignores: ['dist/**', '.wrangler/**', 'node_modules/**', 'worker-configuration.d.ts'],
  },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    commaDangle: 'always-multiline',
    braceStyle: '1tbs',
  }),
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { unicorn },
    rules: {
      // Naming
      '@typescript-eslint/naming-convention': ['error', ...NAMING_RULES],
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],

      // Function design
      'max-params': 'off',
      '@typescript-eslint/max-params': ['error', { max: 4 }],

      // Conditionals
      'curly': ['error', 'multi-line'],
      'no-nested-ternary': 'error',

      // Dispatch tables, loops, const enum
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
      'no-constant-condition': ['error', { checkLoops: 'all' }],

      // Expressions and operators
      'no-plusplus': 'error',
      'eqeqeq': ['error', 'always'],
      'prefer-template': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      // Immutability
      'prefer-const': 'error',
      'no-var': 'error',

      // Exports: named by default. Allowed files are re-enabled below.
      'no-restricted-exports': ['error', {
        restrictDefaultExports: { direct: true, named: true, defaultFrom: true, namedFrom: true, namespaceFrom: true },
      }],

      // Logging goes through the logger facades
      'no-console': 'error',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'never',
      }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Frameworks require a default export here.
    files: ['api/index.ts', '*.config.ts', '**/*.vue'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    // Vue's own convention for component names inside templates is PascalCase.
    files: ['**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
)
