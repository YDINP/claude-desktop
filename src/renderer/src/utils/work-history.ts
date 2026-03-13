export interface WorkStep {
  label: string
  output?: string
  elapsed?: number
  status: 'done' | 'error'
}

export interface WorkRun {
  id: string
  taskId: string
  taskName: string
  startTime: number
  endTime?: number
  steps: WorkStep[]
  success: boolean
  error?: string
}

const STORAGE_KEY = 'work-history'
const MAX_RUNS = 500

export function saveRun(run: WorkRun): void {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    const runs: WorkRun[] = existing ? JSON.parse(existing) : []
    runs.unshift(run)
    const trimmed = runs.slice(0, MAX_RUNS)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch (quotaErr) {
      if (quotaErr instanceof DOMException && quotaErr.name === 'QuotaExceededError') {
        // Remove oldest half and retry
        const reduced = trimmed.slice(0, Math.floor(trimmed.length / 2))
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced))
        } catch {
          // Give up silently if still failing
        }
      }
    }
  } catch (err) {
    console.error('Failed to save work run:', err)
  }
}

export function loadRuns(taskId?: string): WorkRun[] {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    const runs: WorkRun[] = existing ? JSON.parse(existing) : []
    if (taskId) {
      return runs.filter(run => run.taskId === taskId)
    }
    return runs
  } catch (err) {
    console.error('Failed to load work runs:', err)
    return []
  }
}

export function clearHistory(taskId?: string): void {
  try {
    if (taskId) {
      const existing = localStorage.getItem(STORAGE_KEY)
      if (!existing) return
      const runs: WorkRun[] = JSON.parse(existing)
      const filtered = runs.filter(run => run.taskId !== taskId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (err) {
    console.error('Failed to clear work history:', err)
  }
}

export function getRunById(id: string): WorkRun | undefined {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (!existing) return undefined
    const runs: WorkRun[] = JSON.parse(existing)
    return runs.find(run => run.id === id)
  } catch (err) {
    console.error('Failed to get work run:', err)
    return undefined
  }
}
