import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

type FetchMethod = 'GET' | 'HEAD' | 'POST'

interface FetchRoute {
  path: string
  methods: readonly FetchMethod[]
  requestBody: 'buffered' | 'streaming'
  fetch: (request: Request) => Promise<Response>
}

/** The slice of the host context this plugin uses; the host passes the real ctx. */
export interface WorkbenchContext {
  tools: {
    register: (definition: ToolDefinition) => () => void
  }
  connection: {
    fetch: {
      register: (route: FetchRoute) => () => Promise<void>
    }
  }
}

export function registerRoutes(ctx: WorkbenchContext) {
  ctx.connection.fetch.register({
    path: '/api/capp/ping',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }),
  })
}
