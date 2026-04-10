import { describe, it, expect, beforeEach } from 'vitest'
import { saveRun, loadRuns, clearHistory, getRunById } from '../work-history'
import type { WorkRun } from '../work-history'

// ── localStorage mock ─────────────────────────────────────────────────────────

function makeLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k] },
    _store: store,
  }
}

function makeRun(overrides: Partial<WorkRun> = {}): WorkRun {
  return {
    id: 'run-1',
    taskId: 'task-1',
    taskName: 'Test Task',
    startTime: 1000,
    endTime: 2000,
    steps: [{ label: 'step1', status: 'done' }],
    success: true,
    ...overrides,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('work-history', () => {
  let storage: ReturnType<typeof makeLocalStorage>

  beforeEach(() => {
    storage = makeLocalStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
  })

  // ── loadRuns ────────────────────────────────────────────────────────────────

  describe('loadRuns', () => {
    it('returns empty array when storage is empty', () => {
      expect(loadRuns()).toEqual([])
    })

    it('returns all runs when no taskId filter', () => {
      const r1 = makeRun({ id: 'r1', taskId: 'task-a' })
      const r2 = makeRun({ id: 'r2', taskId: 'task-b' })
      saveRun(r1)
      saveRun(r2)
      const all = loadRuns()
      expect(all).toHaveLength(2)
    })

    it('filters by taskId', () => {
      const r1 = makeRun({ id: 'r1', taskId: 'task-a' })
      const r2 = makeRun({ id: 'r2', taskId: 'task-b' })
      saveRun(r1)
      saveRun(r2)
      const filtered = loadRuns('task-a')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('r1')
    })

    it('returns empty array if corrupted JSON', () => {
      storage.setItem('work-history', 'not-valid-json')
      expect(loadRuns()).toEqual([])
    })
  })

  // ── saveRun ─────────────────────────────────────────────────────────────────

  describe('saveRun', () => {
    it('saves a run and can be loaded back', () => {
      const run = makeRun()
      saveRun(run)
      const runs = loadRuns()
      expect(runs).toHaveLength(1)
      expect(runs[0].id).toBe('run-1')
    })

    it('prepends new runs (newest first)', () => {
      const r1 = makeRun({ id: 'r1' })
      const r2 = makeRun({ id: 'r2' })
      saveRun(r1)
      saveRun(r2)
      const runs = loadRuns()
      expect(runs[0].id).toBe('r2')
      expect(runs[1].id).toBe('r1')
    })

    it('enforces MAX_RUNS=500 limit', () => {
      for (let i = 0; i < 510; i++) {
        saveRun(makeRun({ id: `run-${i}` }))
      }
      expect(loadRuns()).toHaveLength(500)
    })

    it('recovers from QuotaExceededError by halving the list', () => {
      // Pre-fill with 100 runs
      const existing = Array.from({ length: 100 }, (_, i) => makeRun({ id: `run-${i}` }))
      storage.setItem('work-history', JSON.stringify(existing))

      let callCount = 0
      const origSetItem = storage.setItem.bind(storage)
      storage.setItem = (key: string, val: string) => {
        callCount++
        if (callCount === 1) {
          // First setItem call throws QuotaExceededError
          const err = new DOMException('quota exceeded', 'QuotaExceededError')
          throw err
        }
        origSetItem(key, val)
      }

      // Should not throw
      expect(() => saveRun(makeRun({ id: 'new-run' }))).not.toThrow()

      // Second setItem succeeded — storage should have ~50 entries
      const saved = JSON.parse(storage._store['work-history'] ?? '[]') as WorkRun[]
      expect(saved.length).toBeLessThan(101)
      expect(saved.length).toBeGreaterThan(0)
    })

    it('silently ignores if second setItem also fails', () => {
      storage.setItem = () => {
        const err = new DOMException('quota exceeded', 'QuotaExceededError')
        throw err
      }
      expect(() => saveRun(makeRun())).not.toThrow()
    })
  })

  // ── clearHistory ────────────────────────────────────────────────────────────

  describe('clearHistory', () => {
    it('clears all runs when called without taskId', () => {
      saveRun(makeRun({ id: 'r1', taskId: 'task-a' }))
      saveRun(makeRun({ id: 'r2', taskId: 'task-b' }))
      clearHistory()
      expect(loadRuns()).toEqual([])
    })

    it('clears only runs matching taskId', () => {
      saveRun(makeRun({ id: 'r1', taskId: 'task-a' }))
      saveRun(makeRun({ id: 'r2', taskId: 'task-b' }))
      clearHistory('task-a')
      const remaining = loadRuns()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('r2')
    })

    it('does nothing when storage is empty and taskId provided', () => {
      expect(() => clearHistory('nonexistent')).not.toThrow()
      expect(loadRuns()).toEqual([])
    })
  })

  // ── getRunById ──────────────────────────────────────────────────────────────

  describe('getRunById', () => {
    it('returns run by id', () => {
      saveRun(makeRun({ id: 'unique-id' }))
      const found = getRunById('unique-id')
      expect(found).toBeDefined()
      expect(found!.id).toBe('unique-id')
    })

    it('returns undefined when not found', () => {
      expect(getRunById('missing')).toBeUndefined()
    })

    it('returns undefined when storage is empty', () => {
      expect(getRunById('any')).toBeUndefined()
    })
  })
})
