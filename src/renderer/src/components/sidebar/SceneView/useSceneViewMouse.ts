import React, { useCallback, useRef, useEffect } from 'react'
import type { SceneNode, ViewTransform, DragState, ResizeState, MarqueeState, UndoEntry } from './types'
import { cocosToSvg } from './utils'
import type { EditHistoryEntry } from './sceneViewConstants'

interface MouseDeps {
  nodeMap: Map<string, SceneNode>
  selectedUuid: string | null
  selectedUuids: Set<string>
  view: ViewTransform
  viewRef: React.MutableRefObject<ViewTransform>
  activeTool: 'select' | 'move'
  spaceDown: boolean
  snapEnabled: boolean
  snapGrid: number
  measureMode: boolean
  blockInactiveClick: boolean
  port: number
  DESIGN_W: number
  DESIGN_H: number

  svgRef: React.RefObject<SVGSVGElement>
  dragRef: React.MutableRefObject<DragState | null>
  resizeRef: React.MutableRefObject<ResizeState | null>
  rotateRef: React.MutableRefObject<{ uuid: string; anchorSx: number; anchorSy: number; startRotation: number } | null>
  isPanning: React.MutableRefObject<boolean>
  panStart: React.MutableRefObject<{ mx: number; my: number; ox: number; oy: number } | null>
  measureStartRef: React.MutableRefObject<{ x: number; y: number } | null>
  marqueeRef: React.MutableRefObject<{ startX: number; startY: number; shiftKey: boolean } | null>
  tabCycleRef: React.MutableRefObject<{ lastClickPos: { x: number; y: number }; candidates: string[]; index: number } | null>
  targetViewRef: React.MutableRefObject<{ zoom: number; offsetX: number; offsetY: number } | null>
  animFrameRef: React.MutableRefObject<number | null>
  pinnedUuids: Set<string>
  lockedUuids: Set<string>
  marquee: MarqueeState | null

  // setters
  setView: (v: ViewTransform | ((prev: ViewTransform) => ViewTransform)) => void
  setSelectedUuid: (uuid: string | null) => void
  setSelectedUuidsReplace: (s: Set<string>) => void
  setSelectedUuids: (fn: (prev: Set<string>) => Set<string>) => void
  setHoveredUuid: (uuid: string | null) => void
  setIsDragging: (v: boolean) => void
  setIsResizing: (v: boolean) => void
  setIsRotating: (v: boolean) => void
  setIsPanningActive: (v: boolean) => void
  setCursorScenePos: (v: { x: number; y: number } | null) => void
  setHoverTooltipPos: (v: { x: number; y: number } | null) => void
  setTooltipVisibleUuid: (v: string | null) => void
  setDragDelta: (v: { dx: number; dy: number } | null) => void
  setAlignGuides: (v: { x?: number; y?: number }[]) => void
  setMarquee: (v: MarqueeState | null) => void
  setMeasureLine: (v: { x1: number; y1: number; x2: number; y2: number } | null) => void
  setUndoStack: (fn: (prev: UndoEntry[]) => UndoEntry[]) => void
  setRedoStack: (v: UndoEntry[]) => void
  setChangeHistory: (fn: (prev: { uuid: string; name: string; x: number; y: number; ts: number }[]) => { uuid: string; name: string; x: number; y: number; ts: number }[]) => void
  setNodeAccessCount: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  setNodeClickCount: (fn: (prev: Map<string, number>) => Map<string, number>) => void
  setCollapsedUuids: (fn: (prev: Set<string>) => Set<string>) => void

  tooltipDelayRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>

  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
  addEditHistory: (action: string, nodeUuid: string, nodeName: string, before: Record<string, unknown>, after: Record<string, unknown>) => void
}

