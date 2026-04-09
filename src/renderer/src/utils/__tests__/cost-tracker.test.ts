import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recordCost, getTodayCost, getMonthlyCost, getDailyCosts } from '../cost-tracker'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => {
  localStorageMock.clear()
  vi.restoreAllMocks()
})

describe('recordCost', () => {
  it('creates a new entry for today', () => {
    recordCost(0.01, 100, 50)
    expect(getTodayCost()).toBeCloseTo(0.01)
  })

  it('accumulates costs on the same day', () => {
    recordCost(0.01, 100, 50)
    recordCost(0.02, 200, 100)
    expect(getTodayCost()).toBeCloseTo(0.03)
  })

  it('skips recording when usd <= 0 and inputTokens <= 0', () => {
    recordCost(0, 0, 100)
    expect(getTodayCost()).toBe(0)
  })

  it('records when usd is 0 but inputTokens > 0', () => {
    recordCost(0, 500, 0)
    expect(getTodayCost()).toBe(0) // usd sum is 0
    // But an entry should exist — getDailyCosts returns it
    const entries = getDailyCosts(1)
    expect(entries.length).toBe(1)
    expect(entries[0].inputTokens).toBe(500)
  })

  it('prunes entries older than 90 days', () => {
    // Inject an old entry directly into storage
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 91)
    const oldDateStr = oldDate.toISOString().slice(0, 10)
    localStorageMock.setItem('cost-tracker-v1', JSON.stringify({
      entries: [{ date: oldDateStr, usd: 5, inputTokens: 1000, outputTokens: 500 }],
    }))

    recordCost(0.01, 100, 50)

    const all = getDailyCosts(120)
    const hasOld = all.some(e => e.date === oldDateStr)
    expect(hasOld).toBe(false)
  })
})

describe('getTodayCost', () => {
  it('returns 0 when no data', () => {
    expect(getTodayCost()).toBe(0)
  })

  it('returns sum of today entries only', () => {
    // Inject a past entry
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const todayStr = new Date().toISOString().slice(0, 10)
    localStorageMock.setItem('cost-tracker-v1', JSON.stringify({
      entries: [
        { date: yesterdayStr, usd: 1.0, inputTokens: 1000, outputTokens: 500 },
        { date: todayStr, usd: 0.05, inputTokens: 100, outputTokens: 50 },
      ],
    }))
    expect(getTodayCost()).toBeCloseTo(0.05)
  })
})

describe('getMonthlyCost', () => {
  it('returns 0 when no data', () => {
    expect(getMonthlyCost()).toBe(0)
  })

  it('sums only entries from the current month', () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const lastMonthDate = new Date()
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
    const lastMonthStr = lastMonthDate.toISOString().slice(0, 10)
    localStorageMock.setItem('cost-tracker-v1', JSON.stringify({
      entries: [
        { date: lastMonthStr, usd: 2.0, inputTokens: 2000, outputTokens: 1000 },
        { date: todayStr, usd: 0.10, inputTokens: 200, outputTokens: 100 },
      ],
    }))
    expect(getMonthlyCost()).toBeCloseTo(0.10)
  })
})

describe('getDailyCosts', () => {
  it('returns empty array when no data', () => {
    expect(getDailyCosts()).toEqual([])
  })

  it('returns entries within the requested day range', () => {
    const today = new Date()
    const d1 = new Date(today); d1.setDate(today.getDate() - 5)
    const d2 = new Date(today); d2.setDate(today.getDate() - 35)
    localStorageMock.setItem('cost-tracker-v1', JSON.stringify({
      entries: [
        { date: d1.toISOString().slice(0, 10), usd: 0.1, inputTokens: 100, outputTokens: 50 },
        { date: d2.toISOString().slice(0, 10), usd: 0.2, inputTokens: 200, outputTokens: 100 },
      ],
    }))
    const result = getDailyCosts(30)
    expect(result.length).toBe(1)
    expect(result[0].usd).toBeCloseTo(0.1)
  })

  it('returns entries sorted by date ascending', () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    localStorageMock.setItem('cost-tracker-v1', JSON.stringify({
      entries: [
        { date: today, usd: 0.02, inputTokens: 20, outputTokens: 10 },
        { date: yesterdayStr, usd: 0.01, inputTokens: 10, outputTokens: 5 },
      ],
    }))
    const result = getDailyCosts(7)
    expect(result[0].date).toBe(yesterdayStr)
    expect(result[1].date).toBe(today)
  })

  it('defaults to 30 days when called without argument', () => {
    recordCost(0.01, 100, 50)
    const result = getDailyCosts()
    expect(result.length).toBe(1)
  })

  it('handles corrupt localStorage gracefully', () => {
    localStorageMock.setItem('cost-tracker-v1', 'not-json{{{')
    expect(() => getDailyCosts()).not.toThrow()
    expect(getDailyCosts()).toEqual([])
  })
})
