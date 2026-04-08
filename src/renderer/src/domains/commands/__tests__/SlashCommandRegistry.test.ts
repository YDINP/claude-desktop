import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Must re-import after each reset to get a fresh singleton.
// Since SlashCommandRegistry is a module-level singleton, we use resetModules.
let SlashCommandRegistry: typeof import('../SlashCommandRegistry').SlashCommandRegistry
let SlashCommandDef: typeof import('../SlashCommandRegistry').SlashCommandDef

async function freshRegistry() {
  vi.resetModules()
  localStorageMock.clear()
  const mod = await import('../SlashCommandRegistry')
  SlashCommandRegistry = mod.SlashCommandRegistry
  return SlashCommandRegistry
}

describe('SlashCommandRegistry', () => {
  beforeEach(async () => {
    await freshRegistry()
  })

  describe('filterCompat', () => {
    it('should return all commands when query is empty', () => {
      const results = SlashCommandRegistry.filterCompat('')

      // Should include all builtins at minimum
      expect(results.length).toBeGreaterThan(0)
      // Every result should have required compat fields
      for (const r of results) {
        expect(r).toHaveProperty('cmd')
        expect(r).toHaveProperty('label')
        expect(r).toHaveProperty('description')
        expect(r).toHaveProperty('prompt')
      }
    })

    it('should filter by cmd prefix', () => {
      const results = SlashCommandRegistry.filterCompat('fi')

      expect(results.every(r => r.cmd.startsWith('fi'))).toBe(true)
      expect(results.some(r => r.cmd === 'fix')).toBe(true)
    })

    it('should return empty for non-matching prefix', () => {
      const results = SlashCommandRegistry.filterCompat('zzz')
      expect(results).toHaveLength(0)
    })

    it('should be case-insensitive', () => {
      const results = SlashCommandRegistry.filterCompat('FIX')
      expect(results.some(r => r.cmd === 'fix')).toBe(true)
    })

    it('should include custom commands in filter results', () => {
      SlashCommandRegistry.setCustoms([
        { cmd: 'my-cmd', label: '/my-cmd', description: 'custom', category: 'custom', prompt: 'hello' },
      ])

      const results = SlashCommandRegistry.filterCompat('my')
      expect(results.some(r => r.cmd === 'my-cmd')).toBe(true)
    })

    it('should include workflow commands in filter results', () => {
      SlashCommandRegistry.setWorkflows([
        { cmd: 'deploy', label: '/deploy', description: 'deploy workflow', category: 'workflow', workflowPath: '/path/deploy.md' },
      ])

      const results = SlashCommandRegistry.filterCompat('dep')
      expect(results.some(r => r.cmd === 'deploy')).toBe(true)
    })
  })

  describe('recordUsage + getRecentCmds', () => {
    it('should record usage and return recent commands', () => {
      SlashCommandRegistry.recordUsage('fix')
      SlashCommandRegistry.recordUsage('review')

      const recent = SlashCommandRegistry.getRecentCmds()
      expect(recent).toEqual(['review', 'fix'])
    })

    it('should move re-used command to the front', () => {
      SlashCommandRegistry.recordUsage('fix')
      SlashCommandRegistry.recordUsage('review')
      SlashCommandRegistry.recordUsage('fix')

      const recent = SlashCommandRegistry.getRecentCmds()
      expect(recent[0]).toBe('fix')
      expect(recent[1]).toBe('review')
    })

    it('should persist to localStorage', () => {
      SlashCommandRegistry.recordUsage('test')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'slash-recent-commands',
        expect.any(String)
      )
      const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1])
      expect(stored).toContain('test')
    })

    it('should limit to MAX_RECENT (10) entries', () => {
      for (let i = 0; i < 15; i++) {
        SlashCommandRegistry.recordUsage(`cmd-${i}`)
      }

      const recent = SlashCommandRegistry.getRecentCmds()
      expect(recent).toHaveLength(10)
      // Most recent should be first
      expect(recent[0]).toBe('cmd-14')
    })

    it('should sort filter results by recent usage', () => {
      SlashCommandRegistry.recordUsage('review')
      SlashCommandRegistry.recordUsage('refactor')

      const results = SlashCommandRegistry.filterCompat('re')
      // 'refactor' should come before 'review' (more recent)
      const refactorIdx = results.findIndex(r => r.cmd === 'refactor')
      const reviewIdx = results.findIndex(r => r.cmd === 'review')
      expect(refactorIdx).toBeLessThan(reviewIdx)
    })
  })

  describe('getGrouped', () => {
    it('should group commands by category', () => {
      SlashCommandRegistry.setCustoms([
        { cmd: 'my-custom', label: '/my-custom', description: 'custom cmd', category: 'custom', prompt: '' },
      ])

      const allCompat = SlashCommandRegistry.getAllCompat()
      const groups = SlashCommandRegistry.getGrouped(allCompat)

      expect(groups.length).toBeGreaterThanOrEqual(1)
      const builtinGroup = groups.find(g => g.category === 'builtin')
      expect(builtinGroup).toBeDefined()
      expect(builtinGroup!.commands.length).toBeGreaterThan(0)

      const customGroup = groups.find(g => g.category === 'custom')
      expect(customGroup).toBeDefined()
      expect(customGroup!.commands.some(c => c.cmd === 'my-custom')).toBe(true)
    })

    it('should sort groups by category order (builtin first)', () => {
      SlashCommandRegistry.setWorkflows([
        { cmd: 'wf-1', label: '/wf-1', description: 'wf', category: 'workflow' },
      ])
      SlashCommandRegistry.setCustoms([
        { cmd: 'cs-1', label: '/cs-1', description: 'cs', category: 'custom', prompt: '' },
      ])

      const allCompat = SlashCommandRegistry.getAllCompat()
      const groups = SlashCommandRegistry.getGrouped(allCompat)
      const categories = groups.map(g => g.category)

      // builtin < workflow < custom
      if (categories.includes('builtin') && categories.includes('workflow')) {
        expect(categories.indexOf('builtin')).toBeLessThan(categories.indexOf('workflow'))
      }
      if (categories.includes('workflow') && categories.includes('custom')) {
        expect(categories.indexOf('workflow')).toBeLessThan(categories.indexOf('custom'))
      }
    })

    it('should include label and icon for each group', () => {
      const allCompat = SlashCommandRegistry.getAllCompat()
      const groups = SlashCommandRegistry.getGrouped(allCompat)

      for (const g of groups) {
        expect(g.label).toBeTruthy()
        expect(typeof g.icon).toBe('string')
      }
    })

    it('should handle empty command list', () => {
      const groups = SlashCommandRegistry.getGrouped([])
      expect(groups).toHaveLength(0)
    })
  })

  describe('setWorkflows / setCustoms', () => {
    it('should register workflow commands', () => {
      SlashCommandRegistry.setWorkflows([
        { cmd: 'build-ios', label: '/build-ios', description: 'Build for iOS', category: 'workflow', workflowPath: '/workflows/ios.md' },
      ])

      const found = SlashCommandRegistry.filterCompat('build-i')
      expect(found).toHaveLength(1)
      expect(found[0].cmd).toBe('build-ios')
      expect(found[0].workflowPath).toBe('/workflows/ios.md')
    })

    it('should replace previous custom commands', () => {
      SlashCommandRegistry.setCustoms([
        { cmd: 'old-cmd', label: '/old-cmd', description: 'old', category: 'custom', prompt: '' },
      ])

      SlashCommandRegistry.setCustoms([
        { cmd: 'new-cmd', label: '/new-cmd', description: 'new', category: 'custom', prompt: '' },
      ])

      const oldResults = SlashCommandRegistry.filterCompat('old')
      const newResults = SlashCommandRegistry.filterCompat('new')
      expect(oldResults).toHaveLength(0)
      expect(newResults).toHaveLength(1)
    })

    it('should mark custom commands with isCustom=true in compat', () => {
      SlashCommandRegistry.setCustoms([
        { cmd: 'custom-test', label: '/custom-test', description: 'test', category: 'custom', prompt: '' },
      ])

      const compat = SlashCommandRegistry.filterCompat('custom-test')
      expect(compat[0].isCustom).toBe(true)
    })

    it('should not mark builtin commands with isCustom', () => {
      const compat = SlashCommandRegistry.filterCompat('fix')
      expect(compat[0].isCustom).toBe(false)
    })
  })

  describe('find', () => {
    it('should find command by exact name', () => {
      const result = SlashCommandRegistry.find('fix')
      expect(result).toBeDefined()
      expect(result!.cmd).toBe('fix')
    })

    it('should return undefined for unknown command', () => {
      const result = SlashCommandRegistry.find('nonexistent')
      expect(result).toBeUndefined()
    })

    it('should be case-insensitive', () => {
      const result = SlashCommandRegistry.find('FIX')
      expect(result).toBeDefined()
    })
  })

  describe('getArgHint', () => {
    it('should return empty string for commands without args', () => {
      expect(SlashCommandRegistry.getArgHint('fix')).toBe('')
    })

    it('should return hint for commands with defined args', () => {
      SlashCommandRegistry.setCustoms([{
        cmd: 'my-translate',
        label: '/my-translate',
        description: 'Translate text',
        category: 'custom',
        prompt: '',
        args: [
          { name: 'lang', description: 'Target language', required: true },
          { name: 'style', description: 'Translation style', required: false },
        ],
      }])

      const hint = SlashCommandRegistry.getArgHint('my-translate')
      expect(hint).toContain('<lang>')
      expect(hint).toContain('[style]')
    })
  })
})
