import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ParameterSchemaSpec, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { CappError } from './errors'

// Local copy of the host's JsonValue shape (dsh-util-values is transitive, not
// a declared dep); used only to satisfy defineTool's output contract.
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// cappTool wraps defineTool for every CAPP tool (spec §4.1/§6.1): generic
// execute card, JSON result rendering, CappError passthrough with log path,
// internal errors mapped to a one-line message and logged with their stack,
// one structured log line per call via the plugin's ctx.logger.

export type ToolExec = ToolRunContext

// Host logger shape: ctx.logger uses printf-style calls.
export interface HostLogger {
  info(message: string, ...args: unknown[]): void
  warn?(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void
  warn?(event: string, fields?: Record<string, unknown>): void
  error(event: string, fields?: Record<string, unknown>): void
}

// capp-<plugin>: <event>; key=value — spec §6.1.
export function cappLogger(logger: HostLogger, plugin: string): Logger {
  const emit =
    (level: 'info' | 'warn' | 'error') =>
    (event: string, fields: Record<string, unknown> = {}) => {
      const pairs = Object.entries(fields)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ')
      const line = `capp-${plugin}: ${event}${pairs ? `; ${pairs}` : ''}`
      const fn = level === 'warn' ? logger.warn?.bind(logger) ?? logger.info.bind(logger) : logger[level].bind(logger)
      // Host logger is printf-style: pass the line as an argument, not the format.
      fn('%s', line)
    }
  return { info: emit('info'), warn: emit('warn'), error: emit('error') }
}

export function cappTool<A, R>(spec: {
  name: `${'step' | 'plan' | 'cam' | 'nc'}_${string}`
  description: string
  parameters: ParameterSchemaSpec
  timeoutMs: number
  concurrencySafe?: boolean
  run: (args: A, exec: ToolExec, log: Logger) => Promise<R>
}, log: Logger): ReturnType<typeof defineTool> {
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
      const t0 = Date.now()
      try {
        const result = await spec.run(args as A, exec, log)
        log.info(`${spec.name} ok`, { duration_ms: Date.now() - t0 })
        return result as Record<string, JsonValue>
      } catch (e) {
        const duration = Date.now() - t0
        if (e instanceof CappError) {
          log.info(`${spec.name} error`, { duration_ms: duration, error: e.message })
          throw new CappError(e.log ? `${e.message} (log: ${e.log})` : e.message, e.log)
        }
        const err = e instanceof Error ? e : new Error(String(e))
        log.error(`${spec.name} internal_error`, { duration_ms: duration, error: err.message, stack: err.stack ?? '' })
        throw new CappError(`Internal error in ${spec.name}: ${err.message}`)
      }
    },
  })
}
