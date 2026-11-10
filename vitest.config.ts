import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    // vmThreads: the forks pool hits a deterministic vite-node SSR temp-file
    // ENOENT in this environment (reproduced across runs and cache clears).
    // Kept pending CI evidence; revisit if Quality stays green on forks.
    pool: 'vmThreads',
    // scripts/*.test.mjs belong to `node --test` (the docs check), not vitest.
    exclude: [...configDefaults.exclude, 'scripts/**'],
  },
})
