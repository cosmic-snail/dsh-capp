import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    // scripts/*.test.mjs belong to `node --test` (the docs check), not vitest.
    exclude: [...configDefaults.exclude, 'scripts/**'],
  },
})
