import { describe, it, expect } from 'vitest'
import type {
  SceneNode,
  ViewTransform,
  DragState,
  ResizeState,
  UndoEntry,
  ClipboardEntry,
  MarqueeState,
} from '../types'

// types.ts는 순수 타입 선언 파일이므로 인터페이스 shape 검증과
// 타입 가드 역할을 하는 런타임 유틸 함수 테스트로 구성한다.

// ── 타입 shape 검증 (런타임 헬퍼) ─────────────────────────────

function makeSceneNode(override: Partial<SceneNode> = {}): SceneNode {
  return {
    uuid: 'test-uuid',
    name: 'TestNode',
    active: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    anchorX: 0.5,
    anchorY: 0.5,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    parentUuid: null,
    childUuids: [],
    components: [],
    ...override,
  }
}

function makeViewTransform(override: Partial<ViewTransform> = {}): ViewTransform {
  return { offsetX: 0, offsetY: 0, zoom: 1, ...override }
}

// ── SceneNode ─────────────────────────────────────────────────

describe('SceneNode', () => {
  it('필수 필드로 생성된다', () => {
    const node = makeSceneNode()
    expect(node.uuid).toBe('test-uuid')
    expect(node.active).toBe(true)
    expect(node.color).toEqual({ r: 255, g: 255, b: 255, a: 255 })
    expect(node.childUuids).toEqual([])
  })

  it('worldX/worldY는 선택적이다', () => {
    const node = makeSceneNode()
    expect(node.worldX).toBeUndefined()
    expect(node.worldY).toBeUndefined()

    const nodeWithWorld = makeSceneNode({ worldX: 100, worldY: 200 })
    expect(nodeWithWorld.worldX).toBe(100)
    expect(nodeWithWorld.worldY).toBe(200)
  })

  it('locked, memo, visible, tags는 선택적이다', () => {
    const node = makeSceneNode()
    expect(node.locked).toBeUndefined()
    expect(node.memo).toBeUndefined()
    expect(node.visible).toBeUndefined()
    expect(node.tags).toBeUndefined()
  })

  it('labelColor는 선택적이다', () => {
    const node = makeSceneNode({ labelColor: '#ff0000' })
    expect(node.labelColor).toBe('#ff0000')
  })

  it('eventHandlers는 선택적이다', () => {
    const node = makeSceneNode({
      eventHandlers: [{ component: 'cc.Button', event: 'click', handler: 'onBtn' }],
    })
    expect(node.eventHandlers).toHaveLength(1)
    expect(node.eventHandlers![0].event).toBe('click')
  })

  it('components 배열에 type/props를 가진 컴포넌트를 담을 수 있다', () => {
    const node = makeSceneNode({
      components: [{ type: 'cc.Label', props: { string: 'Hello' } }],
    })
    expect(node.components[0].type).toBe('cc.Label')
    expect((node.components[0].props as Record<string, unknown>).string).toBe('Hello')
  })
})

// ── ViewTransform ─────────────────────────────────────────────

describe('ViewTransform', () => {
  it('기본 뷰는 zoom=1, offset=0이다', () => {
    const vt = makeViewTransform()
    expect(vt.zoom).toBe(1)
    expect(vt.offsetX).toBe(0)
    expect(vt.offsetY).toBe(0)
  })

  it('zoom 값이 설정된다', () => {
    const vt = makeViewTransform({ zoom: 2.5 })
    expect(vt.zoom).toBe(2.5)
  })
})

// ── DragState ─────────────────────────────────────────────────

describe('DragState', () => {
  it('기본 드래그 상태가 생성된다', () => {
    const drag: DragState = {
      uuid: 'node-1',
      startSvgX: 10,
      startSvgY: 20,
      startNodeX: 5,
      startNodeY: 8,
    }
    expect(drag.uuid).toBe('node-1')
    expect(drag.groupOffsets).toBeUndefined()
  })

  it('groupOffsets가 설정된다', () => {
    const drag: DragState = {
      uuid: 'node-1',
      startSvgX: 0,
      startSvgY: 0,
      startNodeX: 0,
      startNodeY: 0,
      groupOffsets: {
        'node-1': { startX: 10, startY: 20 },
        'node-2': { startX: 30, startY: 40 },
      },
    }
    expect(drag.groupOffsets!['node-2'].startX).toBe(30)
  })
})

// ── ResizeState ───────────────────────────────────────────────

describe('ResizeState', () => {
  const handles: ResizeState['handle'][] = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']

  it('8개의 핸들이 있다', () => {
    expect(handles).toHaveLength(8)
  })

  it('각 핸들로 ResizeState 생성이 가능하다', () => {
    for (const handle of handles) {
      const state: ResizeState = {
        uuid: 'n',
        handle,
        startSvgX: 0,
        startSvgY: 0,
        startWidth: 100,
        startHeight: 100,
        startNodeX: 0,
        startNodeY: 0,
      }
      expect(state.handle).toBe(handle)
    }
  })
})

// ── UndoEntry ─────────────────────────────────────────────────

describe('UndoEntry', () => {
  it('move 타입 엔트리', () => {
    const entry: UndoEntry = {
      type: 'move',
      uuid: 'node-1',
      prevX: 0,
      prevY: 0,
      nextX: 50,
      nextY: 100,
    }
    expect(entry.type).toBe('move')
    expect(entry.nextX).toBe(50)
  })

  it('prop 타입 엔트리', () => {
    const entry: UndoEntry = {
      type: 'prop',
      uuid: 'node-1',
      key: 'opacity',
      prevVal: 255,
      nextVal: 128,
    }
    expect(entry.type).toBe('prop')
    expect(entry.key).toBe('opacity')
  })

  it('type은 선택적이다', () => {
    const entry: UndoEntry = { uuid: 'node-1' }
    expect(entry.type).toBeUndefined()
  })
})

// ── ClipboardEntry ────────────────────────────────────────────

describe('ClipboardEntry', () => {
  it('uuid, name, x, y를 가진다', () => {
    const entry: ClipboardEntry = { uuid: 'clip-1', name: 'Button', x: 10, y: 20 }
    expect(entry.name).toBe('Button')
    expect(entry.x).toBe(10)
  })
})

// ── MarqueeState ──────────────────────────────────────────────

describe('MarqueeState', () => {
  it('비활성 상태 생성', () => {
    const state: MarqueeState = { startX: 0, startY: 0, endX: 0, endY: 0, active: false }
    expect(state.active).toBe(false)
  })

  it('활성 상태에서 영역이 설정된다', () => {
    const state: MarqueeState = { startX: 10, startY: 20, endX: 100, endY: 80, active: true }
    expect(state.endX - state.startX).toBe(90)
    expect(state.endY - state.startY).toBe(60)
  })
})
