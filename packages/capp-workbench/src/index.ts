import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { CAPP_VERSION } from 'capp-common'
import { registerRoutes, type WorkbenchContext } from './server'

export const name = 'capp-workbench'
export const inject = ['tools', 'connection']

export const Config = Schema.object({})

function pingTool() {
  return defineTool({
    name: 'capp_ping',
    description: 'Check that the CAPP workbench plugin is loaded; returns pong and the CAPP version.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pong: { type: 'boolean', required: true },
          version: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs: 5000,
    isConcurrencySafe: () => true,
    presentCall: () => ({ card: 'generic', kind: 'execute', title: 'CAPP ping' }),
    async execute() {
      return { pong: true, version: CAPP_VERSION }
    },
  })
}

export function apply(ctx: WorkbenchContext) {
  ctx.tools.register(pingTool())
  registerRoutes(ctx)
}
