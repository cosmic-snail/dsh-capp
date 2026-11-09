import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

type FetchMethod = 'GET' | 'HEAD' | 'POST'

interface FetchRoute {
  path: string
  methods: readonly FetchMethod[]
  requestBody: 'buffered' | 'streaming'
  fetch: (request: Request) => Promise<Response>
}

/** The slice of the host context the route registrar uses; the host passes the real ctx. */
export interface RoutesContext {
  connection: {
    fetch: {
      register: (route: FetchRoute) => () => Promise<void>
    }
  }
}

/** The slice of the host context this plugin uses; the host passes the real ctx. */
export interface WorkbenchContext {
  tools: {
    register: (definition: ToolDefinition) => () => void
  }
  inject: (deps: string[], callback: (ctx: RoutesContext) => void) => unknown
}

export function registerRoutes(ctx: RoutesContext) {
  ctx.connection.fetch.register({
    path: '/api/capp/ping',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }),
  })
}
