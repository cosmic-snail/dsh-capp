import { afterEach, describe, expect, it, vi } from 'vitest'
import { CappError } from '../src/errors'
import { cappTool } from '../src/tool'

function makeTool(run: () => Promise<unknown>) {
  return cappTool({
    name: 'step_probe',
    description: 'test tool',
    parameters: {},
    timeoutMs: 1000,
    run: run as never,
  })
}

function execOf(tool: unknown): (a: unknown, e: unknown) => Promise<unknown> {
  return (tool as { execute: (a: unknown, e: unknown) => Promise<unknown> }).execute.bind(tool)
}

afterEach(() => vi.restoreAllMocks())

describe('cappTool error mapping', () => {
  it('passes CappError through with the log path appended', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const tool = makeTool(async () => {
      throw new CappError('boom', '/tmp/log.txt')
    })
    await expect(execOf(tool)({}, {})).rejects.toThrow('boom (log: /tmp/log.txt)')
  })

  it('maps other errors to Internal error and logs the stack line', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const tool = makeTool(async () => {
      throw new Error('weird failure')
    })
    await expect(execOf(tool)({}, {})).rejects.toThrow('Internal error in step_probe: weird failure')
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('step_probe internal error'))
  })

  it('returns the run result on success and logs one info line', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const tool = makeTool(async () => ({ ok: true }))
    await expect(execOf(tool)({}, {})).resolves.toEqual({ ok: true })
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('step_probe ok'))
  })
})
