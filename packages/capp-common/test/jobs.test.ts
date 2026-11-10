import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createJob, jobsIndexPath, listJobs, openJob } from '../src/jobs'
import { CappError } from '../src/errors'

let workspace: string
let dshHome: string

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'capp-jobs-ws-'))
  dshHome = await mkdtemp(join(tmpdir(), 'capp-jobs-home-'))
  process.env.DSH_HOME = dshHome
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
  await rm(dshHome, { recursive: true, force: true })
})

describe('jobs', () => {
  it('creates under <workspace>/capp/<id>, lists and opens', async () => {
    const job = await createJob(workspace, 'first')
    expect(job.id).toMatch(/^job-\d{8}-[0-9a-f]{4}$/)
    // inside() returns realpaths; tmpdir may sit behind a symlink (macOS /var).
    expect(job.dir).toBe(join(await realpath(workspace), 'capp', job.id))
    const list = await listJobs()
    expect(list.some((j) => j.id === job.id && j.label === 'first')).toBe(true)
    const opened = await openJob(job.id)
    expect(opened.dir).toBe(job.dir)
  })

  it('throws on a deleted job directory', async () => {
    const job = await createJob(workspace, 'doomed')
    await rm(job.dir, { recursive: true, force: true })
    await expect(openJob(job.id)).rejects.toThrow(CappError)
  })

  it('rejects malformed ids', async () => {
    await expect(openJob('not-a-job')).rejects.toThrow(/invalid job id/)
    await expect(openJob('../x')).rejects.toThrow(/invalid job id/)
  })

  it('throws CappError on a corrupt index instead of dropping jobs', async () => {
    await createJob(workspace, 'one')
    await createJob(workspace, 'two')
    const indexPath = jobsIndexPath()
    await writeFile(indexPath, '{"jobs": [') // truncated JSON
    await expect(createJob(workspace, 'three')).rejects.toThrow(/not valid JSON/)
    await expect(listJobs()).rejects.toThrow(CappError)
    // The file must be untouched — no silent rewrite.
    expect(await readFile(indexPath, 'utf8')).toBe('{"jobs": [')
  })

  it('treats a missing index as empty', async () => {
    const fresh = await mkdtemp(join(tmpdir(), 'capp-jobs-fresh-'))
    const saved = process.env.DSH_HOME
    process.env.DSH_HOME = fresh
    try {
      expect(await listJobs()).toEqual([])
    } finally {
      process.env.DSH_HOME = saved
      await rm(fresh, { recursive: true, force: true })
      await rm(dirname(fresh), { recursive: true, force: true }).catch(() => {})
    }
  })
})
