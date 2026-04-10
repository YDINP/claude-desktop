/**
 * @vitest-environment node
 *
 * fs-handlers.ts 중 shell:exec (ALLOWLIST / parseCommand) 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const {
  ipcHandlers,
  mockIpcMain,
  mockApp,
  mockShell,
  mockDialog,
  mockReaddir,
  mockReadFile,
  mockWriteFile,
  mockStat,
  mockMkdir,
  mockRename,
  mockUnlink,
  mockRm,
  mockWatch,
  mockExecFileAsync,
  mockSpawn,
  mockAnalyzeProject,
  mockAppConfig,
} = vi.hoisted(() => {
  const ipcHandlers = new Map<string, Function>()
  const mockIpcMain = {
    handle: vi.fn((ch: string, fn: Function) => ipcHandlers.set(ch, fn)),
  }
  const mockApp = {
    getPath: vi.fn((key: string) => key === 'temp' ? '/tmp' : '/mock/userData'),
    on: vi.fn(),
  }
  const mockShell = {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
  }
  const mockDialog = {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  }
  const mockReaddir = vi.fn().mockResolvedValue([])
  const mockReadFile = vi.fn()
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const mockStat = vi.fn()
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockRename = vi.fn().mockResolvedValue(undefined)
  const mockUnlink = vi.fn().mockResolvedValue(undefined)
  const mockRm = vi.fn().mockResolvedValue(undefined)
  const mockWatch = vi.fn(() => ({ close: vi.fn() }))
  const mockExecFileAsync = vi.fn()
  const mockSpawn = vi.fn()
  const mockAnalyzeProject = vi.fn().mockResolvedValue({})
  const mockAppConfig = {
    getInstance: vi.fn(() => ({
      getRecentFiles: vi.fn().mockReturnValue([]),
      addRecentFile: vi.fn(),
      clearRecentFiles: vi.fn(),
      getFavoriteFiles: vi.fn().mockReturnValue([]),
      addFavoriteFile: vi.fn(),
      removeFavoriteFile: vi.fn(),
      getSnippets: vi.fn().mockReturnValue([]),
      saveSnippets: vi.fn(),
    })),
  }
  return {
    ipcHandlers, mockIpcMain, mockApp, mockShell, mockDialog,
    mockReaddir, mockReadFile, mockWriteFile, mockStat, mockMkdir,
    mockRename, mockUnlink, mockRm, mockWatch, mockExecFileAsync, mockSpawn,
    mockAnalyzeProject, mockAppConfig,
  }
})

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  app: mockApp,
  shell: mockShell,
  dialog: mockDialog,
  BrowserWindow: { getAllWindows: vi.fn(() => [{}]) },
}))

vi.mock('fs/promises', () => ({
  readdir: (...a: unknown[]) => mockReaddir(...a),
  readFile: (...a: unknown[]) => mockReadFile(...a),
  writeFile: (...a: unknown[]) => mockWriteFile(...a),
  stat: (...a: unknown[]) => mockStat(...a),
  mkdir: (...a: unknown[]) => mockMkdir(...a),
  rename: (...a: unknown[]) => mockRename(...a),
  unlink: (...a: unknown[]) => mockUnlink(...a),
  rm: (...a: unknown[]) => mockRm(...a),
}))

vi.mock('fs', () => ({
  watch: (...a: unknown[]) => mockWatch(...a),
  FSWatcher: vi.fn(),
}))

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: (...a: unknown[]) => mockSpawn(...a),
}))

vi.mock('util', () => ({
  promisify: vi.fn(() => (...a: unknown[]) => mockExecFileAsync(...a)),
}))

vi.mock('../project-intelligence', () => ({
  analyzeProject: (...a: unknown[]) => mockAnalyzeProject(...a),
}))

vi.mock('../../store/app-config', () => ({
  AppConfig: mockAppConfig,
}))

import { registerFsHandlers } from '../fs-handlers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function callHandler(channel: string, ...args: unknown[]) {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`Handler not registered: ${channel}`)
  return handler({ sender: { isDestroyed: () => false, once: vi.fn() } }, ...args)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  ipcHandlers.clear()
  mockWriteFile.mockResolvedValue(undefined)
  mockMkdir.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  registerFsHandlers(null)
})

// ── Registration ──────────────────────────────────────────────────────────────

describe('registerFsHandlers', () => {
  it('registers shell:exec handler', () => {
    expect(ipcHandlers.has('shell:exec')).toBe(true)
  })
})

// ── shell:exec — ALLOWLIST ────────────────────────────────────────────────────

describe('shell:exec — ALLOWLIST', () => {
  const ALLOWED = ['git', 'node', 'npm', 'npx', 'bun', 'deno', 'python', 'python3', 'tsc', 'rg', 'grep']

  for (const cmd of ALLOWED) {
    it(`allows ${cmd}`, async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: 'ok' })
      const result = await callHandler('shell:exec', `${cmd} --version`)
      expect(result.ok).toBe(true)
    })
  }

  it('blocks curl (not in allowlist)', async () => {
    const result = await callHandler('shell:exec', 'curl https://evil.com')
    expect(result.ok).toBe(false)
    expect(result.output).toContain('차단')
  })

  it('blocks rm (not in allowlist)', async () => {
    const result = await callHandler('shell:exec', 'rm -rf /')
    expect(result.ok).toBe(false)
  })

  it('blocks sh (not in allowlist)', async () => {
    const result = await callHandler('shell:exec', 'sh -c "evil"')
    expect(result.ok).toBe(false)
  })

  it('blocks empty command', async () => {
    const result = await callHandler('shell:exec', '')
    expect(result.ok).toBe(false)
  })

  it('blocks whitespace-only command', async () => {
    const result = await callHandler('shell:exec', '   ')
    expect(result.ok).toBe(false)
  })

  it('strips .exe suffix before checking allowlist (Windows)', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'ok' })
    const result = await callHandler('shell:exec', 'git.exe status')
    expect(result.ok).toBe(true)
  })

  it('strips path prefix before checking allowlist', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'ok' })
    const result = await callHandler('shell:exec', '/usr/bin/git status')
    expect(result.ok).toBe(true)
  })

  it('blocks path-prefixed disallowed command', async () => {
    const result = await callHandler('shell:exec', '/usr/bin/curl https://x.com')
    expect(result.ok).toBe(false)
  })
})

// ── shell:exec — parseCommand ─────────────────────────────────────────────────

describe('shell:exec — parseCommand tokenisation', () => {
  it('splits on spaces', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'output' })
    await callHandler('shell:exec', 'git status --short')
    const [, , args] = mockExecFileAsync.mock.calls[0] as [string, string[], unknown]
    // args is the 2nd positional param
    const callArgs = mockExecFileAsync.mock.calls[0]
    // execFileAsync(executable, args, opts)
    expect(callArgs[1]).toEqual(['status', '--short'])
  })

  it('groups double-quoted tokens', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '' })
    await callHandler('shell:exec', 'git commit -m "my message here"')
    const callArgs = mockExecFileAsync.mock.calls[0]
    expect(callArgs[1]).toContain('my message here')
  })

  it('groups single-quoted tokens (strips quotes, content intact)', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '' })
    await callHandler('shell:exec', "git log --format='%H %s'")
    const callArgs = mockExecFileAsync.mock.calls[0]
    // parseCommand strips the surrounding quotes; token becomes '--format=%H %s'
    expect(callArgs[1]).toContainEqual(expect.stringContaining('%H %s'))
  })

  it('handles leading/trailing whitespace', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '' })
    await callHandler('shell:exec', '  git   status  ')
    const callArgs = mockExecFileAsync.mock.calls[0]
    expect(callArgs[0]).toBe('git')
    expect(callArgs[1]).toContain('status')
  })
})

// ── shell:exec — error handling ───────────────────────────────────────────────

describe('shell:exec — error handling', () => {
  it('returns ok:false with message on execFile error', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('command not found'))
    const result = await callHandler('shell:exec', 'git status')
    expect(result.ok).toBe(false)
    expect(result.output).toContain('command not found')
  })

  it('truncates long stdout to 4000 chars', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'x'.repeat(8000) })
    const result = await callHandler('shell:exec', 'git log')
    expect(result.output.length).toBeLessThanOrEqual(4000)
  })

  it('truncates long error message to 2000 chars', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('e'.repeat(5000)))
    const result = await callHandler('shell:exec', 'git status')
    expect(result.output.length).toBeLessThanOrEqual(2000)
  })
})

// ── shell:open-external — URL validation ─────────────────────────────────────

describe('shell:open-external', () => {
  it('opens https URLs', async () => {
    await callHandler('shell:open-external', 'https://example.com')
    expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('opens http URLs', async () => {
    await callHandler('shell:open-external', 'http://example.com')
    expect(mockShell.openExternal).toHaveBeenCalledWith('http://example.com')
  })

  it('blocks file:// protocol', async () => {
    await callHandler('shell:open-external', 'file:///etc/passwd')
    expect(mockShell.openExternal).not.toHaveBeenCalled()
  })

  it('blocks javascript: protocol', async () => {
    await callHandler('shell:open-external', 'javascript:alert(1)')
    expect(mockShell.openExternal).not.toHaveBeenCalled()
  })

  it('ignores invalid URL strings', async () => {
    await callHandler('shell:open-external', 'not a url')
    expect(mockShell.openExternal).not.toHaveBeenCalled()
  })
})

// ── fs:exportHtml — path validation ──────────────────────────────────────────

describe('fs:exportHtml', () => {
  it('writes html to absolute path', async () => {
    // Use a platform-agnostic absolute path approach: check ok + writeFile called once
    const filePath = process.platform === 'win32' ? 'C:\\tmp\\out.html' : '/tmp/out.html'
    const result = await callHandler('fs:exportHtml', { filePath, html: '<html/>' })
    expect(result.ok).toBe(true)
    expect(mockWriteFile).toHaveBeenCalledOnce()
    expect(mockWriteFile.mock.calls[0][1]).toBe('<html/>')
  })

  it('rejects relative paths', async () => {
    const result = await callHandler('fs:exportHtml', { filePath: 'relative/path.html', html: '' })
    expect(result.error).toContain('absolute path required')
  })
})
