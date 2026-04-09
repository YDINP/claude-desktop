/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoist mocks so vi.mock factories can reference them ───────────────────────

const { ipcHandlers, mockIpcMain, mockReadFile, mockWriteFile, mockMkdir, mockExistsSync } = vi.hoisted(() => {
  const ipcHandlers = new Map<string, Function>()
  const mockIpcMain = {
    handle: vi.fn((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler)
    }),
  }
  const mockReadFile = vi.fn()
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockExistsSync = vi.fn().mockReturnValue(false)
  return { ipcHandlers, mockIpcMain, mockReadFile, mockWriteFile, mockMkdir, mockExistsSync }
})

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
}))

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}))

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/user'),
}))

// ── Import SUT (after mocks) ──────────────────────────────────────────────────

import { registerRemoteHandlers } from '../remote-handlers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function callHandler(channel: string, ...args: unknown[]) {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`Handler not registered for: ${channel}`)
  return handler(null, ...args)
}

function savedHostsJson(hosts: object[]) {
  return JSON.stringify(hosts)
}

// ── SSH Config samples ────────────────────────────────────────────────────────

const SSH_CONFIG_BASIC = `
Host myserver
  HostName 192.168.1.10
  User deploy
  Port 2222

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa

Host wildcard
  HostName *
`

const SSH_CONFIG_DEFAULTS = `
Host minimal
  HostName 10.0.0.1
`

const SSH_CONFIG_WITH_WILDCARD = `
Host *
  ServerAliveInterval 60

Host prod
  HostName prod.example.com
  User admin
`

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  ipcHandlers.clear()
  mockExistsSync.mockReturnValue(false)
  mockWriteFile.mockResolvedValue(undefined)
  mockMkdir.mockResolvedValue(undefined)
  registerRemoteHandlers()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('registerRemoteHandlers', () => {
  it('registers all 4 IPC handlers', () => {
    expect(ipcHandlers.has('remote:listHosts')).toBe(true)
    expect(ipcHandlers.has('remote:getSavedHosts')).toBe(true)
    expect(ipcHandlers.has('remote:saveHost')).toBe(true)
    expect(ipcHandlers.has('remote:removeHost')).toBe(true)
  })
})

// ── parseSshConfig (via remote:listHosts) ─────────────────────────────────────

describe('remote:listHosts / parseSshConfig', () => {
  it('returns [] when ssh config file does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    const result = await callHandler('remote:listHosts')
    expect(result).toEqual([])
  })

  it('parses basic ssh config', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(SSH_CONFIG_BASIC)

    const result = await callHandler('remote:listHosts')

    expect(result).toContainEqual(expect.objectContaining({
      alias: 'myserver',
      hostname: '192.168.1.10',
      user: 'deploy',
      port: 2222,
    }))
    expect(result).toContainEqual(expect.objectContaining({
      alias: 'github.com',
      user: 'git',
      identityFile: '~/.ssh/id_rsa',
    }))
  })

  it('uses defaults: user=root, port=22 when not specified', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(SSH_CONFIG_DEFAULTS)

    const result = await callHandler('remote:listHosts')

    expect(result).toContainEqual(expect.objectContaining({
      alias: 'minimal',
      hostname: '10.0.0.1',
      user: 'root',
      port: 22,
    }))
  })

  it('uses alias as hostname when HostName not specified', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue('Host alias-only\n  User dev\n')

    const result = await callHandler('remote:listHosts')

    expect(result).toContainEqual(expect.objectContaining({
      alias: 'alias-only',
      hostname: 'alias-only',
    }))
  })

  it('skips wildcard Host * entries', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(SSH_CONFIG_WITH_WILDCARD)

    const result = await callHandler('remote:listHosts')

    const aliases = result.map((h: { alias: string }) => h.alias)
    expect(aliases).not.toContain('*')
    expect(aliases).toContain('prod')
  })

  it('ignores comment lines and blank lines', async () => {
    const config = `
# This is a comment

Host server1
  HostName 1.2.3.4
  # inline comment
  User ubuntu
`
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(config)

    const result = await callHandler('remote:listHosts')
    expect(result).toHaveLength(1)
    expect(result[0].alias).toBe('server1')
  })

  it('returns [] on readFile error', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockRejectedValue(new Error('Permission denied'))

    const result = await callHandler('remote:listHosts')
    expect(result).toEqual([])
  })

  it('parses port as integer', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue('Host s\n  HostName h.com\n  Port 8022\n')

    const result = await callHandler('remote:listHosts')
    expect(result[0].port).toBe(8022)
    expect(typeof result[0].port).toBe('number')
  })

  it('defaults port to 22 for invalid port value', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue('Host s\n  HostName h.com\n  Port notanumber\n')

    const result = await callHandler('remote:listHosts')
    expect(result[0].port).toBe(22)
  })
})

