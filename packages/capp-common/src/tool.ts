import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ParameterSchemaSpec, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { CappError } from './errors'

// Local copy of the host's JsonValue shape (dsh-util-values is transitive, not
// a declared dep); used only to satisfy defineTool's output contract.
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// cappTool wraps defineTool for every CAPP tool (spec §4.1): generic execute
// card, JSON result rendering, CappError passthrough with log path, internal
// errors mapped to a one-line message, one info log per call.

export type ToolExec = ToolRunContext

export interface Logger {
  info(message: string): void
  error(message: string): void
}

// The host ToolRunContext carries no logger; plugin logs go to the process
// console, which the Harness captures per plugin.
const consoleLog: Logger = {
  info: (m) => console.info(`[capp] ${m}`),
  error: (m) => console.error(`[capp] ${m}`),
}

export function cappTool<A, R>(spec: {
  name: `${'step' | 'plan' | 'cam' | 'nc'}_${string}`
  description: string
  parameters: ParameterSchemaSpec
  timeoutMs: number
  concurrencySafe?: boolean
  run: (args: A, exec: ToolExec, log: Logger) => Promise<R>
}): ReturnType<typeof defineTool> {
  const started = () => Date.now()
  return defineTool({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
    timeoutMs: spec.timeoutMs,
    isConcurrencySafe: spec.concurrencySafe ? () => true : undefined,
    presentCall: () => ({ card: 'generic', kind: 'execute', title: spec.name }),
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args: unknown, exec: ToolRunContext) {
      const t0 = started()
      const log = consoleLog
      try {
        const result = await spec.run(args as A, exec, log)
        log.info(`${spec.name} ok ${Date.now() - t0}ms`)
        return result as Record<string, JsonValue>
      } catch (e) {
        const ms = Date.now() - t0
        if (e instanceof CappError) {
          log.info(`${spec.name} error ${ms}ms: ${e.message}`)
          throw new CappError(e.log ? `${e.message} (log: ${e.log})` : e.message, e.log)
        }
        const message = e instanceof Error ? e.message : String(e)
        log.error(`${spec.name} internal error ${ms}ms: ${message}`)
        throw new CappError(`Internal error in ${spec.name}: ${message}`)
      }
    },
  })
}
