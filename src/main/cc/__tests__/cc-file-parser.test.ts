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
  buildUUIDMap: vi.fn(() => Promise.resolve(new Map())),
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
    it('should parse a 2.x scene into a node tree', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)

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

    it('should preserve _rawIndex for each node', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)

      expect(result.root._rawIndex).toBe(1)
      expect(result.root.children[0]._rawIndex).toBe(2)
    })

    it('should parse components with props', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.components).toHaveLength(1)
      expect(child.components[0].type).toBe('cc.Label')
      expect(child.components[0].props.string).toBe('Hello World')
      expect(child.components[0].props.fontSize).toBe(32)
      expect(child.components[0]._rawIndex).toBe(3)
    })

    it('should store _raw for roundtrip saving', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result._raw).toBeDefined()
      expect(Array.isArray(result._raw)).toBe(true)
      expect(result._raw).toHaveLength(raw.length)
    })
  })

  describe('parseCCScene — 2.x _trs decoding', () => {
    it('should decode _trs TypedArray with array field', async () => {
      const raw = make2xRaw()
      // Set specific position/rotation/scale via _trs
      ;(raw[2] as Record<string, unknown>)._trs = {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [10, 20, 30, 0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 2, 3, 4],
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.position).toEqual({ x: 10, y: 20, z: 30 })
      expect(child.scale).toEqual({ x: 2, y: 3, z: 4 })
      // rotation should be ~90 degrees (qz=sin(45deg), qw=cos(45deg))
      expect(child.rotation.z).toBeCloseTo(90, 0)
      expect(child.rotation.x).toBe(0)
      expect(child.rotation.y).toBe(0)
    })

    it('should decode base64-encoded _trs (Float64Array)', async () => {
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

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.position.x).toBeCloseTo(100)
      expect(child.position.y).toBeCloseTo(200)
      expect(child.scale.x).toBeCloseTo(1.5)
      expect(child.scale.y).toBeCloseTo(2.5)
    })

    it('should fall back to _position/_scale fields when _trs is missing', async () => {
      const raw = make2xRaw()
      const node = raw[2] as Record<string, unknown>
      delete node._trs
      node._position = { x: 55, y: 66, z: 0 }
      node._scale = { x: 3, y: 3, z: 1 }
      node._rotation = { x: 0, y: 0, z: 0, w: 1 }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect(child.position).toEqual({ x: 55, y: 66, z: 0 })
      expect(child.scale).toEqual({ x: 3, y: 3, z: 1 })
      expect(child.rotation.z).toBeCloseTo(0)
    })
  })

  describe('parseCCScene — 3.x', () => {
    it('should parse a 3.x scene with _lpos/_lrot/_lscale', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect(child.name).toBe('Child3x')
      expect(child.position).toEqual({ x: 50, y: 100, z: 0 })
      expect(child.scale).toEqual({ x: 2, y: 2, z: 1 })
    })

    it('should convert 3.x _lrot quaternion to euler Z degrees', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      // _lrot: { x:0, y:0, z:0.707, w:0.707 } → euler Z ≈ 90 degrees
      expect((child.rotation as { x: number; y: number; z: number }).z).toBeCloseTo(90, 0)
      expect((child.rotation as { x: number; y: number; z: number }).x).toBe(0)
      expect((child.rotation as { x: number; y: number; z: number }).y).toBe(0)
    })

    it('should map UITransform size/anchor to node', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect(child.size).toEqual({ x: 300, y: 150 })
      expect(child.anchor).toEqual({ x: 0, y: 1 })
    })

    it('should convert _localOpacity (0~1) to opacity (0~255)', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      // _localOpacity: 0.5 -> 128 (rounded)
      expect(child.opacity).toBe(128)
    })

    it('should preserve _lrotW for roundtrip', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      // _lrot.w = 0.707 should be preserved as _lrotW
      expect(child._lrotW).toBeCloseTo(0.707, 2)
    })

    it('should parse 3.x label component props', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect(child.components).toHaveLength(1)
      expect(child.components[0].type).toBe('cc.Label')
      expect(child.components[0].props.string).toBe('Hello 3x')
      expect(child.components[0].props.fontSize).toBe(24)
    })
  })

  describe('parseCCScene — 3.x rotation accuracy (quaternion→euler)', () => {
    const rotCases: [string, number, number, number][] = [
      // [label, qz, qw, expectedEulerZ]
      ['0°',   0,                    1,                    0],
      ['30°',  Math.sin(15 * Math.PI / 180), Math.cos(15 * Math.PI / 180), 30],
      ['45°',  Math.sin(22.5 * Math.PI / 180), Math.cos(22.5 * Math.PI / 180), 45],
      ['90°',  Math.sin(45 * Math.PI / 180), Math.cos(45 * Math.PI / 180), 90],
      ['180°', Math.sin(90 * Math.PI / 180), Math.cos(90 * Math.PI / 180), 180],
      ['-45°', Math.sin(-22.5 * Math.PI / 180), Math.cos(22.5 * Math.PI / 180), -45],
    ]

    for (const [label, qz, qw, expectedZ] of rotCases) {
      it(`3.x _lrot quaternion → euler ${label}`, async () => {
        const raw = make3xRaw()
        ;(raw[2] as Record<string, unknown>)._lrot = { x: 0, y: 0, z: qz, w: qw }
        mockReadFileSync.mockReturnValue(JSON.stringify(raw))

        const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
        const child = result.root.children[0]
        const rot = child.rotation as { x: number; y: number; z: number }

        expect(rot.z).toBeCloseTo(expectedZ, 1)
        expect(rot.x).toBe(0)
        expect(rot.y).toBe(0)
      })
    }
  })

  describe('parseCCScene — roundtrip (parse → raw values preserved)', () => {
    it('2x: 파싱 후 _raw가 원본 배열과 동일하다 (라운드트립 기반)', async () => {
      const raw = make2xRaw()
      const rawStr = JSON.stringify(raw)
      mockReadFileSync.mockReturnValue(rawStr)

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      // _raw는 파싱 원본 그대로여야 함
      expect(JSON.stringify(result._raw)).toBe(rawStr)
    })

    it('2x: _rawIndex → _raw[_rawIndex]._name이 노드 이름과 일치한다', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      expect((result._raw![child._rawIndex] as Record<string, unknown>)._name).toBe(child.name)
    })

    it('3x: 파싱 후 _raw가 원본 배열과 동일하다 (라운드트립 기반)', async () => {
      const raw = make3xRaw()
      const rawStr = JSON.stringify(raw)
      mockReadFileSync.mockReturnValue(rawStr)

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      expect(JSON.stringify(result._raw)).toBe(rawStr)
    })

    it('3x: _rawIndex → _raw[_rawIndex]._name이 노드 이름과 일치한다', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const child = result.root.children[0]

      expect((result._raw![child._rawIndex] as Record<string, unknown>)._name).toBe(child.name)
    })

    it('3x: 파싱된 rotation.z → 저장 → 재파싱 시 동일 값 보존 (수학적 라운드트립)', () => {
      // 45° → qz/qw → 다시 euler로 복원
      const angleIn = 45
      const rad = angleIn * Math.PI / 180
      const qz = Math.sin(rad / 2), qw = Math.cos(rad / 2)
      // 복원: sinZ = 2*qw*qz, cosZ = 1 - 2*qz*qz
      const sinZ = 2 * qw * qz
      const cosZ = 1 - 2 * qz * qz
      const angleOut = Math.atan2(sinZ, cosZ) * (180 / Math.PI)

      expect(angleOut).toBeCloseTo(angleIn, 5)
    })

    it('2x: 파싱된 rotation(number) → 저장 → 재파싱 시 동일 값 보존 (수학적 라운드트립)', () => {
      // 90° → qz/qw → 다시 euler로 복원
      const angleIn = 90
      const rad = angleIn * Math.PI / 180
      const qz = Math.sin(rad / 2), qw = Math.cos(rad / 2)
      const sinZ = 2 * qw * qz
      const cosZ = 1 - 2 * qz * qz
      const angleOut = Math.atan2(sinZ, cosZ) * (180 / Math.PI)

      expect(angleOut).toBeCloseTo(angleIn, 5)
    })
  })

  describe('version detection', () => {
    it('should auto-detect 2.x from _trs field when version is not specified', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', { detected: true })
      // Should parse successfully as 2x (the _trs field triggers 2x detection)
      expect(result.root).toBeDefined()
      expect(result.root.name).toBe('TestScene')
    })

    it('should auto-detect 3.x from _lpos field when version is not specified', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', { detected: true })
      // Should parse successfully as 3x (the _lpos field triggers 3x detection)
      expect(result.root).toBeDefined()
      expect(result.root.name).toBe('Scene3x')
    })
  })

  describe('edge cases', () => {
    it('should throw on invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('not valid json')

      await expect(parseCCScene('/fake/bad.fire', projectInfo2x)).rejects.toThrow('씬 파일 파싱 실패')
    })

    it('should throw when root node is not found', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify([{ __type__: 'cc.SomeOther' }]))

      await expect(parseCCScene('/fake/empty.fire', projectInfo2x)).rejects.toThrow('씬 루트 노드를 찾을 수 없습니다')
    })

    it('should handle missing _anchorPoint by defaulting to 0.5, 0.5', async () => {
      const raw = make2xRaw()
      delete (raw[2] as Record<string, unknown>)._anchorPoint
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result.root.children[0].anchor).toEqual({ x: 0.5, y: 0.5 })
    })

    it('should handle missing _opacity by defaulting to 255', async () => {
      const raw = make2xRaw()
      delete (raw[2] as Record<string, unknown>)._opacity
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result.root.children[0].opacity).toBe(255)
    })
  })

  describe('rotation 타입 통일 — CCVec3 정규화', () => {
    it('2x: rotation이 {x:0, y:0, z:euler} 형태로 정규화된다', async () => {
      const raw = make2xRaw()
      // _trs: qz=sin(22.5deg), qw=cos(22.5deg) → euler 45°
      const rad = 45 * Math.PI / 180
      ;(raw[2] as Record<string, unknown>)._trs = {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [0, 0, 0, 0, 0, Math.sin(rad / 2), Math.cos(rad / 2), 1, 1, 1],
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const rot = result.root.children[0].rotation

      // rotation은 CCVec3 {x, y, z} 형태여야 함
      expect(rot).toHaveProperty('x')
      expect(rot).toHaveProperty('y')
      expect(rot).toHaveProperty('z')
      expect((rot as { x: number; y: number; z: number }).x).toBe(0)
      expect((rot as { x: number; y: number; z: number }).y).toBe(0)
      expect((rot as { x: number; y: number; z: number }).z).toBeCloseTo(45, 1)
    })

    it('3x: rotation이 {x:0, y:0, z:euler} 형태로 정규화된다', async () => {
      const raw = make3xRaw()
      // _lrot: x:0, y:0, z:sin(30deg), w:cos(30deg) → euler 60°
      ;(raw[2] as Record<string, unknown>)._lrot = { x: 0, y: 0, z: Math.sin(30 * Math.PI / 180), w: Math.cos(30 * Math.PI / 180) }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const rot = result.root.children[0].rotation

      expect(rot).toHaveProperty('x')
      expect(rot).toHaveProperty('y')
      expect(rot).toHaveProperty('z')
      expect((rot as { x: number; y: number; z: number }).x).toBe(0)
      expect((rot as { x: number; y: number; z: number }).y).toBe(0)
      expect((rot as { x: number; y: number; z: number }).z).toBeCloseTo(60, 0)
    })

    it('2x: rotation=0이면 {x:0, y:0, z:0}', async () => {
      const raw = make2xRaw()
      ;(raw[2] as Record<string, unknown>)._trs = {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      expect(result.root.children[0].rotation).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('3x: rotation=0이면 {x:0, y:0, z:0}', async () => {
      const raw = make3xRaw()
      ;(raw[2] as Record<string, unknown>)._lrot = { x: 0, y: 0, z: 0, w: 1 }
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      expect(result.root.children[0].rotation).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('2x: 저장→재파싱 시 rotation.z 보존 (수학적 라운드트립)', () => {
      // euler → quat → euler 변환이 가역적인지 확인
      const angles = [0, 30, 45, 90, -45, 180]
      for (const angle of angles) {
        const rad = angle * Math.PI / 180
        const qz = Math.sin(rad / 2)
        const qw = Math.cos(rad / 2)
        const sinZ = 2 * qw * qz
        const cosZ = 1 - 2 * qz * qz
        const restored = Math.atan2(sinZ, cosZ) * (180 / Math.PI)
        expect(restored).toBeCloseTo(angle, 4)
      }
    })
  })

  describe('Label 3x spacingY 파싱', () => {
    it('3x Label에서 _spacingY를 추출한다', async () => {
      const raw = make3xRaw()
      ;(raw[4] as Record<string, unknown>)._spacingY = 8
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const label = result.root.children[0].components[0]

      expect(label.props.spacingY).toBe(8)
    })

    it('3x Label에서 spacingY(prefix 없음)를 추출한다', async () => {
      const raw = make3xRaw()
      ;(raw[4] as Record<string, unknown>).spacingY = 12
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const label = result.root.children[0].components[0]

      expect(label.props.spacingY).toBe(12)
    })

    it('3x Label에서 _spacingY가 없으면 기본값 0', async () => {
      const raw = make3xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.scene', projectInfo3x)
      const label = result.root.children[0].components[0]

      expect(label.props.spacingY).toBe(0)
    })

    it('2x Label에서 _N$spacingY를 추출한다', async () => {
      const raw = make2xRaw()
      ;(raw[3] as Record<string, unknown>)._N$spacingY = 5
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const label = result.root.children[0].components[0]

      expect(label.props.spacingY).toBe(5)
    })
  })

  describe('R3: Widget 레이아웃 기본 계산', () => {
    /**
     * Canvas(960x640) → Widget 자식 노드의 position/size가 alignFlags 기반으로 재계산되는지 검증
     */
    function makeWidgetRaw(widgetProps: Record<string, unknown>) {
      return [
        { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
        // [1] cc.Scene
        {
          __type__: 'cc.Scene',
          _name: 'Scene', _active: true, _id: 'scene-uuid',
          _children: [{ __id__: 2 }], _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 0, height: 0 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [2] Canvas node (parent)
        {
          __type__: 'cc.Node',
          _name: 'Canvas', _active: true, _id: 'canvas-uuid',
          _children: [{ __id__: 4 }],
          _components: [{ __id__: 3 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 960, height: 640 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [3] cc.Canvas component
        { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 960, height: 640 } },
        // [4] Widget child node (원래 position은 원점)
        {
          __type__: 'cc.Node',
          _name: 'WidgetChild', _active: true, _id: 'widget-child-uuid',
          _children: [], _components: [{ __id__: 5 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 200, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [5] cc.Widget component
        { __type__: 'cc.Widget', node: { __id__: 4 }, ...widgetProps },
      ]
    }

    it('LEFT+RIGHT: 부모 기준 좌우 여백으로 width와 x 재계산', async () => {
      // alignFlags: LEFT(8) | RIGHT(32) = 40, left=10, right=20
      const raw = makeWidgetRaw({
        _N$alignFlags: 40, _N$left: 10, _N$right: 20, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: true, _N$isAlignRight: true,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0].children[0] // Canvas → WidgetChild

      // width = 960 - 10 - 20 = 930
      expect(child.size.x).toBe(930)
      // x = left + width*anchor - parentW*0.5 = 10 + 930*0.5 - 480 = -5
      expect(child.position.x).toBeCloseTo(-5, 1)
    })

    it('TOP+BOTTOM: 부모 기준 상하 여백으로 height와 y 재계산', async () => {
      // alignFlags: TOP(1) | BOT(4) = 5, top=30, bottom=50
      const raw = makeWidgetRaw({
        _N$alignFlags: 5, _N$left: 0, _N$right: 0, _N$top: 30, _N$bottom: 50,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: false,
        _N$isAlignTop: true, _N$isAlignBottom: true,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0].children[0]

      // height = 640 - 30 - 50 = 560
      expect(child.size.y).toBe(560)
      // y = bottom + height*anchor - parentH*0.5 = 50 + 560*0.5 - 320 = 10
      expect(child.position.y).toBeCloseTo(10, 1)
    })

    it('HMID: 수평 중앙 정렬', async () => {
      // alignFlags: HMID(16) = 16
      const raw = makeWidgetRaw({
        _N$alignFlags: 16, _N$left: 0, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0].children[0]

      // HMID → x = horizontalCenter = 0
      expect(child.position.x).toBe(0)
    })

    it('VMID: 수직 중앙 정렬', async () => {
      // alignFlags: VMID(2) = 2
      const raw = makeWidgetRaw({
        _N$alignFlags: 2, _N$left: 0, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0].children[0]

      // VMID → y = verticalCenter = 0
      expect(child.position.y).toBe(0)
    })

    it('LEFT only: 좌측 여백만 적용', async () => {
      // alignFlags: LEFT(8) = 8, left=50
      const raw = makeWidgetRaw({
        _N$alignFlags: 8, _N$left: 50, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: true, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0].children[0]

      // x = left + width*anchor - parentW*0.5 = 50 + 200*0.5 - 480 = -330
      expect(child.position.x).toBeCloseTo(-330, 1)
      // width 유지
      expect(child.size.x).toBe(200)
    })

    it('Widget 없는 노드는 position/size가 변경되지 않는다', async () => {
      const raw = make2xRaw()
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      // 원래 값 유지
      expect(child.position.x).toBe(100)
      expect(child.position.y).toBe(200)
      expect(child.size.x).toBe(200)
      expect(child.size.y).toBe(100)
    })

    it('RIGHT only: 우측 여백만 적용', async () => {
      // alignFlags: RIGHT(32) = 32, right=40
      const raw = makeWidgetRaw({
        _N$alignFlags: 32, _N$left: 0, _N$right: 40, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: true,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0].children[0]

      // x = parentW*0.5 - right - width*(1-anchor) = 480 - 40 - 200*0.5 = 340
      expect(child.position.x).toBeCloseTo(340, 1)
      // width 유지
      expect(child.size.x).toBe(200)
    })

    it('중첩 Widget: 자식 노드도 Widget을 가지면 부모 크기 기준으로 재계산', async () => {
      // Canvas(960x640) → Parent(Widget LEFT+RIGHT) → Child(Widget TOP+BOTTOM)
      const raw = [
        { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
        // [1] cc.Scene
        {
          __type__: 'cc.Scene',
          _name: 'Scene', _active: true, _id: 'scene-uuid',
          _children: [{ __id__: 2 }], _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 0, height: 0 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [2] Canvas node (960x640)
        {
          __type__: 'cc.Node',
          _name: 'Canvas', _active: true, _id: 'canvas-uuid',
          _children: [{ __id__: 4 }],
          _components: [{ __id__: 3 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 960, height: 640 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [3] cc.Canvas
        { __type__: 'cc.Canvas', node: { __id__: 2 } },
        // [4] Parent node: Widget LEFT(8)+RIGHT(32)=40, left=0, right=0 → 960x640 그대로
        {
          __type__: 'cc.Node',
          _name: 'Parent', _active: true, _id: 'parent-uuid',
          _children: [{ __id__: 6 }],
          _components: [{ __id__: 5 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 100, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [5] cc.Widget for Parent: LEFT+RIGHT, left=0, right=0 → width=960
        {
          __type__: 'cc.Widget', node: { __id__: 4 },
          _N$alignFlags: 40, _N$left: 0, _N$right: 0, _N$top: 0, _N$bottom: 0,
          _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
          _N$isAlignLeft: true, _N$isAlignRight: true, _N$isAlignTop: false, _N$isAlignBottom: false,
        },
        // [6] Child node: Widget TOP(1)+BOTTOM(4)=5, top=20, bottom=20
        {
          __type__: 'cc.Node',
          _name: 'Child', _active: true, _id: 'child-uuid',
          _children: [],
          _components: [{ __id__: 7 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 50, height: 50 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // [7] cc.Widget for Child: TOP+BOT, top=20, bottom=20 → height = parentH - 40
        {
          __type__: 'cc.Widget', node: { __id__: 6 },
          _N$alignFlags: 5, _N$left: 0, _N$right: 0, _N$top: 20, _N$bottom: 20,
          _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
          _N$isAlignLeft: false, _N$isAlignRight: false, _N$isAlignTop: true, _N$isAlignBottom: true,
        },
      ]
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const parent = result.root.children[0].children[0]  // Canvas → Parent
      const child = parent.children[0]                     // Parent → Child

      // Parent: LEFT+RIGHT, left=0, right=0, parentW=960 → width=960
      expect(parent.size.x).toBe(960)
      // Child: TOP+BOTTOM, top=20, bottom=20, parentH=parent.size.y(=100, height 미변경) → height=60
      expect(child.size.y).toBe(60)
    })

    it('부모 크기가 0이면 Widget 해결을 건너뛴다', async () => {
      // Scene root의 size는 {0, 0} → Canvas 없이 직접 Widget 자식을 둔 경우
      const raw = [
        { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
        {
          __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's-uuid',
          _children: [{ __id__: 2 }], _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 0, height: 0 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        {
          __type__: 'cc.Node', _name: 'W', _active: true, _id: 'w-uuid',
          _children: [], _components: [{ __id__: 3 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [99,88,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 200, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        { __type__: 'cc.Widget', node: { __id__: 2 }, _N$alignFlags: 40, _N$left: 10, _N$right: 20 },
      ]
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const child = result.root.children[0]

      // 부모 크기 0이므로 Widget 미적용 → 원래 position 유지
      expect(child.position.x).toBe(99)
      expect(child.position.y).toBe(88)
    })
  })

  // ── Widget 라운드트립 최종: 적용 후 position/size 변경 확인 ──────────────────

  describe('Widget 라운드트립 — 적용 후 값 변경 검증', () => {
    function makeWidgetRoundtripRaw(widgetProps: Record<string, unknown>, nodeOverrides: Record<string, unknown> = {}) {
      return [
        { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
        {
          __type__: 'cc.Scene',
          _name: 'Scene', _active: true, _id: 'scene-uuid',
          _children: [{ __id__: 2 }], _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 0, height: 0 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        // Canvas 960x640
        {
          __type__: 'cc.Node',
          _name: 'Canvas', _active: true, _id: 'canvas-uuid',
          _children: [{ __id__: 4 }],
          _components: [{ __id__: 3 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 960, height: 640 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
        },
        { __type__: 'cc.Canvas', node: { __id__: 2 } },
        // Widget 노드 (초기 position 원점, size 200x100)
        {
          __type__: 'cc.Node',
          _name: 'WidgetNode', _active: true, _id: 'widget-uuid',
          _children: [], _components: [{ __id__: 5 }],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
          _contentSize: { width: 200, height: 100 },
          _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r:255,g:255,b:255,a:255 },
          ...nodeOverrides,
        },
        { __type__: 'cc.Widget', node: { __id__: 4 }, ...widgetProps },
      ]
    }

    it('HMID+VMID: 완전 중앙 정렬 적용 후 position이 (0,0)이다', async () => {
      // alignFlags: HMID(16) | VMID(2) = 18
      const raw = makeWidgetRoundtripRaw({
        _N$alignFlags: 18,
        _N$left: 0, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const node = result.root.children[0].children[0] // Canvas → WidgetNode

      // Widget 적용 전 원점(0,0), 적용 후도 (0,0) — HMID/VMID가 실제로 적용됐음 확인
      expect(node.position.x).toBe(0)
      expect(node.position.y).toBe(0)
      // size는 변경 없음 (HMID/VMID는 위치만 조정)
      expect(node.size.x).toBe(200)
      expect(node.size.y).toBe(100)
    })

    it('HMID+VMID: horizontalCenter=50, verticalCenter=30이면 position이 (50,30)으로 변경된다', async () => {
      // alignFlags: HMID(16) | VMID(2) = 18
      const raw = makeWidgetRoundtripRaw({
        _N$alignFlags: 18,
        _N$left: 0, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 50, _N$verticalCenter: 30, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      }, { _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [99,88,0,0,0,0,1,1,1,1] } })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const node = result.root.children[0].children[0]

      // Widget 적용 전 position (99,88) → HMID=50, VMID=30으로 변경됐는지 확인
      expect(node.position.x).toBe(50)
      expect(node.position.y).toBe(30)
      // size 불변
      expect(node.size.x).toBe(200)
      expect(node.size.y).toBe(100)
    })

    it('LEFT+TOP: 좌상 고정 적용 후 position/size가 실제로 변경된다', async () => {
      // alignFlags: LEFT(8) | TOP(1) = 9, left=20, top=15
      // 초기 position을 원점이 아닌 (99,88)로 설정해 변경 여부를 명확히 확인
      const raw = makeWidgetRoundtripRaw({
        _N$alignFlags: 9,
        _N$left: 20, _N$right: 0, _N$top: 15, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: true, _N$isAlignRight: false,
        _N$isAlignTop: true, _N$isAlignBottom: false,
      }, { _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [99,88,0,0,0,0,1,1,1,1] } })
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const result = await parseCCScene('/fake/scene.fire', projectInfo2x)
      const node = result.root.children[0].children[0]

      // LEFT(8) only: x = left + w*ax - parentW*0.5 = 20 + 200*0.5 - 480 = -360
      expect(node.position.x).toBeCloseTo(-360, 1)
      // TOP(1) only: y = parentH*0.5 - top - h*(1-ay) = 320 - 15 - 100*0.5 = 255
      expect(node.position.y).toBeCloseTo(255, 1)
      // size 변경 없음 (LEFT+TOP은 위치만 조정)
      expect(node.size.x).toBe(200)
      expect(node.size.y).toBe(100)
      // Widget 적용 전 position(99,88)에서 실제로 달라졌는지 확인
      expect(node.position.x).not.toBe(99)
      expect(node.position.y).not.toBe(88)
    })
  })
})
