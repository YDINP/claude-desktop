import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    rotation: 0,
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
        rotation: 45,
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
        rotation: { x: 0, y: 0, z: 0.5 },
        scale: { x: 3, y: 3, z: 1 },
        _lrotW: 0.866,
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
    })

    it('should preserve _lrot.w (previous bug fix verification)', () => {
      const modifiedRoot = makeNode({
        rotation: { x: 0, y: 0, z: 0.383 },
        _lrotW: 0.924,
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

      // _lrot.w should be the preserved _lrotW value, NOT defaulting to 1
      expect(writtenRaw[0]._lrot.w).toBe(0.924)
    })

    it('should default _lrot.w to 1 when _lrotW is undefined', () => {
      const modifiedRoot = makeNode({
        rotation: { x: 0, y: 0, z: 0 },
        // _lrotW not set
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

      expect(writtenRaw[0]._lrot.w).toBe(1)
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
})
