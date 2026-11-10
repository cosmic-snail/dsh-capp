import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, resolve, sep } from 'node:path'

// inside(root, rel) resolves rel under root and rejects escapes (guardrail G4):
// absolute rel, `..` segments, drive letters, and symlink escapes when the
// target exists. Returns the resolved absolute path.
export async function inside(root: string, rel: string): Promise<string> {
  if (isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith('\\\\')) {
    throw new Error(`path escapes job root: ${rel}`)
  }
  const rootAbs = resolve(root)
  const target = resolve(rootAbs, rel)
  if (target !== rootAbs && !target.startsWith(rootAbs + sep)) {
    throw new Error(`path escapes job root: ${rel}`)
  }
  try {
    const [rootReal, targetReal] = await Promise.all([realpath(rootAbs), realpath(target)])
    if (targetReal !== rootReal && !targetReal.startsWith(rootReal + sep)) {
      throw new Error(`path escapes job root via symlink: ${rel}`)
    }
    return targetReal
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return target
    throw e
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
