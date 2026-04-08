import { useEffect, useRef } from 'react'
import type { FlatNode, ViewTransformCC } from './ccSceneTypes'

export interface CCSceneKeyboardDeps {
  svgRef: React.RefObject<SVGSVGElement>
  viewRef: React.MutableRefObject<ViewTransformCC>
  multiSelectedRef: React.MutableRefObject<Set<string>>
  clipboardNodeRef: React.MutableRefObject<string | null>
  selHistoryRef: React.MutableRefObject<string[]>
  selHistoryIdxRef: React.MutableRefObject<number>
  navSkipRef: React.MutableRefObject<boolean>
  hoverClientPosRef: React.MutableRefObject<{ x: number; y: number } | null>
  measureStartRef: React.MutableRefObject<{ svgX: number; svgY: number } | null>

  selectedUuid: string | null
  flatNodes: FlatNode[]
  effectiveW: number
  effectiveH: number
  designW: number
  designH: number
  viewBookmarks: (ViewTransformCC | null)[]

  handleFitToSelected: () => void
  handleFit: () => void
  toggleLock: (uuid: string) => void
  setView: (fn: ViewTransformCC | ((v: ViewTransformCC) => ViewTransformCC)) => void
  setViewBookmarks: (fn: (prev: (ViewTransformCC | null)[]) => (ViewTransformCC | null)[]) => void
  setShowSiblingGroup: (fn: (s: boolean) => boolean) => void
  setHiddenUuids: (fn: (prev: Set<string>) => Set<string>) => void
  setMeasureMode: (fn: (m: boolean) => boolean) => void
  setMeasureLine: (v: null) => void
  setPinMarkers: (fn: (prev: { id: number; ccX: number; ccY: number; label?: string }[]) => { id: number; ccX: number; ccY: number; label?: string }[]) => void
  pinIdRef: React.MutableRefObject<number>

  onSelect: (uuid: string | null) => void
  onMove?: (uuid: string, x: number, y: number) => void
  onMultiMove?: (moves: Array<{ uuid: string; x: number; y: number }>) => void
  onMultiDelete?: (uuids: string[]) => void
  onAddNode?: (parentUuid: string | null, pos?: { x: number; y: number }) => void
  onDuplicate?: (uuid: string) => void
  onToggleActive?: (uuid: string) => void
  onReorder?: (uuid: string, direction: 1 | -1) => void
  onGroupNodes?: (uuids: string[]) => void
  onMultiSelectChange?: (uuids: string[]) => void
}

/**
 * Keyboard shortcut handler for CCFileSceneView.
 * Extracted from the main component to reduce file size.
 */
