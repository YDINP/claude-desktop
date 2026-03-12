export interface AguiStep {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  startedAt: number
  finishedAt?: number
}

export interface AguiRun {
  id: string
  startedAt: number
  finishedAt?: number
  costUsd?: number
  steps: AguiStep[]
}

type Listener = (runs: AguiRun[]) => void

let runs: AguiRun[] = []
const listeners = new Set<Listener>()

function notify(): void {
  for (const l of listeners) l([...runs])
}

export function aguiSubscribe(fn: Listener): () => void {
  listeners.add(fn)
  fn([...runs])
  return () => listeners.delete(fn)
}

export function aguiDispatch(ev: Record<string, unknown>): void {
  const type = ev.type as string
  const now = Date.now()

  if (type === 'run_started') {
    const run: AguiRun = { id: ev.runId as string, startedAt: (ev.timestamp as number) ?? now, steps: [] }
    runs = [...runs.slice(-9), run]
  } else if (type === 'step_started') {
    runs = runs.map(r =>
      r.id === ev.runId
        ? { ...r, steps: [...r.steps, { id: ev.stepId as string, name: ev.stepName as string, status: 'running' as const, startedAt: (ev.timestamp as number) ?? now }] }
        : r
    )
  } else if (type === 'step_finished') {
    runs = runs.map(r =>
      r.id === ev.runId
        ? { ...r, steps: r.steps.map(s => s.id === ev.stepId ? { ...s, status: (ev.success ? 'done' : 'error') as AguiStep['status'], finishedAt: (ev.timestamp as number) ?? now } : s) }
        : r
    )
  } else if (type === 'run_finished') {
    runs = runs.map(r =>
      r.id === ev.runId ? { ...r, finishedAt: (ev.timestamp as number) ?? now, costUsd: ev.costUsd as number } : r
    )
  }

  notify()
}