// ── remote:getSavedHosts ──────────────────────────────────────────────────────

describe('remote:getSavedHosts', () => {
  it('returns [] when saved-hosts.json does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    const result = await callHandler('remote:getSavedHosts')
    expect(result).toEqual([])
  })

  it('returns parsed JSON array when file exists', async () => {
    const hosts = [{ id: 'h1', label: 'My Server', hostname: '1.2.3.4', user: 'root', port: 22 }]
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(hosts))

    const result = await callHandler('remote:getSavedHosts')
    expect(result).toEqual(hosts)
  })

  it('returns [] on JSON parse error', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue('not valid json }{')

    const result = await callHandler('remote:getSavedHosts')
    expect(result).toEqual([])
  })

  it('returns [] on readFile error', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockRejectedValue(new Error('EACCES'))

    const result = await callHandler('remote:getSavedHosts')
    expect(result).toEqual([])
  })
})

// ── remote:saveHost ───────────────────────────────────────────────────────────

describe('remote:saveHost', () => {
  const newHost = { id: 'new-1', label: 'New Server', hostname: '9.9.9.9', user: 'admin', port: 22 }

  it('adds new host at front when id does not exist', async () => {
    const existing = [{ id: 'old-1', label: 'Old', hostname: '1.1.1.1', user: 'root', port: 22 }]
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(existing))

    const result = await callHandler('remote:saveHost', newHost)

    expect(result[0]).toEqual(newHost)
    expect(result).toHaveLength(2)
  })

  it('updates existing host by id', async () => {
    const existing = [{ id: 'h1', label: 'Old Label', hostname: '1.1.1.1', user: 'root', port: 22 }]
    const updated = { id: 'h1', label: 'New Label', hostname: '2.2.2.2', user: 'ubuntu', port: 2222 }
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(existing))

    const result = await callHandler('remote:saveHost', updated)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(updated)
  })

  it('writes updated hosts to file', async () => {
    mockExistsSync.mockReturnValue(false)

    await callHandler('remote:saveHost', newHost)

    expect(mockWriteFile).toHaveBeenCalledOnce()
    const writtenContent = mockWriteFile.mock.calls[0][1] as string
    const parsed = JSON.parse(writtenContent)
    expect(parsed).toContainEqual(expect.objectContaining({ id: 'new-1' }))
  })

  it('creates directory before writing', async () => {
    mockExistsSync.mockReturnValue(false)
    await callHandler('remote:saveHost', newHost)
    expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true })
  })

  it('returns the updated hosts array', async () => {
    mockExistsSync.mockReturnValue(false)
    const result = await callHandler('remote:saveHost', newHost)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toEqual(newHost)
  })
})

// ── remote:removeHost ─────────────────────────────────────────────────────────

describe('remote:removeHost', () => {
  it('removes host by id', async () => {
    const hosts = [
      { id: 'h1', label: 'A', hostname: '1.1.1.1', user: 'root', port: 22 },
      { id: 'h2', label: 'B', hostname: '2.2.2.2', user: 'root', port: 22 },
    ]
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(hosts))

    const result = await callHandler('remote:removeHost', { id: 'h1' })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('h2')
  })

  it('writes updated hosts after removal', async () => {
    const hosts = [{ id: 'h1', label: 'A', hostname: '1.1.1.1', user: 'root', port: 22 }]
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(hosts))

    await callHandler('remote:removeHost', { id: 'h1' })

    expect(mockWriteFile).toHaveBeenCalledOnce()
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(written).toEqual([])
  })

  it('returns empty array when removing the only host', async () => {
    const hosts = [{ id: 'solo', label: 'Solo', hostname: '1.1.1.1', user: 'root', port: 22 }]
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(hosts))

    const result = await callHandler('remote:removeHost', { id: 'solo' })

    expect(result).toEqual([])
  })

  it('returns unchanged list when id not found', async () => {
    const hosts = [{ id: 'h1', label: 'A', hostname: '1.1.1.1', user: 'root', port: 22 }]
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(savedHostsJson(hosts))

    const result = await callHandler('remote:removeHost', { id: 'nonexistent' })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('h1')
  })
})