export function useCCSceneKeyboard(deps: CCSceneKeyboardDeps) {
  const {
    svgRef, viewRef, multiSelectedRef, clipboardNodeRef,
    selHistoryRef, selHistoryIdxRef, navSkipRef,
    hoverClientPosRef, measureStartRef,
    selectedUuid, flatNodes, effectiveW, effectiveH, designW, designH, viewBookmarks,
    handleFitToSelected, handleFit, toggleLock,
    setView, setViewBookmarks, setShowSiblingGroup, setHiddenUuids,
    setMeasureMode, setMeasureLine, setPinMarkers, pinIdRef,
    onSelect, onMove, onMultiMove, onMultiDelete, onAddNode, onDuplicate,
    onToggleActive, onReorder, onGroupNodes, onMultiSelectChange,
  } = deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!svgRef.current || svgRef.current.getBoundingClientRect().width === 0) return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        handleFitToSelected()
        return
      }
      if (e.code === 'KeyF' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleFit()
        return
      }
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, 1], ArrowDown: [0, -1],
      }
      // Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const allUuids = flatNodes.map(fn => fn.node.uuid)
        if (allUuids.length > 0) {
          multiSelectedRef.current = new Set(allUuids)
          onSelect(allUuids[0])
          onMultiSelectChange?.(allUuids)
        }
        return
      }
      // Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        onAddNode?.(selectedUuid, undefined)
        return
      }
      // Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        if (selectedUuid) onDuplicate?.(selectedUuid)
        return
      }
      // Ctrl+G
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        const multi = multiSelectedRef.current
        if (multi.size >= 2 && onGroupNodes) {
          onGroupNodes(Array.from(multi))
        }
        return
      }
      // Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedUuid) {
        clipboardNodeRef.current = selectedUuid
        return
      }
      // Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardNodeRef.current) {
        onDuplicate?.(clipboardNodeRef.current)
        return
      }
      // Ctrl+[ / Ctrl+]
      if ((e.ctrlKey || e.metaKey) && e.key === '[' && selectedUuid) {
        e.preventDefault()
        onReorder?.(selectedUuid, -1)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ']' && selectedUuid) {
        e.preventDefault()
        onReorder?.(selectedUuid, 1)
        return
      }
      // L — lock toggle
      if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey && !e.shiftKey && selectedUuid) {
        e.preventDefault()
        toggleLock(selectedUuid)
        return
      }
      // +/= zoom in
      if (!e.ctrlKey && !e.metaKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setView(v => {
          const newZoom = Math.max(0.1, Math.min(5, v.zoom * 1.25))
          const svg = svgRef.current
          if (!svg) return { ...v, zoom: newZoom }
          const rect = svg.getBoundingClientRect()
          const cx = rect.width / 2
          const cy = rect.height / 2
          const scale = newZoom / v.zoom
          return { zoom: newZoom, offsetX: cx - (cx - v.offsetX) * scale, offsetY: cy - (cy - v.offsetY) * scale }
        })
        return
      }
      // - zoom out
      if (!e.ctrlKey && !e.metaKey && e.key === '-') {
        e.preventDefault()
        setView(v => {
          const newZoom = Math.max(0.1, Math.min(5, v.zoom / 1.25))
          const svg = svgRef.current
          if (!svg) return { ...v, zoom: newZoom }
          const rect = svg.getBoundingClientRect()
          const cx = rect.width / 2
          const cy = rect.height / 2
          const scale = newZoom / v.zoom
          return { zoom: newZoom, offsetX: cx - (cx - v.offsetX) * scale, offsetY: cy - (cy - v.offsetY) * scale }
        })
        return
      }
      // 0 — zoom reset
      if (!e.ctrlKey && !e.metaKey && e.key === '0' && !e.altKey) {
        e.preventDefault()
        const svg = svgRef.current
        if (svg) {
          const rect = svg.getBoundingClientRect()
          setView({ zoom: 1.0, offsetX: (rect.width - effectiveW) / 2, offsetY: (rect.height - effectiveH) / 2 })
        }
        return
      }
      // Ctrl+P — pin marker
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
        e.preventDefault()
        const svgEl = svgRef.current
        if (svgEl && hoverClientPosRef.current) {
          const rect = svgEl.getBoundingClientRect()
          const v = viewRef.current
          const svgX = (hoverClientPosRef.current.x - rect.left - v.offsetX) / v.zoom
          const svgY = (hoverClientPosRef.current.y - rect.top - v.offsetY) / v.zoom
          const ccX = Math.round(svgX - designW / 2)
          const ccY = Math.round(-(svgY - designH / 2))
          setPinMarkers(prev => [...prev, { id: ++pinIdRef.current, ccX, ccY }])
        }
        return
      }
      // P — parent focus
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (fn?.parentUuid) {
          const parentFn = flatNodes.find(f => f.node.uuid === fn.parentUuid)
          if (parentFn) onSelect(parentFn.node.uuid)
        }
        return
      }
      // Tab / Shift+Tab — sibling navigation
      if (e.code === 'Tab' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (fn?.parentUuid) {
          const parentFn = flatNodes.find(f => f.node.uuid === fn.parentUuid)
          if (parentFn) {
            const siblings = parentFn.node.children
            const idx = siblings.findIndex(c => c.uuid === selectedUuid)
            if (idx !== -1) {
              const nextIdx = e.shiftKey
                ? (idx - 1 + siblings.length) % siblings.length
                : (idx + 1) % siblings.length
              onSelect(siblings[nextIdx].uuid)
            }
          }
        }
        return
      }
      // Enter — first child
      if (e.code === 'Enter' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (fn && fn.node.children.length > 0) {
          e.preventDefault()
          onSelect(fn.node.children[0].uuid)
          return
        }
      }
      // G — sibling group
      if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setShowSiblingGroup(s => !s)
        return
      }
      // Alt+Arrow — selection history
      if (e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault()
        const hist = selHistoryRef.current
        const idx = selHistoryIdxRef.current
        if (e.code === 'ArrowLeft' && idx < hist.length - 1) {
          const newIdx = idx + 1
          selHistoryIdxRef.current = newIdx
          navSkipRef.current = true
          onSelect(hist[newIdx])
        } else if (e.code === 'ArrowRight' && idx > 0) {
          const newIdx = idx - 1
          selHistoryIdxRef.current = newIdx
          navSkipRef.current = true
          onSelect(hist[newIdx])
        }
        return
      }
      // 1/2/3 — view bookmarks
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code) && !e.altKey && !e.shiftKey) {
        const idx = parseInt(e.code.slice(-1)) - 1
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          setViewBookmarks(prev => { const n = [...prev]; n[idx] = viewRef.current; return n })
        } else {
          const bm = viewBookmarks[idx]
          if (bm) { e.preventDefault(); setView(bm) }
        }
        return
      }
      // H — toggle active
      if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.shiftKey && selectedUuid) {
        e.preventDefault()
        onToggleActive?.(selectedUuid)
        return
      }
      // Shift+H — visual hide toggle
      if (e.code === 'KeyH' && e.shiftKey && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        setHiddenUuids(prev => {
          const next = new Set(prev)
          if (next.has(selectedUuid)) next.delete(selectedUuid)
          else next.add(selectedUuid)
          return next
        })
        return
      }
      // M — measure toggle
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setMeasureMode(m => !m)
        setMeasureLine(null)
        measureStartRef.current = null
        return
      }
      // Escape — parent or deselect
      if (e.code === 'Escape' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (selectedUuid) {
          const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
          const parentUuid = fn?.parentUuid
          if (parentUuid) {
            onSelect(parentUuid)
            multiSelectedRef.current = new Set()
          } else {
            onSelect(null)
            multiSelectedRef.current = new Set()
            onMultiSelectChange?.([])
          }
        }
        return
      }
      // O — move to center
      if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        onMove?.(selectedUuid, 0, 0)
        return
      }
      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const multi = multiSelectedRef.current
        if (multi.size > 1) {
          e.preventDefault()
          onMultiDelete?.(Array.from(multi))
          return
        }
      }
      // Ctrl+Arrow — reorder
      if ((e.ctrlKey || e.metaKey) && (e.code === 'ArrowUp' || e.code === 'ArrowDown') && selectedUuid) {
        e.preventDefault()
        onReorder?.(selectedUuid, e.code === 'ArrowUp' ? 1 : -1)
        return
      }
      // Arrow keys — move selection
      if (e.code in arrows && selectedUuid) {
        if (e.ctrlKey || e.metaKey) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const [dx, dy] = arrows[e.code]
        const multi = multiSelectedRef.current
        if (multi.size > 1) {
          const moves = flatNodes
            .filter(fn => multi.has(fn.node.uuid))
            .map(fn => {
              const p = fn.node.position as { x: number; y: number }
              return { uuid: fn.node.uuid, x: p.x + dx * step, y: p.y + dy * step }
            })
          if (moves.length > 0) onMultiMove?.(moves)
        } else {
          const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
          if (!fn) return
          const pos = fn.node.position as { x: number; y: number }
          onMove?.(selectedUuid, pos.x + dx * step, pos.y + dy * step)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleFitToSelected, handleFit, selectedUuid, flatNodes, onMove, onMultiMove, onMultiDelete, onAddNode, onDuplicate, onToggleActive, onReorder, onGroupNodes, effectiveW, effectiveH])
}
