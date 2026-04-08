import { useCallback, useEffect } from 'react'
import { ALIGN_SNAP_THRESHOLD, type FlatNode, type ViewTransformCC } from './ccSceneTypes'

export interface CCSceneMouseDeps {
  svgRef: React.RefObject<SVGSVGElement | null>
  viewRef: React.MutableRefObject<ViewTransformCC>
  isSpaceDownRef: React.MutableRefObject<boolean>
  panStart: React.MutableRefObject<{ mouseX: number; mouseY: number; offX: number; offY: number } | null>
  dragRef: React.MutableRefObject<{ uuid: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number; isAltDrag?: boolean } | null>
  multiDragRef: React.MutableRefObject<{ startMouseX: number; startMouseY: number; nodes: Map<string, { localX: number; localY: number }> } | null>
  resizeRef: React.MutableRefObject<{ uuid: string; startMouseX: number; startMouseY: number; startW: number; startH: number; dir: 'SE' | 'S' | 'E' | 'NW' | 'N' | 'NE' | 'W' | 'SW'; startLocalX: number; startLocalY: number } | null>
  rotateRef: React.MutableRefObject<{ uuid: string; centerX: number; centerY: number; startAngle: number; startRotation: number } | null>
  anchorRef: React.MutableRefObject<{ uuid: string; rectX: number; rectY: number; w: number; h: number } | null>
  guideDragRef: React.MutableRefObject<{ idx: number; type: 'V' | 'H'; startMouse: number; startPos: number } | null>
  measureStartRef: React.MutableRefObject<{ svgX: number; svgY: number } | null>
  selBoxRef: React.MutableRefObject<{ startSvgX: number; startSvgY: number } | null>
  hoverClientPosRef: React.MutableRefObject<{ x: number; y: number } | null>

  view: ViewTransformCC
  isPanning: boolean
  measureMode: boolean
  snapSize: number
  cx: number
  cy: number
  effectiveW: number
  effectiveH: number
  flatNodes: FlatNode[]
  showUserGuides: boolean
  userGuides: Array<{ type: 'V' | 'H'; pos: number }>
  // Overrides for mouseUp
  anchorOverride: { uuid: string; ax: number; ay: number } | null
  rotateOverride: { uuid: string; angle: number } | null
  dragOverride: { uuid: string; x: number; y: number } | null
  resizeOverride: { uuid: string; w: number; h: number; dx?: number; dy?: number } | null
  multiDragDelta: { dx: number; dy: number } | null
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null

  // Setters
  setView: React.Dispatch<React.SetStateAction<ViewTransformCC>>
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>
  setMouseScenePos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  setUserGuides: React.Dispatch<React.SetStateAction<Array<{ type: 'V' | 'H'; pos: number }>>>
  setMeasureLine: React.Dispatch<React.SetStateAction<{ svgX1: number; svgY1: number; svgX2: number; svgY2: number } | null>>
  setAnchorOverride: React.Dispatch<React.SetStateAction<{ uuid: string; ax: number; ay: number } | null>>
  setRotateOverride: React.Dispatch<React.SetStateAction<{ uuid: string; angle: number } | null>>
  setResizeOverride: React.Dispatch<React.SetStateAction<{ uuid: string; w: number; h: number; dx?: number; dy?: number } | null>>
  setDragOverride: React.Dispatch<React.SetStateAction<{ uuid: string; x: number; y: number } | null>>
  setSnapIndicator: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  setAlignGuides: React.Dispatch<React.SetStateAction<Array<{ type: 'V' | 'H'; pos: number; label?: string }>>>
  setDragGhost: React.Dispatch<React.SetStateAction<{ uuid: string; worldX: number; worldY: number; w: number; h: number; anchorX: number; anchorY: number } | null>>
  setMultiDragDelta: React.Dispatch<React.SetStateAction<{ dx: number; dy: number } | null>>
  setSelectionBox: React.Dispatch<React.SetStateAction<{ x1: number; y1: number; x2: number; y2: number } | null>>
  setMultiSelected: React.Dispatch<React.SetStateAction<Set<string>>>

