import * as React from 'react'

interface WorkbenchOptions {
  title: string
  description?: string
  customFrame?: boolean
  headerLayout?: 'default' | 'compact'
}

type Unregister = () => void

interface ClientContext {
  effect: (setup: () => Unregister | void) => void
  desktopWorkbenches: {
    register: (options: WorkbenchOptions, panel: React.ComponentType) => Unregister
  }
}

function isPingOk(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'ok' in body && body.ok === true
}

function Panel() {
  const [server, setServer] = React.useState('checking…')
  React.useEffect(() => {
    const controller = new AbortController()
    fetch('/api/capp/ping', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setServer(`HTTP ${response.status}`)
          return
        }
        const body: unknown = await response.json()
        setServer(isPingOk(body) ? 'ok' : 'unexpected response')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setServer(error instanceof Error ? error.message : String(error))
      })
    return () => controller.abort()
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header data-dsh-workbench-toolbar="">
        <span>CAPP</span>
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: '0.5rem 1rem' }}>Server: {server}</div>
    </div>
  )
}

export function apply(ctx: ClientContext) {
  ctx.effect(() =>
    ctx.desktopWorkbenches.register(
      {
        title: 'CAPP',
        description: 'AI-native process planning (MVP)',
        customFrame: true,
        headerLayout: 'compact',
      },
      Panel,
    ),
  )
}

export const inject = ['desktopWorkbenches']
