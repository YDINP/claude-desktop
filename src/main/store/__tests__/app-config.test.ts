/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── electron-store mock ───────────────────────────────────────────────────────

// Shared data store (reset in beforeEach)
const storeData = new Map<string, unknown>()

vi.mock('electron-store', () => {
  class MockStore {
    constructor(opts?: { defaults?: Record<string, unknown> }) {
      if (opts?.defaults) {
        for (const [k, v] of Object.entries(opts.defaults)) {
          if (!storeData.has(k)) storeData.set(k, v)
        }
      }
    }
    get(key: string) { return storeData.get(key) }
    set(key: string, value: unknown) { storeData.set(key, value) }
  }
  return { default: MockStore }
})

vi.mock('../../../shared/feature-types', () => {
  const DEFAULT_FEATURES = {
    'group.layout': true,
    'group.chat': true,
    'group.sidebar': true,
    'group.cc': true,
    hqMode: true,
    terminal: true,
    webPreview: true,
    splitView: true,
    sessionFork: true,
    sessionExport: true,
    contextCompress: true,
    autoResume: true,
    voiceInput: false,
    plugins: true,
    connections: true,
    outline: true,
    stats: true,
    sceneview: true,
    git: true,
    'cc.assetBrowser': true,
    'cc.buildTab': true,
    'cc.groupPanel': true,
    'cc.backupManager': true,
    'cc.batchInspector': true,
    'cc.sceneValidation': true,
  }
  return { DEFAULT_FEATURES, FeatureGroup: undefined, FEATURE_GROUP_MAP: {} }
})

import { AppConfig } from '../app-config'

// ── Setup ─────────────────────────────────────────────────────────────────────

// Reset singleton and store before each test
beforeEach(() => {
  storeData.clear()
  // @ts-expect-error private
  AppConfig.instance = undefined
})

function getInstance() {
  return AppConfig.getInstance()
}

// ── Singleton ─────────────────────────────────────────────────────────────────

describe('AppConfig.getInstance', () => {
  it('returns the same instance on repeated calls', () => {
    const a = getInstance()
    const b = getInstance()
    expect(a).toBe(b)
  })
})

// ── anthropicApiKey ───────────────────────────────────────────────────────────

describe('getAnthropicApiKey / setAnthropicApiKey', () => {
  it('returns empty string by default', () => {
    expect(getInstance().getAnthropicApiKey()).toBe('')
  })

  it('stores and retrieves the key', () => {
    const cfg = getInstance()
    cfg.setAnthropicApiKey('sk-ant-test-key')
    expect(cfg.getAnthropicApiKey()).toBe('sk-ant-test-key')
  })

  it('overwrites a previous key', () => {
    const cfg = getInstance()
    cfg.setAnthropicApiKey('key-first')
    cfg.setAnthropicApiKey('key-second')
    expect(cfg.getAnthropicApiKey()).toBe('key-second')
  })

  it('stores empty string when cleared', () => {
    const cfg = getInstance()
    cfg.setAnthropicApiKey('sk-ant-test-key')
    cfg.setAnthropicApiKey('')
    expect(cfg.getAnthropicApiKey()).toBe('')
  })
})

// ── feature flags ─────────────────────────────────────────────────────────────

describe('getFeatures / setFeature', () => {
  it('returns DEFAULT_FEATURES when nothing set', () => {
    const features = getInstance().getFeatures()
    expect(features.terminal).toBe(true)
    expect(features.voiceInput).toBe(false)
  })

  it('setFeature(key, false) disables a flag', () => {
    const cfg = getInstance()
    cfg.setFeature('terminal', false)
    expect(cfg.getFeatures().terminal).toBe(false)
  })

  it('setFeature(key, true) enables a flag', () => {
    const cfg = getInstance()
    cfg.setFeature('voiceInput', true)
    expect(cfg.getFeatures().voiceInput).toBe(true)
  })

  it('changing one flag does not affect others', () => {
    const cfg = getInstance()
    cfg.setFeature('terminal', false)
    const features = cfg.getFeatures()
    expect(features.plugins).toBe(true)
    expect(features.hqMode).toBe(true)
  })

  it('merges with DEFAULT_FEATURES (sparse store)', () => {
    // Simulate store having only one key (no full featureFlags object yet)
    const cfg = getInstance()
    cfg.setFeature('splitView', false)
    const features = cfg.getFeatures()
    // voiceInput default is false from DEFAULT_FEATURES
    expect(features.voiceInput).toBe(false)
    expect(features.splitView).toBe(false)
  })
})

