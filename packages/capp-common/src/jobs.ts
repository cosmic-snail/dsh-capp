import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { CappError } from './errors'
import { inside } from './paths'

// Jobs live in the session workspace under capp/<job-id>/; a global index at
// <DSH_HOME>/capp/jobs.json maps job id → absolute dir (spec A4, design §5).
// The index has no lock: last writer wins.

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

export function dshHome(): string {
  return resolveDshHome()
}

export function jobsIndexPath(): string {
  return join(dshHome(), 'capp', 'jobs.json')
}

async function readIndex(): Promise<JobIndex> {
  const path = jobsIndexPath()
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { jobs: [] }
    throw new CappError(`jobs index ${path} is not readable: ${(e as Error).message}`)
  }
  try {
    const data = JSON.parse(text) as JobIndex
    if (!Array.isArray(data.jobs)) throw new Error('missing jobs array')
    return data
  } catch (e) {
    throw new CappError(`jobs index ${path} is not valid JSON: ${(e as Error).message}`)
  }
}

async function writeIndex(index: JobIndex): Promise<void> {
  const path = jobsIndexPath()
  await mkdir(dirname(path), { recursive: true })
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
  // Read the index first: a failed read must not leave an orphan job dir.
  const index = await readIndex()
  const cappDir = await inside(workspaceRoot, 'capp')
  await mkdir(cappDir, { recursive: true })
  const dir = join(cappDir, id)
  // Non-recursive: an id collision fails loudly instead of reusing a directory.
  await mkdir(dir)
  const now = new Date().toISOString()
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
