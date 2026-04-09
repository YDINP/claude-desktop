import { describe, it, expect, beforeEach } from 'vitest'
import { recordCommand, getTopCommands } from '../command-learner'

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

describe('command-learner', () => {
  beforeEach(() => {
    const storage = makeLocalStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
  })

  // ── SENSITIVE_PATTERNS filter ───────────────────────────────────────────────

  describe('SENSITIVE_PATTERNS filter', () => {
    it('does not record command containing "password"', () => {
      recordCommand('set password=abc123')
      expect(getTopCommands()).toEqual([])
    })

    it('does not record command containing "passwd"', () => {
      recordCommand('passwd mypasswd')
      expect(getTopCommands()).toEqual([])
    })

    it('does not record command containing "secret"', () => {
      recordCommand('export SECRET=xyz')
      expect(getTopCommands()).toEqual([])
    })

    it('does not record command containing "token"', () => {
      recordCommand('curl -H "Authorization: token abc"')
      expect(getTopCommands()).toEqual([])
    })

    it('does not record command containing "key"', () => {
      recordCommand('apikey=12345')
      expect(getTopCommands()).toEqual([])
    })

    it('does not record command with -p followed by space', () => {
      recordCommand('mysql -p mydb')
      expect(getTopCommands()).toEqual([])
    })

    it('records safe commands that do not match sensitive patterns', () => {
      recordCommand('git status')
      expect(getTopCommands()).toContain('git status')
    })
  })

  // ── recordCommand ───────────────────────────────────────────────────────────

  describe('recordCommand', () => {
    it('ignores empty string', () => {
      recordCommand('')
      expect(getTopCommands()).toEqual([])
    })

    it('ignores whitespace-only string', () => {
      recordCommand('   ')
      expect(getTopCommands()).toEqual([])
    })

    it('ignores single-char command', () => {
      recordCommand('x')
      expect(getTopCommands()).toEqual([])
    })

    it('trims whitespace before saving', () => {
      recordCommand('  git log  ')
      expect(getTopCommands()).toContain('git log')
    })

    it('strips trailing newline', () => {
      recordCommand('git diff\n')
      expect(getTopCommands()).toContain('git diff')
    })

    it('increments count on duplicate command', () => {
      recordCommand('ls -la')
      recordCommand('ls -la')
      recordCommand('ls -la')
      // Should appear once with count 3, still in top
      const top = getTopCommands(1)
      expect(top).toEqual(['ls -la'])
    })

    it('ranks more frequent commands higher', () => {
      recordCommand('npm install')
      recordCommand('git status')
      recordCommand('git status')
      recordCommand('git status')
      const top = getTopCommands(1)
      expect(top[0]).toBe('git status')
    })

    it('enforces MAX_HISTORY=200 limit', () => {
      for (let i = 0; i < 210; i++) {
        recordCommand(`command-${i}`)
      }
      const raw = localStorage.getItem('terminalCmdHistory')
      const stats = JSON.parse(raw!)
      expect(stats.length).toBeLessThanOrEqual(200)
    })
  })

  // ── getTopCommands ──────────────────────────────────────────────────────────

  describe('getTopCommands', () => {
    it('returns empty array when history is empty', () => {
      expect(getTopCommands()).toEqual([])
    })

    it('returns top N commands by default n=5', () => {
      for (let i = 0; i < 8; i++) recordCommand(`cmd-${i}`)
      expect(getTopCommands()).toHaveLength(5)
    })

    it('returns fewer than n if not enough history', () => {
      recordCommand('only-cmd')
      expect(getTopCommands(10)).toHaveLength(1)
    })

    it('returns commands sorted by count descending', () => {
      recordCommand('rare')
      recordCommand('frequent')
      recordCommand('frequent')
      const top = getTopCommands(2)
      expect(top[0]).toBe('frequent')
      expect(top[1]).toBe('rare')
    })

    it('handles corrupted storage gracefully', () => {
      localStorage.setItem('terminalCmdHistory', '{bad json}')
      expect(getTopCommands()).toEqual([])
    })
  })
})
