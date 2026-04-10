/**
 * useCCSceneMouse — 좌표 변환 및 핸들러 로직 테스트
 * renderHook으로 훅을 마운트하고 직접 이벤트 시뮬레이션
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCCSceneMouse, type CCSceneMouseDeps } from '../useCCSceneMouse'
import type { FlatNode, ViewTransformCC } from '../ccSceneTypes'
import type { CCSceneNode } from '@shared/ipc-schema'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRef<T>(val: T) {
  return { current: val }
}

function makeSvgRef(left = 0, top = 0, w = 800, h = 600) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left, top, right: left + w, bottom: top + h, width: w, height: h }),
  })
  document.body.appendChild(el)
  return { current: el } as React.RefObject<SVGSVGElement | null>
}

function makeNode(uuid: string): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [],
    children: [],
  }
}

function makeFlatNode(uuid: string, worldX = 0, worldY = 0, parentUuid: string | null = null): FlatNode {
  return {
    node: makeNode(uuid),
    worldX, worldY,
    worldRotZ: 0, worldScaleX: 1, worldScaleY: 1,
    depth: 0, parentUuid, siblingIdx: 0, siblingTotal: 1, effectiveActive: true,
  }
}

function makeDefaultView(zoom = 1, offsetX = 0, offsetY = 0): ViewTransformCC {
  return { zoom, offsetX, offsetY }
}

function makeDeps(overrides: Partial<CCSceneMouseDeps> = {}): CCSceneMouseDeps {
  const view = makeDefaultView()
  const viewRef = makeRef(view)

  return {
    svgRef: makeSvgRef(),
    viewRef,
    isSpaceDownRef: makeRef(false),
    panStart: makeRef(null),
    dragRef: makeRef(null),
    multiDragRef: makeRef(null),
    resizeRef: makeRef(null),
    rotateRef: makeRef(null),
    anchorRef: makeRef(null),
    guideDragRef: makeRef(null),
    measureStartRef: makeRef(null),
    selBoxRef: makeRef(null),
    hoverClientPosRef: makeRef(null),

    view,
    isPanning: false,
    measureMode: false,
    snapSize: 10,
    cx: 400,
    cy: 300,
    effectiveW: 800,
    effectiveH: 600,
    flatNodes: [],
    showUserGuides: false,
    userGuides: [],

    anchorOverride: null,
    rotateOverride: null,
    dragOverride: null,
    resizeOverride: null,
    multiDragDelta: null,
    selectionBox: null,

    setView: vi.fn(),
    setIsPanning: vi.fn(),
    setMouseScenePos: vi.fn(),
    setUserGuides: vi.fn(),
    setMeasureLine: vi.fn(),
    setAnchorOverride: vi.fn(),
    setRotateOverride: vi.fn(),
    setResizeOverride: vi.fn(),
    setDragOverride: vi.fn(),
    setSnapIndicator: vi.fn(),
    setAlignGuides: vi.fn(),
    setDragGhost: vi.fn(),
    setMultiDragDelta: vi.fn(),
    setSelectionBox: vi.fn(),
    setMultiSelected: vi.fn(),

    ccToSvg: (ccX: number, ccY: number) => ({ x: 400 + ccX, y: 300 - ccY }),
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    onRotate: vi.fn(),
    onAnchorMove: vi.fn(),
    onMultiMove: vi.fn(),
    onAltDrag: vi.fn(),

    ...overrides,
  }
}

function makeMouseEvent(overrides: Partial<MouseEvent & { button: number; clientX: number; clientY: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}): React.MouseEvent {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as React.MouseEvent
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useCCSceneMouse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── handleMouseDown — pan start ───────────────────────────────────────────────

  describe('handleMouseDown', () => {
    it('middle button (button=1) starts panning', () => {
      const deps = makeDeps()
      const { result } = renderHook(() => useCCSceneMouse(deps))
      const e = makeMouseEvent({ button: 1, clientX: 100, clientY: 50 })

      act(() => result.current.handleMouseDown(e))

      expect(deps.setIsPanning).toHaveBeenCalledWith(true)
      expect(deps.panStart.current).toEqual({ mouseX: 100, mouseY: 50, offX: 0, offY: 0 })
    })

    it('left button + space key starts panning', () => {
      const deps = makeDeps()
      deps.isSpaceDownRef.current = true
      const { result } = renderHook(() => useCCSceneMouse(deps))
      const e = makeMouseEvent({ button: 0, clientX: 200, clientY: 100 })

      act(() => result.current.handleMouseDown(e))

      expect(deps.setIsPanning).toHaveBeenCalledWith(true)
    })

    it('left button without space starts rubber-band selection (sets selBoxRef)', () => {
      const deps = makeDeps()
      const { result } = renderHook(() => useCCSceneMouse(deps))
      // clientX=400, clientY=300 → svgX=(400-0)/1=400, svgY=(300-0)/1=300
      const e = makeMouseEvent({ button: 0, clientX: 400, clientY: 300 })

      act(() => result.current.handleMouseDown(e))

      expect(deps.panStart.current).toBeNull()
      expect(deps.selBoxRef.current).not.toBeNull()
      expect(deps.selBoxRef.current?.startSvgX).toBeCloseTo(400)
      expect(deps.selBoxRef.current?.startSvgY).toBeCloseTo(300)
    })

    it('left button in measureMode sets measureStartRef', () => {
      const deps = makeDeps({ measureMode: true })
      const { result } = renderHook(() => useCCSceneMouse(deps))
      const e = makeMouseEvent({ button: 0, clientX: 300, clientY: 200 })

      act(() => result.current.handleMouseDown(e))

      expect(deps.measureStartRef.current).not.toBeNull()
      expect(deps.setMeasureLine).toHaveBeenCalledWith(null)
    })

    it('right button (button=2) starts panning', () => {
      const deps = makeDeps()
      const { result } = renderHook(() => useCCSceneMouse(deps))
      const e = makeMouseEvent({ button: 2, clientX: 50, clientY: 50 })

      act(() => result.current.handleMouseDown(e))

      expect(deps.setIsPanning).toHaveBeenCalledWith(true)
    })
  })

  // ── handleMouseMove — pan offset ─────────────────────────────────────────────

  describe('handleMouseMove', () => {
    it('updates view offset while panning', () => {
      const setView = vi.fn()
      const deps = makeDeps({ isPanning: true, setView })
      deps.panStart.current = { mouseX: 100, mouseY: 50, offX: 10, offY: 20 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      const e = makeMouseEvent({ clientX: 120, clientY: 70 })
      act(() => result.current.handleMouseMove(e))

      expect(setView).toHaveBeenCalled()
      const updater = (setView as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const prev = { zoom: 1, offsetX: 0, offsetY: 0 }
      const next = updater(prev)
      // dx=20, dy=20 → offsetX = offX+dx = 30, offsetY = offY+dy = 40
      expect(next.offsetX).toBe(30)
      expect(next.offsetY).toBe(40)
    })

    it('updates mouseScenePos with correct SVG→scene coordinate conversion', () => {
      const setMouseScenePos = vi.fn()
      const deps = makeDeps({ setMouseScenePos })
      // SVG rect: left=0, top=0; zoom=1, offsetX=0, offsetY=0
      // clientX=500, clientY=200 → scx = (500-0)/1 - cx(400) = 100, scy = cy(300) - (200-0)/1 = 100
      const { result } = renderHook(() => useCCSceneMouse(deps))

      const e = makeMouseEvent({ clientX: 500, clientY: 200 })
      act(() => result.current.handleMouseMove(e))

      expect(setMouseScenePos).toHaveBeenCalledWith({ x: 100, y: 100 })
    })

    it('inverts Y axis: clientY > cy produces negative scene Y', () => {
      const setMouseScenePos = vi.fn()
      const deps = makeDeps({ setMouseScenePos })
      // clientX=400(cx), clientY=400 → scx=0, scy = 300-400 = -100
      const { result } = renderHook(() => useCCSceneMouse(deps))

      const e = makeMouseEvent({ clientX: 400, clientY: 400 })
      act(() => result.current.handleMouseMove(e))

      expect(setMouseScenePos).toHaveBeenCalledWith({ x: 0, y: -100 })
    })

    it('zoom affects coordinate scaling', () => {
      const setMouseScenePos = vi.fn()
      const view = makeDefaultView(2, 0, 0)
      const viewRef = makeRef(view)
      const deps = makeDeps({ view, setMouseScenePos })
      deps.viewRef.current = { zoom: 2, offsetX: 0, offsetY: 0 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // clientX=600, clientY=200 → scx = (600)/2 - 400 = -100, scy = 300 - (200)/2 = 200
      const e = makeMouseEvent({ clientX: 600, clientY: 200 })
      act(() => result.current.handleMouseMove(e))

      expect(setMouseScenePos).toHaveBeenCalledWith({ x: -100, y: 200 })
    })

    it('guideDragRef active: updates guide position (V type)', () => {
      const setUserGuides = vi.fn()
      const deps = makeDeps({ setUserGuides, userGuides: [{ type: 'V', pos: 100 }] })
      deps.guideDragRef.current = { idx: 0, type: 'V', startMouse: 100, startPos: 100 }
      deps.viewRef.current = { zoom: 1, offsetX: 0, offsetY: 0 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      const e = makeMouseEvent({ clientX: 150 })  // delta = 50 / zoom(1) = 50
      act(() => result.current.handleMouseMove(e))

      expect(setUserGuides).toHaveBeenCalled()
      const updater = (setUserGuides as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const updated = updater([{ type: 'V', pos: 100 }])
      expect(updated[0].pos).toBe(150)  // 100 + 50
    })

    it('measureMode drag: updates measure line', () => {
      const setMeasureLine = vi.fn()
      const deps = makeDeps({ measureMode: true, setMeasureLine })
      deps.measureStartRef.current = { svgX: 200, svgY: 150 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      const e = makeMouseEvent({ clientX: 300, clientY: 250 })
      act(() => result.current.handleMouseMove(e))

      expect(setMeasureLine).toHaveBeenCalledWith(expect.objectContaining({
        svgX1: 200, svgY1: 150,
        svgX2: expect.any(Number), svgY2: expect.any(Number),
      }))
    })
  })

  // ── handleMouseUp — drag/rotate/resize commit ────────────────────────────────

  describe('handleMouseUp', () => {
    it('commits drag: calls onMove with dragOverride coords', async () => {
      const onMove = vi.fn()
      const deps = makeDeps({ onMove, dragOverride: { uuid: 'node-1', x: 50, y: 30 } })
      deps.dragRef.current = {
        uuid: 'node-1', startMouseX: 0, startMouseY: 0,
        startNodeX: 0, startNodeY: 0,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      await act(async () => result.current.handleMouseUp())

      expect(onMove).toHaveBeenCalledWith('node-1', 50, 30)
      expect(deps.setDragOverride).toHaveBeenCalledWith(null)
    })

    it('commits altDrag: calls onAltDrag instead of onMove', async () => {
      const onMove = vi.fn()
      const onAltDrag = vi.fn()
      const deps = makeDeps({ onMove, onAltDrag, dragOverride: { uuid: 'n', x: 10, y: 20 } })
      deps.dragRef.current = {
        uuid: 'n', startMouseX: 0, startMouseY: 0,
        startNodeX: 0, startNodeY: 0, isAltDrag: true,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      await act(async () => result.current.handleMouseUp())

      expect(onAltDrag).toHaveBeenCalledWith('n', 10, 20)
      expect(onMove).not.toHaveBeenCalled()
    })

    it('commits anchor: calls onAnchorMove', async () => {
      const onAnchorMove = vi.fn()
      const deps = makeDeps({ onAnchorMove, anchorOverride: { uuid: 'a', ax: 0.3, ay: 0.7 } })
      deps.anchorRef.current = { uuid: 'a', rectX: 0, rectY: 0, w: 100, h: 100 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      await act(async () => result.current.handleMouseUp())

      expect(onAnchorMove).toHaveBeenCalledWith('a', 0.3, 0.7)
    })

    it('releases guideDrag without calling any action', async () => {
      const onMove = vi.fn()
      const deps = makeDeps({ onMove })
      deps.guideDragRef.current = { idx: 0, type: 'H', startMouse: 0, startPos: 0 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      await act(async () => result.current.handleMouseUp())

      expect(deps.guideDragRef.current).toBeNull()
      expect(onMove).not.toHaveBeenCalled()
    })

    it('rubber-band: selects nodes in box', async () => {
      const setMultiSelected = vi.fn()
      const onSelect = vi.fn()
      const fn = makeFlatNode('n1', 0, 0)
      fn.node.size = { x: 50, y: 50 }
      const box = { x1: -50, y1: -50, x2: 50, y2: 50 }
      const deps = makeDeps({
        setMultiSelected, onSelect,
        flatNodes: [fn],
        selectionBox: box,
        ccToSvg: (cx, cy) => ({ x: 400 + cx, y: 300 - cy }),
      })
      deps.selBoxRef.current = { startSvgX: -50, startSvgY: -50 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      await act(async () => result.current.handleMouseUp())

      expect(setMultiSelected).toHaveBeenCalled()
    })

    it('commits multiDrag: calls onMultiMove with correct deltas', async () => {
      const onMultiMove = vi.fn()
      const deps = makeDeps({ onMultiMove, multiDragDelta: { dx: 20, dy: 10 } })
      deps.multiDragRef.current = {
        startMouseX: 0, startMouseY: 0,
        nodes: new Map([['n1', { localX: 100, localY: 50 }], ['n2', { localX: 0, localY: 0 }]]),
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      await act(async () => result.current.handleMouseUp())

      expect(onMultiMove).toHaveBeenCalledWith(expect.arrayContaining([
        { uuid: 'n1', x: 120, y: 60 },
        { uuid: 'n2', x: 20, y: 10 },
      ]))
    })
  })

  // ── anchor dragging: ax/ay clamped to [0,1] ───────────────────────────────────

  describe('anchor drag clamping', () => {
    it('clamps ax to [0,1] when cursor goes outside bounds', () => {
      const setAnchorOverride = vi.fn()
      const deps = makeDeps({ setAnchorOverride })
      deps.anchorRef.current = { uuid: 'n', rectX: 100, rectY: 100, w: 200, h: 200 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // svgX far left of rectX → ax < 0 → clamped to 0
      const e = makeMouseEvent({ clientX: 0, clientY: 200 })
      act(() => result.current.handleMouseMove(e))

      const call = (setAnchorOverride as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      expect(call?.ax).toBe(0)
    })

    it('clamps ay to [0,1] when cursor goes above bounds', () => {
      const setAnchorOverride = vi.fn()
      const deps = makeDeps({ setAnchorOverride })
      deps.anchorRef.current = { uuid: 'n', rectX: 100, rectY: 100, w: 200, h: 200 }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // svgY far above rectY → ay > 1 → clamped to 1 (1 - negative/200)
      const e = makeMouseEvent({ clientX: 200, clientY: 0 })
      act(() => result.current.handleMouseMove(e))

      const call = (setAnchorOverride as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      expect(call?.ay).toBeLessThanOrEqual(1)
      expect(call?.ay).toBeGreaterThanOrEqual(0)
    })
  })

  // ── resize direction calculations ────────────────────────────────────────────

  describe('resize SE direction', () => {
    it('SE: increases both width and height', () => {
      const setResizeOverride = vi.fn()
      const deps = makeDeps({ setResizeOverride })
      deps.resizeRef.current = {
        uuid: 'n', startMouseX: 100, startMouseY: 100,
        startW: 200, startH: 150, dir: 'SE',
        startLocalX: 0, startLocalY: 0,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      const e = makeMouseEvent({ clientX: 150, clientY: 160 })  // dx=50, dy=60
      act(() => result.current.handleMouseMove(e))

      expect(setResizeOverride).toHaveBeenCalledWith(expect.objectContaining({
        uuid: 'n', w: 250, h: 210,
      }))
    })

    it('SE + Shift: maintains aspect ratio (wider drag)', () => {
      const setResizeOverride = vi.fn()
      const deps = makeDeps({ setResizeOverride })
      deps.resizeRef.current = {
        uuid: 'n', startMouseX: 0, startMouseY: 0,
        startW: 200, startH: 100, dir: 'SE',
        startLocalX: 0, startLocalY: 0,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // dx=100 > dy=20 → width-driven → h = newW / ratio = 300 / 2 = 150
      const e = makeMouseEvent({ clientX: 100, clientY: 20, shiftKey: true })
      act(() => result.current.handleMouseMove(e))

      const call = (setResizeOverride as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      expect(call?.w).toBe(300)
      expect(call?.h).toBeCloseTo(150)
    })

    it('NW: shifts position as well as resizing', () => {
      const setResizeOverride = vi.fn()
      const deps = makeDeps({ setResizeOverride })
      deps.resizeRef.current = {
        uuid: 'n', startMouseX: 100, startMouseY: 100,
        startW: 200, startH: 150, dir: 'NW',
        startLocalX: 0, startLocalY: 0,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // mdx=-30, mdy=-20 → newW=230, newH=170, posDx=-(30), posDy=20
      const e = makeMouseEvent({ clientX: 70, clientY: 80 })
      act(() => result.current.handleMouseMove(e))

      const call = (setResizeOverride as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      expect(call?.w).toBeCloseTo(230)
      expect(call?.h).toBeCloseTo(170)
      expect(call?.dx).toBeCloseTo(-30)
      expect(call?.dy).toBeCloseTo(20)
    })
  })

  // ── Ctrl snap ────────────────────────────────────────────────────────────────

  describe('drag Ctrl snap', () => {
    it('snaps position to grid when Ctrl held', () => {
      const setDragOverride = vi.fn()
      const deps = makeDeps({ setDragOverride, snapSize: 10 })
      deps.dragRef.current = {
        uuid: 'n', startMouseX: 0, startMouseY: 0,
        startNodeX: 0, startNodeY: 0,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // dx=13, dy=7 → nx=13, ny=7 → snapped to nearest 10: nx=10, ny=10
      const e = makeMouseEvent({ clientX: 13, clientY: -7, ctrlKey: true })
      act(() => result.current.handleMouseMove(e))

      const call = (setDragOverride as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
      expect(call?.x % 10).toBe(0)
      expect(call?.y % 10).toBe(0)
    })

    it('shift + drag: constrains to dominant axis', () => {
      const setDragOverride = vi.fn()
      const deps = makeDeps({ setDragOverride })
      deps.dragRef.current = {
        uuid: 'n', startMouseX: 0, startMouseY: 0,
        startNodeX: 100, startNodeY: 50,
      }
      const { result } = renderHook(() => useCCSceneMouse(deps))

      // dx=50 > dy=10 → dominant X → ny stays at startNodeY(50)
      const e = makeMouseEvent({ clientX: 50, clientY: -10, shiftKey: true })
      act(() => result.current.handleMouseMove(e))

      const call = (setDragOverride as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
      expect(call?.y).toBe(50)   // constrained
      expect(call?.x).not.toBe(100)  // x changed
    })
  })
})
