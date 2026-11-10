import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import Schema from '@deepseek-ai/schemastery'
import { CappError, cappLogger, cappTool, createJob, inside, openJob, registerSkills, writeDoc } from 'capp-common'
import type { Logger, Part, SkillsContext } from 'capp-common'
import { runExtractor, type StepConfig } from './nx'
import { normalize } from './normalize'
import type { SubprocessContext } from './env'

export const name = 'capp-step'
export const inject = ['tools', 'skills', 'systemPrompt', 'subprocess']

export const Config = Schema.object({
  nxRoot: Schema.string().required(),
  extractorScripts: Schema.object({
    extractor: Schema.string().required(),
    analyzer: Schema.string().required(),
  }),
  stepSettings: Schema.string().required(),
  journalRunner: Schema.string().required(),
  pythonPath: Schema.string().required(),
  timeoutMs: Schema.natural().default(600_000),
})

interface StepContext extends SubprocessContext, SkillsContext {
  tools: { register: (tool: unknown) => unknown }
  systemPrompt: { section: (s: { name: string; order: number; text: string }) => unknown }
  logger?: { info(m: string, ...a: unknown[]): void; warn?(m: string, ...a: unknown[]): void; error(m: string, ...a: unknown[]): void }
}

interface StepExec {
  agent?: { session?: { header?: { cwd?: string } } }
  signal?: AbortSignal
}

const NOOP_LOG: Logger = { info: () => {}, error: () => {} }

function featureCounts(part: Part): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const f of part.features ?? []) counts[f.type] = (counts[f.type] ?? 0) + 1
  return counts
}

async function stepParse(
  ctx: StepContext,
  cfg: StepConfig,
  log: Logger,
  args: { step_path: string; job_id?: string },
  exec: StepExec,
): Promise<Record<string, unknown>> {
  const workspaceRoot = exec.agent?.session?.header?.cwd
  if (!workspaceRoot) throw new CappError('cannot resolve the session workspace; step_parse needs a session cwd')
  const stepAbs = await inside(workspaceRoot, args.step_path)
  const buf = await readFile(stepAbs).catch((e) => {
    throw new CappError(`STEP file not found: ${args.step_path} (${(e as Error).message})`)
  })
  const sha256 = createHash('sha256').update(buf).digest('hex')

  const job = args.job_id ? await openJob(args.job_id) : await createJob(workspaceRoot, basename(args.step_path))
  const inputDir = join(job.dir, 'input')
  await mkdir(inputDir, { recursive: true })
  const stepName = basename(args.step_path)
  const jobStep = join(inputDir, stepName)
  await copyFile(stepAbs, jobStep)

  const { reports, log: nxLog } = await runExtractor(ctx, cfg, jobStep, join(job.dir, 'nx'), exec.signal ?? new AbortController().signal)

  const reportDocs = await Promise.all(
    reports.map(async (p) => ({ name: `nx/${basename(p)}`, json: JSON.parse(await readFile(p, 'utf8')) as unknown })),
  )
  const part = normalize(reportDocs, { file: `input/${stepName}`, sha256 })
  const { path: partPath } = await writeDoc(job, 'part', part)
  log.info('step_parse done', { job_id: job.id, features: part.features.length })

  return {
    job_id: job.id,
    part_path: partPath,
    nx_log: nxLog,
    summary: {
      feature_counts: featureCounts(part),
      bbox: part.bbox ?? null,
      material: part.material ?? null,
    },
    warnings: part.warnings ?? [],
  }
}

export function apply(ctx: StepContext, cfg: unknown) {
  const config = cfg as StepConfig
  const log = ctx.logger ? cappLogger(ctx.logger, 'step') : NOOP_LOG

  registerSkills(ctx, { name }, new URL('../skills/', import.meta.url).href, [
    { name: 'read-part', description: 'Interpret a capp.part/v0 part.json: feature vocabulary, warnings as leads, when to open raw NX reports.' },
  ])

  ctx.systemPrompt.section({
    name: 'capp-step',
    order: 110,
    text: 'To read a STEP part, call step_parse; load the read-part skill to interpret part.json.',
  })

  ctx.tools.register(
    cappTool(
      {
        name: 'step_parse',
        description:
          'Parse a STEP file into a CAPP part document. Runs the NX batch extractor and analyzer, writes part.json into a new job directory, and returns a feature summary. step_path is relative to the session workspace.',
        parameters: {
          step_path: { type: 'string', required: true, description: 'STEP file path relative to the session workspace' },
          job_id: { type: 'string', description: 'Existing job id to reuse; omit to create a new job' },
        },
        timeoutMs: config.timeoutMs + 30_000,
        run: (args: { step_path: string; job_id?: string }, exec: StepExec, toolLog: Logger) =>
          stepParse(ctx, config, toolLog, args, exec),
      },
      log,
    ),
  )
}
