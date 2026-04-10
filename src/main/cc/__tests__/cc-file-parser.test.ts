import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs and cc-asset-resolver before importing the module
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}))

vi.mock('../cc-asset-resolver', () => ({
  buildUUIDMap: vi.fn(() => new Map()),
}))

import fs from 'fs'
import { parseCCScene } from '../cc-file-parser'
import type { CCFileProjectInfo } from '../../../shared/ipc-schema'

const mockReadFileSync = vi.mocked(fs.readFileSync)

// ── helpers ──────────────────────────────────────────────────────────────────

function make2xRaw(overrides: Record<string, unknown> = {}) {
  return [
    // [0] cc.SceneAsset
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    // [1] cc.Scene (root)
    {
      __type__: 'cc.Scene',
      _name: 'TestScene',
      _active: true,
      _id: 'scene-uuid',
      _children: [{ __id__: 2 }],
      _components: [],
      _trs: {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      _contentSize: { width: 0, height: 0 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
      ...overrides,
    },
    // [2] child node
    {
      __type__: 'cc.Node',
      _name: 'ChildNode',
      _active: true,
      _id: 'child-uuid',
      _children: [],
      _components: [{ __id__: 3 }],
      _trs: {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [100, 200, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      _contentSize: { width: 200, height: 100 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 128,
      _color: { r: 255, g: 0, b: 0, a: 255 },
      _tag: 42,
    },
    // [3] cc.Label component
    {
      __type__: 'cc.Label',
      node: { __id__: 2 },
      _enabled: true,
      _N$string: 'Hello World',
      _N$fontSize: 32,
      _N$lineHeight: 40,
      _N$horizontalAlign: 1,
    },
  ]
}

function make3xRaw() {
  return [
    // [0] cc.SceneAsset
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    // [1] cc.Scene (root)
    {
      __type__: 'cc.Scene',
      _name: 'Scene3x',
      _active: true,
      _id: 'scene-3x-uuid',
      _children: [{ __id__: 2 }],
      _components: [],
      _lpos: { x: 0, y: 0, z: 0 },
      _lrot: { x: 0, y: 0, z: 0, w: 1 },
      _lscale: { x: 1, y: 1, z: 1 },
      _uiProps: { _localOpacity: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 },
      layer: 33554432,
    },
    // [2] child node
    {
      __type__: 'cc.Node',
      _name: 'Child3x',
      _active: true,
      _id: 'child-3x-uuid',
      _children: [],
      _components: [{ __id__: 4 }],
      _lpos: { x: 50, y: 100, z: 0 },
      _lrot: { x: 0, y: 0, z: 0.707, w: 0.707 },
      _lscale: { x: 2, y: 2, z: 1 },
      _uiProps: { _localOpacity: 0.5 },
      _color: { r: 0, g: 255, b: 0, a: 200 },
      layer: 33554432,
    },
    // [3] cc.UITransform for node[2]
    {
      __type__: 'cc.UITransform',
      node: { __id__: 2 },
      _contentSize: { width: 300, height: 150 },
      _anchorPoint: { x: 0, y: 1 },
    },
    // [4] cc.Label component
    {
      __type__: 'cc.Label',
      node: { __id__: 2 },
      _enabled: true,
      _string: 'Hello 3x',
      _fontSize: 24,
      _lineHeight: 30,
    },
  ]
}

const projectInfo2x: CCFileProjectInfo = { detected: true, version: '2x' }
const projectInfo3x: CCFileProjectInfo = { detected: true, version: '3x' }

// ── tests ────────────────────────────────────────────────────────────────────

describe('cc-file-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseCCScene — 2.x basic', () => {
    it('should parse a 2.x scene into a node tree', () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)

      expect(result.root.name).toBe('TestScene')
      expect(result.root.uuid).toBe('scene-uuid')
      expect(result.root.children).toHaveLength(1)

      const child = result.root.children[0]
      expect(child.name).toBe('ChildNode')
      expect(child.uuid).toBe('child-uuid')
      expect(child.position).toEqual({ x: 100, y: 200, z: 0 })
      expect(child.opacity).toBe(128)
      expect(child.color).toEqual({ r: 255, g: 0, b: 0, a: 255 })
      expect(child.size).toEqual({ x: 200, y: 100 })
      expect(child.tag).toBe(42)
    })

    it('should preserve _rawIndex for each node', () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)

      expect(result.root._rawIndex).toBe(1)
      expect(result.root.children[0]._rawIndex).toBe(2)
    })

    it('should parse components with props', () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.components).toHaveLength(1)
      expect(child.components[0].type).toBe('cc.Label')
      expect(child.components[0].props.string).toBe('Hello World')
      expect(child.components[0].props.fontSize).toBe(32)
      expect(child.components[0]._rawIndex).toBe(3)
    })

    it('should store _raw for roundtrip saving', () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result._raw).toBeDefined()
      expect(Array.isArray(result._raw)).toBe(true)
      expect(result._raw).toHaveLength(raw.length)
    })
  })

  describe('parseCCScene — 2.x _trs decoding', () => {
    it('should decode _trs TypedArray with array field', () => {
      const raw = make2xRaw()
      // Set specific position/rotation/scale via _trs
      ;(raw[2] as Record<string, unknown>)._trs = {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [10, 20, 30, 0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 2, 3, 4],
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.position).toEqual({ x: 10, y: 20, z: 30 })
      expect(child.scale).toEqual({ x: 2, y: 3, z: 4 })
      // rotation should be ~90 degrees (qz=sin(45deg), qw=cos(45deg))
      expect(child.rotation).toBeCloseTo(90, 0)
    })

    it('should decode base64-encoded _trs (Float64Array)', () => {
      // Create a Float64Array with known values and encode to base64
      const values = [100, 200, 0, 0, 0, 0, 1, 1.5, 2.5, 1]
      const buf = Buffer.alloc(values.length * 8)
      values.forEach((v, i) => buf.writeDoubleLE(v, i * 8))
      const b64 = buf.toString('base64')

      const raw = make2xRaw()
      ;(raw[2] as Record<string, unknown>)._trs = {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: b64,
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.position.x).toBeCloseTo(100)
      expect(child.position.y).toBeCloseTo(200)
      expect(child.scale.x).toBeCloseTo(1.5)
      expect(child.scale.y).toBeCloseTo(2.5)
    })

    it('should fall back to _position/_scale fields when _trs is missing', () => {
      const raw = make2xRaw()
      const node = raw[2] as Record<string, unknown>
      delete node._trs
      node._position = { x: 55, y: 66, z: 0 }
      node._scale = { x: 3, y: 3, z: 1 }
      node._rotation = { x: 0, y: 0, z: 0, w: 1 }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.position).toEqual({ x: 55, y: 66, z: 0 })
      expect(child.scale).toEqual({ x: 3, y: 3, z: 1 })
      expect(child.rotation).toBeCloseTo(0)
    })
  })

  describe('parseCCScene — 3.x', () => {
    it('should parse a 3.x scene with _lpos/_lrot/_lscale', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect(child.name).toBe('Child3x')
      expect(child.position).toEqual({ x: 50, y: 100, z: 0 })
      expect(child.scale).toEqual({ x: 2, y: 2, z: 1 })
    })

    it('should convert 3.x _lrot quaternion to euler Z degrees', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      // _lrot: { x:0, y:0, z:0.707, w:0.707 } → euler Z ≈ 90 degrees
      expect((child.rotation as { x: number; y: number; z: number }).z).toBeCloseTo(90, 0)
      expect((child.rotation as { x: number; y: number; z: number }).x).toBe(0)
      expect((child.rotation as { x: number; y: number; z: number }).y).toBe(0)
    })

    it('should map UITransform size/anchor to node', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect(child.size).toEqual({ x: 300, y: 150 })
      expect(child.anchor).toEqual({ x: 0, y: 1 })
    })

    it('should convert _localOpacity (0~1) to opacity (0~255)', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      // _localOpacity: 0.5 -> 128 (rounded)
      expect(child.opacity).toBe(128)
    })

    it('should preserve _lrotW for roundtrip', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      // _lrot.w = 0.707 should be preserved as _lrotW
      expect(child._lrotW).toBeCloseTo(0.707, 2)
    })

    it('should parse 3.x label component props', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect(child.components).toHaveLength(1)
      expect(child.components[0].type).toBe('cc.Label')
      expect(child.components[0].props.string).toBe('Hello 3x')
      expect(child.components[0].props.fontSize).toBe(24)
    })
  })

  describe('version detection', () => {
    it('should auto-detect 2.x from _trs field when version is not specified', () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', { detected: true })
      // Should parse successfully as 2x (the _trs field triggers 2x detection)
      expect(result.root).toBeDefined()
      expect(result.root.name).toBe('TestScene')
    })

    it('should auto-detect 3.x from _lpos field when version is not specified', () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.scene', { detected: true })
      // Should parse successfully as 3x (the _lpos field triggers 3x detection)
      expect(result.root).toBeDefined()
      expect(result.root.name).toBe('Scene3x')
    })
  })

  describe('edge cases', () => {
    it('should throw on invalid JSON', () => {
      mockReadFileSync.mockReturnValue('not valid json')

      expect(() => parseCCScene('/fake/bad.fire', projectInfo2x)).toThrow('씬 파일 파싱 실패')
    })

    it('should throw when root node is not found', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify([{ __type__: 'cc.SomeOther' }]))

      expect(() => parseCCScene('/fake/empty.fire', projectInfo2x)).toThrow('씬 루트 노드를 찾을 수 없습니다')
    })

    it('should handle missing _anchorPoint by defaulting to 0.5, 0.5', () => {
      const raw = make2xRaw()
      delete (raw[2] as Record<string, unknown>)._anchorPoint
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result.root.children[0].anchor).toEqual({ x: 0.5, y: 0.5 })
    })

    it('should handle missing _opacity by defaulting to 255', () => {
      const raw = make2xRaw()
      delete (raw[2] as Record<string, unknown>)._opacity
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result.root.children[0].opacity).toBe(255)
    })
  })
})
