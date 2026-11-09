// Pack every non-private package under packages/ into dist/*.tgz and print each archive's
// sha256. Private packages (capp-common) are bundled into plugins, never packed.
// Usage: node scripts/pack.mjs

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(ROOT, 'packages')
const DIST = join(ROOT, 'dist')

async function pluginPackages() {
  const entries = await readdir(PACKAGES, { withFileTypes: true })
  const plugins = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const dir = join(PACKAGES, entry.name)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) {
      // Spike directories (e.g. packages/capp-step) carry assets before their package exists.
      console.log(`skip ${entry.name}: no package.json`)
      continue
    }
    const pkg = JSON.parse(await readFile(manifest, 'utf8'))
    if (pkg.private) continue
    plugins.push({ dir, name: pkg.name, version: pkg.version })
  }
  return plugins
}

const plugins = await pluginPackages()
if (plugins.length === 0) {
  console.log('no plugin packages to pack')
  process.exit(0)
}

await mkdir(DIST, { recursive: true })

for (const { dir, name, version } of plugins) {
  // pnpm is a .cmd shim on Windows, which spawn can only start through a shell.
  const result = spawnSync('pnpm', ['pack', '--pack-destination', DIST], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error || result.status !== 0) {
    console.error(`pnpm pack failed for ${name} (exit ${result.status ?? result.error?.message})`)
    process.exit(result.status ?? 1)
  }
  const archive = join(DIST, `${name}-${version}.tgz`)
  if (!existsSync(archive)) {
    console.error(`expected ${basename(archive)} in dist after packing ${name}`)
    process.exit(1)
  }
  const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex')
  console.log(`${basename(archive)} ${sha256}`)
}