// ── fontSize clamping ─────────────────────────────────────────────────────────

describe('fontSize clamping', () => {
  it('returns default 13', () => {
    expect(getInstance().getFontSize()).toBe(13)
  })

  it('clamps below minimum to 12', () => {
    const cfg = getInstance()
    cfg.setFontSize(8)
    expect(cfg.getFontSize()).toBe(12)
  })

  it('clamps above maximum to 18', () => {
    const cfg = getInstance()
    cfg.setFontSize(999)
    expect(cfg.getFontSize()).toBe(18)
  })

  it('accepts valid value in range', () => {
    const cfg = getInstance()
    cfg.setFontSize(15)
    expect(cfg.getFontSize()).toBe(15)
  })
})

// ── temperature clamping ──────────────────────────────────────────────────────

describe('temperature clamping', () => {
  it('returns default 1.0', () => {
    expect(getInstance().getTemperature()).toBe(1.0)
  })

  it('clamps to 0 minimum', () => {
    const cfg = getInstance()
    cfg.setTemperature(-1)
    expect(cfg.getTemperature()).toBe(0)
  })

  it('clamps to 1 maximum', () => {
    const cfg = getInstance()
    cfg.setTemperature(2)
    expect(cfg.getTemperature()).toBe(1)
  })

  it('accepts 0.5', () => {
    const cfg = getInstance()
    cfg.setTemperature(0.5)
    expect(cfg.getTemperature()).toBe(0.5)
  })
})

// ── recentFiles ───────────────────────────────────────────────────────────────

describe('recentFiles', () => {
  it('returns [] by default', () => {
    expect(getInstance().getRecentFiles()).toEqual([])
  })

  it('adds a file to front', () => {
    const cfg = getInstance()
    cfg.addRecentFile('/path/a.ts')
    cfg.addRecentFile('/path/b.ts')
    expect(cfg.getRecentFiles()[0]).toBe('/path/b.ts')
  })

  it('deduplicates: re-added file moves to front', () => {
    const cfg = getInstance()
    cfg.addRecentFile('/path/a.ts')
    cfg.addRecentFile('/path/b.ts')
    cfg.addRecentFile('/path/a.ts')
    const files = cfg.getRecentFiles()
    expect(files[0]).toBe('/path/a.ts')
    expect(files.filter(f => f === '/path/a.ts')).toHaveLength(1)
  })

  it('caps at 15 entries', () => {
    const cfg = getInstance()
    for (let i = 0; i < 20; i++) cfg.addRecentFile(`/path/file${i}.ts`)
    expect(cfg.getRecentFiles().length).toBeLessThanOrEqual(15)
  })

  it('clearRecentFiles empties the list', () => {
    const cfg = getInstance()
    cfg.addRecentFile('/path/a.ts')
    cfg.clearRecentFiles()
    expect(cfg.getRecentFiles()).toEqual([])
  })
})

// ── favoriteFiles ─────────────────────────────────────────────────────────────

