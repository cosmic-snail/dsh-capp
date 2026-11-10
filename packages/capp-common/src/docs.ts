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

// Default file name per doc; cam-request/cam-status live inside cam/run-<k>/
// and callers pass `file` explicitly.
const DEFAULT_FILE: Record<DocName, string> = {
  part: 'part.json',
  plan: 'plan.json',
  approval: 'approval.json',
  'cam-request': 'cam/request.json',
  'cam-status': 'cam/status.json',
  'nc-review': 'nc-review.json',
}

export const DOC_FILES: Record<DocName, string> = DEFAULT_FILE

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function validate<N extends DocName>(name: N, data: unknown, file: string): Docs[N] {
  const validateFn = validatorFor(name as SchemaName)
  if (!validateFn(data)) {
    const err = validateFn.errors?.[0]
    const where = err ? `${err.instancePath || '/'} ${err.message ?? ''}`.trim() : 'unknown'
    throw new CappError(`${file} is not a valid capp.${name}/v0: ${where}`)
  }
  return data as Docs[N]
}

export async function readDoc<N extends DocName>(
  job: Job,
  name: N,
  file?: string,
): Promise<{ doc: Docs[N]; sha256: string }> {
  const rel = file ?? DEFAULT_FILE[name]
  const path = await inside(job.dir, rel)
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    throw new CappError(`${rel} not found in job ${job.id}: ${(e as Error).message}`)
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new CappError(`${rel} is not valid JSON: ${(e as Error).message}`)
  }
  return { doc: validate(name, data, rel), sha256: sha256(text) }
}

export async function writeDoc<N extends DocName>(
  job: Job,
  name: N,
  doc: Docs[N],
  file?: string,
): Promise<{ path: string; sha256: string }> {
  const rel = file ?? DEFAULT_FILE[name]
  const path = await inside(job.dir, rel)
  validate(name, doc, rel)
  const text = JSON.stringify(doc, null, 2) + '\n'
  const tmp = `${path}.tmp`
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, path)
  return { path, sha256: sha256(text) }
}
