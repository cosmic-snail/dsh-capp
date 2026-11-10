import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CappError } from './errors'
import { inside } from './paths'

// Jobs live in the session workspace; a global index under DSH_HOME maps
// job id → absolute dir (spec A4). The index has no lock: last writer wins.

export interface Job {
  id: string
  dir: string // absolute
}

export interface JobIndexEntry {
  id: string
  dir: string
  label?: string
  created_at: string
  updated_at: string
}

interface JobIndex {
  jobs: JobIndexEntry[]
}

// DSH_HOME resolution: the host exposes it to plugins; process.env.DSH_HOME is
// the fallback used by headless/CLI runs. Verified against the host in S2/S4.
export function dshHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

export function jobsIndexPath(): string {
  return join(dshHome(), 'capp', 'jobs.json')
}

async function readIndex(): Promise<JobIndex> {
  try {
    const text = await readFile(jobsIndexPath(), 'utf8')
    const data = JSON.parse(text) as JobIndex
    if (!Array.isArray(data.jobs)) return { jobs: [] }
    return data
  } catch {
    return { jobs: [] }
  }
}

async function writeIndex(index: JobIndex): Promise<void> {
  const path = jobsIndexPath()
  await mkdir(join(dshHome(), 'capp'), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(index, null, 2) + '\n', 'utf8')
  await rename(tmp, path)
}

function newJobId(now = new Date()): string {
  const ymd = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `job-${ymd}-${randomBytes(2).toString('hex')}`
}

export async function createJob(workspaceRoot: string, label?: string): Promise<Job> {
  const id = newJobId()
  const dir = await inside(workspaceRoot, id)
  await mkdir(dir, { recursive: true })
  const now = new Date().toISOString()
  const index = await readIndex()
  index.jobs = index.jobs.filter((j) => j.id !== id)
  index.jobs.push({ id, dir, label, created_at: now, updated_at: now })
  await writeIndex(index)
  return { id, dir }
}

export async function openJob(id: string): Promise<Job> {
  if (!/^job-\d{8}-[0-9a-f]{4}$/.test(id)) {
    throw new CappError(`invalid job id: ${id}`)
  }
  const index = await readIndex()
  const entry = index.jobs.find((j) => j.id === id)
  if (!entry) throw new CappError(`job not found: ${id}`)
  try {
    const { stat } = await import('node:fs/promises')
    await stat(entry.dir)
  } catch {
    throw new CappError(`job directory missing: ${entry.dir}`)
  }
  return { id: entry.id, dir: entry.dir }
}

export async function listJobs(): Promise<Array<Job & { label?: string; updated_at: string }>> {
  const index = await readIndex()
  return index.jobs.map((j) => ({ id: j.id, dir: j.dir, label: j.label, updated_at: j.updated_at }))
}
