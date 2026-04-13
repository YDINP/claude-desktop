/**
 * cc-file-parser — resolveWidgetLayout 추가 테스트
 * - 부모 size=0 시 Widget 스킵
 * - Widget 없는 노드 → 변경 없음
 * - 다중 자식 중 일부만 Widget
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

function baseTrs(x = 0, y = 0): Record<string, unknown> {
  return { __type__: 'TypedArray', ctor: 'Float64Array', array: [x, y, 0, 0, 0, 0, 1, 1, 1, 1] }
}

function node2x(
  id: string,
  name: string,
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
  children: { __id__: number }[] = [],
  comps: { __id__: number }[] = [],
) {
  return {
    __type__: 'cc.Node', _name: name, _active: true, _id: id,
    _children: children, _components: comps,
    _trs: baseTrs(),
    _contentSize: { width: w, height: h },
    _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255,
    _color: { r: 255, g: 255, b: 255, a: 255 },
    ...extra,
  }
}

// WIDGET_TOP=1, WIDGET_VMID=2, WIDGET_BOT=4, WIDGET_LEFT=8, WIDGET_HMID=16, WIDGET_RIGHT=32
function widgetComp2x(nodeId: number, flags: number, props: Record<string, unknown> = {}) {
  return {
    __type__: 'cc.Widget', node: { __id__: nodeId },
    _N$alignFlags: flags,
    _N$left: 0, _N$right: 0, _N$top: 0, _N$bottom: 0,
    _N$horizontalCenter: 0, _N$verticalCenter: 0,
    ...props,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── 부모 size=0 시 Widget 스킵 ────────────────────────────────────────────────

describe('resolveWidgetLayout — 부모 size=0 시 스킵', () => {
  it('부모 width=0 이면 Widget LEFT+RIGHT 적용 안 됨 — position/size 그대로 유지', async () => {
    // Canvas 0×0 → Widget 자식 LEFT+RIGHT(8+32=40), left=10, right=10
    // parentW=0 이면 조건 (parentW > 0 && parentH > 0) 실패 → 스킵
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas node — size 0×0
      node2x('canvas', 'Canvas', 0, 0, {}, [{ __id__: 4 }], [{ __id__: 3 }]),
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 0, height: 0 } },
      // [4] Widget 자식: 원래 position=(50, 30), size 100×80
      {
        ...node2x('child', 'Child', 100, 80, { _trs: baseTrs(50, 30) }, [], [{ __id__: 5 }]),
      },
      // [5] Widget LEFT+RIGHT(8+32=40), left=10, right=10
      widgetComp2x(4, 40, { _N$left: 10, _N$right: 10 }),
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // 부모 size=0 → Widget 스킵 → position/size 원본 유지
    expect(child.position.x).toBe(50)
    expect(child.position.y).toBe(30)
    expect(child.size.x).toBe(100)
    expect(child.size.y).toBe(80)
  })

  it('부모 height=0 이면 Widget TOP+BOT 적용 안 됨', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] parent node width=200, height=0
      node2x('parent', 'Parent', 200, 0, {}, [{ __id__: 4 }], [{ __id__: 3 }]),
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 200, height: 0 } },
      // [4] Widget 자식: position=(0, 20), size 50×60
      {
        ...node2x('child', 'Child', 50, 60, { _trs: baseTrs(0, 20) }, [], [{ __id__: 5 }]),
      },
      // [5] Widget TOP+BOT(1+4=5), top=5, bottom=5
      widgetComp2x(4, 5, { _N$top: 5, _N$bottom: 5 }),
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    // parentH=0 → Widget 스킵 → 원본 유지
    expect(child.position.y).toBe(20)
    expect(child.size.y).toBe(60)
  })
})

// ── Widget 없는 노드 → 변경 없음 ─────────────────────────────────────────────

describe('resolveWidgetLayout — Widget 없는 노드', () => {
  it('Widget 컴포넌트 없는 자식 → position/size 그대로', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas 960×640
      node2x('canvas', 'Canvas', 960, 640, {}, [{ __id__: 4 }], [{ __id__: 3 }]),
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 960, height: 640 } },
      // [4] 자식 — Widget 없음, position=(100, 50), size 200×150
      node2x('child', 'Child', 200, 150, { _trs: baseTrs(100, 50) }, [], [{ __id__: 5 }]),
      // [5] cc.Label (Widget 아님)
      { __type__: 'cc.Label', node: { __id__: 4 }, _N$string: 'hello' },
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    expect(child.position.x).toBe(100)
    expect(child.position.y).toBe(50)
    expect(child.size.x).toBe(200)
    expect(child.size.y).toBe(150)
  })

  it('컴포넌트가 아예 없는 노드 → 변경 없음', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas 960×640
      node2x('canvas', 'Canvas', 960, 640, {}, [{ __id__: 3 }], []),
      // [3] 자식 — 컴포넌트 없음, position=(-200, 100)
      node2x('empty', 'Empty', 100, 100, { _trs: baseTrs(-200, 100) }, [], []),
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    expect(child.position.x).toBe(-200)
    expect(child.position.y).toBe(100)
    expect(child.size.x).toBe(100)
    expect(child.size.y).toBe(100)
  })
})

// ── 다중 자식 중 일부만 Widget ────────────────────────────────────────────────

describe('resolveWidgetLayout — 다중 자식 중 일부만 Widget', () => {
  it('3개 자식 중 중간 자식만 Widget LEFT → 나머지는 그대로', async () => {
    // 0: SceneAsset, 1: Scene, 2: Canvas, 3: cc.Canvas, 4: ChildA, 5: ChildB, 6: Widget, 7: ChildC
    // Canvas 960×640 → 자식 A(no widget), 자식 B(Widget LEFT=8), 자식 C(no widget)
    const fixedRaw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas
      node2x('canvas', 'Canvas', 960, 640, {}, [{ __id__: 4 }, { __id__: 5 }, { __id__: 7 }], [{ __id__: 3 }]),
      // [3] cc.Canvas
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 960, height: 640 } },
      // [4] ChildA — no widget
      node2x('childA', 'ChildA', 100, 100, { _trs: baseTrs(-300, 100) }, [], []),
      // [5] ChildB — Widget LEFT(8)
      node2x('childB', 'ChildB', 100, 100, { _trs: baseTrs(0, 0) }, [], [{ __id__: 6 }]),
      // [6] Widget LEFT=8, left=20
      widgetComp2x(5, 8, { _N$left: 20 }),
      // [7] ChildC — no widget
      node2x('childC', 'ChildC', 80, 80, { _trs: baseTrs(200, -50) }, [], []),
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(fixedRaw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const canvas = result.root.children[0]
    const [childA, childB, childC] = canvas.children

    // ChildA: no widget → 원본 유지
    expect(childA.position.x).toBe(-300)
    expect(childA.position.y).toBe(100)

    // ChildB: Widget LEFT(8), left=20, w=100, anchor=0.5
    // x = left + w*anchorX - parentW*0.5 = 20 + 100*0.5 - 960*0.5 = 20 + 50 - 480 = -410
    expect(childB.position.x).toBeCloseTo(-410, 1)
    // y 변화 없음 (수직 widget 없음)
    expect(childB.position.y).toBe(0)

    // ChildC: no widget → 원본 유지
    expect(childC.position.x).toBe(200)
    expect(childC.position.y).toBe(-50)
  })

  it('두 자식 모두 Widget이 있는 경우 각각 독립적으로 적용됨', async () => {
    // Canvas 400×300 → ChildA(Widget RIGHT, right=0), ChildB(Widget TOP, top=0)
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas 400×300
      node2x('canvas', 'Canvas', 400, 300, {}, [{ __id__: 4 }, { __id__: 6 }], [{ __id__: 3 }]),
      // [3] cc.Canvas
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 400, height: 300 } },
      // [4] ChildA: size=80×60, anchor=0.5, Widget RIGHT(32), right=0
      node2x('childA', 'ChildA', 80, 60, { _trs: baseTrs(0, 0) }, [], [{ __id__: 5 }]),
      // [5] Widget RIGHT=32, right=0
      widgetComp2x(4, 32, { _N$right: 0 }),
      // [6] ChildB: size=100×40, anchor=0.5, Widget TOP(1), top=10
      node2x('childB', 'ChildB', 100, 40, { _trs: baseTrs(0, 0) }, [], [{ __id__: 7 }]),
      // [7] Widget TOP=1, top=10
      widgetComp2x(6, 1, { _N$top: 10 }),
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const canvas = result.root.children[0]
    const [childA, childB] = canvas.children

    // ChildA: Widget RIGHT, right=0, w=80, anchor=0.5
    // x = parentW*0.5 - right - w*(1-anchorX) = 200 - 0 - 80*0.5 = 160
    expect(childA.position.x).toBeCloseTo(160, 1)

    // ChildB: Widget TOP, top=10, h=40, anchor=0.5
    // y = parentH*0.5 - top - h*(1-anchorY) = 150 - 10 - 40*0.5 = 120
    expect(childB.position.y).toBeCloseTo(120, 1)
  })
})

// ── Widget flags=0 (정렬 없음) ────────────────────────────────────────────────

describe('resolveWidgetLayout — alignFlags=0 이면 Widget 있어도 스킵', () => {
  it('Widget 컴포넌트가 있어도 alignFlags=0이면 position 그대로', async () => {
    const raw = [
      { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
      {
        __type__: 'cc.Scene', _name: 'S', _active: true, _id: 's',
        _children: [{ __id__: 2 }], _components: [],
        _trs: baseTrs(), _contentSize: { width: 0, height: 0 },
        _anchorPoint: { x: 0.5, y: 0.5 }, _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      // [2] Canvas 960×640
      node2x('canvas', 'Canvas', 960, 640, {}, [{ __id__: 4 }], [{ __id__: 3 }]),
      { __type__: 'cc.Canvas', node: { __id__: 2 }, _designResolution: { width: 960, height: 640 } },
      // [4] 자식: position=(123, 456)
      node2x('child', 'Child', 100, 100, { _trs: baseTrs(123, 456) }, [], [{ __id__: 5 }]),
      // [5] Widget with alignFlags=0 → no alignment applied
      widgetComp2x(4, 0),
    ]
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const result = await parseCCScene('/fake/scene.fire', p2x)
    const child = result.root.children[0].children[0]

    expect(child.position.x).toBe(123)
    expect(child.position.y).toBe(456)
  })
})