  // Callbacks
  ccToSvg: (ccX: number, ccY: number) => { x: number; y: number }
  onSelect: (uuid: string | null) => void
  onMove?: (uuid: string, x: number, y: number) => void
  onResize?: (uuid: string, w: number, h: number) => void
  onRotate?: (uuid: string, angle: number) => void
  onAnchorMove?: (uuid: string, ax: number, ay: number) => void
  onMultiMove?: (moves: Array<{ uuid: string; x: number; y: number }>) => void
  onAltDrag?: (uuid: string, x: number, y: number) => void
}

export interface CCSceneMouseResult {
  handleMouseDown: (e: React.MouseEvent) => void
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseUp: (e?: React.MouseEvent) => void
}

/**
 * Mouse/drag handler logic for CCFileSceneView.
 * Extracted from the main component to reduce file size.
 */
export function useCCSceneMouse(deps: CCSceneMouseDeps): CCSceneMouseResult {
  const {
    svgRef, viewRef, isSpaceDownRef, panStart, dragRef, multiDragRef,
    resizeRef, rotateRef, anchorRef, guideDragRef, measureStartRef,
    selBoxRef, hoverClientPosRef,
    view, isPanning, measureMode, snapSize, cx, cy, effectiveW, effectiveH,
    flatNodes, showUserGuides, userGuides,
    anchorOverride, rotateOverride, dragOverride, resizeOverride, multiDragDelta, selectionBox,
    setView, setIsPanning, setMouseScenePos, setUserGuides, setMeasureLine,
    setAnchorOverride, setRotateOverride, setResizeOverride,
    setDragOverride, setSnapIndicator, setAlignGuides, setDragGhost,
    setMultiDragDelta, setSelectionBox, setMultiSelected,
    ccToSvg, onSelect, onMove, onResize, onRotate, onAnchorMove, onMultiMove, onAltDrag,
  } = deps

  // Wheel zoom (native listener for passive: false)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setView(v => {
        const newZoom = Math.max(0.1, Math.min(5, v.zoom * delta))
        const scale = newZoom / v.zoom
        return {
          zoom: newZoom,
          offsetX: mouseX - (mouseX - v.offsetX) * scale,
          offsetY: mouseY - (mouseY - v.offsetY) * scale,
        }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpaceDownRef.current)) {
      e.preventDefault()
      setIsPanning(true)
      panStart.current = { mouseX: e.clientX, mouseY: e.clientY, offX: view.offsetX, offY: view.offsetY }
    } else if (e.button === 0) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
      const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
      // R2465: 측정 모드 시작
      if (measureMode) {
        measureStartRef.current = { svgX, svgY }
        setMeasureLine(null)
        return
      }
      // 빈 공간 드래그: rubber-band 선택 시작
      selBoxRef.current = { startSvgX: svgX, startSvgY: svgY }
    }
  }, [view, measureMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // R2740: 가이드라인 드래그
    if (guideDragRef.current) {
      const gd = guideDragRef.current
      const delta = gd.type === 'V'
        ? (e.clientX - gd.startMouse) / viewRef.current.zoom
        : (e.clientY - gd.startMouse) / viewRef.current.zoom
      const newPos = gd.startPos + delta
      setUserGuides(gs => gs.map((g, i) => i === gd.idx ? { ...g, pos: newPos } : g))
      return
    }
    // R1598: 마우스 위치 씬 좌표 업데이트
    {
      const svg = svgRef.current
      if (svg) {
        const rect = svg.getBoundingClientRect()
        const v = viewRef.current
        const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
        const svgY = -((e.clientY - rect.top - v.offsetY) / v.zoom)  // Y 반전 (씬 좌표계)
        setMouseScenePos({ x: Math.round(svgX), y: Math.round(svgY) })
      }
    }
    // R2465: 측정 도구 드래그 업데이트
    if (measureStartRef.current) {
      const svg = svgRef.current
      if (svg) {
        const rect = svg.getBoundingClientRect()
        const v = viewRef.current
        const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
        const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
        setMeasureLine({ svgX1: measureStartRef.current.svgX, svgY1: measureStartRef.current.svgY, svgX2: svgX, svgY2: svgY })
      }
      return
    }
    // R1506: 앵커 포인트 드래그
    if (anchorRef.current) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
      const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
      const { rectX, rectY, w, h, uuid } = anchorRef.current
      const ax = w > 0 ? Math.max(0, Math.min(1, (svgX - rectX) / w)) : 0.5
      const ay = h > 0 ? Math.max(0, Math.min(1, 1 - (svgY - rectY) / h)) : 0.5
      setAnchorOverride({ uuid, ax, ay })
      return
    }
    if (rotateRef.current) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
      const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
      const angle = Math.atan2(svgY - rotateRef.current.centerY, svgX - rotateRef.current.centerX) * 180 / Math.PI
      const delta = angle - rotateRef.current.startAngle
      let newAngle = rotateRef.current.startRotation - delta
      // Shift 키: 15° 단위 스냅
      if (e.shiftKey) newAngle = Math.round(newAngle / 15) * 15
      setRotateOverride({ uuid: rotateRef.current.uuid, angle: newAngle })
      return
    }
    if (resizeRef.current) {
      const mdx = e.clientX - resizeRef.current.startMouseX
      const mdy = e.clientY - resizeRef.current.startMouseY
      const z = viewRef.current.zoom
      const { dir, startW, startH } = resizeRef.current
      let newW = startW
      let newH = startH
      let posDx = 0
      let posDy = 0
      if (dir === 'SE') {
        newW = Math.max(1, startW + mdx / z)
        newH = Math.max(1, startH + mdy / z)
      } else if (dir === 'S') {
        newH = Math.max(1, startH + mdy / z)
      } else if (dir === 'E') {
        newW = Math.max(1, startW + mdx / z)
      } else if (dir === 'NW') {
        newW = Math.max(1, startW - mdx / z)
        newH = Math.max(1, startH - mdy / z)
        posDx = -(newW - startW)
        posDy = newH - startH
      } else if (dir === 'N') {
        newH = Math.max(1, startH - mdy / z)
        posDy = newH - startH
      } else if (dir === 'NE') {
        newW = Math.max(1, startW + mdx / z)
        newH = Math.max(1, startH - mdy / z)
        posDy = newH - startH
      } else if (dir === 'W') {
        newW = Math.max(1, startW - mdx / z)
        posDx = -(newW - startW)
      } else if (dir === 'SW') {
        newW = Math.max(1, startW - mdx / z)
        newH = Math.max(1, startH + mdy / z)
        posDx = -(newW - startW)
      }
      // R1638: Shift+리사이즈 — SE 핸들에서 종횡비 유지
      if (e.shiftKey && dir === 'SE' && startW > 0 && startH > 0) {
        const ratio = startW / startH
        if (Math.abs(mdx) / z > Math.abs(mdy) / z) newH = Math.max(1, newW / ratio)
        else newW = Math.max(1, newH * ratio)
      }
      setResizeOverride({ uuid: resizeRef.current.uuid, w: newW, h: newH, dx: posDx, dy: posDy })
      return
    }
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startMouseX
      const dy = e.clientY - dragRef.current.startMouseY
      const z = viewRef.current.zoom
      let nx = dragRef.current.startNodeX + dx / z
      let ny = dragRef.current.startNodeY - dy / z
      // R1685: Shift 키: 축 제한 (더 많이 이동한 축으로 고정)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (Math.abs(dx) >= Math.abs(dy)) ny = dragRef.current.startNodeY
        else nx = dragRef.current.startNodeX
      }
      // Ctrl 키: 그리드 스냅
      if (e.ctrlKey || e.metaKey) {
        nx = Math.round(nx / snapSize) * snapSize
        ny = Math.round(ny / snapSize) * snapSize
        // R1500: 스냅 포인트 시각적 피드백
        setSnapIndicator({ x: nx, y: ny })
      } else {
        setSnapIndicator(null)
      }
      // R2742: 가이드라인 auto-snap (Ctrl/Shift 없을 때)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && showUserGuides && userGuides.length > 0) {
        const SNAP_THRESH = 8 / viewRef.current.zoom
        let snapped = false
        for (const g of userGuides) {
          if (g.type === 'V') {
            const gWorld = g.pos - cx
            if (Math.abs(nx - gWorld) < SNAP_THRESH) { nx = gWorld; snapped = true; break }
          } else {
            const gWorld = cy - g.pos
            if (Math.abs(ny - gWorld) < SNAP_THRESH) { ny = gWorld; snapped = true; break }
          }
        }
        if (snapped) setSnapIndicator({ x: nx, y: ny })
      }
      setDragOverride({ uuid: dragRef.current.uuid, x: nx, y: ny })
      // R1512: 정렬 가이드라인 계산
      const draggedFn = flatNodes.find(fn => fn.node.uuid === dragRef.current!.uuid)
      if (draggedFn) {
        const dw = draggedFn.node.size?.x ?? 0
        const dh = draggedFn.node.size?.y ?? 0
        const dax = draggedFn.node.anchor?.x ?? 0.5
        const day = draggedFn.node.anchor?.y ?? 0.5
        const dSvg = { x: cx + nx, y: cy - ny }
        const dLeft = dSvg.x - dw * dax, dRight = dSvg.x + dw * (1 - dax)
        const dTop = dSvg.y - dh * (1 - day), dBot = dSvg.y + dh * day
        const dCX = dSvg.x, dCY = dSvg.y
        const guides: Array<{ type: 'V' | 'H'; pos: number; label?: string }> = []
        for (const fn of flatNodes) {
          if (fn.node.uuid === dragRef.current!.uuid) continue
          const sp = { x: cx + fn.worldX, y: cy - fn.worldY }
          const fw = fn.node.size?.x ?? 0, fh = fn.node.size?.y ?? 0
          const fax = fn.node.anchor?.x ?? 0.5, fay = fn.node.anchor?.y ?? 0.5
          const fLeft = sp.x - fw * fax, fRight = sp.x + fw * (1 - fax)
          const fTop = sp.y - fh * (1 - fay), fBot = sp.y + fh * fay
          const fCX = sp.x, fCY = sp.y
          const vPairs: [number,number][] = [[dLeft,fLeft],[dLeft,fCX],[dLeft,fRight],[dCX,fLeft],[dCX,fCX],[dCX,fRight],[dRight,fLeft],[dRight,fCX],[dRight,fRight]]
          for (const [dp, fp] of vPairs) { if (Math.abs(dp - fp) < ALIGN_SNAP_THRESHOLD) guides.push({ type: 'V', pos: fp }) }
          const hPairs: [number,number][] = [[dTop,fTop],[dTop,fCY],[dTop,fBot],[dCY,fTop],[dCY,fCY],[dCY,fBot],[dBot,fTop],[dBot,fCY],[dBot,fBot]]
          for (const [dp, fp] of hPairs) { if (Math.abs(dp - fp) < ALIGN_SNAP_THRESHOLD) guides.push({ type: 'H', pos: fp }) }
        }
        // R1634: 캔버스 경계 정렬 가이드 (좌/중/우, 상/중/하)
        for (const svgX of [0, cx, effectiveW]) {
          if ([dLeft, dCX, dRight].some(dp => Math.abs(dp - svgX) < ALIGN_SNAP_THRESHOLD)) guides.push({ type: 'V', pos: svgX })
        }
        for (const svgY of [0, cy, effectiveH]) {
          if ([dTop, dCY, dBot].some(dp => Math.abs(dp - svgY) < ALIGN_SNAP_THRESHOLD)) guides.push({ type: 'H', pos: svgY })
        }
        // R1669: 부모 노드 경계 정렬 가이드
        if (draggedFn.parentUuid) {
          const parentFn = flatNodes.find(fn => fn.node.uuid === draggedFn.parentUuid)
          if (parentFn) {
            const pp = { x: cx + parentFn.worldX, y: cy - parentFn.worldY }
            const pw = parentFn.node.size?.x ?? 0, ph = parentFn.node.size?.y ?? 0
            const pax = parentFn.node.anchor?.x ?? 0.5, pay = parentFn.node.anchor?.y ?? 0.5
            const pLeft = pp.x - pw * pax, pRight = pp.x + pw * (1 - pax)
            const pTop = pp.y - ph * (1 - pay), pBot = pp.y + ph * pay
            for (const svgX of [pLeft, pp.x, pRight]) {
              if ([dLeft, dCX, dRight].some(dp => Math.abs(dp - svgX) < ALIGN_SNAP_THRESHOLD * 1.5)) guides.push({ type: 'V', pos: svgX, label: '부모' })
            }
            for (const svgY of [pTop, pp.y, pBot]) {
              if ([dTop, dCY, dBot].some(dp => Math.abs(dp - svgY) < ALIGN_SNAP_THRESHOLD * 1.5)) guides.push({ type: 'H', pos: svgY, label: '부모' })
            }
          }
        }
        setAlignGuides(guides)
        // R1695: 가이드에 실제 스냅 적용 (Ctrl/Shift 없을 때)
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          for (const g of guides) {
            const cxn = cx + nx, cyn = cy - ny
            if (g.type === 'V') {
              const cands: [number, number][] = [
                [cxn - dw * dax, dw * dax],
                [cxn, 0],
                [cxn + dw * (1 - dax), -dw * (1 - dax)],
              ]
              for (const [dragPos, offset] of cands) {
                if (Math.abs(dragPos - g.pos) < ALIGN_SNAP_THRESHOLD) { nx = g.pos + offset - cx; break }
              }
            } else {
              const cands: [number, number][] = [
                [cyn - dh * (1 - day), dh * (1 - day)],
                [cyn, 0],
                [cyn + dh * day, -dh * day],
              ]
              for (const [dragPos, offset] of cands) {
                if (Math.abs(dragPos - g.pos) < ALIGN_SNAP_THRESHOLD) { ny = cy - (g.pos + offset); break }
              }
            }
          }
          setDragOverride({ uuid: dragRef.current!.uuid, x: nx, y: ny })
        }
      }
      return
    }
    // R2472: 다중 선택 동시 드래그
    if (multiDragRef.current) {
      const z = viewRef.current.zoom
      let dx = (e.clientX - multiDragRef.current.startMouseX) / z
      let dy = -(e.clientY - multiDragRef.current.startMouseY) / z
      if (e.shiftKey && !e.ctrlKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0
        else dx = 0
      }
      if (e.ctrlKey || e.metaKey) {
        dx = Math.round(dx / snapSize) * snapSize
        dy = Math.round(dy / snapSize) * snapSize
      }
      setMultiDragDelta({ dx, dy })
      return
    }
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.mouseX
      const dy = e.clientY - panStart.current.mouseY
      const offX = panStart.current.offX
      const offY = panStart.current.offY
      setView(v => ({ ...v, offsetX: offX + dx, offsetY: offY + dy }))
    }
    // rubber-band selection box 업데이트
    if (selBoxRef.current && !dragRef.current && !resizeRef.current && !rotateRef.current && !isPanning) {
      const svg = svgRef.current
      if (svg) {
        const rect = svg.getBoundingClientRect()
        const v = viewRef.current
        const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
        const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
        setSelectionBox({ x1: selBoxRef.current.startSvgX, y1: selBoxRef.current.startSvgY, x2: svgX, y2: svgY })
      }
    }
    // 마우스 씬 좌표 계산: ccX = (mouseX - offsetX) / zoom - cx, ccY = cy - (mouseY - offsetY) / zoom
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const v = viewRef.current
      const scx = Math.round((mx - v.offsetX) / v.zoom - cx)
      const scy = Math.round(cy - (my - v.offsetY) / v.zoom)
      setMouseScenePos({ x: scx, y: scy })
    }
    hoverClientPosRef.current = { x: e.clientX, y: e.clientY }  // R1693
  }, [isPanning, cx, cy, snapSize, flatNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(async (e?: React.MouseEvent) => {
    // R2740: 가이드라인 드래그 완료
    if (guideDragRef.current) { guideDragRef.current = null; return }
    // R2465: 측정 도구 — 드래그 완료 시 start ref 해제 (측정 선은 유지)
    if (measureStartRef.current) {
      measureStartRef.current = null
      return
    }
    // R1506: 앵커 포인트 드래그 완료
    if (anchorRef.current && anchorOverride) {
      onAnchorMove?.(anchorOverride.uuid, anchorOverride.ax, anchorOverride.ay)
      anchorRef.current = null
      setAnchorOverride(null)
      return
    }
    anchorRef.current = null
    setAnchorOverride(null)
    if (rotateRef.current && rotateOverride) {
      // ref 즉시 해제 (이후 mousemove 무시), override는 await 후 해제(1프레임 플래시 방지)
      rotateRef.current = null
      const saved = { ...rotateOverride }
      await onRotate?.(saved.uuid, saved.angle)
      setRotateOverride(null)
      return
    }
    rotateRef.current = null
    setRotateOverride(null)
    if (resizeRef.current && resizeOverride) {
      const savedRef = { ...resizeRef.current }
      const savedOv = { ...resizeOverride }
      resizeRef.current = null
      await onResize?.(savedOv.uuid, savedOv.w, savedOv.h)
      if (savedOv.dx || savedOv.dy) {
        const newLocalX = savedRef.startLocalX + (savedOv.dx ?? 0)
        const newLocalY = savedRef.startLocalY + (savedOv.dy ?? 0)
        await onMove?.(savedOv.uuid, newLocalX, newLocalY)
      }
      setResizeOverride(null)
      return
    }
    resizeRef.current = null
    setResizeOverride(null)
    if (dragRef.current && dragOverride) {
      // R2705: altDrag — 복제 후 이동
      if (dragRef.current.isAltDrag) {
        onAltDrag?.(dragOverride.uuid, dragOverride.x, dragOverride.y)
      } else {
        onMove?.(dragOverride.uuid, dragOverride.x, dragOverride.y)
      }
      dragRef.current = null
      setDragOverride(null)
      setSnapIndicator(null)
      setAlignGuides([])
      setDragGhost(null)
      return
    }
    dragRef.current = null
    setDragOverride(null)
    setSnapIndicator(null)
    setAlignGuides([])
    setDragGhost(null)
    // R2472: 다중 선택 동시 드래그 완료
    if (multiDragRef.current && multiDragDelta) {
      const { dx, dy } = multiDragDelta
      const moves = Array.from(multiDragRef.current.nodes.entries()).map(([uuid, { localX, localY }]) => ({
        uuid, x: localX + dx, y: localY + dy,
      }))
      if (moves.length > 0) onMultiMove?.(moves)
      multiDragRef.current = null
      setMultiDragDelta(null)
      return
    }
    multiDragRef.current = null
    setMultiDragDelta(null)
    setIsPanning(false)
    panStart.current = null
    // rubber-band 완료: 박스 내 노드 선택
    if (selBoxRef.current && selectionBox) {
      const box = selectionBox
      const hasSize = Math.abs(box.x2 - box.x1) > 4 || Math.abs(box.y2 - box.y1) > 4
      if (hasSize) {
        const minX = Math.min(box.x1, box.x2), maxX = Math.max(box.x1, box.x2)
        const minY = Math.min(box.y1, box.y2), maxY = Math.max(box.y1, box.y2)
        const picked = new Set<string>()
        for (const fn of flatNodes) {
          if (!fn.node.size?.x && !fn.node.size?.y) continue
          const sp = ccToSvg(fn.worldX, fn.worldY)
          const ax = fn.node.anchor?.x ?? 0.5
          const ay = fn.node.anchor?.y ?? 0.5
          const rx = sp.x - fn.node.size.x * ax
          const ry = sp.y - fn.node.size.y * (1 - ay)
          if (rx < maxX && rx + fn.node.size.x > minX && ry < maxY && ry + fn.node.size.y > minY) {
            picked.add(fn.node.uuid)
          }
        }
        // R2701: Shift 키 누른 채 마르키 선택 시 기존 선택 병합
        if (e?.shiftKey) {
          setMultiSelected(prev => new Set([...prev, ...picked]))
        } else {
          setMultiSelected(picked)
        }
        if (picked.size > 0) onSelect([...picked][0])
      }
    }
    selBoxRef.current = null
    setSelectionBox(null)
  }, [anchorOverride, rotateOverride, dragOverride, resizeOverride, selectionBox, flatNodes, ccToSvg, onAnchorMove, onRotate, onMove, onResize, onSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  return { handleMouseDown, handleMouseMove, handleMouseUp }
}
