import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    // vmThreads avoids a vite-node SSR temp-file ENOENT seen with the forks
    // pool once ajv entered the dep graph (vitest 4.1.12 + vite 8.3.6).
    pool: 'vmThreads',
    // scripts/*.test.mjs belong to `node --test` (the docs check), not vitest.
    exclude: [...configDefaults.exclude, 'scripts/**'],
  },
})
