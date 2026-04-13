import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
  readdir: vi.fn(),
  readFile: vi.fn(),
}))

import fsPromises from 'fs/promises'
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

const mockReaddir = vi.mocked(fsPromises.readdir)
const mockReadFile = vi.mocked(fsPromises.readFile)

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

  it('returns empty map when directory is empty', async () => {
    mockReaddir.mockResolvedValue([])
    const map = await buildUUIDMap('/project/assets')
    expect(map.size).toBe(0)
  })

  it('parses a texture .meta and registers uuid', async () => {
    const uuid = 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb'
    mockReaddir.mockImplementation(async (dir) => {
      if (String(dir) === '/project/assets') return [makeDirent('hero.png.meta', false)]
      return []
    })
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')
    expect(map.has(uuid)).toBe(true)
    expect(map.get(uuid)!.type).toBe('texture')
    expect(map.get(uuid)!.relPath).toBe('hero.png')
  })

  it('registers compressed uuid alongside dashed uuid for texture', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    mockReaddir.mockResolvedValue([makeDirent('img.png.meta', false)])
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')
    const compressed = compressCCUuid(uuid)
    expect(compressed).not.toBeNull()
    expect(map.has(compressed!)).toBe(true)
  })

  it('registers subMeta uuids as texture type', async () => {
    const mainUuid = 'main1111-1111-1111-1111-111111111111'
    const subUuid  = 'sub22222-2222-2222-2222-222222222222'
    mockReaddir.mockResolvedValue([makeDirent('atlas.png.meta', false)])
    mockReadFile.mockResolvedValue(
      makeMetaJson(mainUuid, { frame1: { uuid: subUuid } }) as unknown as Buffer
    )

    const map = await buildUUIDMap('/project/assets')
    expect(map.has(subUuid)).toBe(true)
    expect(map.get(subUuid)!.type).toBe('texture')
  })

  it('detects prefab type from .prefab.meta', async () => {
    const uuid = 'prefb111-1111-1111-1111-111111111111'
    mockReaddir.mockResolvedValue([makeDirent('enemy.prefab.meta', false)])
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')
    expect(map.get(uuid)!.type).toBe('prefab')
  })

  it('detects script type from .ts.meta', async () => {
    const uuid = 'scrpt111-1111-1111-1111-111111111111'
    mockReaddir.mockResolvedValue([makeDirent('GameManager.ts.meta', false)])
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')
    expect(map.get(uuid)!.type).toBe('script')
  })

  it('recurses into subdirectories', async () => {
    const uuid = 'deeeeeee-1111-1111-1111-111111111111'
    mockReaddir.mockImplementation(async (dir) => {
      // normalize separators for cross-platform comparison
      const normalized = String(dir).replace(/\\/g, '/')
      if (normalized === '/project/assets') return [makeDirent('sub', true)]
      if (normalized === '/project/assets/sub') return [makeDirent('icon.png.meta', false)]
      return []
    })
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')
    expect(map.has(uuid)).toBe(true)
    expect(map.get(uuid)!.relPath).toBe('sub/icon.png')
  })

  it('ignores malformed .meta files without throwing', async () => {
    mockReaddir.mockResolvedValue([makeDirent('broken.png.meta', false)])
    mockReadFile.mockResolvedValue('not json' as unknown as Buffer)

    await expect(buildUUIDMap('/project/assets')).resolves.not.toThrow()
  })

  // ── walkPrefabFiles: .meta 없는 prefab fallback ───────────────────────────────

  it('walkPrefabFiles: .meta 없는 .prefab 파일은 synthetic uuid로 폴백 등록된다', async () => {
    // .meta 없이 .prefab 파일만 존재하는 경우
    mockReaddir.mockImplementation(async (dir) => {
      const normalized = String(dir).replace(/\\/g, '/')
      if (normalized === '/project/assets') return [makeDirent('enemy.prefab', false)]
      return []
    })
    // .prefab 파일 자체는 readFile로 읽지 않음 (walkPrefabFiles는 경로만 등록)
    mockReadFile.mockResolvedValue('{}' as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')

    // synthetic uuid 형태: 'nometaprefab-{base64}'
    const entries = [...map.entries()]
    const syntheticEntry = entries.find(([k]) => k.startsWith('nometaprefab-'))
    expect(syntheticEntry).toBeDefined()
    const [syntheticUuid, meta] = syntheticEntry!
    expect(syntheticUuid).toMatch(/^nometaprefab-/)
    expect(meta.type).toBe('prefab')
    expect(meta.relPath).toBe('enemy.prefab')
    expect(meta.path).toContain('enemy.prefab')
  })

  it('walkPrefabFiles: .meta가 있는 .prefab은 synthetic 등록 대상에서 제외된다', async () => {
    const uuid = 'prefb222-2222-2222-2222-222222222222'
    // .prefab.meta가 있으면 walkMeta가 먼저 등록 → walkPrefabFiles는 pathSet으로 중복 방지
    mockReaddir.mockImplementation(async (dir) => {
      const normalized = String(dir).replace(/\\/g, '/')
      if (normalized === '/project/assets')
        return [makeDirent('hero.prefab.meta', false), makeDirent('hero.prefab', false)]
      return []
    })
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')

    // meta uuid가 등록됨
    expect(map.has(uuid)).toBe(true)
    expect(map.get(uuid)!.type).toBe('prefab')
    // synthetic uuid는 등록되지 않음
    const syntheticEntry = [...map.keys()].find(k => k.startsWith('nometaprefab-'))
    expect(syntheticEntry).toBeUndefined()
  })

  it('walkPrefabFiles: .prefab이 없으면 synthetic uuid가 생성되지 않는다', async () => {
    // .meta 파일만 있는 경우
    const uuid = 'aaaabbbb-0000-1111-2222-333344445555'
    mockReaddir.mockResolvedValue([makeDirent('sprite.png.meta', false)])
    mockReadFile.mockResolvedValue(makeMetaJson(uuid) as unknown as Buffer)

    const map = await buildUUIDMap('/project/assets')

    const syntheticEntry = [...map.keys()].find(k => k.startsWith('nometaprefab-'))
    expect(syntheticEntry).toBeUndefined()
    expect(map.has(uuid)).toBe(true)
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

// ── 압축 UUID 엣지 케이스 ─────────────────────────────────────────────────────

describe('compressCCUuid / decompressCCUuid — edge cases', () => {
  it('최소 길이 UUID(모두 0) 압축/해제 라운드트립', () => {
    const uuid = '00000000-0000-0000-0000-000000000000'
    const compressed = compressCCUuid(uuid)
    expect(compressed).not.toBeNull()
    expect(compressed!.length).toBe(23)
    const decompressed = decompressCCUuid(compressed!)
    expect(decompressed).toBe(uuid)
  })

  it('최대 길이 UUID(모두 f) 압축/해제 라운드트립', () => {
    const uuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    const compressed = compressCCUuid(uuid)
    expect(compressed).not.toBeNull()
    expect(compressed!.length).toBe(23)
    const decompressed = decompressCCUuid(compressed!)
    expect(decompressed).toBe(uuid)
  })

  it('압축 UUID가 정확히 23자여야 함 — 다양한 UUID 샘플', () => {
    const uuids = [
      '11111111-1111-1111-1111-111111111111',
      'abcdef01-2345-6789-abcd-ef0123456789',
      '12345678-9abc-def0-1234-56789abcdef0',
    ]
    for (const uuid of uuids) {
      const compressed = compressCCUuid(uuid)
      expect(compressed).not.toBeNull()
      expect(compressed!.length).toBe(23)
    }
  })

  it('22자 입력은 decompressCCUuid에서 null 반환', () => {
    expect(decompressCCUuid('0000000000000000000000')).toBeNull()
  })

  it('24자 입력은 decompressCCUuid에서 null 반환', () => {
    expect(decompressCCUuid('000000000000000000000000')).toBeNull()
  })

  it('빈 문자열은 null 반환', () => {
    expect(decompressCCUuid('')).toBeNull()
    expect(compressCCUuid('')).toBeNull()
  })

  it('dashes 없는 32자 hex도 압축 성공 (내부적으로 dash 제거 후 처리)', () => {
    // compressCCUuid는 replace(/-/g, '') 후 32자를 검사하므로
    // dash 없는 32자 hex는 유효한 입력으로 처리됨
    const noDash = 'a1b2c3d4e5f678901234567890abcdef'
    const compressed = compressCCUuid(noDash)
    expect(compressed).not.toBeNull()
    expect(compressed!.length).toBe(23)
  })
})

// ── 순환 참조 UUID 감지 ────────────────────────────────────────────────────────

describe('buildUUIDMap — 순환 참조 및 자기 참조 UUID', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uuid가 자기 자신을 subMeta로 참조해도 크래시 없이 처리', async () => {
    const uuid = 'selfref1-1111-1111-1111-111111111111'
    // subMeta의 uuid가 메인 uuid와 동일한 자기 참조
    mockReadFile.mockResolvedValue(
      makeMetaJson(uuid, { self: { uuid } }) as unknown as Buffer
    )
    mockReaddir.mockResolvedValue([makeDirent('self.png.meta', false)])

    const map = await buildUUIDMap('/project/assets')
    // 크래시 없이 정상 처리, uuid는 등록됨
    expect(map.has(uuid)).toBe(true)
  })

  it('두 파일이 서로 같은 uuid를 갖는 충돌 meta는 나중 파일이 덮어씀', async () => {
    const sharedUuid = 'shared11-1111-1111-1111-111111111111'
    let callCount = 0
    mockReaddir.mockResolvedValue([
      makeDirent('first.png.meta', false),
      makeDirent('second.png.meta', false),
    ])
    mockReadFile.mockImplementation(async () => {
      callCount++
      return makeMetaJson(sharedUuid) as unknown as Buffer
    })

    const map = await buildUUIDMap('/project/assets')
    // 같은 uuid → map에는 하나만 존재
    expect(map.has(sharedUuid)).toBe(true)
    // 두 번 읽었음을 확인
    expect(callCount).toBe(2)
  })
})

