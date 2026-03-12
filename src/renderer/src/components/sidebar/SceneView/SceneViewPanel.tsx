import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SceneNode, ViewTransform, DragState, ResizeState, MarqueeState, UndoEntry, ClipboardEntry } from './types'
import { useSceneSync } from './useSceneSync'
import { NodeRenderer } from './NodeRenderer'
import { SceneToolbar } from './SceneToolbar'
import { SceneInspector } from './SceneInspector'
import { getRenderOrder, cocosToSvg, getComponentIcon } from './utils'
import { NodeHierarchyList } from './NodeHierarchyList'

interface SceneViewPanelProps {
  connected: boolean
  wsKey: string
  port?: number
}

const DESIGN_W = 960
const DESIGN_H = 640
const SNAP_GRID = 4

export function SceneViewPanel({ connected, port = 9091 }: SceneViewPanelProps) {
  // ── 씬 데이터 ──────────────────────────────────────────────
  const { nodeMap, rootUuid, loading, refresh, refreshNode, updateNode } = useSceneSync(connected, port)

  // ── 뷰 상태 ────────────────────────────────────────────────
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 1 })
  const [activeTool, setActiveTool] = useState<'select' | 'move'>('select')
  const [gridVisible, setGridVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [showHierarchy, setShowHierarchy] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isPanningActive, setIsPanningActive] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [cursorScenePos, setCursorScenePos] = useState<{ x: number; y: number } | null>(null)
  const [hoverTooltipPos, setHoverTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // ── 선택 / 호버 상태 ───────────────────────────────────────
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set())
  const [hoveredUuid, setHoveredUuid] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([])
  const [clipboard, setClipboard] = useState<ClipboardEntry[]>([])

  // ── 마퀴 선택 상태 ─────────────────────────────────────────
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const marqueeRef = useRef<{ startX: number; startY: number } | null>(null)

  // ── 드래그 상태 ────────────────────────────────────────────
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // ── SVG ref ────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Fit to view ────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFit = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const padding = 32
    const zoomX = (width - padding * 2) / DESIGN_W
    const zoomY = (height - padding * 2) / DESIGN_H
    const zoom = Math.min(zoomX, zoomY, 2)
    const offsetX = (width - DESIGN_W * zoom) / 2
    const offsetY = (height - DESIGN_H * zoom) / 2
    setView({ offsetX, offsetY, zoom })
  }, [])

  // 선택 노드로 카메라 이동 (G키)
  const handleFocusSelected = useCallback(() => {
    if (!containerRef.current) return
    const node = selectedUuid ? nodeMap.get(selectedUuid) : null
    if (!node) { handleFit(); return }
    const { width, height } = containerRef.current.getBoundingClientRect()
    const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)
    const padding = 60
    const targetZoom = Math.min(
      (width - padding * 2) / Math.max(node.width, 40),
      (height - padding * 2) / Math.max(node.height, 40),
      4
    )
    const offsetX = width / 2 - sx * targetZoom
    const offsetY = height / 2 - sy * targetZoom
    setView({ offsetX, offsetY, zoom: targetZoom })
  }, [selectedUuid, nodeMap, handleFit])

  // 최초 마운트 시 Fit
  useEffect(() => {
    if (rootUuid) handleFit()
  }, [rootUuid])

  // ── copy / paste (키보드 useEffect보다 먼저 선언 필요) ──────
  const handleCopy = useCallback(() => {
    const uuids = selectedUuids.size > 0 ? selectedUuids : (selectedUuid ? new Set([selectedUuid]) : new Set<string>())
    const copied: ClipboardEntry[] = []
    uuids.forEach(uuid => {
      const n = nodeMap.get(uuid)
      if (n) copied.push({ uuid: n.uuid, name: n.name, x: n.x ?? 0, y: n.y ?? 0 })
    })
    if (copied.length > 0) setClipboard(copied)
  }, [selectedUuids, selectedUuid, nodeMap])

  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return
    const newNodes: SceneNode[] = []
    clipboard.forEach(entry => {
      const orig = nodeMap.get(entry.uuid)
      if (orig) {
        newNodes.push({
          ...orig,
          uuid: entry.uuid + '-copy-' + Date.now(),
          name: entry.name + '_Copy',
          x: (entry.x ?? 0) + 20,
          y: (entry.y ?? 0) + 20,
        })
      }
    })
    if (newNodes.length > 0) {
      newNodes.forEach(n => updateNode(n.uuid, n))
    }
  }, [clipboard, nodeMap, updateNode])

  // ── 복제 (Ctrl+D): clipboard 변경 없이 직접 노드 복제 ─────
  const handleDuplicate = useCallback(() => {
    const uuids = selectedUuids.size > 0 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
    uuids.forEach(uuid => {
      const orig = nodeMap.get(uuid)
      if (!orig) return
      updateNode(orig.uuid + '-dup-' + Date.now(), {
        ...orig,
        uuid: orig.uuid + '-dup-' + Date.now(),
        name: orig.name + '_Copy',
        x: (orig.x ?? 0) + 20,
        y: (orig.y ?? 0) + 20,
      })
    })
  }, [selectedUuids, selectedUuid, nodeMap, updateNode])

  // ── 단축키 ────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'v' || e.key === 'V') setActiveTool('select')
      if (e.key === 'w' || e.key === 'W') setActiveTool('move')
      if (e.key === 'f' || e.key === 'F') handleFit()
      if (e.key === 'g' || e.key === 'G') handleFocusSelected()
      if (e.key === '?') setShowShortcuts(v => !v)
      if (e.key === 'Escape') {
        setSelectedUuid(null)
        setSelectedUuids(new Set())
        setMarquee(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        setUndoStack(prev => {
          if (prev.length === 0) return prev
          const entry = prev[prev.length - 1]
          setRedoStack(r => [...r, entry])
          updateNode(entry.uuid, { x: entry.prevX, y: entry.prevY })
          return prev.slice(0, -1)
        })
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        setRedoStack(prev => {
          if (prev.length === 0) return prev
          const entry = prev[prev.length - 1]
          setUndoStack(u => [...u, entry])
          updateNode(entry.uuid, { x: entry.nextX, y: entry.nextY })
          return prev.slice(0, -1)
        })
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        handleCopy()
        e.preventDefault()
      }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        handlePaste()
        e.preventDefault()
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        handleDuplicate()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleFit, handleFocusSelected, updateNode, handleCopy, handlePaste, handleDuplicate])

  // ── Space 키 임시 패닝 모드 ────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.code === 'Space' && !spaceDown) { e.preventDefault(); setSpaceDown(true) }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [spaceDown])

  // ── Ctrl+A 전체 선택 ──────────────────────────────────────
  useEffect(() => {
    const handleSelectAll = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const all = new Set(nodeMap.keys())
        setSelectedUuids(all)
        setSelectedUuid(rootUuid || null)
      }
    }
    window.addEventListener('keydown', handleSelectAll)
    return () => window.removeEventListener('keydown', handleSelectAll)
  }, [nodeMap, rootUuid])

  // ── 방향키 nudge: 선택 노드 1px / Shift+10px 이동 ─────────
  useEffect(() => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    }
    const handleNudge = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (!selectedUuid || !(e.key in arrows)) return
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const node = nodeMap.get(selectedUuid)
      if (!node) return
      const [dx, dy] = arrows[e.key]
      updateNode(selectedUuid, { x: node.x + dx * step, y: node.y + dy * step })
    }
    window.addEventListener('keydown', handleNudge)
    return () => window.removeEventListener('keydown', handleNudge)
  }, [selectedUuid, nodeMap, updateNode])

  // ── CC 이벤트: 외부 선택 동기화 + 노드 최신화 ───────────────
  useEffect(() => {
    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'node:select' && event.uuids?.[0]) {
        const uuid = event.uuids[0]
        setSelectedUuid(uuid)
        // CC 에디터에서 선택 시 컴포넌트 props 최신화
        refreshNode(uuid)
      }
      if (event.type === 'node:deselect') {
        setSelectedUuid(null)
      }
    })
    return () => unsub?.()
  }, [refreshNode])

  // ── 선택 노드 변경 시 자동 갱신 ────────────────────────────
  useEffect(() => {
    if (!selectedUuid) return
    const t = setTimeout(() => refreshNode(selectedUuid), 200)
    return () => clearTimeout(t)
  }, [selectedUuid, refreshNode])

  // ── SVG 좌표 변환 헬퍼 ────────────────────────────────────
  const getSvgCoords = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top),
    }
  }, [])

  // 씬 좌표 변환 (SVG px → Cocos 좌표)
  const svgToScene = useCallback((svgX: number, svgY: number): { cx: number; cy: number } => {
    const sceneX = (svgX - view.offsetX) / view.zoom
    const sceneY = (svgY - view.offsetY) / view.zoom
    return {
      cx: sceneX - DESIGN_W / 2,
      cy: -(sceneY - DESIGN_H / 2),
    }
  }, [view])

  // ── 마우스 이벤트 ─────────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    // 빈 영역 클릭 → 패닝 (middle btn 또는 space + left)
    if (e.button === 1 || (e.button === 0 && (activeTool === 'move' || spaceDown))) {
      isPanning.current = true
      setIsPanningActive(true)
      panStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: view.offsetX,
        oy: view.offsetY,
      }
      e.preventDefault()
      return
    }
    // 빈 배경 클릭 → 선택 해제 + 마퀴 시작
    if (e.button === 0 && activeTool === 'select') {
      if (!e.shiftKey) {
        setSelectedUuid(null)
        setSelectedUuids(new Set())
      }
      const svgCoords = getSvgCoords(e)
      marqueeRef.current = { startX: svgCoords.x, startY: svgCoords.y }
      setMarquee({ startX: svgCoords.x, startY: svgCoords.y, endX: svgCoords.x, endY: svgCoords.y, active: true })
    } else if (e.button === 0) {
      setSelectedUuid(null)
      setSelectedUuids(new Set())
    }
  }, [activeTool, view, getSvgCoords])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    if (e.button !== 0) return

    if (e.shiftKey) {
      // Shift 클릭: 멀티 선택 토글
      setSelectedUuids(prev => {
        const next = new Set(prev)
        if (next.has(uuid)) {
          next.delete(uuid)
        } else {
          next.add(uuid)
        }
        return next
      })
      setSelectedUuid(uuid)
      return
    }

    // 일반 클릭: 단일 선택 (멀티셀렉트 상태에서 선택된 노드를 클릭하면 그룹 드래그)
    const isGroupDrag = selectedUuids.size > 1 && selectedUuids.has(uuid)

    if (!isGroupDrag) {
      setSelectedUuid(uuid)
      setSelectedUuids(new Set())
    }

    const node = nodeMap.get(uuid)
    if (!node) return

    const svgCoords = getSvgCoords(e)
    const groupOffsets: Record<string, { startX: number; startY: number }> | undefined = isGroupDrag
      ? Object.fromEntries(
          [...selectedUuids].map(uid => {
            const n = nodeMap.get(uid)
            return [uid, { startX: n?.x ?? 0, startY: n?.y ?? 0 }]
          })
        )
      : undefined

    dragRef.current = {
      uuid,
      startSvgX: svgCoords.x,
      startSvgY: svgCoords.y,
      startNodeX: node.x,
      startNodeY: node.y,
      groupOffsets,
    }
    setIsDragging(true)
  }, [nodeMap, getSvgCoords, selectedUuids])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, uuid: string, handle: 'nw' | 'ne' | 'se' | 'sw') => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return
    const node = nodeMap.get(uuid)
    if (!node) return
    const svgCoords = getSvgCoords(e)
    resizeRef.current = {
      uuid,
      handle,
      startSvgX: svgCoords.x,
      startSvgY: svgCoords.y,
      startWidth: node.width,
      startHeight: node.height,
      startNodeX: node.x,
      startNodeY: node.y,
    }
    setIsResizing(true)
  }, [nodeMap, getSvgCoords])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 커서 씬 좌표 업데이트
    const svgPos = getSvgCoords(e)
    const { cx, cy } = svgToScene(svgPos.x, svgPos.y)
    setCursorScenePos({ x: Math.round(cx), y: Math.round(cy) })

    // 호버 툴팁 위치
    setHoverTooltipPos({ x: svgPos.x + 12, y: svgPos.y - 24 })

    // 마퀴 업데이트
    if (marqueeRef.current) {
      const svgCoords = getSvgCoords(e)
      setMarquee({
        startX: marqueeRef.current.startX,
        startY: marqueeRef.current.startY,
        endX: svgCoords.x,
        endY: svgCoords.y,
        active: true,
      })
      return
    }

    // 리사이즈
    if (resizeRef.current) {
      const rs = resizeRef.current
      const svgCoords = getSvgCoords(e)
      const dsvgX = svgCoords.x - rs.startSvgX
      const dsvgY = svgCoords.y - rs.startSvgY
      const dsceneX = dsvgX / view.zoom
      const dsceneY = -dsvgY / view.zoom  // Y 반전

      let newW = rs.startWidth
      let newH = rs.startHeight
      // SE: +dsceneX, -dsceneY (SVG Y-down → height decrease)
      if (rs.handle === 'se') { newW = rs.startWidth + dsceneX; newH = rs.startHeight - dsceneY }
      else if (rs.handle === 'ne') { newW = rs.startWidth + dsceneX; newH = rs.startHeight + dsceneY }
      else if (rs.handle === 'sw') { newW = rs.startWidth - dsceneX; newH = rs.startHeight - dsceneY }
      else if (rs.handle === 'nw') { newW = rs.startWidth - dsceneX; newH = rs.startHeight + dsceneY }

      newW = Math.max(4, newW)
      newH = Math.max(4, newH)
      const newX = rs.startNodeX + dsceneX / 2
      const newY = rs.startNodeY + dsceneY / 2

      updateNode(rs.uuid, { width: newW, height: newH, x: newX, y: newY })
      return
    }

    // 패닝
    if (isPanning.current && panStart.current) {
      const ps = panStart.current  // setView 업데이터 호출 전에 캡처
      const dx = e.clientX - ps.mx
      const dy = e.clientY - ps.my
      setView(prev => ({
        ...prev,
        offsetX: ps.ox + dx,
        offsetY: ps.oy + dy,
      }))
      return
    }

    // 노드 드래그
    if (dragRef.current) {
      const drag = dragRef.current
      const svgCoords = getSvgCoords(e)
      const dsvgX = svgCoords.x - drag.startSvgX
      const dsvgY = svgCoords.y - drag.startSvgY

      // SVG 델타 → 씬 좌표 델타
      const dSceneX = dsvgX / view.zoom
      const dSceneY = -dsvgY / view.zoom  // Y축 반전

      let newX = drag.startNodeX + dSceneX
      let newY = drag.startNodeY + dSceneY

      // 스냅
      if (snapEnabled) {
        newX = Math.round(newX / SNAP_GRID) * SNAP_GRID
        newY = Math.round(newY / SNAP_GRID) * SNAP_GRID
      }

      if (drag.groupOffsets) {
        // 그룹 드래그: 모든 선택 노드를 같은 델타만큼 이동
        for (const [uid, { startX, startY }] of Object.entries(drag.groupOffsets)) {
          let nx = startX + dSceneX
          let ny = startY + dSceneY
          if (snapEnabled) {
            nx = Math.round(nx / SNAP_GRID) * SNAP_GRID
            ny = Math.round(ny / SNAP_GRID) * SNAP_GRID
          }
          updateNode(uid, { x: nx, y: ny })
        }
      } else {
        // 낙관적 업데이트 (즉시 반영)
        updateNode(drag.uuid, { x: newX, y: newY })
      }
    }
  }, [view.zoom, snapEnabled, getSvgCoords, svgToScene, updateNode])

  const handleMouseUp = useCallback(async () => {
    // 마퀴 종료 → 히트 테스트
    if (marqueeRef.current && marquee) {
      marqueeRef.current = null
      const mx1 = Math.min(marquee.startX, marquee.endX)
      const my1 = Math.min(marquee.startY, marquee.endY)
      const mx2 = Math.max(marquee.startX, marquee.endX)
      const my2 = Math.max(marquee.startY, marquee.endY)

      // 마퀴가 충분히 크면 노드 히트 테스트
      if (mx2 - mx1 > 4 || my2 - my1 > 4) {
        const hit = new Set<string>()
        nodeMap.forEach((node) => {
          const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)
          const pw = node.width * Math.abs(node.scaleX)
          const ph = node.height * Math.abs(node.scaleY)
          const rx = sx - pw * node.anchorX
          const ry = sy - ph * (1 - node.anchorY)
          // scene transform 적용 → SVG 화면 좌표
          const nx1 = rx * view.zoom + view.offsetX
          const ny1 = ry * view.zoom + view.offsetY
          const nx2 = (rx + pw) * view.zoom + view.offsetX
          const ny2 = (ry + ph) * view.zoom + view.offsetY
          // 교차 판정
          if (nx1 < mx2 && nx2 > mx1 && ny1 < my2 && ny2 > my1) {
            hit.add(node.uuid)
          }
        })
        if (hit.size > 0) {
          setSelectedUuids(hit)
          const first = hit.values().next().value
          setSelectedUuid(first ?? null)
        }
      }

      setMarquee(null)
      return
    }

    // 패닝 종료
    if (isPanning.current) {
      isPanning.current = false
      setIsPanningActive(false)
      panStart.current = null
      return
    }

    // 드래그 종료 → IPC 전송
    if (dragRef.current) {
      const drag = dragRef.current

      if (drag.groupOffsets) {
        // 그룹 드래그 완료: 모든 선택 노드 저장
        const entries: UndoEntry[] = []
        for (const [uid, { startX, startY }] of Object.entries(drag.groupOffsets)) {
          const n = nodeMap.get(uid)
          if (!n) continue
          if (n.x !== startX || n.y !== startY) {
            entries.push({ uuid: uid, prevX: startX, prevY: startY, nextX: n.x, nextY: n.y })
            try {
              await window.api.ccSetProperty?.(port, uid, 'x', n.x)
              await window.api.ccSetProperty?.(port, uid, 'y', n.y)
            } catch (e) {
              console.error('[SceneView] setProperty failed:', e)
            }
          }
        }
        if (entries.length > 0) {
          setUndoStack(prev => [...prev.slice(-(50 - entries.length)), ...entries])
          setRedoStack([])
        }
      } else {
        // 단일 노드 처리
        const node = nodeMap.get(drag.uuid)
        if (node) {
          // 실제로 이동이 있었을 때만 undo 항목 추가
          if (node.x !== drag.startNodeX || node.y !== drag.startNodeY) {
            setUndoStack(prev => [...prev.slice(-49), {
              uuid: drag.uuid,
              prevX: drag.startNodeX,
              prevY: drag.startNodeY,
              nextX: node.x,
              nextY: node.y,
            }])
            setRedoStack([])
          }
          try {
            await window.api.ccSetProperty?.(port, drag.uuid, 'x', node.x)
            await window.api.ccSetProperty?.(port, drag.uuid, 'y', node.y)
          } catch (e) {
            console.error('[SceneView] setProperty failed:', e)
          }
        }
      }
      dragRef.current = null
      setIsDragging(false)
    }

    // 리사이즈 종료 → IPC 전송
    if (resizeRef.current) {
      const rs = resizeRef.current
      const node = nodeMap.get(rs.uuid)
      if (node) {
        try {
          await window.api.ccSetProperty?.(port, rs.uuid, 'width', node.width)
          await window.api.ccSetProperty?.(port, rs.uuid, 'height', node.height)
          await window.api.ccSetProperty?.(port, rs.uuid, 'x', node.x)
          await window.api.ccSetProperty?.(port, rs.uuid, 'y', node.y)
        } catch (e) {
          console.error('[SceneView] resize failed:', e)
        }
      }
      resizeRef.current = null
      setIsResizing(false)
    }
  }, [nodeMap, marquee, view, port])

  // ── 줌 (wheel) — passive: false 필요 ───────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const svgCoords = getSvgCoords(e)
    setView(prev => {
      const newZoom = Math.min(8, Math.max(0.1, prev.zoom * factor))
      const newOffsetX = svgCoords.x - (svgCoords.x - prev.offsetX) * (newZoom / prev.zoom)
      const newOffsetY = svgCoords.y - (svgCoords.y - prev.offsetY) * (newZoom / prev.zoom)
      return { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
    })
  }, [getSvgCoords])

  // 비패시브 wheel 이벤트 등록 (passive: false 없이는 preventDefault 무시됨)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Inspector 업데이트 ─────────────────────────────────────
  const handleInspectorUpdate = useCallback(async (uuid: string, prop: string, value: number | boolean) => {
    updateNode(uuid, { [prop]: value } as Partial<SceneNode>)
    try {
      await window.api.ccSetProperty?.(port, uuid, prop, value)
    } catch (e) {
      console.error('[SceneView] inspector update failed:', e)
    }
  }, [updateNode, port])

  const handleHierarchyToggleActive = useCallback(async (uuid: string, active: boolean) => {
    updateNode(uuid, { active })
    try {
      await window.api.ccSetProperty?.(port, uuid, 'active', active)
    } catch (e) {
      console.error('[SceneView] toggleActive failed:', e)
    }
  }, [updateNode, port])

  const handleRename = useCallback(async (uuid: string, name: string) => {
    updateNode(uuid, { name })
    try {
      await window.api.ccSetProperty?.(port, uuid, 'name', name)
    } catch (e) {
      console.error('[SceneView] rename failed:', e)
    }
  }, [updateNode, port])

  // ── 렌더 순서 ────────────────────────────────────────────
  const renderOrder = useMemo(() => {
    if (!rootUuid) return []
    return getRenderOrder(rootUuid, nodeMap)
  }, [rootUuid, nodeMap])

  const selectedNode = selectedUuid ? nodeMap.get(selectedUuid) ?? null : null
  const selectionCount = selectedUuids.size > 1 ? selectedUuids.size : undefined
  const canCopy = selectedUuids.size > 0 || selectedUuid !== null
  const canPaste = clipboard.length > 0
  const canZOrder = selectedUuids.size === 1
  const canAlign = selectedUuids.size >= 2

  const handleCreateNode = useCallback(async () => {
    const name = 'NewNode'
    try {
      await window.api.ccCreateNode?.(port, name, selectedUuid ?? undefined)
      refresh()
    } catch (e) {
      console.error('[SceneView] createNode failed:', e)
    }
  }, [port, selectedUuid, refresh])

  const handleDeleteNode = useCallback(async () => {
    if (!selectedUuid) return
    try {
      await window.api.ccDeleteNode?.(port, selectedUuid)
      setSelectedUuid(null)
      refresh()
    } catch (e) {
      console.error('[SceneView] deleteNode failed:', e)
    }
  }, [port, selectedUuid, refresh])

  const handleZOrder = useCallback(async (direction: 'front' | 'back' | 'up' | 'down') => {
    if (selectedUuids.size !== 1) return
    const uuid = [...selectedUuids][0]
    try {
      await window.api.ccSetZOrder?.(port, uuid, direction)
      refresh()
    } catch (e) {
      console.error('[SceneView] zorder failed:', e)
    }
  }, [selectedUuids, port, refresh])

  const handleAlign = useCallback(async (direction: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return

    const positions: Record<string, { x: number; y: number }> = {}

    if (direction === 'left') {
      const minLeft = Math.min(...nodes.map(n => n.x - n.width * (n.anchorX ?? 0.5)))
      for (const n of nodes) positions[n.uuid] = { x: minLeft + n.width * (n.anchorX ?? 0.5), y: n.y }
    } else if (direction === 'right') {
      const maxRight = Math.max(...nodes.map(n => n.x + n.width * (1 - (n.anchorX ?? 0.5))))
      for (const n of nodes) positions[n.uuid] = { x: maxRight - n.width * (1 - (n.anchorX ?? 0.5)), y: n.y }
    } else if (direction === 'centerH') {
      const minLeft = Math.min(...nodes.map(n => n.x - n.width * (n.anchorX ?? 0.5)))
      const maxRight = Math.max(...nodes.map(n => n.x + n.width * (1 - (n.anchorX ?? 0.5))))
      const bboxCx = (minLeft + maxRight) / 2
      for (const n of nodes) positions[n.uuid] = { x: bboxCx, y: n.y }
    } else if (direction === 'top') {
      const maxTop = Math.max(...nodes.map(n => n.y + n.height * (1 - (n.anchorY ?? 0.5))))
      for (const n of nodes) positions[n.uuid] = { x: n.x, y: maxTop - n.height * (1 - (n.anchorY ?? 0.5)) }
    } else if (direction === 'bottom') {
      const minBottom = Math.min(...nodes.map(n => n.y - n.height * (n.anchorY ?? 0.5)))
      for (const n of nodes) positions[n.uuid] = { x: n.x, y: minBottom + n.height * (n.anchorY ?? 0.5) }
    } else if (direction === 'centerV') {
      const maxTop = Math.max(...nodes.map(n => n.y + n.height * (1 - (n.anchorY ?? 0.5))))
      const minBottom = Math.min(...nodes.map(n => n.y - n.height * (n.anchorY ?? 0.5)))
      const bboxCy = (minBottom + maxTop) / 2
      for (const n of nodes) positions[n.uuid] = { x: n.x, y: bboxCy }
    }

    for (const [uid, { x, y }] of Object.entries(positions)) {
      updateNode(uid, { x, y })
      try {
        await window.api.ccSetProperty?.(port, uid, 'x', x)
        await window.api.ccSetProperty?.(port, uid, 'y', y)
      } catch (e) {
        console.error('[SceneView] align failed:', e)
      }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  // ── 균등 분포 배치 ────────────────────────────────────────
  const handleDistribute = useCallback(async (axis: 'H' | 'V') => {
    if (selectedUuids.size < 3) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 3) return

    if (axis === 'H') {
      const sorted = [...nodes].sort((a, b) => a.x - b.x)
      const minX = sorted[0].x
      const maxX = sorted[sorted.length - 1].x
      const step = (maxX - minX) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        const n = sorted[i]
        const newX = minX + step * i
        updateNode(n.uuid, { x: newX })
        try { await window.api.ccSetProperty?.(port, n.uuid, 'x', newX) } catch (_) {}
      }
    } else {
      const sorted = [...nodes].sort((a, b) => a.y - b.y)
      const minY = sorted[0].y
      const maxY = sorted[sorted.length - 1].y
      const step = (maxY - minY) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        const n = sorted[i]
        const newY = minY + step * i
        updateNode(n.uuid, { y: newY })
        try { await window.api.ccSetProperty?.(port, n.uuid, 'y', newY) } catch (_) {}
      }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  // ── 멀티셀렉트 그룹 bbox 계산 ──────────────────────────────
  const groupBbox = useMemo(() => {
    if (selectedUuids.size < 2) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const uid of selectedUuids) {
      const n = nodeMap.get(uid)
      if (!n) continue
      const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
      const hw = (n.size?.width ?? 50) / 2
      const hh = (n.size?.height ?? 50) / 2
      minX = Math.min(minX, sx - hw)
      minY = Math.min(minY, sy - hh)
      maxX = Math.max(maxX, sx + hw)
      maxY = Math.max(maxY, sy + hh)
    }
    if (!isFinite(minX)) return null
    const PAD = 8
    return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 }
  }, [selectedUuids, nodeMap])

  // ── SVG viewBox ─────────────────────────────────────────
  // 고정 viewBox를 사용하지 않고 offsetX/Y + zoom을 transform으로 처리
  const sceneTransform = `translate(${view.offsetX} ${view.offsetY}) scale(${view.zoom})`

  // ── 그리드 패턴 크기 (줌에 따라 조정) ─────────────────────
  const gridStep = 50  // 씬 좌표 50px 간격

  if (!connected) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        연결되지 않음
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      {/* 툴바 */}
      <SceneToolbar
        activeTool={activeTool}
        zoom={view.zoom}
        gridVisible={gridVisible}
        snapEnabled={snapEnabled}
        selectionCount={selectionCount}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        canCopy={canCopy}
        canPaste={canPaste}
        canZOrder={canZOrder}
        canAlign={canAlign}
        selectedUuid={selectedUuid}
        onCreateNode={handleCreateNode}
        onDeleteNode={handleDeleteNode}
        onToolChange={setActiveTool}
        onZoomChange={zoom => setView(prev => ({ ...prev, zoom }))}
        onGridToggle={() => setGridVisible(v => !v)}
        onSnapToggle={() => setSnapEnabled(v => !v)}
        onFit={handleFit}
        onRefresh={refresh}
        showHierarchy={showHierarchy}
        onHierarchyToggle={() => setShowHierarchy(v => !v)}
        showLabels={showLabels}
        onLabelsToggle={() => setShowLabels(v => !v)}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onZOrderFront={() => handleZOrder('front')}
        onZOrderBack={() => handleZOrder('back')}
        onZOrderUp={() => handleZOrder('up')}
        onZOrderDown={() => handleZOrder('down')}
        onAlignLeft={() => handleAlign('left')}
        onAlignCenterH={() => handleAlign('centerH')}
        onAlignRight={() => handleAlign('right')}
        onAlignTop={() => handleAlign('top')}
        onAlignCenterV={() => handleAlign('centerV')}
        onAlignBottom={() => handleAlign('bottom')}
        onDistributeH={() => handleDistribute('H')}
        onDistributeV={() => handleDistribute('V')}
        onUndo={() => {
          setUndoStack(prev => {
            if (prev.length === 0) return prev
            const entry = prev[prev.length - 1]
            setRedoStack(r => [...r, entry])
            updateNode(entry.uuid, { x: entry.prevX, y: entry.prevY })
            return prev.slice(0, -1)
          })
        }}
        onRedo={() => {
          setRedoStack(prev => {
            if (prev.length === 0) return prev
            const entry = prev[prev.length - 1]
            setUndoStack(u => [...u, entry])
            updateNode(entry.uuid, { x: entry.nextX, y: entry.nextY })
            return prev.slice(0, -1)
          })
        }}
      />

      {/* 노드 계층 트리 패널 */}
      {showHierarchy && rootUuid && (
        <NodeHierarchyList
          rootUuid={rootUuid}
          nodeMap={nodeMap}
          selectedUuids={selectedUuids}
          focusUuid={selectedUuid}
          onToggleActive={handleHierarchyToggleActive}
          onSelect={(uuid, multi) => {
            if (multi) {
              setSelectedUuids(prev => {
                const next = new Set(prev)
                if (next.has(uuid)) next.delete(uuid)
                else next.add(uuid)
                return next
              })
            } else {
              setSelectedUuid(uuid)
              setSelectedUuids(new Set([uuid]))
            }
          }}
        />
      )}

      {/* SVG 뷰포트 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isPanningActive ? 'grabbing' : (activeTool === 'move' || spaceDown) ? 'grab' : 'default',
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block', userSelect: 'none' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setCursorScenePos(null); setHoverTooltipPos(null); handleMouseUp() }}
        >
          <defs>
            {/* 체크패턴 배경 */}
            <pattern
              id="checker"
              x="0"
              y="0"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#242424" />
              <rect x="8" y="0" width="8" height="8" fill="#1e1e1e" />
              <rect x="0" y="8" width="8" height="8" fill="#1e1e1e" />
              <rect x="8" y="8" width="8" height="8" fill="#242424" />
            </pattern>

            {/* 그리드 패턴 */}
            {gridVisible && (
              <pattern
                id="grid"
                x={view.offsetX % (gridStep * view.zoom)}
                y={view.offsetY % (gridStep * view.zoom)}
                width={gridStep * view.zoom}
                height={gridStep * view.zoom}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridStep * view.zoom} 0 L 0 0 0 ${gridStep * view.zoom}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
              </pattern>
            )}
          </defs>

          {/* 배경 */}
          <rect width="100%" height="100%" fill="url(#checker)" />
          {gridVisible && <rect width="100%" height="100%" fill="url(#grid)" />}

          {/* 씬 그룹 */}
          <g transform={sceneTransform}>
            {/* 씬 경계 */}
            <rect
              x={0}
              y={0}
              width={DESIGN_W}
              height={DESIGN_H}
              fill="rgba(0,0,0,0.6)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              rx={1}
            />

            {/* 씬 해상도 레이블 */}
            <text
              x={DESIGN_W}
              y={-5}
              textAnchor="end"
              fontSize={10 / view.zoom}
              fill="rgba(255,255,255,0.35)"
              style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace' }}
            >
              {DESIGN_W} × {DESIGN_H}
            </text>

            {/* 원점 십자 + (0,0) 레이블 */}
            <line
              x1={DESIGN_W / 2 - 10} y1={DESIGN_H / 2}
              x2={DESIGN_W / 2 + 10} y2={DESIGN_H / 2}
              stroke="rgba(255,255,255,0.2)" strokeWidth={1}
            />
            <line
              x1={DESIGN_W / 2} y1={DESIGN_H / 2 - 10}
              x2={DESIGN_W / 2} y2={DESIGN_H / 2 + 10}
              stroke="rgba(255,255,255,0.2)" strokeWidth={1}
            />
            <text
              x={DESIGN_W / 2 + 5 / view.zoom}
              y={DESIGN_H / 2 - 5 / view.zoom}
              fontSize={8 / view.zoom}
              fill="rgba(255,255,255,0.2)"
              style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace' }}
            >
              (0,0)
            </text>

            {/* 노드 렌더링 */}
            {renderOrder.map(uuid => {
              const node = nodeMap.get(uuid)
              if (!node) return null
              return (
                <NodeRenderer
                  key={uuid}
                  node={node}
                  nodeMap={nodeMap}
                  view={view}
                  selected={selectedUuid === uuid}
                  hovered={hoveredUuid === uuid}
                  multiSelected={selectedUuids.has(uuid)}
                  showLabel={showLabels}
                  onMouseDown={handleNodeMouseDown}
                  onMouseEnter={setHoveredUuid}
                  onMouseLeave={() => setHoveredUuid(null)}
                />
              )
            })}

            {/* 선택 노드 리사이즈 핸들 (단일 선택 시) */}
            {selectedNode && selectedUuids.size <= 1 && (() => {
              const n = selectedNode
              const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              const hw = n.width / 2
              const hh = n.height / 2
              const hs = 5 / view.zoom
              const handles: Array<{ id: 'nw' | 'ne' | 'se' | 'sw'; cx: number; cy: number; cursor: string }> = [
                { id: 'nw', cx: sx - hw, cy: sy - hh, cursor: 'nw-resize' },
                { id: 'ne', cx: sx + hw, cy: sy - hh, cursor: 'ne-resize' },
                { id: 'se', cx: sx + hw, cy: sy + hh, cursor: 'se-resize' },
                { id: 'sw', cx: sx - hw, cy: sy + hh, cursor: 'sw-resize' },
              ]
              return handles.map(h => (
                <rect
                  key={h.id}
                  x={h.cx - hs / 2} y={h.cy - hs / 2}
                  width={hs} height={hs}
                  fill="white" stroke="#4096ff" strokeWidth={1 / view.zoom}
                  style={{ cursor: h.cursor, pointerEvents: 'all' }}
                  onMouseDown={e => handleResizeMouseDown(e, n.uuid, h.id)}
                />
              ))
            })()}

            {/* 선택 노드 size 레이블 */}
            {selectedNode && selectedUuids.size <= 1 && !isDragging && !isResizing && (() => {
              const n = selectedNode
              const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              const hw = n.width / 2
              const hh = n.height / 2
              return (
                <text
                  x={sx + hw + 4 / view.zoom}
                  y={sy - hh - 3 / view.zoom}
                  fontSize={9 / view.zoom}
                  fill="rgba(96,165,250,0.85)"
                  style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace' }}
                >
                  {Math.round(n.width)}×{Math.round(n.height)}
                </text>
              )
            })()}

            {/* 선택 노드 anchor point 마커 */}
            {selectedNode && selectedUuids.size <= 1 && (() => {
              const n = selectedNode
              const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              const as = 4 / view.zoom
              return (
                <polygon
                  points={`${sx},${sy - as} ${sx + as},${sy} ${sx},${sy + as} ${sx - as},${sy}`}
                  fill="rgba(250,200,50,0.9)"
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.5 / view.zoom}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })()}

            {/* 멀티셀렉트 그룹 bbox */}
            {groupBbox && (
              <rect
                x={groupBbox.x}
                y={groupBbox.y}
                width={groupBbox.w}
                height={groupBbox.h}
                fill="rgba(250, 204, 21, 0.05)"
                stroke="#fbbf24"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${4 / view.zoom} ${2 / view.zoom}`}
                rx={3 / view.zoom}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>

          {/* 마퀴 선택 rect */}
          {marquee && (
            <rect
              x={Math.min(marquee.startX, marquee.endX)}
              y={Math.min(marquee.startY, marquee.endY)}
              width={Math.abs(marquee.endX - marquee.startX)}
              height={Math.abs(marquee.endY - marquee.startY)}
              fill="rgba(96, 165, 250, 0.1)"
              stroke="#60a5fa"
              strokeWidth={1}
              strokeDasharray="4 2"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* 로딩 오버레이 */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
              color: 'var(--text-muted)',
              fontSize: 11,
              pointerEvents: 'none',
            }}
          >
            씬 로딩 중...
          </div>
        )}

        {/* 줌 레벨 표시 (클릭: 1:1, 더블클릭: fit) */}
        <div
          title={`${Math.round(view.zoom * 100)}% — 클릭: 1:1 (100%) / 더블클릭: Fit`}
          onClick={() => {
            if (!containerRef.current) return
            const { width, height } = containerRef.current.getBoundingClientRect()
            setView({ zoom: 1, offsetX: (width - DESIGN_W) / 2, offsetY: (height - DESIGN_H) / 2 })
          }}
          onDoubleClick={e => { e.stopPropagation(); handleFit() }}
          style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            fontSize: 9,
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.5)',
            padding: '1px 5px',
            borderRadius: 3,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {Math.round(view.zoom * 100)}%
        </div>

        {/* 마우스 씬 좌표 표시 */}
        {cursorScenePos && !isDragging && !isResizing && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 44,
              fontSize: 9,
              color: 'var(--text-muted)',
              background: 'rgba(0,0,0,0.5)',
              padding: '1px 5px',
              borderRadius: 3,
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {cursorScenePos.x}, {cursorScenePos.y}
          </div>
        )}

        {/* 노드 호버 툴팁 */}
        {hoveredUuid && hoverTooltipPos && !isDragging && !isResizing && (() => {
          const hn = nodeMap.get(hoveredUuid)
          if (!hn) return null
          const icon = getComponentIcon(hn.components)
          return (
            <div
              style={{
                position: 'absolute',
                left: hoverTooltipPos.x,
                top: hoverTooltipPos.y,
                background: 'rgba(0,0,0,0.8)',
                color: '#e5e5e5',
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 3,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 10,
              }}
            >
              {icon && <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 4 }}>{icon}</span>}
              {hn.name}
            </div>
          )
        })()}

        {/* 드래그/리사이즈 좌표 오버레이 */}
        {(isDragging || isResizing) && selectedNode && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 8,
              fontSize: 9,
              color: '#60a5fa',
              background: 'rgba(0,0,0,0.65)',
              padding: '2px 6px',
              borderRadius: 3,
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isDragging
              ? `X: ${Math.round(selectedNode.x)}  Y: ${Math.round(selectedNode.y)}`
              : `W: ${Math.round(selectedNode.width)}  H: ${Math.round(selectedNode.height)}`}
          </div>
        )}
      </div>

      {/* 단축키 도움말 오버레이 */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '12px 16px',
              fontSize: 10,
              color: 'var(--text-primary)',
              minWidth: 200,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 11 }}>단축키 도움말</div>
            {[
              ['V', '선택 도구'],
              ['W', '이동 도구'],
              ['F', '화면 맞추기'],
              ['G', '선택 노드 포커스'],
              ['Ctrl+Z', '실행 취소'],
              ['Ctrl+Y', '다시 실행'],
              ['Ctrl+A', '전체 선택'],
              ['Ctrl+C', '복사'],
              ['Ctrl+V', '붙여넣기'],
              ['Ctrl+D', '복제 (클립보드 유지)'],
              ['Escape', '선택 해제'],
              ['↑↓←→', '선택 노드 1px 이동'],
              ['Shift+↑↓←→', '선택 노드 10px 이동'],
              ['?', '단축키 도움말 토글'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent)', minWidth: 60, flexShrink: 0 }}>{key}</span>
                <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>클릭하거나 ? 키로 닫기</div>
          </div>
        </div>
      )}

      {/* Inspector */}
      <SceneInspector
        node={selectedNode}
        onUpdate={handleInspectorUpdate}
        onClose={() => { setSelectedUuid(null); setSelectedUuids(new Set()) }}
        selectionCount={selectionCount}
        onRename={handleRename}
        nodeMap={nodeMap}
        onSelectParent={uuid => { setSelectedUuid(uuid); setSelectedUuids(new Set([uuid])) }}
      />
    </div>
  )
}

export default SceneViewPanel
