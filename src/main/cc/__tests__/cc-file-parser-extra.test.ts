/**
 * cc-file-parser — 추가 테스트
 * Widget 엣지 케이스, Atlas sprite, 대형 씬 성능, 깊은 중첩, 손상 JSON 등
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(), statSync: vi.fn(), existsSync: vi.fn() },
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

const p2x: CCFileProjectInfo = { detected: true, version: '2x' }
const p3x: CCFileProjectInfo = { detected: true, version: '3x' }

// ── helpers ────────────────────────────────────────────────────────────────────

function baseTrs(x = 0, y = 0): Record<string, unknown> {
  return { __type__: 'TypedArray', ctor: 'Float64Array', array: [x, y, 0, 0, 0, 0, 1, 1, 1, 1] }
}

function base2xNode(
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
  children: { __id__: number }[] = [],
  components: { __id__: number }[] = []
) {
  return {
    __type__: 'cc.Node',
    _name: name,
    _active: true,
    _id: id,
    _children: children,
    _components: components,
    _trs: baseTrs(),
    _contentSize: { width: 100, height: 100 },
    _anchorPoint: { x: 0.5, y: 0.5 },
    _opacity: 255,
    _color: { r: 255, g: 255, b: 255, a: 255 },
    ...extra,
  }
}

function make2xScene(nodes: unknown[], extraSceneFields: Record<string, unknown> = {}) {
  return [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    {
      __type__: 'cc.Scene',
      _name: 'Scene',
      _active: true,
      _id: 'root-uuid',
      _children: [{ __id__: 2 }],
      _components: [],
      _trs: baseTrs(),
      _contentSize: { width: 0, height: 0 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
      ...extraSceneFields,
    },
    ...nodes,
  ]
}

// ── Widget 엣지 케이스 ─────────────────────────────────────────────────────────

describe('cc-file-parser — Widget edge cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Widget HMID+TOP 조합 — x=horizontalCenter, y=top 기반으로 재계산', async () => {
    // Canvas(960x640) → Widget(HMID=16, TOP=1) top=50
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas 960x640
      {
        __type__: 'cc.Node', _name: 'Canvas', _active: true, _id: 'canvas',
        _children: [{ __id__: 4 }], _components: [{ __id__: 3 }],
        _trs: baseTrs(), _contentSize: { width: 960, height: 640 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 960, height: 640 } },
      // [4] Widget child
      {
        __type__: 'cc.Node', _name: 'WChild', _active: true, _id: 'wchild',
        _children: [], _components: [{ __id__: 5 }],
        _trs: baseTrs(), _contentSize: { width: 200, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [5] Widget: HMID(16)+TOP(1)=17, horizontalCenter=0, top=50
      {
        __type__: 'cc.Widget', node: { __id__: 4 },
        _N$alignFlags: 17, _N$left: 0, _N$right: 0, _N$top: 50, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: false, _N$isAlignRight: false,
        _N$isAlignTop: true, _N$isAlignBottom: false,
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // HMID → x=horizontalCenter=0
    expect(child.position.x).toBe(0)
    // TOP(1) only: y = parentH*0.5 - top - height*(1-anchor) = 320 - 50 - 100*0.5 = 220
    expect(child.position.y).toBeCloseTo(220, 1)
    // width/height 유지
    expect(child.size.x).toBe(200)
    expect(child.size.y).toBe(100)
  })

  it('Widget VMID+LEFT 조합 — y=verticalCenter, x=left 기반으로 재계산', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Canvas', _active: true, _id: 'canvas',
        _children: [{ __id__: 4 }], _components: [{ __id__: 3 }],
        _trs: baseTrs(), _contentSize: { width: 960, height: 640 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { __type__: 'cc.Canvas', node: { __id__: 2 } },
      {
        __type__: 'cc.Node', _name: 'WChild', _active: true, _id: 'wchild',
        _children: [], _components: [{ __id__: 5 }],
        _trs: baseTrs(), _contentSize: { width: 200, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // VMID(2)+LEFT(8)=10, verticalCenter=0, left=30
      {
        __type__: 'cc.Widget', node: { __id__: 4 },
        _N$alignFlags: 10, _N$left: 30, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: true, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // VMID → y=verticalCenter=0
    expect(child.position.y).toBe(0)
    // LEFT only: x = left + width*anchor - parentW*0.5 = 30 + 200*0.5 - 480 = -350
    expect(child.position.x).toBeCloseTo(-350, 1)
  })

  it('Widget LEFT only — 좌측 여백만 정확히 적용 (width 변화 없음)', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Canvas', _active: true, _id: 'canvas',
        _children: [{ __id__: 4 }], _components: [{ __id__: 3 }],
        _trs: baseTrs(), _contentSize: { width: 800, height: 600 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { __type__: 'cc.Canvas', node: { __id__: 2 } },
      {
        __type__: 'cc.Node', _name: 'WChild', _active: true, _id: 'wchild',
        _children: [], _components: [{ __id__: 5 }],
        _trs: baseTrs(), _contentSize: { width: 150, height: 80 },
        _anchorPoint: { x: 0, y: 0.5 },  // 왼쪽 앵커
        _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Widget', node: { __id__: 4 },
        _N$alignFlags: 8, _N$left: 20, _N$right: 0, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
        _N$isAlignLeft: true, _N$isAlignRight: false,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // LEFT only: x = left + width*anchor - parentW*0.5 = 20 + 150*0 - 400 = -380
    expect(child.position.x).toBeCloseTo(-380, 1)
    // width 변화 없음
    expect(child.size.x).toBe(150)
  })

  it('Widget alignMode=0 (ONCE) — 파싱 시에도 적용됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Canvas', _active: true, _id: 'canvas',
        _children: [{ __id__: 4 }], _components: [{ __id__: 3 }],
        _trs: baseTrs(), _contentSize: { width: 960, height: 640 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { __type__: 'cc.Canvas', node: { __id__: 2 } },
      {
        __type__: 'cc.Node', _name: 'WChild', _active: true, _id: 'wchild',
        _children: [], _components: [{ __id__: 5 }],
        _trs: baseTrs(), _contentSize: { width: 200, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Widget', node: { __id__: 4 },
        _N$alignFlags: 40, _N$left: 10, _N$right: 10, _N$top: 0, _N$bottom: 0,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 0, // ONCE
        _N$isAlignLeft: true, _N$isAlignRight: true,
        _N$isAlignTop: false, _N$isAlignBottom: false,
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // LEFT+RIGHT: width = 960 - 10 - 10 = 940
    expect(child.size.x).toBe(940)
  })

  it('Widget isAlignOnce 플래그 없어도 alignFlags 기반으로 처리됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Canvas', _active: true, _id: 'canvas',
        _children: [{ __id__: 4 }], _components: [{ __id__: 3 }],
        _trs: baseTrs(), _contentSize: { width: 480, height: 320 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { __type__: 'cc.Canvas', node: { __id__: 2 } },
      {
        __type__: 'cc.Node', _name: 'WChild', _active: true, _id: 'wchild',
        _children: [], _components: [{ __id__: 5 }],
        _trs: baseTrs(), _contentSize: { width: 100, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // isAlignLeft/Right 필드 없음 — alignFlags(5=TOP+BOT)로만 판단
      {
        __type__: 'cc.Widget', node: { __id__: 4 },
        _N$alignFlags: 5, _N$top: 10, _N$bottom: 10,
        _N$horizontalCenter: 0, _N$verticalCenter: 0, _N$alignMode: 1,
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // TOP+BOT: height = 320 - 10 - 10 = 300
    expect(child.size.y).toBe(300)
  })
})

// ── 대형 씬 성능/정확성 ────────────────────────────────────────────────────────

describe('cc-file-parser — large scene (100+ nodes)', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeLargeScene(nodeCount: number) {
    const raw: unknown[] = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'LargeScene', _active: true, _id: 'scene-uuid',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    // [2]: root node with many children
    const childRefs: { __id__: number }[] = []
    for (let i = 0; i < nodeCount; i++) {
      childRefs.push({ __id__: 3 + i })
    }
    raw.push({
      __type__: 'cc.Node', _name: 'Root', _active: true, _id: 'root-node-uuid',
      _children: childRefs, _components: [],
      _trs: baseTrs(), _contentSize: { width: 960, height: 640 },
      _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    })
    for (let i = 0; i < nodeCount; i++) {
      raw.push({
        __type__: 'cc.Node', _name: `Node_${i}`, _active: true, _id: `node-${i}`,
        _children: [], _components: [],
        _trs: baseTrs(i * 10, i * 5),
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      })
    }
    return raw
  }

  it('100개 노드 씬 — 모든 자식이 파싱됨', async () => {
    const raw = makeLargeScene(100)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/large.fire', p2x)
    expect(result.root.children[0].children).toHaveLength(100)
  })

  it('100개 노드 씬 — 첫/마지막 노드 이름 정확성', async () => {
    const raw = makeLargeScene(100)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/large.fire', p2x)
    const children = result.root.children[0].children
    expect(children[0].name).toBe('Node_0')
    expect(children[99].name).toBe('Node_99')
  })

  it('100개 노드 씬 — position이 각각 올바르게 설정됨', async () => {
    const raw = makeLargeScene(100)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/large.fire', p2x)
    const children = result.root.children[0].children
    // node[50] → x=500, y=250
    expect(children[50].position.x).toBe(500)
    expect(children[50].position.y).toBe(250)
  })

  it('100개 노드 씬 — _rawIndex가 연속적으로 증가함', async () => {
    const raw = makeLargeScene(100)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/large.fire', p2x)
    const children = result.root.children[0].children
    // 첫 번째 자식의 _rawIndex는 3(0-indexed: sceneAsset=0, scene=1, rootNode=2, first child=3)
    for (let i = 0; i < 100; i++) {
      expect(children[i]._rawIndex).toBe(3 + i)
    }
  })

  it('200개 노드 씬 — 파싱 성공', async () => {
    const raw = makeLargeScene(200)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/large200.fire', p2x)
    expect(result.root.children[0].children).toHaveLength(200)
  })

  it('대형 씬 — _raw 배열 크기가 원본과 동일함', async () => {
    const raw = makeLargeScene(100)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/large.fire', p2x)
    expect(result._raw).toHaveLength(raw.length)
  })
})

// ── 깊은 중첩 ──────────────────────────────────────────────────────────────────

describe('cc-file-parser — deep nesting', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDeepScene(depth: number) {
    const raw: unknown[] = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'DeepScene', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    // 노드 체인: [2] → [3] → [4] → ... → [depth+1]
    for (let i = 0; i < depth; i++) {
      const hasChild = i < depth - 1
      raw.push({
        __type__: 'cc.Node', _name: `Depth_${i}`, _active: true, _id: `node-${i}`,
        _children: hasChild ? [{ __id__: 3 + i }] : [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      })
    }
    return raw
  }

  it('depth 10 중첩 — 최하위 노드 이름 정확성', async () => {
    const raw = makeDeepScene(10)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/deep.fire', p2x)
    // Walk to depth 9
    let node = result.root.children[0]
    for (let i = 1; i < 10; i++) {
      expect(node.name).toBe(`Depth_${i - 1}`)
      node = node.children[0]
    }
    expect(node.name).toBe('Depth_9')
  })

  it('depth 10 중첩 — _rawIndex가 올바르게 설정됨', async () => {
    const raw = makeDeepScene(10)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/deep.fire', p2x)
    // 첫 노드(Depth_0)는 raw 인덱스 2
    expect(result.root.children[0]._rawIndex).toBe(2)
    // 두 번째(Depth_1)는 raw 인덱스 3
    expect(result.root.children[0].children[0]._rawIndex).toBe(3)
  })

  it('depth 50 중첩 — 파싱 성공 (depth <= 100)', async () => {
    const raw = makeDeepScene(50)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/deep50.fire', p2x)
    expect(result.root).toBeDefined()
    // 루트의 자식이 존재함
    expect(result.root.children.length).toBeGreaterThan(0)
  })

  it('depth 100 경계 — 파싱 가능', async () => {
    const raw = makeDeepScene(99)  // depth 0~98, total 99 levels below root
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/deep100.fire', p2x)
    expect(result.root).toBeDefined()
  })

  it('depth 10 + 3x 버전 — 정상 파싱', async () => {
    const raw: unknown[] = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'D3x', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0, w: 1 }, _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 }, _color: { r: 255, g: 255, b: 255, a: 255 }, layer: 33554432,
      },
    ]
    for (let i = 0; i < 10; i++) {
      const hasChild = i < 9
      raw.push({
        __type__: 'cc.Node', _name: `D3x_${i}`, _active: true, _id: `nd-${i}`,
        _children: hasChild ? [{ __id__: 3 + i }] : [],
        _components: [],
        _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0, w: 1 }, _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 }, _color: { r: 255, g: 255, b: 255, a: 255 }, layer: 33554432,
      })
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/deep3x.scene', p3x)
    expect(result.root.children[0].name).toBe('D3x_0')
  })
})

// ── 손상된 JSON / 엣지 케이스 ─────────────────────────────────────────────────

describe('cc-file-parser — malformed JSON & edge cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('완전히 빈 배열 — 루트 노드 없음 오류', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([]))

    await expect(parseCCScene('/fake/empty.fire', p2x)).rejects.toThrow()
  })

  it('배열이 아닌 JSON 객체 — 오류 발생', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ __type__: 'cc.Scene' }))

    await expect(parseCCScene('/fake/obj.fire', p2x)).rejects.toThrow()
  })

  it('null JSON — 오류 발생', async () => {
    mockReadFileSync.mockReturnValue('null')

    await expect(parseCCScene('/fake/null.fire', p2x)).rejects.toThrow()
  })

  it('__type__ 없는 엔트리만 있는 배열 — 루트 못 찾음', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([{ foo: 'bar' }, { baz: 123 }]))

    await expect(parseCCScene('/fake/noroot.fire', p2x)).rejects.toThrow()
  })

  it('SceneAsset이 없고 cc.Scene만 있을 때 — cc.Scene을 루트로 파싱', async () => {
    const raw = [
      {
        __type__: 'cc.Scene',
        _name: 'FallbackScene', _active: true, _id: 'fb-uuid',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/nosceneasset.fire', p2x)
    expect(result.root.name).toBe('FallbackScene')
  })

  it('_children 참조가 범위 밖 인덱스 — 자식 무시하고 파싱 성공', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'Scene', _active: true, _id: 's',
        _children: [{ __id__: 999 }],  // 범위 밖
        _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/outofrange.fire', p2x)
    // 자식이 없거나 null 필터링됨
    expect(result.root).toBeDefined()
  })

  it('노드에 _components가 없을 때 — 빈 컴포넌트 배열', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'NoComp', _active: true, _id: 'nc',
        _children: [],
        // _components 없음
        _trs: baseTrs(), _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/nocomp.fire', p2x)
    expect(result.root.children[0].components).toHaveLength(0)
  })

  it('_color가 없을 때 — 기본 white 색상', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'NoColor', _active: true, _id: 'nc2',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255,
        // _color 없음
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/nocolor.fire', p2x)
    expect(result.root.children[0].color).toEqual({ r: 255, g: 255, b: 255, a: 255 })
  })

  it('_contentSize가 없을 때 — 기본 size {0,0}', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'NoSize', _active: true, _id: 'ns',
        _children: [], _components: [],
        _trs: baseTrs(), _color: { r: 255, g: 255, b: 255, a: 255 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255,
        // _contentSize 없음
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/nosize.fire', p2x)
    expect(result.root.children[0].size).toEqual({ x: 0, y: 0 })
  })
})

// ── _active 파싱 ──────────────────────────────────────────────────────────────

describe('cc-file-parser — _active field', () => {
  beforeEach(() => vi.clearAllMocks())

  it('2x: _active=false인 노드가 active=false로 파싱됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Inactive', _active: false, _id: 'inc',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/inactive.fire', p2x)
    expect(result.root.children[0].active).toBe(false)
  })

  it('2x: _active=true인 노드가 active=true로 파싱됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Active', _active: true, _id: 'ac',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/active.fire', p2x)
    expect(result.root.children[0].active).toBe(true)
  })

  it('3x: _active=false → active=false', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S3x', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0, w: 1 }, _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 }, _color: { r: 255, g: 255, b: 255, a: 255 }, layer: 33554432,
      },
      {
        __type__: 'cc.Node', _name: 'Inactive3x', _active: false, _id: 'in3x',
        _children: [], _components: [],
        _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0, w: 1 }, _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 }, _color: { r: 255, g: 255, b: 255, a: 255 }, layer: 33554432,
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/inactive3x.scene', p3x)
    expect(result.root.children[0].active).toBe(false)
  })
})

// ── Prefab 파싱 ───────────────────────────────────────────────────────────────

describe('cc-file-parser — Prefab format', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cc.Prefab 형식 파일 — data 레퍼런스로 루트 탐색', async () => {
    const raw = [
      // [0] cc.Prefab
      { __type__: 'cc.Prefab', data: { __id__: 1 } },
      // [1] cc.Node as prefab root
      {
        __type__: 'cc.Node', _name: 'PrefabRoot', _active: true, _id: 'pref-uuid',
        _children: [], _components: [],
        _trs: baseTrs(50, 50), _contentSize: { width: 200, height: 200 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/node.prefab', p2x)
    expect(result.root.name).toBe('PrefabRoot')
    expect(result.root.uuid).toBe('pref-uuid')
  })

  it('cc.Prefab 형식 — position이 올바르게 파싱됨', async () => {
    const raw = [
      { __type__: 'cc.Prefab', data: { __id__: 1 } },
      {
        __type__: 'cc.Node', _name: 'PrefabNode', _active: true, _id: 'p2',
        _children: [], _components: [],
        _trs: baseTrs(100, 200), _contentSize: { width: 150, height: 75 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/node2.prefab', p2x)
    expect(result.root.position.x).toBe(100)
    expect(result.root.position.y).toBe(200)
  })
})

// ── 다양한 컴포넌트 타입 ───────────────────────────────────────────────────────

describe('cc-file-parser — various component types', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeSceneWithComp(compData: Record<string, unknown>) {
    return [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'Node', _active: true, _id: 'n',
        _children: [], _components: [{ __id__: 3 }],
        _trs: baseTrs(), _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { ...compData, node: { __id__: 2 }, _enabled: true },
    ]
  }

  it('cc.Sprite 컴포넌트 — type 정확히 파싱됨', async () => {
    const raw = makeSceneWithComp({ __type__: 'cc.Sprite', _N$spriteFrame: { __uuid__: 'sprite-uuid' } })
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/sprite.fire', p2x)
    expect(result.root.children[0].components[0].type).toBe('cc.Sprite')
  })

  it('cc.Button 컴포넌트 — type 정확히 파싱됨', async () => {
    const raw = makeSceneWithComp({ __type__: 'cc.Button', _N$interactable: true })
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/button.fire', p2x)
    expect(result.root.children[0].components[0].type).toBe('cc.Button')
  })

  it('cc.Canvas 컴포넌트 — type 정확히 파싱됨', async () => {
    const raw = makeSceneWithComp({ __type__: 'cc.Canvas', _designResolution: { width: 960, height: 640 } })
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/canvas.fire', p2x)
    expect(result.root.children[0].components[0].type).toBe('cc.Canvas')
  })

  it('cc.RichText 컴포넌트 — type 정확히 파싱됨', async () => {
    const raw = makeSceneWithComp({ __type__: 'cc.RichText', _N$string: '<b>bold</b>' })
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/richtext.fire', p2x)
    expect(result.root.children[0].components[0].type).toBe('cc.RichText')
  })

  it('cc.ProgressBar 컴포넌트 — type 정확히 파싱됨', async () => {
    const raw = makeSceneWithComp({ __type__: 'cc.ProgressBar', _N$progress: 0.5 })
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/progress.fire', p2x)
    expect(result.root.children[0].components[0].type).toBe('cc.ProgressBar')
  })

  it('복수 컴포넌트 — 두 개 모두 파싱됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node', _name: 'MultiComp', _active: true, _id: 'mc',
        _children: [], _components: [{ __id__: 3 }, { __id__: 4 }],
        _trs: baseTrs(), _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      { __type__: 'cc.Label', node: { __id__: 2 }, _enabled: true, _N$string: 'test', _N$fontSize: 20 },
      { __type__: 'cc.Button', node: { __id__: 2 }, _enabled: true, _N$interactable: true },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/multi.fire', p2x)
    expect(result.root.children[0].components).toHaveLength(2)
    expect(result.root.children[0].components[0].type).toBe('cc.Label')
    expect(result.root.children[0].components[1].type).toBe('cc.Button')
  })
})

// ── 씬 메타 정보 ──────────────────────────────────────────────────────────────

describe('cc-file-parser — scene meta', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scenePath가 결과에 포함됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'MetaScene', _active: true, _id: 'm',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/my/project/scenes/main.fire', p2x)
    expect(result.scenePath).toBe('/my/project/scenes/main.fire')
  })

  it('projectInfo가 결과에 포함됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'MetaScene', _active: true, _id: 'm',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const info: CCFileProjectInfo = { detected: true, version: '2x', projectPath: '/my/project' }
    const result = await parseCCScene('/my/project/scenes/main.fire', info)
    expect(result.projectInfo.version).toBe('2x')
    expect(result.projectInfo.projectPath).toBe('/my/project')
  })

  it('scriptNames가 빈 객체로 초기화됨 (assetsDir 없을 때)', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    expect(result.scriptNames).toBeDefined()
    expect(typeof result.scriptNames).toBe('object')
  })
})
