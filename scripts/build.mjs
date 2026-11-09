// esbuild pipeline for plugin packages: src/index.ts → lib/index.js (node ESM),
// src/client/index.tsx → lib/client.js wrapped for the Harness module loader.
// capp-common is bundled into each plugin, never built itself; its CAPP_VERSION is
// injected from the building package's version. Usage: node scripts/build.mjs

import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(ROOT, 'packages')

async function pluginPackages() {
  const entries = await readdir(PACKAGES, { withFileTypes: true })
  const plugins = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const dir = join(PACKAGES, entry.name)
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    // Private packages (capp-common) are bundled into plugins, never built on their own.
    if (pkg.private) continue
    plugins.push({ dir, name: pkg.name, version: pkg.version })
  }
  return plugins
}

function print(path) {
  console.log(relative(ROOT, path))
}

for (const { dir, name, version } of await pluginPackages()) {
  const lib = join(dir, 'lib')
  await rm(lib, { recursive: true, force: true })
  await mkdir(lib, { recursive: true })

  // Substitute capp-common's __CAPP_VERSION__ so each bundle reports its own package version.
  const define = { __CAPP_VERSION__: JSON.stringify(version) }

  const serverOut = join(lib, 'index.js')
  await build({
    entryPoints: [join(dir, 'src', 'index.ts')],
    outfile: serverOut,
    platform: 'node',
    format: 'esm',
    target: 'es2023',
    bundle: true,
    external: ['@deepseek-ai/*', 'node:*'],
    define,
    logLevel: 'warning',
  })
  print(serverOut)

  const clientEntry = join(dir, 'src', 'client', 'index.tsx')
  if (existsSync(clientEntry)) {
    const result = await build({
      entryPoints: [clientEntry],
      platform: 'browser',
      format: 'cjs',
      target: 'es2023',
      bundle: true,
      external: ['react', '@deepseek-ai/*'],
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      define,
      write: false,
      logLevel: 'warning',
    })
    const output = result.outputFiles[0]
    if (!output) throw new Error(`esbuild produced no client bundle for ${clientEntry}`)
    const clientOut = join(lib, 'client.js')
    // npm names cannot contain quotes, so the id is safe as a single-quoted literal.
    await writeFile(clientOut, `window.__ModuleLoader__.load({ id: '${name}', factory: (require) => {
  const module = { exports: {} }
  ;(function (require, module, exports) {
${output.text}
  })(require, module, module.exports)
  return module.exports
} })
`)
    print(clientOut)
  }

  const skills = join(dir, 'skills')
  if (existsSync(skills)) {
    const skillsOut = join(lib, 'skills')
    await cp(skills, skillsOut, { recursive: true })
    print(skillsOut)
  }
}
