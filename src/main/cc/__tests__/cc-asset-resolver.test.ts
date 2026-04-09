import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import fs from 'fs'
import {
  decompressCCUuid,
  compressCCUuid,
  buildUUIDMap,
  extractReferencedUUIDs,
  resolveTextureUrl,
  resolveUUIDToPath,
  getAssetInfo,
  getAllTextureUUIDs,
} from '../cc-asset-resolver'

const mockReaddirSync = vi.mocked(fs.readdirSync)
const mockReadFileSync = vi.mocked(fs.readFileSync)

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDirent(name: string, isDir: boolean): fs.Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: '',
    parentPath: '',
  } as unknown as fs.Dirent
}

function makeMetaJson(uuid: string, subMetas?: Record<string, { uuid: string }>) {
  const meta: Record<string, unknown> = { uuid }
  if (subMetas) meta.subMetas = subMetas
  return JSON.stringify(meta)
}

// ── decompressCCUuid / compressCCUuid ─────────────────────────────────────────

describe('decompressCCUuid', () => {
  it('returns null for non-23 char input', () => {
    expect(decompressCCUuid('short')).toBeNull()
    expect(decompressCCUuid('toolongtoolongtoolongtoolong')).toBeNull()
  })

  it('roundtrips with compressCCUuid', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const compressed = compressCCUuid(uuid)
    expect(compressed).not.toBeNull()
    expect(compressed!.length).toBe(23)
    const decompressed = decompressCCUuid(compressed!)
    expect(decompressed).toBe(uuid)
  })

  it('returns null for invalid base64 chars in compressed', () => {
    // 23 chars but contains invalid B64 character
    const invalid = '00000!!!!!!!!!!!!!!!!!'
    expect(decompressCCUuid(invalid)).toBeNull()
  })
})

describe('compressCCUuid', () => {
  it('returns null for non-32 hex (no dashes removed)', () => {
    expect(compressCCUuid('short')).toBeNull()
  })

  it('produces 23-character output for valid UUID', () => {
    const uuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    const result = compressCCUuid(uuid)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(23)
  })
})

// ── buildUUIDMap ──────────────────────────────────────────────────────────────

describe('buildUUIDMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty map when directory is empty', () => {
    mockReaddirSync.mockReturnValue([])
    const map = buildUUIDMap('/project/assets')
    expect(map.size).toBe(0)
  })

  it('parses a texture .meta and registers uuid', () => {
    const uuid = 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb'
    mockReaddirSync.mockImplementation((dir) => {
      if (dir === '/project/assets') return [makeDirent('hero.png.meta', false)]
      return []
    })
    mockReadFileSync.mockReturnValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = buildUUIDMap('/project/assets')
    expect(map.has(uuid)).toBe(true)
    expect(map.get(uuid)!.type).toBe('texture')
    expect(map.get(uuid)!.relPath).toBe('hero.png')
  })

  it('registers compressed uuid alongside dashed uuid for texture', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    mockReaddirSync.mockImplementation(() => [makeDirent('img.png.meta', false)])
    mockReadFileSync.mockReturnValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = buildUUIDMap('/project/assets')
    const compressed = compressCCUuid(uuid)
    expect(compressed).not.toBeNull()
    expect(map.has(compressed!)).toBe(true)
  })

  it('registers subMeta uuids as texture type', () => {
    const mainUuid = 'main1111-1111-1111-1111-111111111111'
    const subUuid  = 'sub22222-2222-2222-2222-222222222222'
    mockReaddirSync.mockImplementation(() => [makeDirent('atlas.png.meta', false)])
    mockReadFileSync.mockReturnValue(
      makeMetaJson(mainUuid, { frame1: { uuid: subUuid } }) as unknown as Buffer
    )

    const map = buildUUIDMap('/project/assets')
    expect(map.has(subUuid)).toBe(true)
    expect(map.get(subUuid)!.type).toBe('texture')
  })

  it('detects prefab type from .prefab.meta', () => {
    const uuid = 'prefb111-1111-1111-1111-111111111111'
    mockReaddirSync.mockImplementation(() => [makeDirent('enemy.prefab.meta', false)])
    mockReadFileSync.mockReturnValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = buildUUIDMap('/project/assets')
    expect(map.get(uuid)!.type).toBe('prefab')
  })

  it('detects script type from .ts.meta', () => {
    const uuid = 'scrpt111-1111-1111-1111-111111111111'
    mockReaddirSync.mockImplementation(() => [makeDirent('GameManager.ts.meta', false)])
    mockReadFileSync.mockReturnValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = buildUUIDMap('/project/assets')
    expect(map.get(uuid)!.type).toBe('script')
  })

  it('recurses into subdirectories', () => {
    const uuid = 'deeeeeee-1111-1111-1111-111111111111'
    mockReaddirSync.mockImplementation((dir) => {
      // normalize separators for cross-platform comparison
      const normalized = String(dir).replace(/\\/g, '/')
      if (normalized === '/project/assets') return [makeDirent('sub', true)]
      if (normalized === '/project/assets/sub') return [makeDirent('icon.png.meta', false)]
      return []
    })
    mockReadFileSync.mockReturnValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = buildUUIDMap('/project/assets')
    expect(map.has(uuid)).toBe(true)
    expect(map.get(uuid)!.relPath).toBe('sub/icon.png')
  })

  it('ignores malformed .meta files without throwing', () => {
    mockReaddirSync.mockImplementation(() => [makeDirent('broken.png.meta', false)])
    mockReadFileSync.mockReturnValue('not json' as unknown as Buffer)

    expect(() => buildUUIDMap('/project/assets')).not.toThrow()
  })
})

