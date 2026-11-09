import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const style = {
  semi: ['error', 'never'],
  quotes: ['error', 'single', { avoidEscape: true }],
}

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', '**/lib/**', 'coverage/**', '.worktrees/**', 'capp-jobs/**'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: style,
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: style,
  },
  {
    files: ['packages/*/src/client/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
)
