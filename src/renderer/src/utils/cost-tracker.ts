// localStorage key: 'cost-tracker-v1'
// Stored as: { entries: Array<{ date: string, usd: number, inputTokens: number, outputTokens: number }> }
// date format: 'YYYY-MM-DD'
// Max 90 days of entries (older entries get pruned automatically)

const STORAGE_KEY = 'cost-tracker-v1'
const MAX_DAYS = 90

interface CostEntry {
  date: string     // 'YYYY-MM-DD'
  usd: number
  inputTokens: number
  outputTokens: number
}

interface CostStore {
  entries: CostEntry[]
}

function getStore(): CostStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: [] }
    return JSON.parse(raw) as CostStore
  } catch {
    return { entries: [] }
  }
}

function saveStore(store: CostStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // storage full or unavailable, ignore
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function recordCost(usd: number, inputTokens = 0, outputTokens = 0): void {
  if (usd <= 0 && inputTokens <= 0) return
  const store = getStore()
  const today = todayStr()
  const existing = store.entries.find(e => e.date === today)
  if (existing) {
    existing.usd += usd
    existing.inputTokens += inputTokens
    existing.outputTokens += outputTokens
  } else {
    store.entries.push({ date: today, usd, inputTokens, outputTokens })
  }
  // Prune entries older than MAX_DAYS
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - MAX_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  store.entries = store.entries.filter(e => e.date >= cutoffStr)
  saveStore(store)
}

export function getTodayCost(): number {
  const store = getStore()
  const today = todayStr()
  return store.entries.filter(e => e.date === today).reduce((s, e) => s + e.usd, 0)
}

export function getMonthlyCost(): number {
  const store = getStore()
  const monthPrefix = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  return store.entries.filter(e => e.date.startsWith(monthPrefix)).reduce((s, e) => s + e.usd, 0)
}

export function getDailyCosts(days = 30): CostEntry[] {
  const store = getStore()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return store.entries.filter(e => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date))
}
