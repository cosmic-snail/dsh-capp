import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createJob, listJobs, openJob } from '../src/jobs'
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
  it('creates, lists and opens a job', async () => {
    const job = await createJob(workspace, 'first')
    expect(job.id).toMatch(/^job-\d{8}-[0-9a-f]{4}$/)
    expect(job.dir.startsWith(workspace)).toBe(true)
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
})
