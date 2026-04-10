import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fs before importing
vi.mock('fs', () => {
  const statResult = { mtimeMs: 1000, size: 100 }
  return {
    default: {
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      renameSync: vi.fn(),
      statSync: vi.fn(() => statResult),
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      unlinkSync: vi.fn(),
    },
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    renameSync: vi.fn(),
    statSync: vi.fn(() => statResult),
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn(() => []),
    unlinkSync: vi.fn(),
  }
})

import fs from 'fs'
import {
  saveCCScene,
  validateCCScene,
  recordSceneMtime,
  forceOverwriteScene,
  clearMtimeMap,
  listBakFiles,
  deleteAllBakFiles,
  restoreFromBakFile,
  restoreFromBackup,
} from '../cc-file-saver'
import type { CCSceneNode, CCSceneFile } from '../../../shared/ipc-schema'

const mockStatSync = vi.mocked(fs.statSync)
const mockWriteFileSync = vi.mocked(fs.writeFileSync)
const mockRenameSync = vi.mocked(fs.renameSync)
const mockCopyFileSync = vi.mocked(fs.copyFileSync)

// ── helpers ──────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid: 'root-uuid',
    name: 'Root',
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [],
    children: [],
    _rawIndex: 0,
    ...overrides,
  }
}

function makeChildNode(overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return makeNode({
    uuid: 'child-uuid',
    name: 'Child',
    position: { x: 10, y: 20, z: 0 },
    _rawIndex: 1,
    ...overrides,
  })
}

