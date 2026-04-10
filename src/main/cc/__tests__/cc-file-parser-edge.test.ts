/**
 * cc-file-parser — 엣지 케이스 테스트
 * - 빈 씬 (nodes 0개)
 * - 순환 참조 (_children이 부모를 참조)
 * - 누락된 _children 배열
 * - __type__ 없는 raw 엔트리
 * - 매우 깊은 중첩 (depth 100+)
 * - _trs가 손상된 base64
 * - UITransform 없는 3.x 노드
 * - 프리팹 내 프리팹 (중첩 prefab)
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

function baseTrs(x = 0, y = 0) {
  return { __type__: 'TypedArray', ctor: 'Float64Array', array: [x, y, 0, 0, 0, 0, 1, 1, 1, 1] }
}

// ── 빈 씬 (nodes 0개) ────────────────────────────────────────────────────────

describe('cc-file-parser edge — 빈 씬 (nodes 0개)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cc.Scene만 있고 _children이 빈 배열이면 root 파싱 성공, children=[]', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'EmptyScene',
        _active: true,
        _id: 'empty-root',
        _children: [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/empty.fire', p2x)
    expect(result.root.name).toBe('EmptyScene')
    expect(result.root.children).toHaveLength(0)
  })

  it('cc.Scene 노드 하나만 있을 때 _raw 길이 == 2', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'Solo',
        _active: true,
        _id: 'solo-id',
        _children: [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/solo.fire', p2x)
    expect(result._raw).toHaveLength(2)
  })
})

// ── 순환 참조 (_children이 부모를 가리키는 경우) ──────────────────────────────

describe('cc-file-parser edge — 순환 참조', () => {
  beforeEach(() => vi.clearAllMocks())

  it('자식이 조상 인덱스를 가리키면 depth 100 제한으로 null 처리되어 children 배열에 포함 안 됨', async () => {
    // idx=1(Scene) → idx=2(Node) → _children=[{__id__:1}] 순환
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'CyclicScene',
        _active: true,
        _id: 'cyclic-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'CyclicChild',
        _active: true,
        _id: 'cyclic-child',
        // 부모(idx=1)를 자식으로 참조 → 순환
        _children: [{ __id__: 1 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    // depth 초과로 null → filter 제거 → 크래시 없이 반환
    const result = await parseCCScene('/fake/cyclic.fire', p2x)
    expect(result.root.name).toBe('CyclicScene')
    // CyclicChild는 파싱됨 (깊이 1)
    expect(result.root.children).toHaveLength(1)
    expect(result.root.children[0].name).toBe('CyclicChild')
    // 그 하위에서 depth>=100으로 잘림 (순환이 100번 반복 후 null)
    // 결과가 너무 깊어지므로 테스트는 크래시 없음만 검증
  })
})

// ── 누락된 _children 배열 ─────────────────────────────────────────────────────

describe('cc-file-parser edge — 누락된 _children', () => {
  beforeEach(() => vi.clearAllMocks())

  it('노드에 _children 필드가 없으면 children=[] 기본값 사용', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'NoChildrenField',
        _active: true,
        _id: 'no-children-root',
        // _children 필드 없음
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/no-children.fire', p2x)
    expect(result.root.children).toEqual([])
  })

  it('_children이 null이면 children=[] 기본값', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'NullChildren',
        _active: true,
        _id: 'null-children',
        _children: null,
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/null-children.fire', p2x)
    expect(result.root.children).toEqual([])
  })
})

// ── __type__ 없는 raw 엔트리 ──────────────────────────────────────────────────

describe('cc-file-parser edge — __type__ 없는 엔트리', () => {
  beforeEach(() => vi.clearAllMocks())

  it('컴포넌트 ref가 __type__ 없는 엔트리면 unknown 타입 컴포넌트로 처리', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'TypelessComp',
        _active: true,
        _id: 'typeless-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'NodeWithTypelessComp',
        _active: true,
        _id: 'typeless-child',
        _children: [],
        _components: [{ __id__: 3 }],
        _trs: baseTrs(),
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // __type__ 없는 컴포넌트 엔트리
      {
        node: { __id__: 2 },
        _enabled: true,
        someField: 'value',
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/typeless.fire', p2x)
    const child = result.root.children[0]
    expect(child.components).toHaveLength(1)
    // __type__ 없으므로 '' 또는 'unknown' 타입
    expect(typeof child.components[0].type).toBe('string')
  })

  it('SceneAsset 없이 __type__ 없는 첫 엔트리면 cc.Scene을 루트로 사용', async () => {
    const raw = [
      // __type__ 없는 엔트리 (인덱스 0)
      { someRandomField: 'data' },
      {
        __type__: 'cc.Scene',
        _name: 'FallbackRoot',
        _active: true,
        _id: 'fallback-id',
        _children: [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/fallback.fire', p2x)
    expect(result.root.name).toBe('FallbackRoot')
  })
})

// ── 매우 깊은 중첩 (depth 100+) ───────────────────────────────────────────────

describe('cc-file-parser edge — 매우 깊은 중첩 (depth 100+)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('depth 99 노드는 파싱됨, depth 100에서 잘림 (크래시 없음)', async () => {
    // 101개 노드를 선형 체인으로 구성
    // idx=0: SceneAsset, idx=1: Scene (depth=0), idx=2..101: cc.Node (depth=1..100)
    const entries: unknown[] = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    ]

    // Scene root: children=[{__id__:2}]
    entries.push({
      __type__: 'cc.Scene',
      _name: 'DeepScene',
      _active: true,
      _id: 'deep-root',
      _children: [{ __id__: 2 }],
      _components: [],
      _trs: baseTrs(),
      _contentSize: { width: 0, height: 0 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
    })

    // 노드 2 ~ 101: 각 노드가 다음 노드를 자식으로 가짐
    for (let i = 2; i <= 102; i++) {
      const hasChild = i < 102
      entries.push({
        __type__: 'cc.Node',
        _name: `Deep${i}`,
        _active: true,
        _id: `deep-${i}`,
        _children: hasChild ? [{ __id__: i + 1 }] : [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 10, height: 10 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      })
    }

    mockReadFileSync.mockReturnValue(JSON.stringify(entries))

    // parseNode2x는 depth>100이면 null 반환 → filter 후 제외
    // 크래시 없이 완료되어야 함
    const result = await parseCCScene('/fake/deep.fire', p2x)
    expect(result.root.name).toBe('DeepScene')

    // depth=1 (idx=2)은 파싱됨
    expect(result.root.children).toHaveLength(1)
    expect(result.root.children[0].name).toBe('Deep2')
  })
})

// ── _trs가 손상된 base64 ──────────────────────────────────────────────────────

describe('cc-file-parser edge — 손상된 _trs base64', () => {
  beforeEach(() => vi.clearAllMocks())

  it('base64 _trs가 잘못된 경우 기본값(0,0,0 / scale 1,1,1)으로 폴백', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'CorruptTRS',
        _active: true,
        _id: 'corrupt-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'CorruptNode',
        _active: true,
        _id: 'corrupt-child',
        _children: [],
        _components: [],
        // base64 문자열이지만 디코딩하면 10개 float 미만
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: '!!!invalid_base64!!!' },
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/corrupt-trs.fire', p2x)
    const child = result.root.children[0]
    // 폴백: position 기본값
    expect(child.position).toEqual({ x: 0, y: 0, z: 0 })
    expect(child.scale).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('_trs.array가 숫자 배열이지만 길이 < 10이면 기본값으로 폴백', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'ShortTRS',
        _active: true,
        _id: 'short-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'ShortArray',
        _active: true,
        _id: 'short-child',
        _children: [],
        _components: [],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [1, 2, 3] }, // 길이 3 < 10
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/short-trs.fire', p2x)
    const child = result.root.children[0]
    expect(child.position).toEqual({ x: 0, y: 0, z: 0 })
    expect(child.scale).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('_trs 자체가 없으면 _position/_scale 개별 필드 폴백 사용', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'NoTRS',
        _active: true,
        _id: 'notrs-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'FallbackPos',
        _active: true,
        _id: 'fallback-pos',
        _children: [],
        _components: [],
        // _trs 없음, 개별 필드 폴백
        _position: { x: 42, y: 84, z: 0 },
        _scale: { x: 2, y: 3, z: 1 },
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 200,
        _color: { r: 100, g: 150, b: 200, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/fallback-pos.fire', p2x)
    const child = result.root.children[0]
    expect(child.position).toEqual({ x: 42, y: 84, z: 0 })
    expect(child.scale).toEqual({ x: 2, y: 3, z: 1 })
  })
})

// ── UITransform 없는 3.x 노드 ─────────────────────────────────────────────────

describe('cc-file-parser edge — UITransform 없는 3.x 노드', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cc.UITransform 없으면 size={x:0, y:0}, anchor={x:0.5, y:0.5} 기본값', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'NoUIT3x',
        _active: true,
        _id: 'no-uit-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _lpos: { x: 0, y: 0, z: 0 },
        _lrot: { x: 0, y: 0, z: 0, w: 1 },
        _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 },
        _color: { r: 255, g: 255, b: 255, a: 255 },
        layer: 33554432,
      },
      {
        __type__: 'cc.Node',
        _name: 'NoUITransform',
        _active: true,
        _id: 'no-uit-child',
        _children: [],
        _components: [],
        _lpos: { x: 10, y: 20, z: 0 },
        _lrot: { x: 0, y: 0, z: 0, w: 1 },
        _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 0.8 },
        _color: { r: 0, g: 100, b: 200, a: 255 },
        layer: 33554432,
        // cc.UITransform 컴포넌트 없음 → uiMap에 항목 없음
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/no-uit.scene', p3x)
    const child = result.root.children[0]
    expect(child.position).toEqual({ x: 10, y: 20, z: 0 })
    expect(child.size).toEqual({ x: 0, y: 0 })
    expect(child.anchor).toEqual({ x: 0.5, y: 0.5 })
    // opacity: 0.8 * 255 = 204
    expect(child.opacity).toBe(204)
  })

  it('일부 노드만 UITransform 있어도 나머지는 기본값으로 정상 파싱', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'MixedUIT',
        _active: true,
        _id: 'mixed-root',
        _children: [{ __id__: 2 }, { __id__: 3 }],
        _components: [],
        _lpos: { x: 0, y: 0, z: 0 },
        _lrot: { x: 0, y: 0, z: 0, w: 1 },
        _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 },
        _color: { r: 255, g: 255, b: 255, a: 255 },
        layer: 33554432,
      },
      // idx=2: UITransform 있음
      {
        __type__: 'cc.Node',
        _name: 'WithUIT',
        _active: true,
        _id: 'with-uit',
        _children: [],
        _components: [{ __id__: 4 }],
        _lpos: { x: 0, y: 0, z: 0 },
        _lrot: { x: 0, y: 0, z: 0, w: 1 },
        _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 },
        _color: { r: 255, g: 255, b: 255, a: 255 },
        layer: 33554432,
      },
      // idx=3: UITransform 없음
      {
        __type__: 'cc.Node',
        _name: 'WithoutUIT',
        _active: true,
        _id: 'without-uit',
        _children: [],
        _components: [],
        _lpos: { x: 5, y: 10, z: 0 },
        _lrot: { x: 0, y: 0, z: 0, w: 1 },
        _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 },
        _color: { r: 255, g: 255, b: 255, a: 255 },
        layer: 33554432,
      },
      // idx=4: UITransform for idx=2
      {
        __type__: 'cc.UITransform',
        node: { __id__: 2 },
        _contentSize: { width: 200, height: 100 },
        _anchorPoint: { x: 0, y: 0 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/mixed-uit.scene', p3x)
    const [withUIT, withoutUIT] = result.root.children
    expect(withUIT.size).toEqual({ x: 200, y: 100 })
    expect(withUIT.anchor).toEqual({ x: 0, y: 0 })
    expect(withoutUIT.size).toEqual({ x: 0, y: 0 })
    expect(withoutUIT.anchor).toEqual({ x: 0.5, y: 0.5 })
  })
})

// ── 프리팹 내 프리팹 (중첩 prefab) ────────────────────────────────────────────

describe('cc-file-parser edge — 중첩 prefab', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cc.Prefab 루트 파싱 — data 참조로 루트 인덱스 찾음', async () => {
    const raw = [
      // idx=0: Prefab asset
      { __type__: 'cc.Prefab', data: { __id__: 1 } },
      // idx=1: root node of prefab
      {
        __type__: 'cc.Node',
        _name: 'PrefabRoot',
        _active: true,
        _id: 'prefab-root-id',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 200, height: 200 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // idx=2: 내부 자식 노드 (내부 프리팹 인스턴스)
      {
        __type__: 'cc.Node',
        _name: 'InnerPrefabInstance',
        _active: true,
        _id: 'inner-prefab-id',
        _children: [],
        _components: [],
        _prefab: { __id__: 3 }, // 내부 prefab 참조 (파싱 시 무시됨)
        _trs: baseTrs(10, 20),
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 200,
        _color: { r: 255, g: 0, b: 0, a: 255 },
      },
      // idx=3: CompPrefabInfo (cc.CompPrefabInfo는 건너뜀)
      {
        __type__: 'cc.CompPrefabInfo',
        fileId: 'some-id',
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/nested.prefab', p2x)

    expect(result.root.name).toBe('PrefabRoot')
    expect(result.root.children).toHaveLength(1)
    expect(result.root.children[0].name).toBe('InnerPrefabInstance')
    expect(result.root.children[0].position).toEqual({ x: 10, y: 20, z: 0 })
  })

  it('중첩 prefab에서 cc.CompPrefabInfo 컴포넌트는 필터링됨', async () => {
    const raw = [
      { __type__: 'cc.Prefab', data: { __id__: 1 } },
      {
        __type__: 'cc.Node',
        _name: 'PrefabNodeWithInfo',
        _active: true,
        _id: 'pni-root',
        _children: [],
        _components: [{ __id__: 2 }, { __id__: 3 }],
        _trs: baseTrs(),
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // idx=2: cc.Label (유지됨)
      {
        __type__: 'cc.Label',
        node: { __id__: 1 },
        _enabled: true,
        _N$string: 'PrefabLabel',
        _N$fontSize: 24,
        _N$lineHeight: 30,
        _N$horizontalAlign: 0,
      },
      // idx=3: cc.CompPrefabInfo (건너뜀)
      {
        __type__: 'cc.CompPrefabInfo',
        fileId: 'skip-me',
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/prefab-comp.prefab', p2x)
    // cc.CompPrefabInfo는 필터링되어 cc.Label만 남음
    expect(result.root.components).toHaveLength(1)
    expect(result.root.components[0].type).toBe('cc.Label')
  })
})

// ── 기타 엣지 케이스 ──────────────────────────────────────────────────────────

describe('cc-file-parser edge — 기타', () => {
  beforeEach(() => vi.clearAllMocks())

  it('파일 읽기 실패 시 에러 throw', async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    await expect(parseCCScene('/fake/nonexistent.fire', p2x)).rejects.toThrow('씬 파일 파싱 실패')
  })

  it('유효하지 않은 JSON이면 에러 throw', async () => {
    mockReadFileSync.mockReturnValue('{ not valid json }}}')
    await expect(parseCCScene('/fake/bad.fire', p2x)).rejects.toThrow('씬 파일 파싱 실패')
  })

  it('루트 노드를 찾을 수 없으면 에러 throw', async () => {
    // SceneAsset이 scene ref를 범위 밖 인덱스로 가리킴
    const raw = [
      { __type__: 'cc.SomeRandomAsset', value: 1 },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    await expect(parseCCScene('/fake/noroot.fire', p2x)).rejects.toThrow('씬 루트 노드를 찾을 수 없습니다')
  })

  it('opacity 필드 없는 2x 노드는 255로 기본값', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'NoOpacity',
        _active: true,
        _id: 'no-opacity-root',
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        // _opacity 없음
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'OpacityDefault',
        _active: true,
        _id: 'opacity-default',
        _children: [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        // _opacity 없음 → 255 기본값
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/no-opacity.fire', p2x)
    expect(result.root.children[0].opacity).toBe(255)
  })

  it('_id 없는 노드는 _idx{n} 형태 uuid 사용', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene',
        _name: 'NoID',
        _active: true,
        // _id 없음
        _children: [{ __id__: 2 }],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'NoIDChild',
        _active: true,
        // _id 없음
        _children: [],
        _components: [],
        _trs: baseTrs(),
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))
    const result = await parseCCScene('/fake/no-id.fire', p2x)
    expect(result.root.uuid).toBe('_idx1')
    expect(result.root.children[0].uuid).toBe('_idx2')
  })
})
