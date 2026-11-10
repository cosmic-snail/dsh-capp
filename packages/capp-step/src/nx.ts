import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CappError } from 'capp-common'
import { buildNxEnv, type SubprocessContext } from './env'

// runExtractor: render journal.py.tpl, run run_journal.exe (NX batch), then
// the standalone analyzer. See packages/capp-step/README.md for the S-NX
// verdict this encodes.

export interface StepConfig {
  nxRoot: string
  extractorScripts: { extractor: string; analyzer: string }
  stepSettings: string
  journalRunner: string
  pythonPath: string
  timeoutMs: number
}

export interface ExtractorResult {
  reports: string[] // absolute paths: [nx-report.json, analysis.json]
  log: string // absolute path of nx.log
}

interface SpawnedChild {
  done: Promise<{ exitCode: number | null }>
  collected?: {
    stdout?: { readFrom(offset: number): { text: string } }
    stderr?: { readFrom(offset: number): { text: string } }
  }
  pid?: number
}

const JOURNAL_TPL = fileURLToPath(new URL('../nx/journal.py.tpl', import.meta.url))

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    const v = vars[k]
    if (v === undefined) throw new CappError(`journal template: unknown placeholder {{${k}}}`)
    return v
  })
}

function spawn(
  ctx: SubprocessContext,
  argv: string[],
  opts: { cwd: string; env: Record<string, string>; signal: AbortSignal; stdin?: string },
): SpawnedChild {
  return ctx.subprocess.spawn({
    argv,
    cwd: opts.cwd,
    env: opts.env,
    signal: opts.signal,
    graceMs: 5_000,
    stdio: {
      ...(opts.stdin !== undefined ? { stdin: { data: opts.stdin } } : {}),
      stdout: { maxBytes: 8_000_000 },
      stderr: { maxBytes: 8_000_000 },
    },
  })
}

function collected(child: SpawnedChild): { stdout: string; stderr: string } {
  return {
    stdout: child.collected?.stdout?.readFrom(0).text ?? '',
    stderr: child.collected?.stderr?.readFrom(0).text ?? '',
  }
}

async function killTree(ctx: SubprocessContext, pid: number | undefined): Promise<void> {
  if (pid === undefined) return
  try {
    const killer = spawn(ctx, ['taskkill', '/PID', String(pid), '/T', '/F'], {
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      signal: new AbortController().signal,
    })
    await killer.done
  } catch {
    // best effort; the caller is already failing
  }
}

// Runs one subprocess to completion; on caller abort or the shared timeout it
// kills the whole process tree (NX spawns children) and throws CappError.
async function runToCompletion(
  ctx: SubprocessContext,
  label: string,
  argv: string[],
  opts: { cwd: string; env: Record<string, string>; signal: AbortSignal },
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const child = spawn(ctx, argv, opts)
  try {
    const { exitCode } = await child.done
    return { exitCode, ...collected(child) }
  } catch (e) {
    await killTree(ctx, child.pid)
    if (opts.signal.aborted) {
      throw new CappError(`${label} aborted or timed out`, undefined)
    }
    throw e
  }
}

export async function runExtractor(
  ctx: SubprocessContext,
  cfg: StepConfig,
  stepAbs: string,
  outDir: string,
  signal: AbortSignal,
): Promise<ExtractorResult> {
  const workDir = join(outDir, 'work')
  await mkdir(workDir, { recursive: true })
  await mkdir(outDir, { recursive: true })

  const journalPath = join(workDir, 'journal.py')
  const tpl = await readFile(JOURNAL_TPL, 'utf8')
  await writeFile(
    journalPath,
    render(tpl, {
      WORK_DIR: workDir,
      STEP_FILE: stepAbs,
      SETTINGS_FILE: cfg.stepSettings,
      EXTRACTOR: cfg.extractorScripts.extractor,
      OUT_DIR: outDir,
    }),
    'utf8',
  )

  const env = await buildNxEnv(ctx, cfg.nxRoot)
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(cfg.timeoutMs)])
  const logPath = join(outDir, 'nx.log')
  const nxReport = join(outDir, 'nx-report.json')
  const analysisPath = join(outDir, 'analysis.json')
  let log = ''

  const journal = await runToCompletion(ctx, 'NX journal', [cfg.journalRunner, journalPath], {
    cwd: workDir,
    env,
    signal: timeout,
  })
  log += `=== run_journal ===\nexit=${journal.exitCode}\n${journal.stdout}\n${journal.stderr}\n`
  if (journal.exitCode !== 0) {
    await writeFile(logPath, log, 'utf8')
    throw new CappError(`NX exited with code ${journal.exitCode}`, logPath)
  }

  const analyzer = await runToCompletion(
    ctx,
    'analyzer',
    [cfg.pythonPath, cfg.extractorScripts.analyzer, nxReport, analysisPath],
    { cwd: outDir, env, signal: timeout },
  )
  log += `=== analyzer ===\nexit=${analyzer.exitCode}\n${analyzer.stdout}\n${analyzer.stderr}\n`
  await writeFile(logPath, log, 'utf8')
  if (analyzer.exitCode !== 0) {
    throw new CappError(`analyzer exited with code ${analyzer.exitCode}`, logPath)
  }
  return { reports: [nxReport, analysisPath], log: logPath }
}
