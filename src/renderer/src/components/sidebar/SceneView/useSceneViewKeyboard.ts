import { useEffect, useRef, useCallback } from 'react'
import type { SceneNode, ViewTransform, DragState, ResizeState, UndoEntry } from './types'
import { LABEL_COLORS, VB_KEY, type CameraBookmark } from './sceneViewConstants'

interface KeyboardDeps {
  nodeMap: Map<string, SceneNode>
  selectedUuid: string | null
  selectedUuids: Set<string>
  rootUuid: string | null
  isDragging: boolean
  isResizing: boolean
  spaceDown: boolean
  port: number
  view: ViewTransform
  viewRef: React.MutableRefObject<ViewTransform>
  viewHistoryRef: React.MutableRefObject<ViewTransform[]>
  viewHistIdxRef: React.MutableRefObject<number>
  dragRef: React.MutableRefObject<DragState | null>
  resizeRef: React.MutableRefObject<ResizeState | null>
  canvasSearchRef: React.MutableRefObject<HTMLInputElement | null>
  viewBookmarks: CameraBookmark[]
  viewBookmarkToastRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>

  // setters
  setActiveTool: (tool: 'select' | 'move') => void
  setSelectedUuid: (uuid: string | null) => void
  setSelectedUuids: (fn: (prev: Set<string>) => Set<string>) => void
  setSelectedUuidsReplace: (s: Set<string>) => void
  setView: (v: ViewTransform | ((prev: ViewTransform) => ViewTransform)) => void
  setShowStatsOverlay: (fn: (v: boolean) => boolean) => void
  setShowNodeInfo: (fn: (v: boolean) => boolean) => void
  setShowMinimap: (fn: (v: boolean) => boolean) => void
  setShowRuler: (fn: (v: boolean) => boolean) => void
  setShowCanvasSearch: (fn: (v: boolean) => boolean) => void
  setShowShortcuts: (fn: (v: boolean) => boolean) => void
  setSpaceDown: (v: boolean) => void
  setIsDragging: (v: boolean) => void
  setIsResizing: (v: boolean) => void
  setMarquee: (v: null) => void
  setUndoStack: (fn: (prev: UndoEntry[]) => UndoEntry[]) => void
  setRedoStack: (fn: (prev: UndoEntry[]) => UndoEntry[]) => void
  setBookmarkedUuids: (fn: (prev: Set<string>) => Set<string>) => void
  setFocusMode: (fn: (v: boolean) => boolean) => void
  setMeasureMode: (fn: (v: boolean) => boolean) => void
  setMeasureLine: (v: null) => void
  setCollapsedUuids: (fn: (prev: Set<string>) => Set<string>) => void
  setViewBookmarks: (fn: (prev: CameraBookmark[]) => CameraBookmark[]) => void
  setViewBookmarkToast: (v: string | null) => void

  // handlers
  handleFit: () => void
  handleFocusSelected: () => void
  handleCopy: () => void
  handlePaste: () => void
  handleDuplicate: () => void
  handleGroup: () => void
  handleUngroup: () => void
  handleCreateNode: () => void
  handleDeleteNode: () => void
  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
  measureStartRef: React.MutableRefObject<{ x: number; y: number } | null>
}

