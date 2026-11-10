import { lstat, realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path'
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
  // a symlinked directory can't smuggle a new file outside the root. lstat (not
  // stat) so a dangling symlink still counts as "existing" and gets resolved.
  let ancestor = target
  const tail: string[] = []
  for (;;) {
    try {
      await lstat(ancestor)
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      const parent = dirname(ancestor)
      if (parent === ancestor) break
      tail.unshift(basename(ancestor))
      ancestor = parent
    }
  }
  // Canonicalize for the escape check. A symlink must resolve — a dangling
  // one is refused. A non-symlink that realpath can't handle (e.g. an 8.3
  // alias on a volume where realpath fails) falls back to the lexical path:
  // it cannot redirect anywhere, so the comparison stays sound.
  const canon = async (p: string, danglingRel: string): Promise<string> => {
    const lst = await lstat(p).catch(() => undefined)
    if (lst?.isSymbolicLink()) {
      try {
        return await realpath(p)
      } catch {
        throw new CappError(`path has a dangling symlink inside job root: ${danglingRel}`)
      }
    }
    try {
      return await realpath(p)
    } catch {
      return resolve(p)
    }
  }
  const rootReal = await canon(rootAbs, rel)
  const ancestorReal = await canon(ancestor, rel)
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
