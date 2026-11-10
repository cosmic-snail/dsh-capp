import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    // vmThreads: the default forks pool hits an intermittent vite-node SSR
    // temp-file ENOENT at file-collection time (reproduced on macOS and
    // Linux, ~1 in 3 runs). Trade-off: errors from Node built-ins come from
    // another realm, so `instanceof Error` differs under test — nothing
    // depends on that today. `pool: 'forks'` + `fileParallelism: false` may
    // avoid the race without changing realms; untested.
    pool: 'vmThreads',
    // scripts/*.test.mjs belong to `node --test` (the docs check), not vitest.
    exclude: [...configDefaults.exclude, 'scripts/**'],
  },
})
