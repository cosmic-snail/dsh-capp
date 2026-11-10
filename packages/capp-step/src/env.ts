import { CappError } from 'capp-common'

// NX environment for subprocesses (S-NX verdict + spec §8 S-PERM):
// UGII_BASE_DIR, UGII_LANG, SPLM_LICENSE_SERVER are required; the journal
// also tolerates UGS_LICENSE_BUNDLE absent. Missing values are recovered
// from the machine registry, then UGII_BASE_DIR falls back to cfg.nxRoot.

export interface SubprocessContext {
  subprocess: {
    spawn(options: {
      argv: string[]
      cwd?: string
      env?: Record<string, string>
      signal?: AbortSignal
      graceMs?: number
      stdio?: Record<string, unknown>
    }): {
      done: Promise<{ exitCode: number | null }>
      collected?: { stdout?: { readFrom(offset: number): { text: string } }; stderr?: { readFrom(offset: number): { text: string } } }
      pid?: number
    }
  }
}

const REQUIRED_VARS = ['UGII_BASE_DIR', 'UGII_LANG', 'SPLM_LICENSE_SERVER'] as const
const OPTIONAL_VARS = ['UGS_LICENSE_BUNDLE'] as const

async function regQuery(ctx: SubprocessContext, name: string): Promise<string | undefined> {
  const child = ctx.subprocess.spawn({
    argv: ['reg', 'query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', name],
    stdio: { stdout: { maxBytes: 8192 }, stderr: { maxBytes: 2048 } },
  })
  const { exitCode } = await child.done
  if (exitCode !== 0) return undefined
  const text = child.collected?.stdout?.readFrom(0).text ?? ''
  const m = text.match(new RegExp(`${name}\\s+REG_SZ\\s+(.+)`))
  return m?.[1]?.trim() || undefined
}

export async function buildNxEnv(ctx: SubprocessContext, nxRoot: string): Promise<Record<string, string>> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>
  const missing: string[] = []
  for (const name of [...REQUIRED_VARS, ...OPTIONAL_VARS]) {
    if (env[name]) continue
    const fromReg = await regQuery(ctx, name)
    if (fromReg) env[name] = fromReg
    else if (name === 'UGII_BASE_DIR') env[name] = nxRoot
    else if ((REQUIRED_VARS as readonly string[]).includes(name)) missing.push(name)
  }
  if (missing.length > 0) {
    throw new CappError(`NX environment variable(s) not set and not in registry: ${missing.join(', ')}`)
  }
  return env
}