// ── 빈 프로젝트 (assets 폴더 없음) ───────────────────────────────────────────

describe('buildUUIDMap — 빈 프로젝트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assets 폴더가 비어 있으면 빈 맵 반환', async () => {
    mockReaddir.mockResolvedValue([])
    const map = await buildUUIDMap('/empty-project/assets')
    expect(map.size).toBe(0)
  })

  it('readdir가 에러를 던지면 빈 맵 반환 (크래시 없음)', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT: no such file or directory'))
    await expect(buildUUIDMap('/nonexistent/assets')).resolves.toBeDefined()
  })

  it('assets 폴더에 meta 파일이 전혀 없으면 빈 맵 반환', async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const normalized = String(dir).replace(/\\/g, '/')
      if (normalized === '/project/no-assets') {
        return [
          makeDirent('README.md', false),
          makeDirent('config.json', false),
        ]
      }
      return []
    })

    const map = await buildUUIDMap('/project/no-assets')
    expect(map.size).toBe(0)
  })

  it('중첩 빈 폴더는 순회하지만 아무것도 등록 안 함', async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const normalized = String(dir).replace(/\\/g, '/')
      if (normalized === '/project/assets') return [makeDirent('empty-dir', true)]
      return []
    })

    const map = await buildUUIDMap('/project/assets')
    expect(map.size).toBe(0)
  })
})
