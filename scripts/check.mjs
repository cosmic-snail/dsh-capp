// Explicit check groups for humans, agents, the git hook and CI. Report only: no auto-fix,
// no implicit installs. Usage and scope: docs/development.md.
//
//   node scripts/check.mjs [docs] [lint] [types] [test] [pack] [install-hooks]
//
// With no group, runs `docs`. `lint` calls `pnpm run lint`. `types`, `test` and `pack` call
// the root package.json scripts of the same names (typecheck, test, build + pack), which
// arrive with the S0 workspace.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GROUPS = ['docs', 'lint', 'types', 'test', 'pack', 'install-hooks']
const HOOKS_PATH = '.githooks'

function run (group, cmd, args) {
  console.log(`[${group}] ${cmd} ${args.join(' ')}`)
  // pnpm is a .cmd shim on Windows, which spawn can only start through a shell.
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' && cmd !== process.execPath })
  const code = r.error ? 127 : (r.status ?? 1)
  if (r.error) console.error(`[${group}] cannot start ${cmd}: ${r.error.message}`)
  console.log(`[${group}] exit=${code}`)
  return code
}

function needWorkspace (group) {
  if (existsSync(resolve(ROOT, 'pnpm-workspace.yaml'))) return true
  console.error(`[${group}] no pnpm workspace yet; this group starts working once S0 adds pnpm-workspace.yaml`)
  return false
}

function installHooks () {
  const r = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: ROOT, encoding: 'utf8' })
  const current = r.status === 0 ? r.stdout.trim() : ''
  if (current && current !== HOOKS_PATH) {
    console.error(`[install-hooks] core.hooksPath is already "${current}"; leaving it alone. Unset it first if you want the repo hooks.`)
    return 1
  }
  if (current === HOOKS_PATH) {
    console.log('[install-hooks] already installed')
    return 0
  }
  return run('install-hooks', 'git', ['config', 'core.hooksPath', HOOKS_PATH])
}

const steps = {
  docs: () => run('docs', process.execPath, ['scripts/check-docs.mjs']) ||
    run('docs', process.execPath, ['--test', '--test-reporter=dot', 'scripts/check-docs.test.mjs']),
  lint: () => run('lint', 'pnpm', ['run', 'lint']),
  types: () => needWorkspace('types') ? run('types', 'pnpm', ['run', 'typecheck']) : 2,
  test: () => needWorkspace('test') ? run('test', 'pnpm', ['run', 'test']) : 2,
  pack: () => needWorkspace('pack') ? (run('pack', 'pnpm', ['run', 'build']) || run('pack', 'pnpm', ['run', 'pack'])) : 2,
  'install-hooks': installHooks,
}

const groups = process.argv.slice(2)
const unknown = groups.filter((g) => !GROUPS.includes(g))
if (unknown.length) {
  console.error(`unknown group(s): ${unknown.join(', ')}; choose from ${GROUPS.join(', ')}`)
  process.exit(2)
}
for (const g of groups.length ? groups : ['docs']) {
  const code = steps[g]()
  if (code) process.exit(code)
}
