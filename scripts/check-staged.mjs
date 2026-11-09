// Checks what is about to be committed, not the working tree: exports the full git index to a
// temporary directory and runs the *staged* docs checker against it. The pre-commit hook pipes
// the staged copy of this file into node, so a half-edited working copy can't change the result.
// It is a consistency check, not a tamper-proof boundary (docs/development.md).

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })

const root = git('rev-parse', '--show-toplevel').trim()
process.chdir(root)

if (git('ls-files', '--unmerged').trim()) {
  console.error('staged check: unresolved merge conflicts in the index')
  process.exit(1)
}

// Whitespace errors and leftover conflict markers in the staged diff.
const ws = spawnSync('git', ['diff', '--cached', '--check'], { stdio: 'inherit' })
if (ws.status) {
  console.error('staged check: fix the whitespace/conflict-marker problems above, re-stage, commit again')
  process.exit(1)
}

const snap = mkdtempSync(join(tmpdir(), 'capp-index-'))
let code = 1
try {
  // Trailing separator matters: --prefix is a string prefix, not a directory.
  execFileSync('git', ['checkout-index', '--all', `--prefix=${snap}/`])
  const r = spawnSync(process.execPath, [join(snap, 'scripts', 'check-docs.mjs'), '--root', snap], { stdio: 'inherit' })
  code = r.status ?? 1
} catch (err) {
  console.error(`staged check failed: ${err.message}`)
} finally {
  rmSync(snap, { recursive: true, force: true })
}
if (code) console.error('staged check: fix the problems in the working tree, re-stage, commit again (or `git commit --no-verify` and say why in the PR)')
process.exit(code)