export function useSceneViewKeyboard(deps: KeyboardDeps): void {
  const {
    nodeMap, selectedUuid, selectedUuids, rootUuid, isDragging, isResizing,
    spaceDown, port, view, viewRef, viewHistoryRef, viewHistIdxRef,
    dragRef, resizeRef, canvasSearchRef, viewBookmarks, viewBookmarkToastRef,
    setActiveTool, setSelectedUuid, setSelectedUuids, setSelectedUuidsReplace, setView,
    setShowStatsOverlay, setShowNodeInfo, setShowMinimap, setShowRuler,
    setShowCanvasSearch, setShowShortcuts, setSpaceDown,
    setIsDragging, setIsResizing, setMarquee,
    setUndoStack, setRedoStack, setBookmarkedUuids,
    setFocusMode, setMeasureMode, setMeasureLine,
    setCollapsedUuids, setViewBookmarks, setViewBookmarkToast,
    handleFit, handleFocusSelected, handleCopy, handlePaste, handleDuplicate,
    handleGroup, handleUngroup, handleCreateNode, handleDeleteNode,
    updateNode, measureStartRef,
  } = deps

  // ── 주요 단축키 ────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ctrl+F: 씬 검색
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowCanvasSearch(v => !v)
        setTimeout(() => canvasSearchRef.current?.focus(), 50)
        return
      }
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'v' || e.key === 'V') setActiveTool('select')
      if (e.key === 'w' || e.key === 'W') setActiveTool('move')
      if (e.key === 'f' || e.key === 'F') {
        const arr = viewHistoryRef.current.slice(0, viewHistIdxRef.current + 1)
        viewHistoryRef.current = [...arr, viewRef.current].slice(-20)
        viewHistIdxRef.current = viewHistoryRef.current.length - 1
        handleFit()
      }
      if (e.key === 'g' || e.key === 'G') {
        const arr = viewHistoryRef.current.slice(0, viewHistIdxRef.current + 1)
        viewHistoryRef.current = [...arr, viewRef.current].slice(-20)
        viewHistIdxRef.current = viewHistoryRef.current.length - 1
        handleFocusSelected()
      }
      if ((e.key === 'i' || e.key === 'I') && !e.shiftKey) setShowStatsOverlay(v => !v)
      if (e.key === 'I' && e.shiftKey) setShowNodeInfo(v => !v)
      if ((e.key === 'p' || e.key === 'P') && selectedUuid) {
        const node = nodeMap.get(selectedUuid)
        if (node?.parentUuid) {
          setSelectedUuid(node.parentUuid)
          setSelectedUuidsReplace(new Set([node.parentUuid]))
        }
      }
      if (e.key === 'm' || e.key === 'M') setShowMinimap(v => !v)
      if (e.key === 'r' || e.key === 'R') setShowRuler(v => !v)
      if (e.key === 'n' || e.key === 'N') handleCreateNode()
      if ((e.key === 'h' || e.key === 'H') && (selectedUuids.size > 0 || selectedUuid)) {
        // 다중 선택 일괄 처리: anyVisible 기준으로 전체 토글
        const uuids = selectedUuids.size > 1 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
        const anyVisible = uuids.some(u => nodeMap.get(u)?.visible !== false)
        uuids.forEach(u => { const n = nodeMap.get(u); if (n) updateNode(u, { visible: !anyVisible }) })
      }
      if (e.key === 'Tab' && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node?.parentUuid) {
          const parent = nodeMap.get(node.parentUuid)
          if (parent && parent.childUuids.length > 1) {
            const idx = parent.childUuids.indexOf(selectedUuid)
            const next = e.shiftKey
              ? parent.childUuids[(idx - 1 + parent.childUuids.length) % parent.childUuids.length]
              : parent.childUuids[(idx + 1) % parent.childUuids.length]
            setSelectedUuid(next)
            setSelectedUuidsReplace(new Set([next]))
          }
        }
      }
      if (e.key === '?') setShowShortcuts(v => !v)
      if (e.key === 'Escape') {
        // 드래그 중 Escape: groupOffsets 기준 원위치 복원
        if (isDragging && dragRef.current) {
          const drag = dragRef.current
          if (drag.groupOffsets) {
            Object.entries(drag.groupOffsets).forEach(([u, { startX, startY }]) => {
              updateNode(u, { x: startX, y: startY })
            })
          } else {
            updateNode(drag.uuid, { x: drag.startNodeX, y: drag.startNodeY })
          }
          dragRef.current = null
          setIsDragging(false)
        // 리사이즈 중 Escape: rs.startWidth/Height 복원
        } else if (isResizing && resizeRef.current) {
          const rs = resizeRef.current
          updateNode(rs.uuid, { width: rs.startWidth, height: rs.startHeight, x: rs.startNodeX, y: rs.startNodeY })
          resizeRef.current = null
          setIsResizing(false)
        } else {
          setSelectedUuid(null)
          setSelectedUuidsReplace(new Set())
          setMarquee(null)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        setUndoStack(prev => {
          if (prev.length === 0) return prev
          const entry = prev[prev.length - 1]
          setRedoStack(r => [...r, entry])
          if (!entry.type || entry.type === 'move') {
            updateNode(entry.uuid, { x: entry.prevX, y: entry.prevY })
            window.api.ccSetProperty?.(port, entry.uuid, 'x', entry.prevX).catch(() => {})
            window.api.ccSetProperty?.(port, entry.uuid, 'y', entry.prevY).catch(() => {})
          } else {
            updateNode(entry.uuid, { [entry.key!]: entry.prevVal } as Partial<SceneNode>)
            window.api.ccSetProperty?.(port, entry.uuid, entry.key!, entry.prevVal).catch(() => {})
          }
          return prev.slice(0, -1)
        })
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        setRedoStack(prev => {
          if (prev.length === 0) return prev
          const entry = prev[prev.length - 1]
          setUndoStack(u => [...u, entry])
          if (!entry.type || entry.type === 'move') {
            updateNode(entry.uuid, { x: entry.nextX, y: entry.nextY })
            window.api.ccSetProperty?.(port, entry.uuid, 'x', entry.nextX).catch(() => {})
            window.api.ccSetProperty?.(port, entry.uuid, 'y', entry.nextY).catch(() => {})
          } else {
            updateNode(entry.uuid, { [entry.key!]: entry.nextVal } as Partial<SceneNode>)
            window.api.ccSetProperty?.(port, entry.uuid, entry.key!, entry.nextVal).catch(() => {})
          }
          return prev.slice(0, -1)
        })
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) { handleCopy(); e.preventDefault() }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) { handlePaste(); e.preventDefault() }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) { handleDuplicate(); e.preventDefault() }
      if (e.key === 'g' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { handleGroup(); e.preventDefault() }
      if (e.key === 'g' && (e.ctrlKey || e.metaKey) && e.shiftKey) { handleUngroup(); e.preventDefault() }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedUuid || selectedUuids.size > 0)) {
        e.preventDefault(); handleDeleteNode(); return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === ']' || e.key === '[') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node?.parentUuid) {
          const parent = nodeMap.get(node.parentUuid)
          if (parent && parent.childUuids.length > 1) {
            const idx = parent.childUuids.indexOf(selectedUuid)
            const newChildUuids = [...parent.childUuids]
            if (e.key === ']' && idx < newChildUuids.length - 1) {
              ;[newChildUuids[idx], newChildUuids[idx + 1]] = [newChildUuids[idx + 1], newChildUuids[idx]]
              updateNode(parent.uuid, { childUuids: newChildUuids })
            } else if (e.key === '[' && idx > 0) {
              ;[newChildUuids[idx], newChildUuids[idx - 1]] = [newChildUuids[idx - 1], newChildUuids[idx]]
              updateNode(parent.uuid, { childUuids: newChildUuids })
            }
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleFit, handleFocusSelected, updateNode, handleCopy, handlePaste, handleDuplicate, handleGroup, handleUngroup, selectedUuid, nodeMap, selectedUuids, isDragging, isResizing])

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

  // ── Ctrl+1~5 카메라 뷰 북마크 저장/이동 ──────────
  useEffect(() => {
    const handleViewBookmark = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      const key = parseInt(e.key)
      if (isNaN(key) || key < 1 || key > 5) return
      const idx = key - 1
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const bm = { zoom: viewRef.current.zoom, offsetX: viewRef.current.offsetX, offsetY: viewRef.current.offsetY }
        setViewBookmarks(prev => {
          const next = [...prev]
          while (next.length < 5) next.push(null)
          next[idx] = bm
          localStorage.setItem(VB_KEY, JSON.stringify(next))
          return next
        })
        if (viewBookmarkToastRef.current) clearTimeout(viewBookmarkToastRef.current)
        setViewBookmarkToast(`뷰 ${key} 저장됨`)
        viewBookmarkToastRef.current = setTimeout(() => setViewBookmarkToast(null), 1500)
      } else if (!e.shiftKey && !e.altKey) {
        const bm = viewBookmarks[idx]
        if (!bm) return
        e.preventDefault()
        const start = { ...viewRef.current }
        const startTime = Date.now()
        const DURATION = 200
        const animate = () => {
          const elapsed = Date.now() - startTime
          const t = Math.min(elapsed / DURATION, 1)
          const eased = t * (2 - t)
          setView({
            zoom: start.zoom + (bm.zoom - start.zoom) * eased,
            offsetX: start.offsetX + (bm.offsetX - start.offsetX) * eased,
            offsetY: start.offsetY + (bm.offsetY - start.offsetY) * eased,
          })
          if (t < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }
    window.addEventListener('keydown', handleViewBookmark)
    return () => window.removeEventListener('keydown', handleViewBookmark)
  }, [viewBookmarks])

  // ── Ctrl+A 전체 선택 / Ctrl+Shift+A 선택 반전 ─────────────
  useEffect(() => {
    const handleSelectAll = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault()
        const all = new Set(nodeMap.keys())
        setSelectedUuidsReplace(all)
        setSelectedUuid(rootUuid || null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.shiftKey) {
        e.preventDefault()
        const all = new Set(nodeMap.keys())
        const inverted = new Set([...all].filter(u => !selectedUuids.has(u)))
        setSelectedUuidsReplace(inverted)
        setSelectedUuid(inverted.size > 0 ? [...inverted][0] : null)
      }
    }
    window.addEventListener('keydown', handleSelectAll)
    return () => window.removeEventListener('keydown', handleSelectAll)
  }, [nodeMap, rootUuid, selectedUuids])

  // ── 방향키 nudge: 선택 노드 1px / Shift+10px 이동 ─────────
  useEffect(() => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    }
    const handleNudge = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault(); setFocusMode(v => !v); return
      }
      if (e.altKey && (e.key === '[' || e.key === ']') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node) {
          const delta = e.key === '[' ? -10 : 10
          updateNode(selectedUuid, { opacity: Math.min(255, Math.max(0, node.opacity + delta)) })
        }
        return
      }
      // Alt+0~9 색상 레이블 단축키: labelColor 즉시 갱신
      if (e.altKey && /^[0-9]$/.test(e.key) && selectedUuid) {
        e.preventDefault()
        updateNode(selectedUuid, { labelColor: LABEL_COLORS[e.key] })
        return
      }
      if (e.altKey && (e.key === 'l' || e.key === 'L') && (selectedUuids.size > 0 || selectedUuid)) {
        e.preventDefault()
        // 다중 선택 일괄 처리: anyUnlocked 기준 잠금 토글
        const uuids = selectedUuids.size > 1 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
        const anyUnlocked = uuids.some(u => !nodeMap.get(u)?.locked)
        uuids.forEach(u => { const n = nodeMap.get(u); if (n) updateNode(u, { locked: anyUnlocked }) })
        return
      }
      // 카메라 히스토리 네비게이션: Alt+←/→으로 viewHistoryRef 이동
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        if (viewHistIdxRef.current > 0) {
          viewHistIdxRef.current--
          setView(viewHistoryRef.current[viewHistIdxRef.current])
        }
        return
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        if (viewHistIdxRef.current < viewHistoryRef.current.length - 1) {
          viewHistIdxRef.current++
          setView(viewHistoryRef.current[viewHistIdxRef.current])
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && selectedUuid) {
        e.preventDefault()
        setBookmarkedUuids(prev => {
          const next = new Set(prev)
          if (next.has(selectedUuid)) next.delete(selectedUuid)
          else next.add(selectedUuid)
          return next
        })
        return
      }
      if ((e.altKey || e.shiftKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        setMeasureMode(v => !v)
        setMeasureLine(null)
        measureStartRef.current = null
        return
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (!node) return
        if (e.key === 'ArrowUp' && node.parentUuid) {
          setSelectedUuid(node.parentUuid)
          setSelectedUuidsReplace(new Set([node.parentUuid]))
        } else if (e.key === 'ArrowDown' && node.childUuids.length > 0) {
          const firstChild = node.childUuids[0]
          setSelectedUuid(firstChild)
          setSelectedUuidsReplace(new Set([firstChild]))
        }
        return
      }
      // Ctrl+← →: 회전 1° / Shift: 10° — rotStep과 node.rotation + delta 적용
      if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (!node) return
        const rotStep = e.shiftKey ? 10 : 1
        const delta = e.key === 'ArrowLeft' ? rotStep : -rotStep
        updateNode(selectedUuid, { rotation: parseFloat(((node.rotation + delta) % 360).toFixed(2)) })
        return
      }
      // 좌우/상하 반전: scaleX: -(node.scaleX) / scaleY: -(node.scaleY)
      if (e.altKey && (e.key === 'h' || e.key === 'H') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node) updateNode(selectedUuid, { scaleX: -(node.scaleX ?? 1) })
        return
      }
      if (e.altKey && (e.key === 'v' || e.key === 'V') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node) updateNode(selectedUuid, { scaleY: -(node.scaleY ?? 1) })
        return
      }
      if (!selectedUuid || !(e.key in arrows)) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const node = nodeMap.get(selectedUuid)
      if (!node) return
      const [dx, dy] = arrows[e.key]
      updateNode(selectedUuid, { x: node.x + dx * step, y: node.y + dy * step })
    }
    window.addEventListener('keydown', handleNudge)
    return () => window.removeEventListener('keydown', handleNudge)
  }, [selectedUuid, nodeMap, updateNode, setSelectedUuid, selectedUuids])
}
