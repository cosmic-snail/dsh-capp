import { realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { CappError } from './errors'

// inside(root, rel) resolves rel under root and rejects escapes (guardrail G4):
// absolute rel, `..` segments, drive letters, and symlink escapes — including
// through a symlinked directory whose final target doesn't exist yet. Returns
// the resolved absolute path (unresolved tail kept when nothing exists).
export async function inside(root: string, rel: string): Promise<string> {
  if (isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith('\\\\')) {
    throw new CappError(`path escapes job root: ${rel}`)
  }
  const rootAbs = resolve(root)
  const target = resolve(rootAbs, rel)
  if (target !== rootAbs && !target.startsWith(rootAbs + sep)) {
    throw new CappError(`path escapes job root: ${rel}`)
  }

  // realpath the nearest existing ancestor, then re-append the missing tail —
  // a symlinked directory can't smuggle a new file outside the root.
  let ancestor = target
  const tail: string[] = []
  for (;;) {
    try {
      await stat(ancestor)
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      const parent = dirname(ancestor)
      if (parent === ancestor) break
      tail.unshift(ancestor.slice(parent.length + 1))
      ancestor = parent
    }
  }
  const rootReal = await realpath(rootAbs)
  const ancestorReal = await realpath(ancestor)
  const resolved = [ancestorReal, ...tail].join(sep)
  if (resolved !== rootReal && !resolved.startsWith(rootReal + sep)) {
    throw new CappError(`path escapes job root via symlink: ${rel}`)
  }
  return resolved
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
