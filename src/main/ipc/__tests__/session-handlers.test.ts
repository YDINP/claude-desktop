/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const {
  ipcHandlers,
  mockIpcMain,
  mockBrowserWindow,
  mockDialog,
  mockReadFile,
  mockWriteFile,
  mockReaddir,
  mockMkdir,
  mockUnlink,
  mockAccess,
  mockRename,
} = vi.hoisted(() => {
  const ipcHandlers = new Map<string, Function>()
  const mockIpcMain = {
    handle: vi.fn((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler)
    }),
  }
  const mockBrowserWindow = { getAllWindows: vi.fn(() => [{}]) }
  const mockDialog = { showSaveDialog: vi.fn() }
  const mockReadFile = vi.fn()
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const mockReaddir = vi.fn()
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockUnlink = vi.fn().mockResolvedValue(undefined)
  const mockAccess = vi.fn()
  const mockRename = vi.fn().mockResolvedValue(undefined)
  return {
    ipcHandlers,
    mockIpcMain,
    mockBrowserWindow,
    mockDialog,
    mockReadFile,
    mockWriteFile,
    mockReaddir,
    mockMkdir,
    mockUnlink,
    mockAccess,
    mockRename,
  }
})

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
  BrowserWindow: mockBrowserWindow,
  dialog: mockDialog,
}))

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  access: (...args: unknown[]) => mockAccess(...args),
  rename: (...args: unknown[]) => mockRename(...args),
}))

import { registerSessionHandlers } from '../session-handlers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function callHandler(channel: string, ...args: unknown[]) {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`Handler not registered: ${channel}`)
  return handler(null, ...args)
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-abc123',
    title: 'Test Session',
    cwd: '/home/user/project',
    model: 'claude-opus-4-6',
    messages: [],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  }
}

function makeIndexEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-abc123',
    title: 'Test Session',
    cwd: '/home/user/project',
    model: 'claude-opus-4-6',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 0,
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  ipcHandlers.clear()
  mockWriteFile.mockResolvedValue(undefined)
  mockMkdir.mockResolvedValue(undefined)
  mockUnlink.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  registerSessionHandlers()
})

// ── Registration ──────────────────────────────────────────────────────────────

describe('registerSessionHandlers', () => {
  it('registers all required IPC handlers', () => {
    for (const ch of ['session:save', 'session:list', 'session:load', 'session:delete', 'session:rename', 'session:pin', 'session:reorder', 'session:globalSearch', 'session:tag', 'session:exportAll']) {
      expect(ipcHandlers.has(ch), `missing handler: ${ch}`).toBe(true)
    }
  })
})

// ── session:save ──────────────────────────────────────────────────────────────

describe('session:save', () => {
  it('writes session file and returns true', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT')) // index empty
    const session = makeSession()
    const result = await callHandler('session:save', session)
    expect(result).toBe(true)
    // session file write
    const fileCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('sess-abc123.json'))
    expect(fileCall).toBeDefined()
    expect(JSON.parse(fileCall![1] as string).id).toBe('sess-abc123')
  })

  it('writes index atomically via tmp file then rename', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    await callHandler('session:save', makeSession())
    const tmpCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('_index.json.tmp'))
    expect(tmpCall).toBeDefined()
    expect(mockRename).toHaveBeenCalled()
  })

  it('adds new entry to index when not existing', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT')) // empty index
    await callHandler('session:save', makeSession())
    const tmpCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('.tmp'))!
    const index = JSON.parse(tmpCall[1] as string) as unknown[]
    expect(index).toHaveLength(1)
    expect((index[0] as { id: string }).id).toBe('sess-abc123')
  })

  it('updates existing entry in index', async () => {
    const existing = [makeIndexEntry()]
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing))
    const updated = makeSession({ title: 'Updated Title', messages: [{}, {}] })
    await callHandler('session:save', updated)
    const tmpCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('.tmp'))!
    const index = JSON.parse(tmpCall[1] as string) as Array<{ id: string; title: string; messageCount: number }>
    expect(index).toHaveLength(1)
    expect(index[0].title).toBe('Updated Title')
    expect(index[0].messageCount).toBe(2)
  })

  it('preserves pinned/tags/locked from existing index entry', async () => {
    const existing = [makeIndexEntry({ pinned: true, tags: ['important'], locked: true })]
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing))
    await callHandler('session:save', makeSession())
    const tmpCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('.tmp'))!
    const index = JSON.parse(tmpCall[1] as string) as Array<{ pinned?: boolean; tags?: string[]; locked?: boolean }>
    expect(index[0].pinned).toBe(true)
    expect(index[0].tags).toEqual(['important'])
    expect(index[0].locked).toBe(true)
  })

  it('throws on invalid session ID', async () => {
    const bad = makeSession({ id: '../evil/../path' })
    await expect(callHandler('session:save', bad)).rejects.toThrow('Invalid session ID')
  })

  it('rejects session ID with special chars', async () => {
    const bad = makeSession({ id: 'has space' })
    await expect(callHandler('session:save', bad)).rejects.toThrow()
  })
})

