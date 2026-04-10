/**
 * @vitest-environment node
 *
 * cc-file-handlers.ts — resolveSprite / resolveFont / detectProject / 기타 IPC 핸들러 단위 테스트
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// ── Hoist mocks ────────────────────────────────────────────────────────────────

const {
  ipcHandlers,
  mockIpcMain,
  mockDialog,
  mockBrowserWindow,
  mockReadFile,
  mockBuildUUIDMap,
  mockParseCCScene,
  mockSaveCCScene,
  mockDetectCCVersion,
  mockCCFileWatcher,
  mockRestoreFromBackup,
  mockListBakFiles,
  mockDeleteAllBakFiles,
  mockRestoreFromBakFile,
  mockForceOverwriteScene,
  mockRecordSceneMtime,
  mockClearMtimeMap,
  mockParseCCSceneChunked,
  mockIsLargeScene,
  mockExtractReferencedUUIDs,
} = vi.hoisted(() => {
  const ipcHandlers = new Map<string, Function>()
  const mockIpcMain = {
    handle: vi.fn((ch: string, fn: Function) => ipcHandlers.set(ch, fn)),
  }
  const mockDialog = {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  }
  const mockBrowserWindow = {
    getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() }, isDestroyed: () => false }]),
  }
  const mockReadFile = vi.fn()
  const mockBuildUUIDMap = vi.fn()
  const mockParseCCScene = vi.fn()
  const mockSaveCCScene = vi.fn()
  const mockDetectCCVersion = vi.fn()
  const mockCCFileWatcher = {
    onChange: vi.fn(() => vi.fn()),
    onPartialUpdate: vi.fn(() => vi.fn()),
    watch: vi.fn(),
    unwatch: vi.fn(),
    close: vi.fn(),
    watchedCount: 0,
  }
  const mockRestoreFromBackup = vi.fn()
  const mockListBakFiles = vi.fn()
  const mockDeleteAllBakFiles = vi.fn()
  const mockRestoreFromBakFile = vi.fn()
  const mockForceOverwriteScene = vi.fn()
  const mockRecordSceneMtime = vi.fn()
  const mockClearMtimeMap = vi.fn()
  const mockParseCCSceneChunked = vi.fn()
  const mockIsLargeScene = vi.fn()
  const mockExtractReferencedUUIDs = vi.fn()

  return {
    ipcHandlers, mockIpcMain, mockDialog, mockBrowserWindow, mockReadFile,
    mockBuildUUIDMap, mockParseCCScene, mockSaveCCScene, mockDetectCCVersion,
    mockCCFileWatcher, mockRestoreFromBackup, mockListBakFiles, mockDeleteAllBakFiles,
    mockRestoreFromBakFile, mockForceOverwriteScene, mockRecordSceneMtime,
    mockClearMtimeMap, mockParseCCSceneChunked, mockIsLargeScene, mockExtractReferencedUUIDs,
  }
})

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  BrowserWindow: mockBrowserWindow,
}))

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}))

vi.mock('../../cc/cc-asset-resolver', () => ({
  buildUUIDMap: mockBuildUUIDMap,
  extractReferencedUUIDs: mockExtractReferencedUUIDs,
  resolveTextureUrl: vi.fn(),
  getAssetInfo: vi.fn(),
  getAllTextureUUIDs: vi.fn(),
}))

vi.mock('../../cc/cc-file-parser', () => ({
  parseCCScene: mockParseCCScene,
  parseCCSceneChunked: mockParseCCSceneChunked,
  isLargeScene: mockIsLargeScene,
}))

vi.mock('../../cc/cc-file-saver', () => ({
  saveCCScene: mockSaveCCScene,
  restoreFromBackup: mockRestoreFromBackup,
  listBakFiles: mockListBakFiles,
  deleteAllBakFiles: mockDeleteAllBakFiles,
  restoreFromBakFile: mockRestoreFromBakFile,
  recordSceneMtime: mockRecordSceneMtime,
  forceOverwriteScene: mockForceOverwriteScene,
  clearMtimeMap: mockClearMtimeMap,
}))

vi.mock('../../cc/cc-file-watcher', () => ({
  ccFileWatcher: mockCCFileWatcher,
}))

vi.mock('../../cc/cc-version-detector', () => ({
  detectCCVersion: mockDetectCCVersion,
}))

import { registerCCFileHandlers } from '../cc-file-handlers'

// 한 번만 등록 (_registered 플래그 때문에)
beforeAll(() => {
  registerCCFileHandlers()
})

let _testId = 0
beforeEach(() => {
  vi.clearAllMocks()
  _testId++
  // clearAllMocks는 mockReturnValue 등도 리셋하므로 기본값 재설정
  mockBuildUUIDMap.mockResolvedValue(new Map())
  mockCCFileWatcher.onChange.mockReturnValue(vi.fn())
  mockCCFileWatcher.onPartialUpdate.mockReturnValue(vi.fn())
})

// UUID 캐시 충돌 방지용 고유 assetsDir 생성
function uid() { return `/assets-test-${_testId}-${Math.random().toString(36).slice(2, 6)}` }

function getHandler(channel: string): Function {
  const h = ipcHandlers.get(channel)
  if (!h) throw new Error(`Handler not registered: ${channel}`)
  return h
}

// ── registerCCFileHandlers — handler registration ─────────────────────────────

describe('registerCCFileHandlers — handler registration', () => {
  it('cc:file:detect 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:detect')).toBe(true)
  })

  it('cc:file:openProject 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:openProject')).toBe(true)
  })

  it('cc:file:listScenes 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:listScenes')).toBe(true)
  })

  it('cc:file:readScene 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:readScene')).toBe(true)
  })

  it('cc:file:saveScene 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:saveScene')).toBe(true)
  })

  it('cc:file:resolveSprite 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:resolveSprite')).toBe(true)
  })

  it('cc:file:resolveFont 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:resolveFont')).toBe(true)
  })

  it('cc:file:buildUUIDMap 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:buildUUIDMap')).toBe(true)
  })

  it('cc:file:watch 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:watch')).toBe(true)
  })

  it('cc:file:unwatch 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:unwatch')).toBe(true)
  })

  it('cc:file:extractUUIDs 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:extractUUIDs')).toBe(true)
  })

  it('cc:file:resolveTexture 핸들러가 등록됨', () => {
    expect(ipcHandlers.has('cc:file:resolveTexture')).toBe(true)
  })
})

// ── cc:file:detect ─────────────────────────────────────────────────────────────

describe('cc:file:detect', () => {
  it('projectPath를 detectCCVersion에 전달하고 결과 반환', async () => {
    mockDetectCCVersion.mockReturnValue({ detected: true, version: '2x', projectPath: '/proj' })
    const h = getHandler('cc:file:detect')
    const result = await h({}, '/some/project')
    expect(mockDetectCCVersion).toHaveBeenCalledWith('/some/project')
    expect(result.version).toBe('2x')
  })

  it('3x 버전도 올바르게 반환', async () => {
    mockDetectCCVersion.mockReturnValue({ detected: true, version: '3x', projectPath: '/proj3x' })
    const h = getHandler('cc:file:detect')
    const result = await h({}, '/proj3x')
    expect(result.version).toBe('3x')
  })
})

// ── cc:file:listScenes ─────────────────────────────────────────────────────────

describe('cc:file:listScenes', () => {
  it('scenes 배열 반환', async () => {
    mockDetectCCVersion.mockReturnValue({
      detected: true, version: '2x',
      scenes: ['/proj/scenes/main.fire', '/proj/scenes/loading.fire'],
    })
    const h = getHandler('cc:file:listScenes')
    const result = await h({}, '/proj')
    expect(result).toEqual(['/proj/scenes/main.fire', '/proj/scenes/loading.fire'])
  })

  it('scenes가 없으면 빈 배열 반환', async () => {
    mockDetectCCVersion.mockReturnValue({ detected: true, version: '2x' })
    const h = getHandler('cc:file:listScenes')
    const result = await h({}, '/proj')
    expect(result).toEqual([])
  })
})

// ── cc:file:readScene ──────────────────────────────────────────────────────────

describe('cc:file:readScene', () => {
  it('parseCCScene 결과를 반환함', async () => {
    const mockSceneFile = { root: { name: 'TestScene', uuid: 'r1', children: [] } }
    mockParseCCScene.mockResolvedValue(mockSceneFile)

    const h = getHandler('cc:file:readScene')
    const result = await h({}, '/proj/main.fire', { detected: true, version: '2x' })
    expect(result.root.name).toBe('TestScene')
    expect(mockRecordSceneMtime).toHaveBeenCalledWith('/proj/main.fire')
  })

  it('parseCCScene 예외 시 { error: string } 반환', async () => {
    mockParseCCScene.mockRejectedValue(new Error('parse failed'))

    const h = getHandler('cc:file:readScene')
    const result = await h({}, '/bad.fire', { detected: true, version: '2x' })
    expect(result.error).toContain('parse failed')
  })
})

// ── cc:file:saveScene ──────────────────────────────────────────────────────────

describe('cc:file:saveScene', () => {
  it('saveCCScene에 sceneFile과 modifiedRoot 전달', async () => {
    mockSaveCCScene.mockReturnValue({ success: true })

    const mockScene = { scenePath: '/proj/main.fire', root: { uuid: 'r1' } }
    const mockRoot = { uuid: 'r1', name: 'Scene', children: [] }

    const h = getHandler('cc:file:saveScene')
    const result = await h({}, mockScene, mockRoot)
    expect(mockSaveCCScene).toHaveBeenCalledWith(mockScene, mockRoot)
    expect(result.success).toBe(true)
  })
})

// ── cc:file:resolveSprite — UUID not found ─────────────────────────────────────

describe('cc:file:resolveSprite — UUID 미존재/타입 오류', () => {
  it('UUID가 맵에 없으면 null 반환', async () => {
    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, 'nonexist-uuid', '/assets')
    expect(result).toBeNull()
  })

  it('타입이 texture가 아니면 null 반환', async () => {
    const map = new Map([['script-uuid', { uuid: 'script-uuid', path: '/assets/game.ts', relPath: 'game.ts', type: 'script' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, 'script-uuid', '/assets')
    expect(result).toBeNull()
  })

  it('texture 타입 — 이미지 파일 읽기 성공 시 dataUrl 반환', async () => {
    const dir = uid()
    const map = new Map([['tex-uuid', { uuid: 'tex-uuid', path: `${dir}/img.png`, relPath: 'img.png', type: 'texture' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockImplementation((path: string) => {
      if (path === `${dir}/img.png`) return Promise.resolve(Buffer.from('png-data'))
      return Promise.reject(new Error('no meta'))
    })

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, 'tex-uuid', dir)
    expect(result).not.toBeNull()
    expect(result.dataUrl).toContain('data:image/png;base64,')
    expect(result.borderTop).toBe(0)
    expect(result.frame).toBeNull()
  })

  it('이미지 파일 읽기 실패 시 null 반환', async () => {
    const dir = uid()
    const map = new Map([['tex-uuid2', { uuid: 'tex-uuid2', path: `${dir}/missing.png`, relPath: 'missing.png', type: 'texture' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, 'tex-uuid2', dir)
    expect(result).toBeNull()
  })
})

// ── cc:file:resolveSprite — atlas frame ───────────────────────────────────────

describe('cc:file:resolveSprite — atlas frame 추출', () => {
  it('atlas subMeta에서 frame rect 추출 (CC 2.x)', async () => {
    const dir = uid()
    const uuid = 'frame-uuid-2x'
    const map = new Map([[uuid, { uuid, path: `${dir}/atlas.plist`, relPath: 'atlas.plist', type: 'sprite-atlas' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    mockReadFile.mockImplementation((path: string) => {
      if (path === `${dir}/atlas.png`) return Promise.resolve(Buffer.from('fake-png'))
      if (path === `${dir}/atlas.plist.meta`) {
        const meta = {
          subMetas: {
            frame1: {
              uuid: uuid,
              trimX: 10, trimY: 20, width: 50, height: 60,
              rawWidth: 100, rawHeight: 200,
              rawTextureUuid: 'atlas-tex-uuid',
              rotated: false,
              borderTop: 2, borderBottom: 3, borderLeft: 4, borderRight: 5,
            },
          },
        }
        return Promise.resolve(JSON.stringify(meta))
      }
      return Promise.reject(new Error('ENOENT'))
    })

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, uuid, dir)

    expect(result).not.toBeNull()
    expect(result.frame).toEqual({ x: 10, y: 20, w: 50, h: 60, rotated: false })
    expect(result.borderTop).toBe(2)
    expect(result.borderBottom).toBe(3)
    expect(result.borderLeft).toBe(4)
    expect(result.borderRight).toBe(5)
  })

  it('atlas frame이 전체 이미지와 동일하면 frame=null', async () => {
    const dir = uid()
    const uuid = 'full-frame-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/atlas2.plist`, relPath: 'atlas2.plist', type: 'sprite-atlas' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    mockReadFile.mockImplementation((path: string) => {
      if (path === `${dir}/atlas2.png`) return Promise.resolve(Buffer.from('fake-png'))
      if (path === `${dir}/atlas2.plist.meta`) {
        const meta = {
          subMetas: {
            full: {
              uuid: uuid,
              trimX: 0, trimY: 0, width: 100, height: 200,
              rawWidth: 100, rawHeight: 200,
              rawTextureUuid: 'tex-uuid',
              rotated: false,
            },
          },
        }
        return Promise.resolve(JSON.stringify(meta))
      }
      return Promise.reject(new Error('ENOENT'))
    })

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, uuid, dir)
    expect(result.frame).toBeNull()
  })

  it('CC 3.x userData 형식에서 frame 추출', async () => {
    const dir = uid()
    const uuid = 'frame-uuid-3x'
    const map = new Map([[uuid, { uuid, path: `${dir}/tex3x.png`, relPath: 'tex3x.png', type: 'sprite-atlas' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    mockReadFile.mockImplementation((path: string) => {
      if (path === `${dir}/tex3x.png`) return Promise.resolve(Buffer.from('fake-png-3x'))
      if (path === `${dir}/tex3x.png.meta`) {
        const meta = {
          subMetas: {
            sp1: {
              uuid: uuid,
              userData: {
                trimX: 5, trimY: 8, width: 30, height: 40,
                rawWidth: 128, rawHeight: 128,
                atlasUuid: 'parent-atlas',
                rotated: true,
                borderTop: 1, borderBottom: 1, borderLeft: 2, borderRight: 2,
              },
            },
          },
        }
        return Promise.resolve(JSON.stringify(meta))
      }
      return Promise.reject(new Error('ENOENT'))
    })

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, uuid, dir)

    expect(result.frame).toEqual({ x: 5, y: 8, w: 30, h: 40, rotated: true })
    expect(result.borderTop).toBe(1)
    expect(result.borderLeft).toBe(2)
  })

  it('meta 파일 없으면 border=0, frame=null', async () => {
    const dir = uid()
    const uuid = 'no-meta-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/nometa.png`, relPath: 'nometa.png', type: 'texture' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    mockReadFile.mockImplementation((path: string) => {
      if (path === `${dir}/nometa.png`) return Promise.resolve(Buffer.from('png'))
      return Promise.reject(new Error('ENOENT'))
    })

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, uuid, dir)
    expect(result.borderTop).toBe(0)
    expect(result.frame).toBeNull()
  })

  it('rotated=true인 frame 추출 확인', async () => {
    const dir = uid()
    const uuid = 'rotated-frame-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/rot.plist`, relPath: 'rot.plist', type: 'sprite-atlas' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    mockReadFile.mockImplementation((path: string) => {
      if (path === `${dir}/rot.png`) return Promise.resolve(Buffer.from('png'))
      if (path === `${dir}/rot.plist.meta`) {
        return Promise.resolve(JSON.stringify({
          subMetas: {
            r1: {
              uuid: uuid,
              trimX: 0, trimY: 0, width: 32, height: 64,
              rawWidth: 256, rawHeight: 256,
              rawTextureUuid: 't',
              rotated: true,
            },
          },
        }))
      }
      return Promise.reject(new Error('ENOENT'))
    })

    const h = getHandler('cc:file:resolveSprite')
    const result = await h({}, uuid, dir)
    expect(result.frame?.rotated).toBe(true)
  })
})

// ── cc:file:resolveFont ────────────────────────────────────────────────────────

describe('cc:file:resolveFont', () => {
  it('UUID 없으면 null', async () => {
    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, 'unknown', '/assets')
    expect(result).toBeNull()
  })

  it('TTF 파일 — dataUrl과 familyName 반환', async () => {
    const dir = uid()
    const uuid = 'ttf-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/NotoSans.ttf`, relPath: 'NotoSans.ttf', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('fake-ttf-data'))

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)

    expect(result).not.toBeNull()
    expect(result.dataUrl).toContain('data:font/truetype;base64,')
    expect(result.familyName).toBe('NotoSans')
    expect(result.fallback).toBeUndefined()
  })

  it('OTF 파일 — mime type font/opentype', async () => {
    const dir = uid()
    const uuid = 'otf-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/MyFont.otf`, relPath: 'MyFont.otf', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('fake-otf'))

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result.dataUrl).toContain('data:font/opentype;base64,')
    expect(result.familyName).toBe('MyFont')
  })

  it('WOFF 파일 — mime type font/woff', async () => {
    const dir = uid()
    const uuid = 'woff-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/icon.woff`, relPath: 'icon.woff', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('fake-woff'))

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result.dataUrl).toContain('data:font/woff;base64,')
  })

  it('WOFF2 파일 — mime type font/woff2', async () => {
    const dir = uid()
    const uuid = 'woff2-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/icon.woff2`, relPath: 'icon.woff2', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('fake-woff2'))

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result.dataUrl).toContain('data:font/woff2;base64,')
  })

  it('BMFont (.fnt) — fallback=true, dataUrl=""', async () => {
    const dir = uid()
    const uuid = 'fnt-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/bitmap.fnt`, relPath: 'bitmap.fnt', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)

    expect(result).not.toBeNull()
    expect(result.fallback).toBe(true)
    expect(result.dataUrl).toBe('')
    expect(result.familyName).toBe('bitmap')
  })

  it('지원되지 않는 확장자 (.mp3) — null 반환', async () => {
    const dir = uid()
    const uuid = 'mp3-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/audio.mp3`, relPath: 'audio.mp3', type: 'audio' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result).toBeNull()
  })

  it('파일 읽기 실패 — null 반환', async () => {
    const dir = uid()
    const uuid = 'ttf-err-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/missing.ttf`, relPath: 'missing.ttf', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result).toBeNull()
  })

  it('familyName에서 특수문자를 _로 치환', async () => {
    const dir = uid()
    const uuid = 'special-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/My Font #1.ttf`, relPath: 'My Font #1.ttf', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('fake'))

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result.familyName).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('BMFont — familyName도 특수문자 제거됨', async () => {
    const dir = uid()
    const uuid = 'fnt-special'
    const map = new Map([[uuid, { uuid, path: `${dir}/Score Font.fnt`, relPath: 'Score Font.fnt', type: 'font' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    const h = getHandler('cc:file:resolveFont')
    const result = await h({}, uuid, dir)
    expect(result.familyName).toMatch(/^[a-zA-Z0-9_-]+$/)
  })
})

// ── cc:file:buildUUIDMap ───────────────────────────────────────────────────────

describe('cc:file:buildUUIDMap', () => {
  it('UUID 맵을 plain object로 직렬화하여 반환', async () => {
    const dir = uid()
    const map = new Map([
      ['uuid1', { uuid: 'uuid1', path: `${dir}/img.png`, relPath: 'img.png', type: 'texture' }],
      ['uuid2', { uuid: 'uuid2', path: `${dir}/font.ttf`, relPath: 'font.ttf', type: 'font' }],
    ])
    mockBuildUUIDMap.mockResolvedValue(map)

    const h = getHandler('cc:file:buildUUIDMap')
    const result = await h({}, dir)

    expect(result['uuid1'].type).toBe('texture')
    expect(result['uuid2'].type).toBe('font')
    expect(typeof result).toBe('object')
  })

  it('UUID 맵이 비어있으면 빈 객체 반환', async () => {
    const dir = uid()
    const h = getHandler('cc:file:buildUUIDMap')
    const result = await h({}, dir)
    expect(Object.keys(result)).toHaveLength(0)
  })
})

// ── cc:file:extractUUIDs ───────────────────────────────────────────────────────

describe('cc:file:extractUUIDs', () => {
  it('extractReferencedUUIDs 결과 반환', async () => {
    mockExtractReferencedUUIDs.mockReturnValue(['uuid-a', 'uuid-b'])

    const h = getHandler('cc:file:extractUUIDs')
    const raw = [{ __type__: 'cc.Sprite', _spriteFrame: { __uuid__: 'uuid-a' } }]
    const result = await h({}, raw)
    expect(result).toEqual(['uuid-a', 'uuid-b'])
  })

  it('빈 배열 인자 → 빈 배열 반환', async () => {
    mockExtractReferencedUUIDs.mockReturnValue([])
    const h = getHandler('cc:file:extractUUIDs')
    const result = await h({}, [])
    expect(result).toEqual([])
  })
})

// ── cc:file:watch / unwatch ────────────────────────────────────────────────────

describe('cc:file:watch / unwatch', () => {
  it('cc:file:watch — ccFileWatcher.watch 호출', async () => {
    mockCCFileWatcher.watch.mockResolvedValue(undefined)
    mockCCFileWatcher.watchedCount = 1

    const h = getHandler('cc:file:watch')
    const result = await h({}, '/proj/scenes/main.fire')
    expect(mockCCFileWatcher.watch).toHaveBeenCalledWith('/proj/scenes/main.fire')
    expect(result.watching).toBe(1)
  })

  it('cc:file:unwatch — paths 있으면 unwatch 호출', async () => {
    mockCCFileWatcher.watchedCount = 0

    const h = getHandler('cc:file:unwatch')
    const result = await h({}, '/proj/scenes/main.fire')
    expect(mockCCFileWatcher.unwatch).toHaveBeenCalledWith('/proj/scenes/main.fire')
    expect(result.watching).toBe(0)
  })

  it('cc:file:unwatch — paths 없으면 close 호출', async () => {
    mockCCFileWatcher.close.mockResolvedValue(undefined)
    mockCCFileWatcher.watchedCount = 0

    const h = getHandler('cc:file:unwatch')
    await h({}, undefined)
    expect(mockCCFileWatcher.close).toHaveBeenCalled()
  })
})

// ── cc:file:isLargeScene ───────────────────────────────────────────────────────

describe('cc:file:isLargeScene', () => {
  it('isLargeScene true 반환', async () => {
    mockIsLargeScene.mockReturnValue(true)

    const h = getHandler('cc:file:isLargeScene')
    const result = await h({}, '/proj/big.fire')
    expect(result).toBe(true)
  })

  it('isLargeScene false 반환', async () => {
    mockIsLargeScene.mockReturnValue(false)

    const h = getHandler('cc:file:isLargeScene')
    const result = await h({}, '/proj/small.fire')
    expect(result).toBe(false)
  })

  it('예외 발생 시 false 반환', async () => {
    mockIsLargeScene.mockImplementation(() => { throw new Error('fail') })

    const h = getHandler('cc:file:isLargeScene')
    const result = await h({}, '/proj/error.fire')
    expect(result).toBe(false)
  })
})

// ── cc:file backup operations ─────────────────────────────────────────────────

describe('cc:file backup operations', () => {
  it('cc:file:restoreBackup — restoreFromBackup 호출', async () => {
    mockRestoreFromBackup.mockReturnValue({ success: true })

    const h = getHandler('cc:file:restoreBackup')
    const result = await h({}, '/proj/main.fire')
    expect(mockRestoreFromBackup).toHaveBeenCalledWith('/proj/main.fire')
    expect(result.success).toBe(true)
  })

  it('cc:file:listBakFiles — listBakFiles 결과 반환', async () => {
    mockListBakFiles.mockReturnValue(['/proj/main.fire.bak1', '/proj/main.fire.bak2'])

    const h = getHandler('cc:file:listBakFiles')
    const result = await h({}, '/proj/main.fire')
    expect(result).toHaveLength(2)
  })

  it('cc:file:deleteAllBakFiles — deleteAllBakFiles 호출', async () => {
    mockDeleteAllBakFiles.mockReturnValue({ deleted: 3 })

    const h = getHandler('cc:file:deleteAllBakFiles')
    const result = await h({}, '/proj/main.fire')
    expect(mockDeleteAllBakFiles).toHaveBeenCalledWith('/proj/main.fire')
    expect(result.deleted).toBe(3)
  })

  it('cc:file:restoreFromBak — restoreFromBakFile 호출', async () => {
    mockRestoreFromBakFile.mockReturnValue({ success: true })

    const h = getHandler('cc:file:restoreFromBak')
    const result = await h({}, '/proj/main.fire.bak1', '/proj/main.fire')
    expect(mockRestoreFromBakFile).toHaveBeenCalledWith('/proj/main.fire.bak1', '/proj/main.fire')
    expect(result.success).toBe(true)
  })
})

// ── cc:file:readSceneChunked ───────────────────────────────────────────────────

describe('cc:file:readSceneChunked', () => {
  it('parseCCSceneChunked 결과 반환', async () => {
    const mockChunk = { root: null, chunkTotal: 5, chunkIndex: 0, nodes: [] }
    mockParseCCSceneChunked.mockResolvedValue(mockChunk)

    const h = getHandler('cc:file:readSceneChunked')
    const result = await h({}, '/proj/main.fire', { version: '2x' }, 50, 0)
    expect(mockParseCCSceneChunked).toHaveBeenCalledWith('/proj/main.fire', { version: '2x' }, 50, 0, undefined)
    expect(result.chunkTotal).toBe(5)
  })

  it('예외 발생 시 { error: string } 반환', async () => {
    mockParseCCSceneChunked.mockRejectedValue(new Error('chunk fail'))

    const h = getHandler('cc:file:readSceneChunked')
    const result = await h({}, '/bad.fire', { version: '2x' }, 50, 0)
    expect(result.error).toContain('chunk fail')
  })
})

// ── cc:file:resolveTexture ─────────────────────────────────────────────────────

describe('cc:file:resolveTexture', () => {
  it('UUID 없으면 null', async () => {
    const h = getHandler('cc:file:resolveTexture')
    const result = await h({}, 'missing-uuid', '/assets')
    expect(result).toBeNull()
  })

  it('texture 타입 — base64 data URL 반환', async () => {
    const dir = uid()
    const uuid = 'tex-only-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/bg.png`, relPath: 'bg.png', type: 'texture' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('png-content'))

    const h = getHandler('cc:file:resolveTexture')
    const result = await h({}, uuid, dir)
    expect(result).toContain('data:image/png;base64,')
  })

  it('jpg 확장자 — mime image/jpeg', async () => {
    const dir = uid()
    const uuid = 'jpg-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/photo.jpg`, relPath: 'photo.jpg', type: 'texture' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('jpg-content'))

    const h = getHandler('cc:file:resolveTexture')
    const result = await h({}, uuid, dir)
    expect(result).toContain('data:image/jpeg;base64,')
  })

  it('script 타입 — null 반환', async () => {
    const dir = uid()
    const uuid = 'script-only-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/main.ts`, relPath: 'main.ts', type: 'script' }]])
    mockBuildUUIDMap.mockResolvedValue(map)

    const h = getHandler('cc:file:resolveTexture')
    const result = await h({}, uuid, dir)
    expect(result).toBeNull()
  })

  it('webp 확장자 — mime image/webp', async () => {
    const dir = uid()
    const uuid = 'webp-uuid'
    const map = new Map([[uuid, { uuid, path: `${dir}/img.webp`, relPath: 'img.webp', type: 'texture' }]])
    mockBuildUUIDMap.mockResolvedValue(map)
    mockReadFile.mockResolvedValue(Buffer.from('webp-content'))

    const h = getHandler('cc:file:resolveTexture')
    const result = await h({}, uuid, dir)
    expect(result).toContain('data:image/webp;base64,')
  })
})
