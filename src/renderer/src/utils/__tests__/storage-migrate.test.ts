import { describe, it, expect, beforeEach } from 'vitest'
import { runStorageMigration } from '../storage-migrate'

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

// ── tests ─────────────────────────────────────────────────────────────────────

describe('runStorageMigration', () => {
  let storage: ReturnType<typeof makeLocalStorage>

  beforeEach(() => {
    storage = makeLocalStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
  })

  it('sets migration done flag after running', () => {
    runStorageMigration()
    expect(localStorage.getItem('cd-storage-migrated-v1')).toBe('1')
  })

  it('migrates sv-locked-uuids → cd-sv-locked-nodes', () => {
    localStorage.setItem('sv-locked-uuids', '["node1"]')
    runStorageMigration()
    expect(localStorage.getItem('cd-sv-locked-nodes')).toBe('["node1"]')
    expect(localStorage.getItem('sv-locked-uuids')).toBeNull()
  })

  it('migrates all defined key pairs', () => {
    const pairs = [
      { from: 'sv-locked-uuids',        to: 'cd-sv-locked-nodes' },
      { from: 'scene-locked',           to: 'cd-scene-locked' },
      { from: 'cc-pinned-nodes',        to: 'cd-cc-pinned' },
      { from: 'scene-pinned',           to: 'cd-scene-pinned' },
      { from: 'searchHistory',          to: 'cd-search-history' },
      { from: 'smart-input',            to: 'cd-smart-input' },
      { from: 'settings:openaiApiKey',  to: 'cd-settings-openai-key' },
    ]
    for (const { from } of pairs) localStorage.setItem(from, `value:${from}`)

    runStorageMigration()

    for (const { from, to } of pairs) {
      expect(localStorage.getItem(to)).toBe(`value:${from}`)
      expect(localStorage.getItem(from)).toBeNull()
    }
  })

  it('does not run again if migration done flag is set', () => {
    localStorage.setItem('cd-storage-migrated-v1', '1')
    localStorage.setItem('sv-locked-uuids', 'old-data')

    runStorageMigration()

    // old key should remain untouched because migration was skipped
    expect(localStorage.getItem('sv-locked-uuids')).toBe('old-data')
    expect(localStorage.getItem('cd-sv-locked-nodes')).toBeNull()
  })

  it('does not overwrite existing new-key data with old-key data', () => {
    localStorage.setItem('sv-locked-uuids', 'old-value')
    localStorage.setItem('cd-sv-locked-nodes', 'already-set')

    runStorageMigration()

    expect(localStorage.getItem('cd-sv-locked-nodes')).toBe('already-set')
    // old key is still removed
    expect(localStorage.getItem('sv-locked-uuids')).toBeNull()
  })

  it('skips keys that do not exist in storage', () => {
    // no old keys present
    runStorageMigration()
    expect(localStorage.getItem('cd-sv-locked-nodes')).toBeNull()
    expect(localStorage.getItem('cd-scene-locked')).toBeNull()
  })

  it('preserves old key data value exactly', () => {
    const json = JSON.stringify({ complex: true, list: [1, 2, 3] })
    localStorage.setItem('smart-input', json)

    runStorageMigration()

    expect(localStorage.getItem('cd-smart-input')).toBe(json)
  })
})