describe('favoriteFiles', () => {
  it('returns [] by default', () => {
    expect(getInstance().getFavoriteFiles()).toEqual([])
  })

  it('adds a favorite', () => {
    const cfg = getInstance()
    cfg.addFavoriteFile('/fav/file.ts')
    expect(cfg.getFavoriteFiles()).toContain('/fav/file.ts')
  })

  it('does not duplicate favorites', () => {
    const cfg = getInstance()
    cfg.addFavoriteFile('/fav/file.ts')
    cfg.addFavoriteFile('/fav/file.ts')
    expect(cfg.getFavoriteFiles().filter(f => f === '/fav/file.ts')).toHaveLength(1)
  })

  it('removes a favorite', () => {
    const cfg = getInstance()
    cfg.addFavoriteFile('/fav/file.ts')
    cfg.removeFavoriteFile('/fav/file.ts')
    expect(cfg.getFavoriteFiles()).not.toContain('/fav/file.ts')
  })
})

// ── projectSystemPrompt ───────────────────────────────────────────────────────

describe('projectSystemPrompt', () => {
  it('returns empty string for unknown project', () => {
    expect(getInstance().getProjectSystemPrompt('/some/path')).toBe('')
  })

  it('stores and retrieves prompt by path', () => {
    const cfg = getInstance()
    cfg.setProjectSystemPrompt('/my/project', 'You are a helpful assistant.')
    expect(cfg.getProjectSystemPrompt('/my/project')).toBe('You are a helpful assistant.')
  })

  it('deletes prompt when set to whitespace', () => {
    const cfg = getInstance()
    cfg.setProjectSystemPrompt('/my/project', 'Initial prompt')
    cfg.setProjectSystemPrompt('/my/project', '   ')
    expect(cfg.getProjectSystemPrompt('/my/project')).toBe('')
  })

  it('deletes prompt when set to empty string', () => {
    const cfg = getInstance()
    cfg.setProjectSystemPrompt('/my/project', 'Initial prompt')
    cfg.setProjectSystemPrompt('/my/project', '')
    expect(cfg.getProjectSystemPrompt('/my/project')).toBe('')
  })

  it('keeps other project prompts intact', () => {
    const cfg = getInstance()
    cfg.setProjectSystemPrompt('/proj/a', 'Prompt A')
    cfg.setProjectSystemPrompt('/proj/b', 'Prompt B')
    cfg.setProjectSystemPrompt('/proj/a', '')
    expect(cfg.getProjectSystemPrompt('/proj/b')).toBe('Prompt B')
  })
})

// ── promptTemplates ───────────────────────────────────────────────────────────

describe('promptTemplates', () => {
  it('returns [] by default', () => {
    expect(getInstance().getPromptTemplates()).toEqual([])
  })

  it('saves and retrieves a template', () => {
    const cfg = getInstance()
    cfg.savePromptTemplate({ id: 't1', name: 'Template 1', prompt: 'Hello' })
    expect(cfg.getPromptTemplates()).toHaveLength(1)
    expect(cfg.getPromptTemplates()[0].id).toBe('t1')
  })

  it('upserts: updating same id replaces it', () => {
    const cfg = getInstance()
    cfg.savePromptTemplate({ id: 't1', name: 'Old', prompt: 'Old prompt' })
    cfg.savePromptTemplate({ id: 't1', name: 'New', prompt: 'New prompt' })
    const templates = cfg.getPromptTemplates()
    expect(templates).toHaveLength(1)
    expect(templates[0].name).toBe('New')
  })

  it('adds new template at front', () => {
    const cfg = getInstance()
    cfg.savePromptTemplate({ id: 't1', name: 'First', prompt: 'A' })
    cfg.savePromptTemplate({ id: 't2', name: 'Second', prompt: 'B' })
    expect(cfg.getPromptTemplates()[0].id).toBe('t2')
  })

  it('deletes a template by id', () => {
    const cfg = getInstance()
    cfg.savePromptTemplate({ id: 't1', name: 'To delete', prompt: '' })
    cfg.savePromptTemplate({ id: 't2', name: 'Keep', prompt: '' })
    cfg.deletePromptTemplate('t1')
    const ids = cfg.getPromptTemplates().map(t => t.id)
    expect(ids).not.toContain('t1')
    expect(ids).toContain('t2')
  })
})