// ── extractReferencedUUIDs ────────────────────────────────────────────────────

describe('extractReferencedUUIDs', () => {
  it('returns empty array for empty input', () => {
    expect(extractReferencedUUIDs([])).toEqual([])
  })

  it('extracts __uuid__ from flat objects', () => {
    const raw = [{ __uuid__: 'uuid-1' }, { __uuid__: 'uuid-2' }]
    const result = extractReferencedUUIDs(raw)
    expect(result).toContain('uuid-1')
    expect(result).toContain('uuid-2')
  })

  it('extracts __uuid__ from nested objects', () => {
    const raw = [
      { spriteFrame: { __uuid__: 'nested-uuid' } },
    ]
    const result = extractReferencedUUIDs(raw)
    expect(result).toContain('nested-uuid')
  })

  it('deduplicates repeated uuids', () => {
    const raw = [{ __uuid__: 'dup-uuid' }, { __uuid__: 'dup-uuid' }]
    const result = extractReferencedUUIDs(raw)
    expect(result.filter(u => u === 'dup-uuid')).toHaveLength(1)
  })

  it('extracts __uuid__ from arrays within objects', () => {
    const raw = [
      { clickEvents: [{ __uuid__: 'event-uuid-1' }, { __uuid__: 'event-uuid-2' }] },
    ]
    const result = extractReferencedUUIDs(raw)
    expect(result).toContain('event-uuid-1')
    expect(result).toContain('event-uuid-2')
  })

  it('ignores non-string __uuid__ values', () => {
    const raw = [{ __uuid__: 42 }]
    const result = extractReferencedUUIDs(raw)
    expect(result).toHaveLength(0)
  })
})

// ── resolveTextureUrl ─────────────────────────────────────────────────────────

describe('resolveTextureUrl', () => {
  it('returns null for unknown uuid', () => {
    const map = new Map()
    expect(resolveTextureUrl('unknown', map)).toBeNull()
  })

  it('returns null for non-texture asset', () => {
    const map = new Map([
      ['script-uuid', { uuid: 'script-uuid', path: '/a/b.ts', relPath: 'b.ts', type: 'script' as const }],
    ])
    expect(resolveTextureUrl('script-uuid', map)).toBeNull()
  })

  it('returns local:// url for texture asset', () => {
    const map = new Map([
      ['tex-uuid', { uuid: 'tex-uuid', path: '/assets/hero.png', relPath: 'hero.png', type: 'texture' as const }],
    ])
    const url = resolveTextureUrl('tex-uuid', map)
    expect(url).toMatch(/^local:\/\//)
    expect(url).toContain(encodeURIComponent('/assets/hero.png'))
  })

  it('returns local:// url for sprite-atlas asset', () => {
    const map = new Map([
      ['atlas-uuid', { uuid: 'atlas-uuid', path: '/assets/ui.png', relPath: 'ui.png', type: 'sprite-atlas' as const }],
    ])
    const url = resolveTextureUrl('atlas-uuid', map)
    expect(url).not.toBeNull()
    expect(url).toMatch(/^local:\/\//)
  })
})

// ── resolveUUIDToPath ─────────────────────────────────────────────────────────

describe('resolveUUIDToPath', () => {
  it('returns null for missing uuid', () => {
    expect(resolveUUIDToPath('missing', new Map())).toBeNull()
  })

  it('returns asset path for known uuid', () => {
    const map = new Map([
      ['uuid-1', { uuid: 'uuid-1', path: '/p/file.png', relPath: 'file.png', type: 'texture' as const }],
    ])
    expect(resolveUUIDToPath('uuid-1', map)).toBe('/p/file.png')
  })
})

// ── getAssetInfo ──────────────────────────────────────────────────────────────

describe('getAssetInfo', () => {
  it('returns null for unknown uuid', () => {
    expect(getAssetInfo('x', new Map())).toBeNull()
  })

  it('returns path, type, and name (without extension)', () => {
    const map = new Map([
      ['u1', { uuid: 'u1', path: '/assets/hero.png', relPath: 'hero.png', type: 'texture' as const }],
    ])
    const info = getAssetInfo('u1', map)
    expect(info).not.toBeNull()
    expect(info!.path).toBe('/assets/hero.png')
    expect(info!.type).toBe('texture')
    expect(info!.name).toBe('hero')
  })
})

// ── getAllTextureUUIDs ────────────────────────────────────────────────────────

describe('getAllTextureUUIDs', () => {
  it('returns only texture and sprite-atlas uuids', () => {
    const map = new Map([
      ['t1', { uuid: 't1', path: '/a.png', relPath: 'a.png', type: 'texture' as const }],
      ['t2', { uuid: 't2', path: '/b.png', relPath: 'b.png', type: 'sprite-atlas' as const }],
      ['s1', { uuid: 's1', path: '/c.ts', relPath: 'c.ts', type: 'script' as const }],
    ])
    const result = getAllTextureUUIDs(map)
    expect(result).toContain('t1')
    expect(result).toContain('t2')
    expect(result).not.toContain('s1')
  })

  it('returns empty array for empty map', () => {
    expect(getAllTextureUUIDs(new Map())).toEqual([])
  })
})
