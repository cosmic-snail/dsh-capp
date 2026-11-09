// Run with: node --test scripts/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { check } from './check-docs.mjs'

function repo (files) {
  const root = mkdtempSync(join(tmpdir(), 'capp-docs-'))
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  return root
}

function errorsFor (files) {
  const root = repo(files)
  try { return check(root) } finally { rmSync(root, { recursive: true, force: true }) }
}

const base = { 'README.md': '[docs](docs/README.md)\n', 'docs/README.md': '# Docs\n' }

test('clean tree passes', () => {
  assert.deepEqual(errorsFor(base), [])
})

test('missing targets fail, code spans and external links are ignored', () => {
  const errors = errorsFor({ ...base, 'docs/README.md': '[a](nope.md) `[b](gone.md)` [c](https://x.y/z)\n```\n[d](gone.md)\n```\n' })
  assert.equal(errors.length, 1)
  assert.match(errors[0], /missing link target: nope\.md/)
})

test('anchors and encoded paths resolve to the file', () => {
  assert.deepEqual(errorsFor({ ...base, 'docs/README.md': '[a](my%20page.md#x)\n', 'docs/my page.md': '# x\n' }), [])
})

test('links that leave the repo or point at the machine fail', () => {
  const errors = errorsFor({ ...base, 'docs/README.md': '[a](../../etc/passwd) [b](file:///tmp/x) [c](C:/x.md)\n' })
  assert.equal(errors.length, 3)
})

test('machine paths and private addresses fail even inside code', () => {
  const errors = errorsFor({ ...base, 'docs/README.md': '`/Users/alice/x` `C:\\Users\\bob\\y` 192.168.1.20 ok: /Users/... 10.0.22621.0 pnpm 10.34.5 10.1.2.3.4 C:\\capp-assets\\x\n' })
  assert.equal(errors.length, 3)
})

test('unreachable guides fail, archive pages do not', () => {
  const errors = errorsFor({ ...base, 'docs/orphan.md': '# o\n', 'docs/acceptance/G0.md': '# G0\n' })
  assert.deepEqual(errors, ['docs/orphan.md: not reachable from README.md, AGENTS.md or docs/README.md'])
})

test('dated paragraphs fail only in current pages', () => {
  const errors = errorsFor({ ...base, 'docs/README.md': '[g](acceptance/G0.md)\n2026-11-08: ran it\n', 'docs/acceptance/G0.md': '2026-11-08: ran it\n' })
  assert.equal(errors.length, 1)
  assert.match(errors[0], /docs\/README\.md:2: dated paragraph/)
})

test('notes must match their directory and template', () => {
  const good = 'Status: proposed\nDate: 2026-11-08\nBaseline: main abc\n\n## Problem\n## Alternatives\n## Decision\n## Cost and limits\n## Evidence and gaps\n'
  assert.deepEqual(errorsFor({ ...base, '.agents/notes/proposed/2026-11-08-x.md': good }), [])
  const errors = errorsFor({ ...base, '.agents/notes/implemented/2026-11-08-x.md': good.replace('## Decision\n', '') })
  assert.equal(errors.length, 2)
})

test('skills need matching name and a description', () => {
  assert.deepEqual(errorsFor({ ...base, '.agents/skills/a/SKILL.md': '---\nname: a\ndescription: Use when x\n---\n# A\n' }), [])
  assert.equal(errorsFor({ ...base, '.agents/skills/a/SKILL.md': '---\nname: b\n---\n' }).length, 1)
})
