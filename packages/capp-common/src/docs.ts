import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import type { ValidateFunction } from 'ajv'
import approvalSchema from '../schemas/approval.schema.json'
import camRequestSchema from '../schemas/cam-request.schema.json'
import camStatusSchema from '../schemas/cam-status.schema.json'
import ncReviewSchema from '../schemas/nc-review.schema.json'
import partSchema from '../schemas/part.schema.json'
import planSchema from '../schemas/plan.schema.json'
import templateSchema from '../schemas/template.schema.json'
import { CappError } from './errors'
import { inside } from './paths'
import type { DocName, Docs } from './types'
import type { Job } from './jobs'

const ajv = new Ajv2020({ allErrors: false, strict: false })

const SCHEMAS = {
  part: partSchema,
  plan: planSchema,
  approval: approvalSchema,
  'cam-request': camRequestSchema,
  'cam-status': camStatusSchema,
  'nc-review': ncReviewSchema,
  template: templateSchema,
} as const

type SchemaName = keyof typeof SCHEMAS

const validators = new Map<SchemaName, ValidateFunction>()
function validatorFor(name: SchemaName): ValidateFunction {
  let v = validators.get(name)
  if (!v) {
    v = ajv.compile(SCHEMAS[name])
    validators.set(name, v)
  }
  return v
}

// Job-level docs have a default file; cam-request/cam-status live inside
// cam/run-<k>/ (design §6.4) and callers must pass `file` explicitly.
const DEFAULT_FILE: Partial<Record<DocName, string>> = {
  part: 'part.json',
  plan: 'plan.json',
  approval: 'approval.json',
  'nc-review': 'nc-review.json',
}

export function validateDoc<N extends SchemaName>(name: N, data: unknown, file = `<${name}>`): Docs[N & DocName] {
  const validateFn = validatorFor(name)
  if (!validateFn(data)) {
    const err = validateFn.errors?.[0]
    const where = err ? `${err.instancePath || '/'} ${err.message ?? ''}`.trim() : 'unknown'
    throw new CappError(`${file} is not a valid capp.${name}/v0: ${where}`)
  }
  return data as Docs[N & DocName]
}

function resolveFile<N extends DocName>(name: N, file?: string): string {
  if (file) return file
  const def = DEFAULT_FILE[name]
  if (!def) throw new CappError(`readDoc/writeDoc for capp.${name}/v0 requires an explicit file path`)
  return def
}

export async function readDoc<N extends DocName>(
  job: Job,
  name: N,
  file?: string,
): Promise<{ doc: Docs[N]; sha256: string }> {
  const rel = resolveFile(name, file)
  const path = await inside(job.dir, rel)
  let buf: Buffer
  try {
    buf = await readFile(path)
  } catch (e) {
    throw new CappError(`${rel} not found in job ${job.id}: ${(e as Error).message}`)
  }
  const sha256 = createHash('sha256').update(buf).digest('hex')
  let data: unknown
  try {
    data = JSON.parse(buf.toString('utf8'))
  } catch (e) {
    throw new CappError(`${rel} is not valid JSON: ${(e as Error).message}`)
  }
  return { doc: validateDoc(name, data, rel) as Docs[N], sha256 }
}

export async function writeDoc<N extends DocName>(
  job: Job,
  name: N,
  doc: Docs[N],
  file?: string,
): Promise<{ path: string; sha256: string }> {
  const rel = resolveFile(name, file)
  const path = await inside(job.dir, rel)
  validateDoc(name, doc, rel)
  const text = JSON.stringify(doc, null, 2) + '\n'
  const tmp = `${path}.tmp`
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, path)
  return { path, sha256: createHash('sha256').update(text, 'utf8').digest('hex') }
}
