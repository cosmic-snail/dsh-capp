import { describe, expect, it } from 'vitest'
import { CappError } from '../src/errors'
import { cappLogger, cappTool, type Logger } from '../src/tool'

function fakeLog(): Logger & { lines: string[] } {
  const lines: string[] = []
  return {
    lines,
    info: (event, fields) => lines.push(`I:${event} ${JSON.stringify(fields ?? {})}`),
    error: (event, fields) => lines.push(`E:${event} ${JSON.stringify(fields ?? {})}`),
  }
}

function makeTool(run: () => Promise<unknown>, log: Logger) {
  return cappTool(
    {
      name: 'step_probe',
      description: 'test tool',
      parameters: {},
      timeoutMs: 1000,
      run: run as never,
    },
    log,
  )
}

function execOf(tool: unknown): (a: unknown, e: unknown) => Promise<unknown> {
  return (tool as { execute: (a: unknown, e: unknown) => Promise<unknown> }).execute.bind(tool)
}

describe('cappTool error mapping', () => {
  it('passes CappError through with the log path appended', async () => {
    const log = fakeLog()
    const tool = makeTool(async () => {
      throw new CappError('boom', '/tmp/log.txt')
    }, log)
    await expect(execOf(tool)({}, {})).rejects.toThrow('boom (log: /tmp/log.txt)')
    expect(log.lines.some((l) => l.includes('step_probe error'))).toBe(true)
  })

  it('maps other errors to Internal error and logs the stack', async () => {
    const log = fakeLog()
    const tool = makeTool(async () => {
      throw new Error('weird failure')
    }, log)
    await expect(execOf(tool)({}, {})).rejects.toThrow('Internal error in step_probe: weird failure')
    const line = log.lines.find((l) => l.startsWith('E:step_probe internal_error'))
    expect(line).toBeDefined()
    expect(line).toContain('weird failure')
    expect(line).toContain('stack')
  })

  it('returns the run result on success and logs one info line', async () => {
    const log = fakeLog()
    const tool = makeTool(async () => ({ ok: true }), log)
    await expect(execOf(tool)({}, {})).resolves.toEqual({ ok: true })
    expect(log.lines.filter((l) => l.startsWith('I:step_probe ok'))).toHaveLength(1)
  })
})

describe('cappLogger', () => {
  it('formats capp-<plugin>: <event>; key=value through the host logger', () => {
    const seen: string[] = []
    // Host logger is printf-style: substitute %s like cordis LoggerMethod does.
    const printf = (m: string, ...args: unknown[]) => {
      let i = 0
      seen.push(m.replace(/%[sdifoOcC]/g, () => String(args[i++])))
    }
    const host = { info: printf, error: printf }
    const log = cappLogger(host, 'step')
    log.info('step_parse ok', { duration_ms: 12, job_id: 'job-1' })
    expect(seen[0]).toBe('capp-step: step_parse ok; duration_ms=12 job_id=job-1')
    // A message containing %d must not be eaten as a placeholder.
    log.error('step_parse failed', { error: '100% done %d' })
    expect(seen[1]).toContain('100% done %d')
  })
})