function makeSceneFile(
  root: CCSceneNode,
  raw: Record<string, unknown>[] | undefined = undefined,
  version: '2x' | '3x' = '2x'
): CCSceneFile {
  const defaultRaw = [
    {
      __type__: 'cc.Node',
      _name: 'Root',
      _active: true,
      _children: [{ __id__: 1 }],
      _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { width: 100, height: 100 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
    },
    {
      __type__: 'cc.Node',
      _name: 'Child',
      _active: true,
      _children: [],
      _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [10, 20, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { width: 50, height: 50 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
    },
  ]

  return {
    projectInfo: { detected: true, version },
    scenePath: '/fake/scene.fire',
    root,
    _raw: raw ?? defaultRaw,
  }
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('cc-file-saver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mtime by default: statSync returns consistent mtimeMs
    mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
  })

  describe('saveCCScene — basic 2x', () => {
    it('should save successfully with backup', () => {
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      expect(result.backupPath).toBe('/fake/scene.fire.bak')
      // Verify backup was created
      expect(mockCopyFileSync).toHaveBeenCalledWith('/fake/scene.fire', '/fake/scene.fire.bak')
      // Verify temp file was written and renamed
      expect(mockWriteFileSync).toHaveBeenCalledWith('/fake/scene.fire.tmp', expect.any(String), 'utf-8')
      expect(mockRenameSync).toHaveBeenCalledWith('/fake/scene.fire.tmp', '/fake/scene.fire')
    })

    it('should return error when _raw is missing', () => {
      const root = makeNode()
      const sceneFile: CCSceneFile = {
        projectInfo: { detected: true, version: '2x' },
        scenePath: '/fake/scene.fire',
        root,
      }

      const result = saveCCScene(sceneFile, root)
      expect(result.success).toBe(false)
      expect(result.error).toContain('_raw')
    })
  })

  describe('patch2x — position/rotation/scale', () => {
    it('should patch _trs array with updated position/rotation/scale', () => {
      const modifiedRoot = makeNode({
        position: { x: 50, y: 75, z: 0 },
        rotation: { x: 0, y: 0, z: 45 },
        scale: { x: 2, y: 2, z: 1 },
        children: [],
      })
      const sceneFile = makeSceneFile(modifiedRoot, [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ])

      saveCCScene(sceneFile, modifiedRoot)

      // Inspect what was written
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      const trs = writtenRaw[0]._trs.array

      expect(trs[0]).toBe(50)   // x
      expect(trs[1]).toBe(75)   // y
      expect(trs[7]).toBe(2)    // scaleX
      expect(trs[8]).toBe(2)    // scaleY
      // Rotation 45 degrees -> qz = sin(22.5deg), qw = cos(22.5deg)
      expect(trs[5]).toBeCloseTo(Math.sin(45 * Math.PI / 360), 5)
      expect(trs[6]).toBeCloseTo(Math.cos(45 * Math.PI / 360), 5)
    })

    it('should patch _contentSize and _anchorPoint', () => {
      const modifiedRoot = makeNode({
        size: { x: 300, y: 200 },
        anchor: { x: 0, y: 1 },
        children: [],
      })
      const sceneFile = makeSceneFile(modifiedRoot, [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ])

      saveCCScene(sceneFile, modifiedRoot)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      expect(writtenRaw[0]._contentSize).toEqual({ width: 300, height: 200 })
      expect(writtenRaw[0]._anchorPoint).toEqual({ x: 0, y: 1 })
    })
  })

  describe('patch3x — _lpos/_lrot/_lscale', () => {
    it('should patch _lpos, _lrot, _lscale for 3.x nodes', () => {
      const modifiedRoot = makeNode({
        position: { x: 100, y: 200, z: 50 },
        rotation: { x: 0, y: 0, z: 60 },  // euler 60 degrees
        scale: { x: 3, y: 3, z: 1 },
        children: [],
      })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
      ]
      const sceneFile = makeSceneFile(modifiedRoot, raw3x, '3x')

      saveCCScene(sceneFile, modifiedRoot)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      expect(writtenRaw[0]._lpos).toEqual({ x: 100, y: 200, z: 50 })
      expect(writtenRaw[0]._lscale).toEqual({ x: 3, y: 3, z: 1 })
      // euler 60 degrees → quaternion: qz=sin(30deg)=0.5, qw=cos(30deg)≈0.866
      expect(writtenRaw[0]._lrot.z).toBeCloseTo(0.5, 3)
      expect(writtenRaw[0]._lrot.w).toBeCloseTo(0.866, 2)
    })

    it('should convert euler Z to quaternion for _lrot (roundtrip verification)', () => {
      // 45 degrees euler → qz=sin(22.5deg)≈0.3827, qw=cos(22.5deg)≈0.9239
      const modifiedRoot = makeNode({
        rotation: { x: 0, y: 0, z: 45 },  // euler 45 degrees
        children: [],
      })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
      ]
      const sceneFile = makeSceneFile(modifiedRoot, raw3x, '3x')

      saveCCScene(sceneFile, modifiedRoot)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      // euler 45deg → qz=sin(22.5deg), qw=cos(22.5deg)
      expect(writtenRaw[0]._lrot.z).toBeCloseTo(Math.sin(45 * Math.PI / 360), 5)
      expect(writtenRaw[0]._lrot.w).toBeCloseTo(Math.cos(45 * Math.PI / 360), 5)
    })

    it('should produce identity quaternion for 0-degree rotation', () => {
      const modifiedRoot = makeNode({
        rotation: { x: 0, y: 0, z: 0 },  // euler 0 degrees
        children: [],
      })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
      ]
      const sceneFile = makeSceneFile(modifiedRoot, raw3x, '3x')

      saveCCScene(sceneFile, modifiedRoot)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      // 0 degrees → identity quaternion: qz=0, qw=1
      expect(writtenRaw[0]._lrot).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    })
  })

  describe('normalizeTree — new node assignment', () => {
    it('should assign _rawIndex to new nodes (null _rawIndex)', () => {
      const newChild = makeChildNode({ _rawIndex: undefined as unknown as number })
      const root = makeNode({ children: [newChild] })
      const sceneFile = makeSceneFile(root, [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ])

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      // The new child should have been added to raw array
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      // Original had 1 entry, new child adds 1 more = 2
      expect(writtenRaw.length).toBe(2)
      expect(writtenRaw[1]._name).toBe('Child')
    })
  })

  describe('mtime conflict detection', () => {
    it('should detect conflict when mtime has changed since load', () => {
      // Record initial mtime
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      // Now simulate external change: mtime is different
      mockStatSync.mockReturnValue({ mtimeMs: 5000, size: 200 } as ReturnType<typeof fs.statSync>)

      const root = makeNode({ children: [] })
      const sceneFile = makeSceneFile(root, [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ])

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(false)
      expect(result.conflict).toBe(true)
      expect(result.currentMtime).toBe(5000)
    })

    it('should save normally when mtime has not changed', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      // mtime unchanged
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)

      const root = makeNode({ children: [] })
      const sceneFile = makeSceneFile(root, [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ])

      const result = saveCCScene(sceneFile, root)
      expect(result.success).toBe(true)
    })

    it('forceOverwriteScene should bypass mtime check', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      // mtime changed
      mockStatSync.mockReturnValue({ mtimeMs: 9999, size: 200 } as ReturnType<typeof fs.statSync>)

      const root = makeNode({ children: [] })
      const sceneFile = makeSceneFile(root, [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ])

      const result = forceOverwriteScene(sceneFile, root)
      expect(result.success).toBe(true)
    })
  })

  describe('validateCCScene', () => {
    it('should pass for a valid tree', () => {
      const root = makeNode({
        children: [makeChildNode()],
      })

      const result = validateCCScene(root)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect duplicate UUIDs', () => {
      const child1 = makeChildNode({ uuid: 'dup-uuid' })
      const child2 = makeChildNode({ uuid: 'dup-uuid', name: 'Child2', _rawIndex: 2 })
      const root = makeNode({ children: [child1, child2] })

      const result = validateCCScene(root)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('중복 UUID'))).toBe(true)
    })

    it('should warn about null _rawIndex', () => {
      const child = makeChildNode({ _rawIndex: undefined as unknown as number })
      const root = makeNode({ children: [child] })

      const result = validateCCScene(root)

      expect(result.warnings.some(w => w.includes('_rawIndex 없음'))).toBe(true)
    })

    it('should detect circular references', () => {
      const child = makeChildNode()
      // Create circular: child's children point back to itself via same uuid
      const circularChild = makeNode({
        uuid: child.uuid, // same uuid as parent = cycle
        name: 'CircularChild',
        _rawIndex: 3,
        children: [],
      })
      child.children = [circularChild]
      const root = makeNode({ children: [child] })

      const result = validateCCScene(root)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('순환 참조'))).toBe(true)
    })
  })

  // ── clearMtimeMap ──────────────────────────────────────────────────────────

  describe('clearMtimeMap', () => {
    afterEach(() => {
      clearMtimeMap()
    })

    it('특정 projectPath prefix를 가진 키만 삭제한다', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 5000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/project/a/scene.fire')
      recordSceneMtime('/project/b/scene.fire')
      recordSceneMtime('/other/scene.fire')

      clearMtimeMap('/project/a')

      // /project/a가 삭제되었으면 conflict 없이 저장 가능해야 함
      // recordSceneMtime 후 statSync가 다른 값 반환하면 conflict 발생
      mockStatSync.mockReturnValue({ mtimeMs: 9999, size: 100 } as ReturnType<typeof fs.statSync>)

      const root = makeNode({ children: [makeChildNode()] })
      // /project/a 는 삭제됐으니 mtime 체크 없이 저장됨 (sceneFile의 scenePath가 달라도 검증 로직 상)
      const sceneFileA: CCSceneFile = makeSceneFile(root) // /fake/scene.fire (clearMtimeMap 미기록)
      const res = saveCCScene(sceneFileA, root)
      expect(res.success).toBe(true)
    })

    it('인자 없이 호출하면 전체 클리어', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')
      clearMtimeMap()

      // mtime이 클리어됐으므로 conflict 없이 저장됨
      mockStatSync.mockReturnValue({ mtimeMs: 9999, size: 100 } as ReturnType<typeof fs.statSync>)
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = saveCCScene(sceneFile, root)
      expect(res.success).toBe(true)
    })
  })

  // ── 충돌 감지 추가 시나리오 ──────────────────────────────────────────────

  describe('saveCCScene — conflict detection (추가)', () => {
    afterEach(() => {
      clearMtimeMap()
    })

    it('mtime 차이가 정확히 100ms이면 conflict 아님', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      // 100ms 차이 → abs(1100-1000)=100 → 100 > 100 → false → conflict 아님
      mockStatSync.mockReturnValue({ mtimeMs: 1100, size: 100 } as ReturnType<typeof fs.statSync>)
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = saveCCScene(sceneFile, root)
      expect(res.conflict).toBeUndefined()
    })

    it('mtime 차이가 101ms이면 conflict', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      mockStatSync.mockReturnValue({ mtimeMs: 1101, size: 100 } as ReturnType<typeof fs.statSync>)
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = saveCCScene(sceneFile, root)
      expect(res.conflict).toBe(true)
      expect(res.success).toBe(false)
    })

    it('mtime이 감소해도 차이가 101ms이면 conflict', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 2000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      mockStatSync.mockReturnValue({ mtimeMs: 1800, size: 100 } as ReturnType<typeof fs.statSync>)
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = saveCCScene(sceneFile, root)
      expect(res.conflict).toBe(true)
    })

    it('conflict 시 currentMtime을 반환한다', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      mockStatSync.mockReturnValue({ mtimeMs: 5000, size: 100 } as ReturnType<typeof fs.statSync>)
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = saveCCScene(sceneFile, root)
      expect(res.currentMtime).toBe(5000)
    })

    it('forceOverwriteScene은 conflict를 무시하고 저장한다', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      mockStatSync.mockReturnValue({ mtimeMs: 9999, size: 100 } as ReturnType<typeof fs.statSync>)
      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = forceOverwriteScene(sceneFile, root)
      expect(res.success).toBe(true)
      expect(res.conflict).toBeUndefined()
    })

    it('statSync가 예외를 던지면 conflict 없이 저장된다', () => {
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      recordSceneMtime('/fake/scene.fire')

      mockStatSync.mockImplementation(() => { throw new Error('file deleted') })
      vi.mocked(fs.copyFileSync).mockImplementation(() => {})
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})
      vi.mocked(fs.renameSync).mockImplementation(() => {})

      const root = makeNode({ children: [makeChildNode()] })
      const sceneFile = makeSceneFile(root)
      const res = saveCCScene(sceneFile, root)
      expect(res.conflict).toBeUndefined()
    })
  })

  // ── 새 키 자동 생성 (enabled 키 생성) ────────────────────────────────────────

  describe('컴포넌트 props — 새 키 자동 생성', () => {
    afterEach(() => {
      clearMtimeMap()
    })

    it('2x: 기존 raw entry에 없는 key → _N$ prefix로 신규 생성된다', () => {
      const root = makeNode({
        children: [],
        components: [{
          type: 'cc.Label',
          props: { string: 'NewText', enabled: true },
          _rawIndex: 1,
        }],
      })
      const raw2x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [{ __id__: 1 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
        {
          __type__: 'cc.Label',
          node: { __id__: 0 },
          _enabled: true,
          // 'string' 키 없음 → _N$string으로 신규 생성됨
        },
      ]
      const sceneFile = makeSceneFile(root, raw2x)

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      // 'string' 없음 → '_N$string' 생성
      expect(writtenRaw[1]['_N$string']).toBe('NewText')
    })

    it('2x: 기존 raw entry에 _N$string이 있으면 해당 키를 업데이트한다', () => {
      const root = makeNode({
        children: [],
        components: [{
          type: 'cc.Label',
          props: { string: 'Updated' },
          _rawIndex: 1,
        }],
      })
      const raw2x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [{ __id__: 1 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
        {
          __type__: 'cc.Label',
          node: { __id__: 0 },
          _enabled: true,
          '_N$string': 'Original',
        },
      ]
      const sceneFile = makeSceneFile(root, raw2x)

      saveCCScene(sceneFile, root)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      expect(writtenRaw[1]['_N$string']).toBe('Updated')
    })

    it('3x: 기존 raw entry에 없는 key → _ prefix로 신규 생성된다', () => {
      const root = makeNode({
        children: [],
        rotation: { x: 0, y: 0, z: 0 },
        components: [{
          type: 'cc.Label',
          props: { string: '3xNew', enabled: true },
          _rawIndex: 1,
        }],
      })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [{ __id__: 1 }],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
        {
          __type__: 'cc.Label',
          node: { __id__: 0 },
          _enabled: true,
          // 'string' 키 없음 → _string으로 신규 생성됨
        },
      ]
      const sceneFile = makeSceneFile(root, raw3x, '3x')

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      expect(writtenRaw[1]['_string']).toBe('3xNew')
    })
  })

  // ── COMP_DEFAULT 확장 (Camera, ParticleSystem) ─────────────────────────────

  describe('새 노드 추가 — COMP_DEFAULT 기본값 포함', () => {
    afterEach(() => {
      clearMtimeMap()
    })

    it('2x: 새 cc.Camera 컴포넌트 생성 시 COMP_DEFAULT_2x 기본값이 포함된다', () => {
      const newChild = makeChildNode({
        _rawIndex: undefined as unknown as number,
        components: [{
          type: 'cc.Camera',
          props: {},
          _rawIndex: undefined as unknown as number,
        }],
      })
      const root = makeNode({ children: [newChild] })
      const raw2x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ]
      const sceneFile = makeSceneFile(root, raw2x)

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      // 새 노드(idx 1) + 새 Camera 컴포넌트(idx 2) 생성됨
      const cameraEntry = writtenRaw.find((e: Record<string, unknown>) => e.__type__ === 'cc.Camera')
      expect(cameraEntry).toBeDefined()
      // COMP_DEFAULT_2x['cc.Camera'] 기본값 포함
      expect(cameraEntry['_N$depth']).toBe(-1)
      expect(cameraEntry['_N$cullingMask']).toBe(4294967295)
    })

    it('2x: 새 cc.ParticleSystem 컴포넌트 생성 시 COMP_DEFAULT_2x 기본값이 포함된다', () => {
      const newChild = makeChildNode({
        _rawIndex: undefined as unknown as number,
        components: [{
          type: 'cc.ParticleSystem',
          props: {},
          _rawIndex: undefined as unknown as number,
        }],
      })
      const root = makeNode({ children: [newChild] })
      const raw2x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255,
          _color: { r: 255, g: 255, b: 255, a: 255 },
        },
      ]
      const sceneFile = makeSceneFile(root, raw2x)

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      const psEntry = writtenRaw.find((e: Record<string, unknown>) => e.__type__ === 'cc.ParticleSystem')
      expect(psEntry).toBeDefined()
      expect(psEntry['_N$playOnLoad']).toBe(true)
      expect(psEntry['_N$duration']).toBe(1)
    })

    it('3x: 새 cc.Camera 컴포넌트 생성 시 COMP_DEFAULT_3x 기본값이 포함된다', () => {
      const newChild = makeChildNode({
        _rawIndex: undefined as unknown as number,
        rotation: { x: 0, y: 0, z: 0 },
        components: [{
          type: 'cc.Camera',
          props: {},
          _rawIndex: undefined as unknown as number,
        }],
      })
      const root = makeNode({
        rotation: { x: 0, y: 0, z: 0 },
        children: [newChild],
      })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
      ]
      const sceneFile = makeSceneFile(root, raw3x, '3x')

      const result = saveCCScene(sceneFile, root)

      expect(result.success).toBe(true)
      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)
      const cameraEntry = writtenRaw.find((e: Record<string, unknown>) => e.__type__ === 'cc.Camera')
      expect(cameraEntry).toBeDefined()
      // COMP_DEFAULT_3x['cc.Camera'] 기본값 포함
      expect(cameraEntry['_projection']).toBe(0)
      expect(cameraEntry['_far']).toBe(1000)
    })
  })

  // ── listBakFiles ───────────────────────────────────────────────────────────

  describe('listBakFiles', () => {
    it('해당 씬 이름으로 시작하고 .bak으로 끝나는 파일만 반환한다', () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        'scene.fire.bak',
        'scene.fire.bak2',
        'other.fire.bak',
        'scene.fire.json',
      ] as unknown as ReturnType<typeof fs.readdirSync>)
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 512 } as ReturnType<typeof fs.statSync>)

      const result = listBakFiles('/project/scene.fire')
      expect(result.map(r => r.name)).toContain('scene.fire.bak')
      expect(result.find(r => r.name === 'other.fire.bak')).toBeUndefined()
      expect(result.find(r => r.name === 'scene.fire.json')).toBeUndefined()
    })

    it('mtime 내림차순으로 정렬한다', () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        'scene.fire.bak',
        'scene.fire.bak2',
      ] as unknown as ReturnType<typeof fs.readdirSync>)
      let callCount = 0
      mockStatSync.mockImplementation(() => {
        callCount++
        return { mtimeMs: callCount === 1 ? 1000 : 2000, size: 100 } as ReturnType<typeof fs.statSync>
      })

      const result = listBakFiles('/project/scene.fire')
      if (result.length >= 2) {
        expect(result[0].mtime).toBeGreaterThanOrEqual(result[1].mtime)
      }
    })

    it('readdirSync 실패 시 빈 배열 반환', () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error('no dir') })
      const result = listBakFiles('/project/scene.fire')
      expect(result).toEqual([])
    })

    it('각 파일에 name, path, size, mtime이 포함된다', () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        'scene.fire.bak',
      ] as unknown as ReturnType<typeof fs.readdirSync>)
      mockStatSync.mockReturnValue({ mtimeMs: 3000, size: 1024 } as ReturnType<typeof fs.statSync>)

      const result = listBakFiles('/project/scene.fire')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('scene.fire.bak')
      expect(result[0].size).toBe(1024)
      expect(result[0].mtime).toBe(3000)
    })
  })

  // ── deleteAllBakFiles ──────────────────────────────────────────────────────

  describe('deleteAllBakFiles', () => {
    it('모든 .bak 파일을 삭제하고 deleted 수를 반환한다', () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        'scene.fire.bak',
        'scene.fire.1234.bak',
      ] as unknown as ReturnType<typeof fs.readdirSync>)
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      vi.mocked(fs.unlinkSync).mockImplementation(() => {})

      const result = deleteAllBakFiles('/project/scene.fire')
      expect(result.deleted).toBe(2)
    })

    it('.bak 파일이 없으면 deleted=0', () => {
      vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>)
      const result = deleteAllBakFiles('/project/scene.fire')
      expect(result.deleted).toBe(0)
    })

    it('unlinkSync가 일부 실패해도 나머지는 계속 삭제한다', () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        'scene.fire.bak',
        'scene.fire.1234.bak',
      ] as unknown as ReturnType<typeof fs.readdirSync>)
      mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      let callCount = 0
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        callCount++
        if (callCount === 1) throw new Error('permission denied')
      })

      const result = deleteAllBakFiles('/project/scene.fire')
      expect(result.deleted).toBe(1)
    })
  })

  // ── restoreFromBakFile ─────────────────────────────────────────────────────

  describe('restoreFromBakFile', () => {
    it('bak 파일이 존재하면 복원 성공', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.copyFileSync).mockImplementation(() => {})

      const result = restoreFromBakFile('/project/scene.fire.bak', '/project/scene.fire')
      expect(result.success).toBe(true)
    })

    it('bak 파일이 없으면 실패 반환', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = restoreFromBakFile('/project/scene.fire.bak', '/project/scene.fire')
      expect(result.success).toBe(false)
      expect(result.error).toContain('존재하지 않습니다')
    })

    it('copyFileSync 실패 시 error 메시지 반환', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.copyFileSync).mockImplementation(() => { throw new Error('copy error') })

      const result = restoreFromBakFile('/project/scene.fire.bak', '/project/scene.fire')
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ── restoreFromBackup ──────────────────────────────────────────────────────

  describe('restoreFromBackup', () => {
    it('.bak 파일이 있으면 복원 성공', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.copyFileSync).mockImplementation(() => {})

      const result = restoreFromBackup('/project/scene.fire')
      expect(result.success).toBe(true)
    })

    it('.bak 파일이 없으면 실패', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = restoreFromBackup('/project/scene.fire')
      expect(result.success).toBe(false)
      expect(result.error).toContain('없습니다')
    })
  })

  // ── UITransform 자동 생성 (3x 전용) ──────────────────────────────────────

  describe('3x UITransform 자동 생성', () => {
    afterEach(() => {
      clearMtimeMap()
    })

    function make3xSceneFile(root: CCSceneNode, raw: Record<string, unknown>[]) {
      return makeSceneFile(root, raw, '3x')
    }

    it('3x 새 노드(_rawIndex 없음)에 UITransform이 자동 추가된다', () => {
      const newChild = makeChildNode({
        _rawIndex: undefined as unknown as number,
        size: { x: 200, y: 80 },
        anchor: { x: 0.5, y: 0.5 },
      })
      const root = makeNode({ children: [newChild] })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
      ]

      saveCCScene(make3xSceneFile(root, raw3x), root)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      // 원본 1개 + 새 노드 1개 + UITransform 1개 = 3개
      expect(writtenRaw.length).toBe(3)

      // 마지막 항목이 cc.UITransform이어야 함
      const uitEntry = writtenRaw.find((e: Record<string, unknown>) => e.__type__ === 'cc.UITransform')
      expect(uitEntry).toBeDefined()
      expect(uitEntry._contentSize).toEqual({ width: 200, height: 80 })
      expect(uitEntry._anchorPoint).toEqual({ x: 0.5, y: 0.5 })
    })

    it('3x 새 노드 UITransform의 node ref는 새 노드 인덱스를 가리킨다', () => {
      const newChild = makeChildNode({
        _rawIndex: undefined as unknown as number,
        size: { x: 100, y: 50 },
      })
      const root = makeNode({ children: [newChild] })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
      ]

      saveCCScene(make3xSceneFile(root, raw3x), root)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      // 새 노드는 index 1에 추가됨, UITransform의 node.__id__ = 1
      const uitEntry = writtenRaw.find((e: Record<string, unknown>) => e.__type__ === 'cc.UITransform')
      expect(uitEntry).toBeDefined()
      const nodeRef = uitEntry.node as { __id__: number }
      expect(nodeRef.__id__).toBe(1)
    })

    it('3x 기존 노드(_rawIndex 있음)에는 UITransform이 중복 추가되지 않는다', () => {
      const root = makeNode({ children: [] })
      const raw3x = [
        {
          __type__: 'cc.Node',
          _name: 'Root',
          _active: true,
          _children: [],
          _components: [{ __id__: 1 }],
          _lpos: { x: 0, y: 0, z: 0 },
          _lrot: { x: 0, y: 0, z: 0, w: 1 },
          _lscale: { x: 1, y: 1, z: 1 },
          _uiProps: { _localOpacity: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 },
          layer: 33554432,
        },
        {
          __type__: 'cc.UITransform',
          node: { __id__: 0 },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 },
        },
      ]

      saveCCScene(make3xSceneFile(root, raw3x), root)

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string
      const writtenRaw = JSON.parse(writtenContent)

      // 추가 없이 2개 유지
      expect(writtenRaw.length).toBe(2)
      const uitEntries = writtenRaw.filter((e: Record<string, unknown>) => e.__type__ === 'cc.UITransform')
      expect(uitEntries).toHaveLength(1)
    })
  })
})
