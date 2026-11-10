import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CappError } from '../src/errors'
import { inside } from '../src/paths'

let root: string
let outside: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'capp-paths-root-'))
  outside = await mkdtemp(join(tmpdir(), 'capp-paths-out-'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
  await rm(outside, { recursive: true, force: true })
})

describe('inside', () => {
  it('accepts a normal relative path', async () => {
    await mkdir(join(root, 'sub'), { recursive: true })
    await writeFile(join(root, 'sub', 'a.json'), '{}')
    const p = await inside(root, 'sub/a.json')
    expect(p.endsWith(join('sub', 'a.json'))).toBe(true)
  })

  it('rejects .. escapes with CappError', async () => {
    await expect(inside(root, '../escape.json')).rejects.toThrow(CappError)
    await expect(inside(root, 'sub/../../escape.json')).rejects.toThrow(/escapes/)
  })

  it('rejects absolute paths', async () => {
    await expect(inside(root, '/etc/passwd')).rejects.toThrow(/escapes/)
    await expect(inside(root, 'C:\\Windows\\x')).rejects.toThrow(/escapes/)
    await expect(inside(root, '\\\\server\\share')).rejects.toThrow(/escapes/)
  })

  it('rejects symlink escapes when the target exists', async () => {
    const link = join(root, 'link')
    try {
      await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      return // no symlink privilege on this platform
    }
    await writeFile(join(outside, 'secret.json'), '{}')
    await expect(inside(root, 'link/secret.json')).rejects.toThrow(CappError)
  })

  it('rejects new files through a symlinked directory (target does not exist)', async () => {
    const link = join(root, 'linkdir')
    try {
      await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      return
    }
    // written.json does not exist yet — the old code returned the unresolved path.
    await expect(inside(root, 'linkdir/written.json')).rejects.toThrow(CappError)
  })
})