// ── session:list ─────────────────────────────────────────────────────────────

describe('session:list', () => {
  it('returns [] when no sessions exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    mockReaddir.mockResolvedValue([]) // no .json files
    const result = await callHandler('session:list')
    expect(result).toEqual([])
  })

  it('builds index from disk when index is empty', async () => {
    // First call: readIndex → empty (ENOENT)
    // buildIndexFromDisk: readdir → one file (string), then readFile → session data
    mockReadFile
      .mockRejectedValueOnce(new Error('ENOENT')) // readIndex fails
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'sess-disk' })))
    mockReaddir.mockResolvedValue(['sess-disk.json'])

    const result = await callHandler('session:list')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('sess-disk')
  })

  it('sorts pinned sessions to top', async () => {
    const index = [
      makeIndexEntry({ id: 'a', title: 'A' }),
      makeIndexEntry({ id: 'b', title: 'B', pinned: true }),
      makeIndexEntry({ id: 'c', title: 'C' }),
    ]
    // readIndex succeeds; reconcile reads disk → readdir returns string array
    mockReadFile.mockResolvedValueOnce(JSON.stringify(index))
    mockReaddir.mockResolvedValue(['a.json', 'b.json', 'c.json'])
    // buildIndexFromDisk (reconcile) readFile for each file
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'a' })))
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'b', pinned: true } as Record<string, unknown>)))
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'c' })))

    const result = await callHandler('session:list')
    expect(result[0].id).toBe('b')
  })

  it('adds orphan sessions from disk to index', async () => {
    const index = [makeIndexEntry({ id: 'in-index' })]
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(index)) // readIndex
      // buildIndexFromDisk for reconcile
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'in-index' })))
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'orphan' })))
    mockReaddir.mockResolvedValue(['in-index.json', 'orphan.json'])

    const result = await callHandler('session:list')
    const ids = result.map((s: { id: string }) => s.id)
    expect(ids).toContain('in-index')
    expect(ids).toContain('orphan')
  })
})

// ── session:delete ────────────────────────────────────────────────────────────

describe('session:delete', () => {
  it('deletes session file and removes from index, returns true', async () => {
    const index = [makeIndexEntry({ id: 'del-me' }), makeIndexEntry({ id: 'keep' })]
    mockAccess.mockResolvedValue(undefined) // file exists
    mockReadFile.mockResolvedValueOnce(JSON.stringify(index))

    const result = await callHandler('session:delete', 'del-me')

    expect(result).toBe(true)
    expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('del-me.json'))
    const tmpCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('.tmp'))!
    const newIndex = JSON.parse(tmpCall[1] as string) as Array<{ id: string }>
    expect(newIndex.map(s => s.id)).not.toContain('del-me')
    expect(newIndex.map(s => s.id)).toContain('keep')
  })

  it('returns false for invalid session ID', async () => {
    const result = await callHandler('session:delete', '../bad')
    expect(result).toBe(false)
    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it('skips unlink when file does not exist but still updates index', async () => {
    const index = [makeIndexEntry({ id: 'ghost' })]
    mockAccess.mockRejectedValue(new Error('ENOENT')) // file missing
    mockReadFile.mockResolvedValueOnce(JSON.stringify(index))

    const result = await callHandler('session:delete', 'ghost')

    expect(result).toBe(true)
    expect(mockUnlink).not.toHaveBeenCalled()
    // index should still be rewritten without the ghost entry
    const tmpCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('.tmp'))!
    const newIndex = JSON.parse(tmpCall[1] as string) as Array<{ id: string }>
    expect(newIndex.map(s => s.id)).not.toContain('ghost')
  })
})

// ── buildIndexFromDisk (indirect via session:list) ────────────────────────────

describe('buildIndexFromDisk', () => {
  it('ignores _index.json and non-.json files', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT')) // empty index → trigger buildFromDisk
    mockReaddir.mockResolvedValue(['_index.json', 'readme.txt', 'valid-id.json'])
    mockReadFile.mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'valid-id' })))

    const result = await callHandler('session:list')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('valid-id')
  })

  it('skips corrupt JSON files', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))
    mockReaddir.mockResolvedValue(['corrupt.json', 'good.json'])
    mockReadFile
      .mockResolvedValueOnce('not valid json {{{')
      .mockResolvedValueOnce(JSON.stringify(makeSession({ id: 'good' })))

    const result = await callHandler('session:list')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('good')
  })
})
