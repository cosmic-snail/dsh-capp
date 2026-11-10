import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CappError } from '../src/errors'
import { readDoc, writeDoc } from '../src/docs'
import type { Part, Plan } from '../src/types'

const FIXTURES = join(__dirname, '..', '..', '..', 'fixtures')

let workspace: string
let jobDir: string

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'capp-s1-'))
  jobDir = join(workspace, 'job-test')
  await mkdir(jobDir, { recursive: true })
  process.env.DSH_HOME = join(workspace, 'dsh-home')
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

describe('docs', () => {
  it('round-trips fixtures with a stable sha256', async () => {
    const part = JSON.parse(await readFile(join(FIXTURES, 'toy-part.json'), 'utf8')) as Part
    const plan = JSON.parse(await readFile(join(FIXTURES, 'toy-plan.json'), 'utf8')) as Plan
    const w1 = await writeDoc({ id: 'job-x', dir: jobDir }, 'part', part)
    const w2 = await writeDoc({ id: 'job-x', dir: jobDir }, 'part', part)
    expect(w1.sha256).toBe(w2.sha256)
    const r = await readDoc({ id: 'job-x', dir: jobDir }, 'part')
    expect(r.sha256).toBe(w1.sha256)
    expect(r.doc.features).toHaveLength(2)
    await writeDoc({ id: 'job-x', dir: jobDir }, 'plan', plan)
    const rp = await readDoc({ id: 'job-x', dir: jobDir }, 'plan')
    expect(rp.doc.mode).toBe('template')
  })

  it('fails on a missing schema field', async () => {
    const bad = { source: {}, units: 'mm', features: [] }
    await expect(writeDoc({ id: 'job-x', dir: jobDir }, 'part', bad as Part)).rejects.toThrow(CappError)
    await expect(writeDoc({ id: 'job-x', dir: jobDir }, 'part', bad as Part)).rejects.toThrow(/not a valid capp.part\/v0/)
  })

  it('fails on a wrong schema const', async () => {
    const bad = { schema: 'capp.plan/v0', revision: 1, part: { file: 'p', sha256: 'x' }, mode: 'template', setups: [] }
    await expect(writeDoc({ id: 'job-x', dir: jobDir }, 'part', bad as unknown as Part)).rejects.toThrow(/not a valid/)
  })

  it('preserves extra fields', async () => {
    const part = JSON.parse(await readFile(join(FIXTURES, 'toy-part.json'), 'utf8')) as Part
    const extra = { ...part, custom_field: { nested: [1, 2, 3] } }
    await writeDoc({ id: 'job-x', dir: jobDir }, 'part', extra)
    const r = await readDoc({ id: 'job-x', dir: jobDir }, 'part')
    expect((r.doc as Record<string, unknown>).custom_field).toEqual({ nested: [1, 2, 3] })
  })

  it('reads template docs too', async () => {
    const tpl = JSON.parse(await readFile(join(FIXTURES, 'toy-template.json'), 'utf8'))
    const path = join(jobDir, 'toy.template.json')
    await writeFile(path, JSON.stringify(tpl))
    const { readFile: rf } = await import('node:fs/promises')
    const text = await rf(path, 'utf8')
    expect(JSON.parse(text).schema).toBe('capp.template/v0')
  })
})