export function useSceneViewMouse(deps: MouseDeps) {
  const {
    nodeMap, selectedUuid, selectedUuids, view, viewRef, activeTool, spaceDown,
    snapEnabled, snapGrid, measureMode, blockInactiveClick, port,
    DESIGN_W, DESIGN_H, svgRef, dragRef, resizeRef, rotateRef,
    isPanning, panStart, measureStartRef, marqueeRef, tabCycleRef,
    targetViewRef, animFrameRef, pinnedUuids, lockedUuids, marquee,
    setView, setSelectedUuid, setSelectedUuidsReplace, setSelectedUuids,
    setHoveredUuid, setIsDragging, setIsResizing, setIsRotating,
    setIsPanningActive, setCursorScenePos, setHoverTooltipPos, setTooltipVisibleUuid,
    setDragDelta, setAlignGuides, setMarquee, setMeasureLine,
    setUndoStack, setRedoStack, setChangeHistory,
    setNodeAccessCount, setNodeClickCount, setCollapsedUuids,
    tooltipDelayRef, updateNode, addEditHistory,
  } = deps

  // ── SVG 좌표 변환 헬퍼 ────────────────────────────────────
  const getSvgCoords = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) }
  }, [])

  const svgToScene = useCallback((svgX: number, svgY: number): { cx: number; cy: number } => {
    const sceneX = (svgX - view.offsetX) / view.zoom
    const sceneY = (svgY - view.offsetY) / view.zoom
    return { cx: sceneX - DESIGN_W / 2, cy: -(sceneY - DESIGN_H / 2) }
  }, [view, DESIGN_W, DESIGN_H])

  // ── 히트 테스트 ────────────────────────────────────────────
  const hitTestAtPoint = useCallback((svgX: number, svgY: number): string[] => {
    const minHitPx = 8 / view.zoom
    const allNodes = [...nodeMap.values()]
    const hits: string[] = []
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const n = allNodes[i]
      if (!n.active && blockInactiveClick) continue
      if (n.locked || lockedUuids.has(n.uuid)) continue
      const { sx, sy } = cocosToSvg(n.worldX ?? n.x, n.worldY ?? n.y, DESIGN_W, DESIGN_H)
      const w = Math.max(n.width, minHitPx)
      const h = Math.max(n.height, minHitPx)
      const rx = sx - w * (n.anchorX ?? 0.5)
      const ry = sy - h * (1 - (n.anchorY ?? 0.5))
      if (svgX >= rx && svgX <= rx + w && svgY >= ry && svgY <= ry + h) {
        hits.push(n.uuid)
      }
    }
    return hits
  }, [nodeMap, view.zoom, DESIGN_W, DESIGN_H, blockInactiveClick, lockedUuids])

  // ── Tab 키로 겹치는 노드 순환 ────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !tabCycleRef.current) return
      e.preventDefault()
      const { candidates, index } = tabCycleRef.current
      if (candidates.length <= 1) return
      const nextIdx = (index + 1) % candidates.length
      tabCycleRef.current.index = nextIdx
      setSelectedUuid(candidates[nextIdx])
      setSelectedUuidsReplace(new Set())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── SVG 마우스 다운 ───────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (measureMode && e.button === 0) {
      const svgPos = getSvgCoords(e)
      measureStartRef.current = { x: svgPos.x, y: svgPos.y }
      setMeasureLine({ x1: svgPos.x, y1: svgPos.y, x2: svgPos.x, y2: svgPos.y })
      return
    }
    if (e.button === 1 || (e.button === 0 && (activeTool === 'move' || spaceDown))) {
      isPanning.current = true
      setIsPanningActive(true)
      panStart.current = { mx: e.clientX, my: e.clientY, ox: view.offsetX, oy: view.offsetY }
      e.preventDefault()
      return
    }
    if (e.button === 0 && activeTool === 'select') {
      if (!e.shiftKey) {
        setSelectedUuid(null)
        setSelectedUuidsReplace(new Set())
      }
      const svgCoords = getSvgCoords(e)
      marqueeRef.current = { startX: svgCoords.x, startY: svgCoords.y, shiftKey: e.shiftKey }
      setMarquee({ startX: svgCoords.x, startY: svgCoords.y, endX: svgCoords.x, endY: svgCoords.y, active: true })
    } else if (e.button === 0) {
      setSelectedUuid(null)
      setSelectedUuidsReplace(new Set())
    }
  }, [activeTool, view, getSvgCoords])

  // ── 노드 마우스 다운 ─────────────────────────────────────
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    if (nodeMap.get(uuid)?.locked) return
    if (lockedUuids.has(uuid)) return
    if (pinnedUuids.has(uuid)) return
    const clickedNode = nodeMap.get(uuid)
    if (blockInactiveClick && clickedNode && !clickedNode.active) return

    if (e.altKey) {
      const node = nodeMap.get(uuid)
      if (node && node.childUuids.length > 0) {
        setCollapsedUuids(prev => {
          const next = new Set(prev)
          if (next.has(uuid)) next.delete(uuid)
          else next.add(uuid)
          return next
        })
      }
      return
    }
    if (e.shiftKey) {
      setSelectedUuids(prev => {
        const next = new Set(prev)
        if (next.has(uuid)) next.delete(uuid)
        else next.add(uuid)
        return next
      })
      setSelectedUuid(uuid)
      return
    }

    const isGroupDrag = selectedUuids.size > 1 && selectedUuids.has(uuid)
    if (!isGroupDrag) {
      setSelectedUuid(uuid)
      setSelectedUuidsReplace(new Set())
    }
    setNodeAccessCount(prev => ({ ...prev, [uuid]: (prev[uuid] ?? 0) + 1 }))
    setNodeClickCount(prev => { const next = new Map(prev); next.set(uuid, (next.get(uuid) ?? 0) + 1); return next })

    const node = nodeMap.get(uuid)
    if (!node) return
    const svgCoords = getSvgCoords(e)
    const candidates = hitTestAtPoint(svgCoords.x, svgCoords.y)
    if (candidates.length > 1) {
      tabCycleRef.current = { lastClickPos: { x: svgCoords.x, y: svgCoords.y }, candidates, index: candidates.indexOf(uuid) }
    } else {
      tabCycleRef.current = null
    }
    const groupOffsets: Record<string, { startX: number; startY: number }> | undefined = isGroupDrag
      ? Object.fromEntries([...selectedUuids].map(uid => {
          const n = nodeMap.get(uid)
          return [uid, { startX: n?.x ?? 0, startY: n?.y ?? 0 }]
        }))
      : undefined

    dragRef.current = {
      uuid, startSvgX: svgCoords.x, startSvgY: svgCoords.y,
      startNodeX: node.x, startNodeY: node.y, groupOffsets,
    }
    setIsDragging(true)
  }, [nodeMap, getSvgCoords, selectedUuids, pinnedUuids, lockedUuids, blockInactiveClick])

  // ── 리사이즈 마우스 다운 ──────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, uuid: string, handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w') => {
    e.stopPropagation(); e.preventDefault()
    if (e.button !== 0) return
    if (nodeMap.get(uuid)?.locked) return
    if (lockedUuids.has(uuid)) return
    const node = nodeMap.get(uuid)
    if (!node) return
    const svgCoords = getSvgCoords(e)
    resizeRef.current = {
      uuid, handle, startSvgX: svgCoords.x, startSvgY: svgCoords.y,
      startWidth: node.width, startHeight: node.height, startNodeX: node.x, startNodeY: node.y,
    }
    setIsResizing(true)
  }, [nodeMap, getSvgCoords, lockedUuids])

  // ── 회전 마우스 다운 ──────────────────────────────────────
  const handleRotateMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation(); e.preventDefault()
    if (e.button !== 0) return
    if (nodeMap.get(uuid)?.locked) return
    if (lockedUuids.has(uuid)) return
    const node = nodeMap.get(uuid)
    if (!node) return
    const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)
    const anchorSx = sx * view.zoom + view.offsetX
    const anchorSy = sy * view.zoom + view.offsetY
    rotateRef.current = { uuid, anchorSx, anchorSy, startRotation: node.rotation }
    setIsRotating(true)
  }, [nodeMap, view, lockedUuids, DESIGN_W, DESIGN_H])

  // ── 마우스 이동 ───────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svgPos = getSvgCoords(e)
    const { cx, cy } = svgToScene(svgPos.x, svgPos.y)
    setCursorScenePos({ x: Math.round(cx), y: Math.round(cy) })

    if (measureMode && measureStartRef.current && e.buttons === 1) {
      setMeasureLine({ x1: measureStartRef.current.x, y1: measureStartRef.current.y, x2: svgPos.x, y2: svgPos.y })
      return
    }
    setHoverTooltipPos({ x: svgPos.x + 10, y: svgPos.y + 10 })

    if (marqueeRef.current) {
      const svgCoords = getSvgCoords(e)
      setMarquee({
        startX: marqueeRef.current.startX, startY: marqueeRef.current.startY,
        endX: svgCoords.x, endY: svgCoords.y, active: true,
      })
      return
    }
    if (rotateRef.current) {
      const rt = rotateRef.current
      const dx = e.clientX - rt.anchorSx; const dy = e.clientY - rt.anchorSy
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
      const newRotation = parseFloat((-angleDeg - 90).toFixed(1))
      updateNode(rt.uuid, { rotation: newRotation })
      return
    }
    if (resizeRef.current) {
      const rs = resizeRef.current
      const svgCoords = getSvgCoords(e)
      const dsvgX = svgCoords.x - rs.startSvgX
      const dsvgY = svgCoords.y - rs.startSvgY
      const dsceneX = dsvgX / view.zoom
      const dsceneY = -dsvgY / view.zoom
      let newW = rs.startWidth; let newH = rs.startHeight
      if (rs.handle === 'se') { newW = rs.startWidth + dsceneX; newH = rs.startHeight - dsceneY }
      else if (rs.handle === 'ne') { newW = rs.startWidth + dsceneX; newH = rs.startHeight + dsceneY }
      else if (rs.handle === 'sw') { newW = rs.startWidth - dsceneX; newH = rs.startHeight - dsceneY }
      else if (rs.handle === 'nw') { newW = rs.startWidth - dsceneX; newH = rs.startHeight + dsceneY }
      else if (rs.handle === 'e') { newW = rs.startWidth + dsceneX }
      else if (rs.handle === 'w') { newW = rs.startWidth - dsceneX }
      else if (rs.handle === 's') { newH = rs.startHeight - dsceneY }
      else if (rs.handle === 'n') { newH = rs.startHeight + dsceneY }
      if (e.shiftKey && ['nw', 'ne', 'se', 'sw'].includes(rs.handle) && rs.startHeight > 0) {
        const aspect = rs.startWidth / rs.startHeight
        if (Math.abs(newW - rs.startWidth) >= Math.abs(newH - rs.startHeight) * aspect) {
          newH = newW / aspect
        } else { newW = newH * aspect }
      }
      newW = Math.max(4, newW); newH = Math.max(4, newH)
      const newX = (rs.handle === 'n' || rs.handle === 's') ? rs.startNodeX : rs.startNodeX + dsceneX / 2
      const newY = (rs.handle === 'e' || rs.handle === 'w') ? rs.startNodeY : rs.startNodeY + dsceneY / 2
      updateNode(rs.uuid, { width: newW, height: newH, x: newX, y: newY })
      return
    }
    if (isPanning.current && panStart.current) {
      const ps = panStart.current
      const dx = e.clientX - ps.mx; const dy = e.clientY - ps.my
      setView(prev => ({ ...prev, offsetX: ps.ox + dx, offsetY: ps.oy + dy }))
      return
    }
    if (dragRef.current) {
      const drag = dragRef.current
      const svgCoords = getSvgCoords(e)
      const dsvgX = svgCoords.x - drag.startSvgX; const dsvgY = svgCoords.y - drag.startSvgY
      const dSceneX = dsvgX / view.zoom; const dSceneY = -dsvgY / view.zoom
      let newX = drag.startNodeX + dSceneX; let newY = drag.startNodeY + dSceneY
      setDragDelta({ dx: Math.round(dSceneX), dy: Math.round(dSceneY) })
      // Alt 홀드 시 스냅 일시 비활성화 (!e.altKey)
      if (snapEnabled && !e.altKey) {
        newX = Math.round(newX / snapGrid) * snapGrid
        newY = Math.round(newY / snapGrid) * snapGrid
      }
      if (!drag.groupOffsets) {
        const dragNode = nodeMap.get(drag.uuid)
        const threshold = 12 / view.zoom
        const guides: { x?: number; y?: number }[] = []
        if (dragNode) {
          const hw = dragNode.width / 2; const hh = dragNode.height / 2
          const myXs = [newX - hw, newX, newX + hw]
          const myYs = [newY - hh, newY, newY + hh]
          nodeMap.forEach((n, uid) => {
            if (uid === drag.uuid || selectedUuids.has(uid)) return
            const nXs = [n.x - n.width / 2, n.x, n.x + n.width / 2]
            const nYs = [n.y - n.height / 2, n.y, n.y + n.height / 2]
            for (const nx2 of nXs) for (const mx of myXs) {
              if (Math.abs(nx2 - mx) < threshold) { guides.push({ x: nx2 }); if (snapEnabled) newX = nx2 - (mx - newX) }
            }
            for (const ny2 of nYs) for (const my of myYs) {
              if (Math.abs(ny2 - my) < threshold) { guides.push({ y: ny2 }); if (snapEnabled) newY = ny2 - (my - newY) }
            }
          })
        }
        setAlignGuides(guides)
      }
      if (drag.groupOffsets) {
        for (const [uid, { startX, startY }] of Object.entries(drag.groupOffsets)) {
          let nx = startX + dSceneX; let ny = startY + dSceneY
          if (snapEnabled && !e.altKey) { nx = Math.round(nx / snapGrid) * snapGrid; ny = Math.round(ny / snapGrid) * snapGrid }
          updateNode(uid, { x: nx, y: ny })
        }
      } else {
        updateNode(drag.uuid, { x: newX, y: newY })
      }
    }
  }, [view.zoom, snapEnabled, snapGrid, getSvgCoords, svgToScene, updateNode, nodeMap, selectedUuids, measureMode])

  // ── 마우스 업 ─────────────────────────────────────────────
  const handleMouseUp = useCallback(async () => {
    setAlignGuides([])
    if (marqueeRef.current && marquee) {
      const wasShift = marqueeRef.current.shiftKey
      marqueeRef.current = null
      const mx1 = Math.min(marquee.startX, marquee.endX)
      const my1 = Math.min(marquee.startY, marquee.endY)
      const mx2 = Math.max(marquee.startX, marquee.endX)
      const my2 = Math.max(marquee.startY, marquee.endY)
      if (mx2 - mx1 > 4 || my2 - my1 > 4) {
        const hit = new Set<string>()
        nodeMap.forEach((node) => {
          const nodeX = node.worldX ?? node.x; const nodeY = node.worldY ?? node.y
          const { sx, sy } = cocosToSvg(nodeX, nodeY, DESIGN_W, DESIGN_H)
          const pw = node.width * Math.abs(node.scaleX); const ph = node.height * Math.abs(node.scaleY)
          const rx = sx - pw * node.anchorX; const ry = sy - ph * (1 - node.anchorY)
          const nx1 = rx * view.zoom + view.offsetX; const ny1 = ry * view.zoom + view.offsetY
          const nx2 = (rx + pw) * view.zoom + view.offsetX; const ny2 = (ry + ph) * view.zoom + view.offsetY
          if (nx1 < mx2 && nx2 > mx1 && ny1 < my2 && ny2 > my1) hit.add(node.uuid)
        })
        if (hit.size > 0) {
          setSelectedUuidsReplace(wasShift ? new Set([...selectedUuids, ...hit]) : hit)
          const first = hit.values().next().value
          setSelectedUuid(first ?? null)
        }
      }
      setMarquee(null)
      return
    }
    if (isPanning.current) {
      isPanning.current = false; setIsPanningActive(false); panStart.current = null; return
    }
    const capturedDrag = dragRef.current
    if (capturedDrag) {
      dragRef.current = null
      const drag = capturedDrag
      if (drag.groupOffsets) {
        const entries: UndoEntry[] = []
        for (const [uid, { startX, startY }] of Object.entries(drag.groupOffsets)) {
          const n = nodeMap.get(uid)
          if (!n) continue
          if (n.x !== startX || n.y !== startY) {
            entries.push({ uuid: uid, prevX: startX, prevY: startY, nextX: n.x, nextY: n.y })
            try { await window.api.ccSetProperty?.(port, uid, 'x', n.x); await window.api.ccSetProperty?.(port, uid, 'y', n.y) }
            catch (e) { console.error('[SceneView] setProperty failed:', e) }
          }
        }
        if (entries.length > 0) { setUndoStack(prev => [...prev.slice(-(50 - entries.length)), ...entries]); setRedoStack([]) }
      } else {
        const node = nodeMap.get(drag.uuid)
        if (node) {
          if (node.x !== drag.startNodeX || node.y !== drag.startNodeY) {
            setUndoStack(prev => [...prev.slice(-49), { uuid: drag.uuid, prevX: drag.startNodeX, prevY: drag.startNodeY, nextX: node.x, nextY: node.y }])
            setRedoStack([])
          }
          try { await window.api.ccSetProperty?.(port, drag.uuid, 'x', node.x); await window.api.ccSetProperty?.(port, drag.uuid, 'y', node.y) }
          catch (e) { console.error('[SceneView] setProperty failed:', e) }
        }
      }
      const draggedNode = nodeMap.get(drag.uuid)
      if (draggedNode) {
        setChangeHistory(prev => {
          const entry = { uuid: drag.uuid, name: draggedNode.name, x: Math.round(draggedNode.x), y: Math.round(draggedNode.y), ts: Date.now() }
          return [entry, ...prev.filter(e => e.uuid !== drag.uuid)].slice(0, 20)
        })
        if (draggedNode.x !== drag.startNodeX || draggedNode.y !== drag.startNodeY) {
          addEditHistory('move', drag.uuid, draggedNode.name, { x: drag.startNodeX, y: drag.startNodeY }, { x: draggedNode.x, y: draggedNode.y })
        }
      }
      setIsDragging(false); setDragDelta(null)
    }
    if (resizeRef.current) {
      const rs = resizeRef.current
      const node = nodeMap.get(rs.uuid)
      if (node) {
        if (node.width !== rs.startWidth || node.height !== rs.startHeight) {
          addEditHistory('resize', rs.uuid, node.name, { width: rs.startWidth, height: rs.startHeight }, { width: node.width, height: node.height })
        }
        try {
          await window.api.ccSetProperty?.(port, rs.uuid, 'width', node.width)
          await window.api.ccSetProperty?.(port, rs.uuid, 'height', node.height)
          await window.api.ccSetProperty?.(port, rs.uuid, 'x', node.x)
          await window.api.ccSetProperty?.(port, rs.uuid, 'y', node.y)
        } catch (e) { console.error('[SceneView] resize failed:', e) }
      }
      resizeRef.current = null; setIsResizing(false)
    }
    if (rotateRef.current) {
      const rt = rotateRef.current
      const node = nodeMap.get(rt.uuid)
      if (node) {
        try { await window.api.ccSetProperty?.(port, rt.uuid, 'rotation', node.rotation) }
        catch (e) { console.error('[SceneView] rotate failed:', e) }
      }
      rotateRef.current = null; setIsRotating(false)
    }
  }, [nodeMap, marquee, view, port, selectedUuids, DESIGN_W, DESIGN_H])

  // ── 줌 애니메이션 (RAF 보간) ────────────────────────────────
  const animateToTarget = useCallback(() => {
    if (!targetViewRef.current) return
    setView(curr => {
      const target = targetViewRef.current!
      const dz = target.zoom - curr.zoom; const dx = target.offsetX - curr.offsetX; const dy = target.offsetY - curr.offsetY
      if (Math.abs(dz) < 0.001 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        targetViewRef.current = null; animFrameRef.current = null; return target
      }
      const EASE = 0.18
      return { zoom: curr.zoom + dz * EASE, offsetX: curr.offsetX + dx * EASE, offsetY: curr.offsetY + dy * EASE }
    })
    if (targetViewRef.current) animFrameRef.current = requestAnimationFrame(animateToTarget)
  }, [])

  // ── 줌 (wheel) ────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const svgCoords = getSvgCoords(e)
      const curr = targetViewRef.current ?? viewRef.current
      const newZoom = Math.min(8, Math.max(0.1, curr.zoom * factor))
      const newOffsetX = svgCoords.x - (svgCoords.x - curr.offsetX) * (newZoom / curr.zoom)
      const newOffsetY = svgCoords.y - (svgCoords.y - curr.offsetY) * (newZoom / curr.zoom)
      targetViewRef.current = { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
      if (!animFrameRef.current) animFrameRef.current = requestAnimationFrame(animateToTarget)
    } else {
      setView(prev => ({ ...prev, offsetX: prev.offsetX - e.deltaX, offsetY: prev.offsetY - e.deltaY }))
    }
  }, [getSvgCoords])

  // ── wheel passive: false 등록 ─────────────────────────────
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // 줌 RAF cleanup
  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [])

  return {
    getSvgCoords,
    svgToScene,
    hitTestAtPoint,
    handleSvgMouseDown,
    handleNodeMouseDown,
    handleResizeMouseDown,
    handleRotateMouseDown,
    handleMouseMove,
    handleMouseUp,
    animateToTarget,
    handleWheel,
  }
}
