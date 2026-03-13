import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SceneNode, ViewTransform, DragState, ResizeState, MarqueeState, UndoEntry, ClipboardEntry } from './types'
import { useSceneSync } from './useSceneSync'
import { NodeRenderer } from './NodeRenderer'
import { SceneToolbar } from './SceneToolbar'
import type { SceneBgValue } from './SceneToolbar'
import { SceneInspector } from './SceneInspector'
import { getRenderOrder, cocosToSvg, getComponentIcon } from './utils'
import { NodeHierarchyList } from './NodeHierarchyList'

interface Annotation { id: string; svgX: number; svgY: number; text: string }
type SnapshotEntry = { uuid: string; x: number; y: number; width: number; height: number }

interface SceneViewPanelProps {
  connected: boolean
  wsKey: string
  port?: number
}


const CC_LAYER_NAMES: Record<number, string> = {
  1: 'DEFAULT', 2: 'UI_3D', 4: 'GIZMOS', 8: 'EDITOR',
  16: 'UI_2D', 32: 'SCENE_GIZMO', 64: 'PROFILER',
}

function getRulerTicks(
  axis: 'h' | 'v',
  svgSize: number,
  view: { zoom: number; offsetX: number; offsetY: number }
): { pos: number; label: string | null; isMajor: boolean }[] {
  const ticks: { pos: number; label: string | null; isMajor: boolean }[] = []
  const rawStep = 50 / view.zoom
  const step = Math.pow(10, Math.round(Math.log10(rawStep)))
  const offset = axis === 'h' ? view.offsetX : view.offsetY
  const startScene = -offset / view.zoom
  const endScene = (svgSize - offset) / view.zoom
  const start = Math.floor(startScene / step) * step
  for (let s = start; s <= endScene; s += step) {
    const pos = s * view.zoom + offset
    if (pos < 0 || pos > svgSize) continue
    ticks.push({ pos, label: String(Math.round(s)), isMajor: true })
    for (let i = 1; i < 5; i++) {
      const subPos = pos + (i / 5) * step * view.zoom
      if (subPos >= 0 && subPos <= svgSize) {
        ticks.push({ pos: subPos, label: null, isMajor: false })
      }
    }
  }
  return ticks
}

const CANVAS_PRESETS = [
  { label: '960×640 (기본)', w: 960, h: 640 },
  { label: '1280×720 (HD)', w: 1280, h: 720 },
  { label: '1920×1080 (FHD)', w: 1920, h: 1080 },
  { label: '750×1334 (iPhone)', w: 750, h: 1334 },
  { label: '1334×750 (iPhone 가로)', w: 1334, h: 750 },
  { label: '480×320 (소형)', w: 480, h: 320 },
]

export function SceneViewPanel({ connected, port = 9091 }: SceneViewPanelProps) {
  // ── 씬 데이터 ──────────────────────────────────────────────
  const { nodeMap, rootUuid, loading, refresh, refreshNode, updateNode } = useSceneSync(connected, port)

  // ── 뷰 상태 ────────────────────────────────────────────────
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 1 })
  const [activeTool, setActiveTool] = useState<'select' | 'move'>('select')
  const [showRuler, setShowRuler] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 640 })
  const DESIGN_W = canvasSize.w
  const DESIGN_H = canvasSize.h
  const [gridVisible, setGridVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [snapGrid, setSnapGrid] = useState(4)
  const [showHierarchy, setShowHierarchy] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isPanningActive, setIsPanningActive] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [cursorScenePos, setCursorScenePos] = useState<{ x: number; y: number } | null>(null)
  const [hoverTooltipPos, setHoverTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [tooltipVisibleUuid, setTooltipVisibleUuid] = useState<string | null>(null)
  const tooltipDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [inspectorNameFocus, setInspectorNameFocus] = useState(0)
  const [showMinimap, setShowMinimap] = useState(true)
  const [svgContextMenu, setSvgContextMenu] = useState<{ uuid: string | null; x: number; y: number } | null>(null)
  const [sceneBg, setSceneBg] = useState<SceneBgValue>(() => {
    return (localStorage.getItem('scene-bg') as SceneBgValue) ?? 'dark'
  })
  const [alignGuides, setAlignGuides] = useState<{ x?: number; y?: number }[]>([])
  const [showConnections, setShowConnections] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showNodeInfo, setShowNodeInfo] = useState(false)
  const [showChangeHistory, setShowChangeHistory] = useState(false)
  const [componentFilter, setComponentFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [flashUuid, setFlashUuid] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [collapsedUuids, setCollapsedUuids] = useState<Set<string>>(new Set())
  const [focusMode, setFocusMode] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [refImageUrl, setRefImageUrl] = useState('')
  const [bookmarkedUuids, setBookmarkedUuids] = useState<Set<string>>(new Set())
  const [showBookmarkList, setShowBookmarkList] = useState(false)
  const [pinnedUuids, setPinnedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-pinned') ?? '[]')) }
    catch { return new Set() }
  })
  const [lockedUuids, setLockedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-locked') ?? '[]')) }
    catch { return new Set() }
  })
  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('node-colors') ?? '{}') } catch { return {} }
  })
  const viewHistoryRef = useRef<ViewTransform[]>([])
  const viewHistIdxRef = useRef(-1)
  const viewRef = useRef(view)
  viewRef.current = view
  const targetViewRef = useRef<{ zoom: number; offsetX: number; offsetY: number } | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const nodeMapInitRef = useRef(false)
  const [refImageOpacity, setRefImageOpacity] = useState(0.3)
  const [showRefImagePanel, setShowRefImagePanel] = useState(false)
  const [measureLine, setMeasureLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const measureStartRef = useRef<{ x: number; y: number } | null>(null)
  const [nodeEditDraft, setNodeEditDraft] = useState<{ x: string; y: string; w: string; h: string; r: string } | null>(null)
  const [changeHistory, setChangeHistory] = useState<Array<{ uuid: string; name: string; x: number; y: number; ts: number }>>([])
  const changeHistoryRef = useRef<Array<{ uuid: string; name: string; x: number; y: number; ts: number }>>([])
  changeHistoryRef.current = changeHistory
  const [canvasSearch, setCanvasSearch] = useState('')
  const [showCanvasSearch, setShowCanvasSearch] = useState(false)
  const [nodeSearch, setNodeSearch] = useState('')
  const [showNodeSearch, setShowNodeSearch] = useState(false)
  const [nodeSearchMatchIndex, setNodeSearchMatchIndex] = useState(0)
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set())
  const [showAllToggle, setShowAllToggle] = useState(true)
  const [lockedLayers, setLockedLayers] = useState<Set<string>>(new Set())
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const canvasSearchRef = useRef<HTMLInputElement>(null)

  // ── 스냅샷 / diff 상태 ─────────────────────────────────────
  const [snapshot, setSnapshot] = useState<Map<string, SnapshotEntry> | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  // ── 스냅샷 기록 상태 ────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<Array<{ label: string; timestamp: number; nodes: unknown[] }>>([])
  const [snapshotOpen, setSnapshotOpen] = useState(false)

  // ── 히트맵 상태 ────────────────────────────────────────────
  const [showHeatmap, setShowHeatmap] = useState(false)
  // ── 노드 접근 빈도 히트맵 (R702) ───────────────────────────
  const [nodeAccessCount, setNodeAccessCount] = useState<Record<string, number>>({})
  // ── 노드 그룹 색상 (R709) ──────────────────────────────────
  const [nodeGroupColors, setNodeGroupColors] = useState<Record<string, string>>({})
  const [colorPickerNode, setColorPickerNode] = useState<string | null>(null)
  // ── 노드 메모 (R716) ──────────────────────────────────────────
  const [nodeMemos, setNodeMemos] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('node-memos') ?? '{}'))
  const [editingNodeMemo, setEditingNodeMemo] = useState<string | null>(null)
  // ── 노드 링크 (R721) ──────────────────────────────────────────
  const [nodeLinks, setNodeLinks] = useState<Record<string, string[]>>({})
  const [showNodeLinks, setShowNodeLinks] = useState(false)
  // ── 노드 배지 (R725) ──────────────────────────────────────────
  const [nodeBadges, setNodeBadges] = useState<Record<string, string>>({})
  const [badgeEditNode, setBadgeEditNode] = useState<string | null>(null)
  // ── 씬 히스토리 (R730) ──────────────────────────────────────────
  const [sceneHistory, setSceneHistory] = useState<string[]>([])
  const [showSceneHistory, setShowSceneHistory] = useState(false)
  // ── 즐겨찾기 씬 (R736) ──────────────────────────────────────────
  const [favoriteScenes, setFavoriteScenes] = useState<string[]>(() => JSON.parse(localStorage.getItem('fav-scenes') ?? '[]'))
  const [showFavScenes, setShowFavScenes] = useState(false)

  // ── 퀵 액션 패널 상태 ──────────────────────────────────────
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [quickActionDismissed, setQuickActionDismissed] = useState(false)

  // ── 애니메이션 미리보기 상태 ────────────────────────────────
  const [animPreview, setAnimPreview] = useState(false)
  const [animFrame, setAnimFrame] = useState(0)
  const [nodeTags, setNodeTags] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('node-tags') ?? '{}') } catch { return {} }
  })
  const [nodeTagInput, setNodeTagInput] = useState<string | null>(null)
  const [nodeTagDraft, setNodeTagDraft] = useState('')
  const animPreviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleTakeSnapshot = useCallback(() => {
    const snap = new Map<string, SnapshotEntry>()
    nodeMap.forEach((n, uuid) => {
      snap.set(uuid, { uuid, x: n.worldX ?? n.x, y: n.worldY ?? n.y, width: n.width, height: n.height })
    })
    setSnapshot(snap)
    setShowDiff(true)
  }, [nodeMap])

  const takeSnapshot = useCallback(() => {
    const nodes = [...nodeMap.values()] as unknown[]
    const ts = Date.now()
    const label = `스냅샷 ${new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    setSnapshots(prev => {
      const next = [{ label, timestamp: ts, nodes }, ...prev]
      return next.slice(0, 5)
    })
  }, [nodeMap])

  // ── 히트맵 밀도 계산 ───────────────────────────────────────
  function buildHeatmap(nodes: SceneNode[], cellSize: number): Map<string, number> {
    const map = new Map<string, number>()
    for (const node of nodes) {
      const key = `${Math.floor(node.x / cellSize)},${Math.floor(node.y / cellSize)}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }

  // ── 주석 (Annotation) 상태 ─────────────────────────────────
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    try { return JSON.parse(localStorage.getItem('sceneview-annotations') ?? '[]') } catch { return [] }
  })
  const [editingAnnotId, setEditingAnnotId] = useState<string | null>(null)

  // ── 선택 / 호버 상태 ───────────────────────────────────────
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set())
  const [hoveredUuid, setHoveredUuid] = useState<string | null>(null)
  // ── 다중 선택 그룹화 상태 (R655) ───────────────────────────
  const multiSelected = selectedUuids
  const [showGroupBtn, setShowGroupBtn] = useState(false)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([])
  const [clipboard, setClipboard] = useState<ClipboardEntry[]>([])
  const [copiedNode, setCopiedNode] = useState<SceneNode | null>(null)

  // ── 마퀴 선택 상태 ─────────────────────────────────────────
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const marqueeRef = useRef<{ startX: number; startY: number; shiftKey: boolean } | null>(null)

  // ── 드래그 상태 ────────────────────────────────────────────
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const rotateRef = useRef<{ uuid: string; anchorSx: number; anchorSy: number; startRotation: number } | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // ── SVG ref ────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Fit to view ────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFit = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const padding = 20

    // 활성 노드 bounding box 계산
    const activeNodes = [...nodeMap.values()].filter(n => n.active && (n.width > 0 || n.height > 0))
    if (activeNodes.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      activeNodes.forEach(n => {
        const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
        const pw = Math.max(n.width * Math.abs(n.scaleX), 1)
        const ph = Math.max(n.height * Math.abs(n.scaleY), 1)
        const rx = sx - pw * n.anchorX
        const ry = sy - ph * (1 - n.anchorY)
        minX = Math.min(minX, rx); minY = Math.min(minY, ry)
        maxX = Math.max(maxX, rx + pw); maxY = Math.max(maxY, ry + ph)
      })
      const bboxW = Math.max(maxX - minX, 40)
      const bboxH = Math.max(maxY - minY, 40)
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const targetZoom = Math.min(
        (width - padding * 2) / bboxW,
        (height - padding * 2) / bboxH,
        4
      )
      setView({
        offsetX: width / 2 - centerX * targetZoom,
        offsetY: height / 2 - centerY * targetZoom,
        zoom: targetZoom,
      })
      return
    }

    // fallback: 캔버스 기준
    const zoomX = (width - padding * 2) / DESIGN_W
    const zoomY = (height - padding * 2) / DESIGN_H
    const zoom = Math.min(zoomX, zoomY, 2)
    const offsetX = (width - DESIGN_W * zoom) / 2
    const offsetY = (height - DESIGN_H * zoom) / 2
    setView({ offsetX, offsetY, zoom })
  }, [canvasSize, nodeMap])

  // 줌 프리셋: 캔버스 중심 기준으로 지정 zoom 적용 (animateToTarget보다 먼저 정의되므로 ref 경유)
  const handleZoomTo = useCallback((zoom: number) => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const offsetX = width / 2 - (DESIGN_W / 2) * zoom
    const offsetY = height / 2 - (DESIGN_H / 2) * zoom
    setView({ zoom, offsetX, offsetY })
  }, [DESIGN_W, DESIGN_H])

  // 선택 노드로 카메라 이동 (G키) — 멀티셀렉트 bounding box 줌 지원
  const handleFocusSelected = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const padding = 60
    // 선택 노드 목록 (멀티셀렉트 우선)
    const uuids = selectedUuids.size > 1 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
    if (uuids.length === 0) { handleFit(); return }
    const nodes = uuids.map(u => nodeMap.get(u)).filter(Boolean) as SceneNode[]
    if (nodes.length === 0) { handleFit(); return }
    // 선택 노드들의 scene 좌표 bounding box 계산
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(n => {
      const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
      const pw = n.width * Math.abs(n.scaleX)
      const ph = n.height * Math.abs(n.scaleY)
      const rx = sx - pw * n.anchorX
      const ry = sy - ph * (1 - n.anchorY)
      minX = Math.min(minX, rx); minY = Math.min(minY, ry)
      maxX = Math.max(maxX, rx + pw); maxY = Math.max(maxY, ry + ph)
    })
    const bboxW = Math.max(maxX - minX, 40)
    const bboxH = Math.max(maxY - minY, 40)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const targetZoom = Math.min(
      (width - padding * 2) / bboxW,
      (height - padding * 2) / bboxH,
      4
    )
    setView({
      offsetX: width / 2 - centerX * targetZoom,
      offsetY: height / 2 - centerY * targetZoom,
      zoom: targetZoom,
    })
  }, [selectedUuid, selectedUuids, nodeMap, handleFit, canvasSize])

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
    if (copied.length > 0) {
      setClipboard(copied)
      const primaryUuid = [...uuids][0]
      const primaryNode = primaryUuid ? nodeMap.get(primaryUuid) ?? null : null
      setCopiedNode(primaryNode)
    }
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
      if (copiedNode) {
        console.log(`copy paste: ${copiedNode.name}`)
      } else if (clipboard.length > 0) {
        console.log(`copy paste: ${clipboard[0].name}`)
      }
    }
  }, [clipboard, copiedNode, nodeMap, updateNode])

  // ── 복제 (Ctrl+D): clipboard 변경 없이 직접 노드 복제 ─────
  // ── 그룹화 (Ctrl+G): 선택 노드들을 새 Group 노드 아래로 묶기 ─
  const handleGroup = useCallback(() => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(u => nodeMap.get(u)).filter(Boolean) as import('./types').SceneNode[]
    if (nodes.length < 2) return
    // 공통 부모 찾기 (모두 같은 부모면 해당 부모, 아니면 root)
    const parentUuids = new Set(nodes.map(n => n.parentUuid))
    const commonParentUuid = parentUuids.size === 1 ? [...parentUuids][0] : rootUuid
    if (!commonParentUuid) return
    const parent = nodeMap.get(commonParentUuid)
    if (!parent) return
    // bbox 중심 계산
    const xs = nodes.map(n => n.x ?? 0)
    const ys = nodes.map(n => n.y ?? 0)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const groupUuid = 'group-' + Date.now()
    const childUuids = nodes.map(n => n.uuid)
    // 신규 Group 노드 삽입
    updateNode(groupUuid, {
      uuid: groupUuid, name: 'Group', active: true,
      x: cx, y: cy, width: 0, height: 0,
      anchorX: 0.5, anchorY: 0.5, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1,
      color: { r: 255, g: 255, b: 255, a: 255 },
      parentUuid: commonParentUuid, childUuids,
      components: [],
    })
    // 부모의 childUuids 업데이트: 선택 노드 제거 + 그룹 추가
    const newParentChildren = parent.childUuids
      .filter(u => !selectedUuids.has(u))
      .concat(groupUuid)
    updateNode(commonParentUuid, { childUuids: newParentChildren })
    // 각 선택 노드의 parentUuid 업데이트
    nodes.forEach(n => updateNode(n.uuid, { parentUuid: groupUuid }))
    // 그룹 노드 선택
    setSelectedUuid(groupUuid)
    setSelectedUuids(new Set([groupUuid]))
  }, [selectedUuids, nodeMap, rootUuid, updateNode])

  // ── 그룹 해제 (Ctrl+Shift+G): 선택 그룹 노드의 자식을 상위 레벨로 올리기 ─
  const handleUngroup = useCallback(() => {
    if (!selectedUuid) return
    const group = nodeMap.get(selectedUuid)
    if (!group || group.childUuids.length === 0) return
    const grandParentUuid = group.parentUuid
    if (!grandParentUuid) return
    const grandParent = nodeMap.get(grandParentUuid)
    if (!grandParent) return
    // 그랜드 부모의 childUuids: 그룹 노드를 제거하고 자식들로 대체
    const newGrandChildren = grandParent.childUuids
      .filter(u => u !== selectedUuid)
      .concat(group.childUuids)
    updateNode(grandParentUuid, { childUuids: newGrandChildren })
    // 각 자식의 parentUuid를 grandParent로 업데이트
    group.childUuids.forEach(u => updateNode(u, { parentUuid: grandParentUuid }))
    // 그룹 노드 제거 (빈 노드로 만들고 선택 해제)
    updateNode(selectedUuid, { active: false, childUuids: [] })
    setSelectedUuids(new Set(group.childUuids))
    setSelectedUuid(group.childUuids[0] ?? null)
  }, [selectedUuid, nodeMap, updateNode])

  const handleDuplicate = useCallback(() => {
    const uuids = selectedUuids.size > 0 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
    const baseTs = Date.now()
    uuids.forEach((uuid, i) => {
      const orig = nodeMap.get(uuid)
      if (!orig) return
      const dupId = orig.uuid + '-dup-' + (baseTs + i)
      updateNode(dupId, {
        ...orig,
        uuid: dupId,
        name: orig.name + '_Copy',
        x: (orig.x ?? 0) + 20,
        y: (orig.y ?? 0) + 20,
      })
    })
  }, [selectedUuids, selectedUuid, nodeMap, updateNode])

  // ── 단축키 ────────────────────────────────────────────────
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
      if (e.key === 'i' || e.key === 'I') setShowNodeInfo(v => !v)
      // P — 부모 노드 선택
      if ((e.key === 'p' || e.key === 'P') && selectedUuid) {
        const node = nodeMap.get(selectedUuid)
        if (node?.parentUuid) {
          setSelectedUuid(node.parentUuid)
          setSelectedUuids(new Set([node.parentUuid]))
        }
      }
      if (e.key === 'm' || e.key === 'M') setShowMinimap(v => !v)
      if (e.key === 'r' || e.key === 'R') setShowRuler(v => !v)
      if (e.key === 'n' || e.key === 'N') handleCreateNode()
      // H — 선택 노드 가시성 토글
      if ((e.key === 'h' || e.key === 'H') && (selectedUuids.size > 0 || selectedUuid)) {
        const uuids = selectedUuids.size > 1 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
        const anyVisible = uuids.some(u => nodeMap.get(u)?.visible !== false)
        uuids.forEach(u => { const n = nodeMap.get(u); if (n) updateNode(u, { visible: !anyVisible }) })
      }
      // Tab / Shift+Tab: 형제 노드 순환 선택
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
            setSelectedUuids(new Set([next]))
          }
        }
      }
      if (e.key === '?') setShowShortcuts(v => !v)
      if (e.key === 'Escape') {
        if (isDragging && dragRef.current) {
          // 드래그 중 Escape → 원래 위치로 복원 (드래그 취소)
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
        } else if (isResizing && resizeRef.current) {
          // 리사이즈 중 Escape → 원래 크기/위치로 복원 (리사이즈 취소)
          const rs = resizeRef.current
          updateNode(rs.uuid, { width: rs.startWidth, height: rs.startHeight, x: rs.startNodeX, y: rs.startNodeY })
          resizeRef.current = null
          setIsResizing(false)
        } else {
          setSelectedUuid(null)
          setSelectedUuids(new Set())
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
      if (e.key === 'g' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        handleGroup()
        e.preventDefault()
      }
      // Ctrl+Shift+G — 그룹 해제
      if (e.key === 'g' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        handleUngroup()
        e.preventDefault()
      }
      // Delete / Backspace — 선택 노드 삭제
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedUuid || selectedUuids.size > 0)) {
        e.preventDefault()
        handleDeleteNode()
        return
      }
      // Ctrl+] / Ctrl+[: z-order 변경 (앞으로/뒤로)
      if ((e.ctrlKey || e.metaKey) && (e.key === ']' || e.key === '[') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node?.parentUuid) {
          const parent = nodeMap.get(node.parentUuid)
          if (parent && parent.childUuids.length > 1) {
            const idx = parent.childUuids.indexOf(selectedUuid)
            const newChildUuids = [...parent.childUuids]
            if (e.key === ']' && idx < newChildUuids.length - 1) {
              // 앞으로 (위로): idx+1과 교환
              ;[newChildUuids[idx], newChildUuids[idx + 1]] = [newChildUuids[idx + 1], newChildUuids[idx]]
              updateNode(parent.uuid, { childUuids: newChildUuids })
            } else if (e.key === '[' && idx > 0) {
              // 뒤로 (아래로): idx-1과 교환
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

  // ── Ctrl+A 전체 선택 / Ctrl+Shift+A 선택 반전 ─────────────
  useEffect(() => {
    const handleSelectAll = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault()
        const all = new Set(nodeMap.keys())
        setSelectedUuids(all)
        setSelectedUuid(rootUuid || null)
      }
      // Ctrl+Shift+A — 선택 반전
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.shiftKey) {
        e.preventDefault()
        const all = new Set(nodeMap.keys())
        const inverted = new Set([...all].filter(u => !selectedUuids.has(u)))
        setSelectedUuids(inverted)
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
      // Alt+Up: 부모 선택, Alt+Down: 첫 자식 선택
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        setFocusMode(v => !v)
        return
      }
      // Alt+[ / Alt+] — 선택 노드 투명도 -10 / +10 (0~255)
      if (e.altKey && (e.key === '[' || e.key === ']') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (node) {
          const delta = e.key === '[' ? -10 : 10
          updateNode(selectedUuid, { opacity: Math.min(255, Math.max(0, node.opacity + delta)) })
        }
        return
      }
      // Alt+0~9 — 빠른 색상 레이블 (Alt+0: 초기화)
      if (e.altKey && /^[0-9]$/.test(e.key) && selectedUuid) {
        e.preventDefault()
        const LABEL_COLORS: Record<string, string | undefined> = {
          '0': undefined,
          '1': '#f87171', '2': '#fb923c', '3': '#facc15', '4': '#4ade80',
          '5': '#34d399', '6': '#60a5fa', '7': '#a78bfa', '8': '#f472b6', '9': '#9ca3af',
        }
        updateNode(selectedUuid, { labelColor: LABEL_COLORS[e.key] })
        return
      }
      // Alt+L — 노드 잠금/해제 (다중 선택 일괄 처리)
      if (e.altKey && (e.key === 'l' || e.key === 'L') && (selectedUuids.size > 0 || selectedUuid)) {
        e.preventDefault()
        const uuids = selectedUuids.size > 1 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
        const anyUnlocked = uuids.some(u => !nodeMap.get(u)?.locked)
        uuids.forEach(u => { const n = nodeMap.get(u); if (n) updateNode(u, { locked: anyUnlocked }) })
        return
      }
      // Alt+← / Alt+→ — 카메라 히스토리 뒤로/앞으로
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
      // Ctrl+B — 즐겨찾기 토글
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
          setSelectedUuids(new Set([node.parentUuid]))
        } else if (e.key === 'ArrowDown' && node.childUuids.length > 0) {
          const firstChild = node.childUuids[0]
          setSelectedUuid(firstChild)
          setSelectedUuids(new Set([firstChild]))
        }
        return
      }
      // Ctrl+← →: 회전 (1° / Shift+10°)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedUuid) {
        e.preventDefault()
        const node = nodeMap.get(selectedUuid)
        if (!node) return
        const rotStep = e.shiftKey ? 10 : 1
        const delta = e.key === 'ArrowLeft' ? rotStep : -rotStep
        updateNode(selectedUuid, { rotation: parseFloat(((node.rotation + delta) % 360).toFixed(2)) })
        return
      }
      // Alt+H / Alt+V: 좌우/상하 반전 (scaleX/scaleY 부호 반전)
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
  }, [selectedUuid, nodeMap, updateNode, setSelectedUuid, setSelectedUuids, selectedUuids])

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

  // 퀵 액션: 선택 노드가 바뀌면 dismiss 해제
  useEffect(() => {
    setQuickActionDismissed(false)
  }, [selectedUuid])

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
  }, [view, canvasSize])

  // ── 마우스 이벤트 ─────────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    // 측정 모드 — 클릭으로 측정 시작
    if (measureMode && e.button === 0) {
      const svgPos = getSvgCoords(e)
      measureStartRef.current = { x: svgPos.x, y: svgPos.y }
      setMeasureLine({ x1: svgPos.x, y1: svgPos.y, x2: svgPos.x, y2: svgPos.y })
      return
    }
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
      marqueeRef.current = { startX: svgCoords.x, startY: svgCoords.y, shiftKey: e.shiftKey }
      setMarquee({ startX: svgCoords.x, startY: svgCoords.y, endX: svgCoords.x, endY: svgCoords.y, active: true })
    } else if (e.button === 0) {
      setSelectedUuid(null)
      setSelectedUuids(new Set())
    }
  }, [activeTool, view, getSvgCoords, canvasSize])

  const togglePin = useCallback((uuid: string) => {
    setPinnedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('scene-pinned', JSON.stringify([...next]))
      return next
    })
  }, [])

  const toggleLocked = useCallback((uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('scene-locked', JSON.stringify([...next]))
      return next
    })
  }, [])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    // 잠긴 노드는 드래그/선택 불가
    if (nodeMap.get(uuid)?.locked) return
    if (lockedUuids.has(uuid)) return
    // 핀된 노드는 드래그/선택 불가
    if (pinnedUuids.has(uuid)) return

    if (e.altKey) {
      // Alt 클릭: 자식 그룹 접기/펼치기
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

    // 접근 횟수 누적 (R702)
    setNodeAccessCount(prev => ({ ...prev, [uuid]: (prev[uuid] ?? 0) + 1 }))

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
  }, [nodeMap, getSvgCoords, selectedUuids, canvasSize, pinnedUuids, lockedUuids])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, uuid: string, handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w') => {
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
  }, [nodeMap, getSvgCoords, canvasSize])

  const handleRotateMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return
    const node = nodeMap.get(uuid)
    if (!node) return
    const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)
    // anchor 점의 SVG 화면 좌표
    const anchorSx = sx * view.zoom + view.offsetX
    const anchorSy = sy * view.zoom + view.offsetY
    rotateRef.current = { uuid, anchorSx, anchorSy, startRotation: node.rotation }
    setIsRotating(true)
  }, [nodeMap, view])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 커서 씬 좌표 업데이트
    const svgPos = getSvgCoords(e)
    const { cx, cy } = svgToScene(svgPos.x, svgPos.y)
    setCursorScenePos({ x: Math.round(cx), y: Math.round(cy) })

    // 측정 모드 드래그
    if (measureMode && measureStartRef.current && e.buttons === 1) {
      setMeasureLine({ x1: measureStartRef.current.x, y1: measureStartRef.current.y, x2: svgPos.x, y2: svgPos.y })
      return
    }

    // 호버 툴팁 위치 (마우스 커서 우하단 +10, +10)
    setHoverTooltipPos({ x: svgPos.x + 10, y: svgPos.y + 10 })

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

    // 회전
    if (rotateRef.current) {
      const rt = rotateRef.current
      const dx = e.clientX - rt.anchorSx
      const dy = e.clientY - rt.anchorSy
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
      // SVG Y-down이므로 Cocos rotation = -angleDeg - 90 (핸들이 위쪽에 있으므로)
      const newRotation = parseFloat((-angleDeg - 90).toFixed(1))
      updateNode(rt.uuid, { rotation: newRotation })
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
      // 측면 핸들: 단일 축만 변경
      else if (rs.handle === 'e') { newW = rs.startWidth + dsceneX }
      else if (rs.handle === 'w') { newW = rs.startWidth - dsceneX }
      else if (rs.handle === 's') { newH = rs.startHeight - dsceneY }
      else if (rs.handle === 'n') { newH = rs.startHeight + dsceneY }

      // Shift: 비례 리사이즈 — 코너 핸들에서만 적용
      if (e.shiftKey && ['nw', 'ne', 'se', 'sw'].includes(rs.handle) && rs.startHeight > 0) {
        const aspect = rs.startWidth / rs.startHeight
        if (Math.abs(newW - rs.startWidth) >= Math.abs(newH - rs.startHeight) * aspect) {
          newH = newW / aspect
        } else {
          newW = newH * aspect
        }
      }

      newW = Math.max(4, newW)
      newH = Math.max(4, newH)
      // 측면 핸들은 해당 축만 위치 조정
      const newX = (rs.handle === 'n' || rs.handle === 's') ? rs.startNodeX : rs.startNodeX + dsceneX / 2
      const newY = (rs.handle === 'e' || rs.handle === 'w') ? rs.startNodeY : rs.startNodeY + dsceneY / 2

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
      setDragDelta({ dx: Math.round(dSceneX), dy: Math.round(dSceneY) })

      // 스냅 (Alt 홀드 시 일시 비활성화)
      if (snapEnabled && !e.altKey) {
        newX = Math.round(newX / snapGrid) * snapGrid
        newY = Math.round(newY / snapGrid) * snapGrid
      }

      // 정렬 가이드라인 계산 (드래그 중 타 노드와 정렬 감지)
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
            for (const nx2 of nXs) {
              for (const mx of myXs) {
                if (Math.abs(nx2 - mx) < threshold) {
                  guides.push({ x: nx2 })
                  if (snapEnabled) newX = nx2 - (mx - newX)
                }
              }
            }
            for (const ny2 of nYs) {
              for (const my of myYs) {
                if (Math.abs(ny2 - my) < threshold) {
                  guides.push({ y: ny2 })
                  if (snapEnabled) newY = ny2 - (my - newY)
                }
              }
            }
          })
        }
        setAlignGuides(guides)
      }

      if (drag.groupOffsets) {
        // 그룹 드래그: 모든 선택 노드를 같은 델타만큼 이동
        for (const [uid, { startX, startY }] of Object.entries(drag.groupOffsets)) {
          let nx = startX + dSceneX
          let ny = startY + dSceneY
          if (snapEnabled && !e.altKey) {
            nx = Math.round(nx / snapGrid) * snapGrid
            ny = Math.round(ny / snapGrid) * snapGrid
          }
          updateNode(uid, { x: nx, y: ny })
        }
      } else {
        // 낙관적 업데이트 (즉시 반영)
        updateNode(drag.uuid, { x: newX, y: newY })
      }
    }
  }, [view.zoom, snapEnabled, snapGrid, getSvgCoords, svgToScene, updateNode, nodeMap, selectedUuids, canvasSize, measureMode])

  const handleMouseUp = useCallback(async () => {
    setAlignGuides([])
    // 마퀴 종료 → 히트 테스트
    if (marqueeRef.current && marquee) {
      const wasShift = marqueeRef.current.shiftKey
      marqueeRef.current = null
      const mx1 = Math.min(marquee.startX, marquee.endX)
      const my1 = Math.min(marquee.startY, marquee.endY)
      const mx2 = Math.max(marquee.startX, marquee.endX)
      const my2 = Math.max(marquee.startY, marquee.endY)

      // 마퀴가 충분히 크면 노드 히트 테스트
      if (mx2 - mx1 > 4 || my2 - my1 > 4) {
        const hit = new Set<string>()
        nodeMap.forEach((node) => {
          // worldX/worldY 우선 사용 (부모 이동 반영), 없으면 로컬 좌표 fallback
          const nodeX = node.worldX ?? node.x
          const nodeY = node.worldY ?? node.y
          const { sx, sy } = cocosToSvg(nodeX, nodeY, DESIGN_W, DESIGN_H)
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
          // Shift: 기존 선택에 추가, 아니면 교체
          setSelectedUuids(prev => wasShift ? new Set([...prev, ...hit]) : hit)
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
    // [C-7] race condition 방지: await 전에 dragRef를 로컬 캡처 후 즉시 null 처리
    const capturedDrag = dragRef.current
    if (capturedDrag) {
      dragRef.current = null
      const drag = capturedDrag

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
      // 이동 히스토리 기록
      const draggedNode = nodeMap.get(drag.uuid)
      if (draggedNode) {
        setChangeHistory(prev => {
          const entry = { uuid: drag.uuid, name: draggedNode.name, x: Math.round(draggedNode.x), y: Math.round(draggedNode.y), ts: Date.now() }
          return [entry, ...prev.filter(e => e.uuid !== drag.uuid)].slice(0, 20)
        })
      }
      // dragRef.current already nulled at start of handler (race condition fix)
      setIsDragging(false)
      setDragDelta(null)
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

    // 회전 종료 → IPC 전송
    if (rotateRef.current) {
      const rt = rotateRef.current
      const node = nodeMap.get(rt.uuid)
      if (node) {
        try {
          await window.api.ccSetProperty?.(port, rt.uuid, 'rotation', node.rotation)
        } catch (e) {
          console.error('[SceneView] rotate failed:', e)
        }
      }
      rotateRef.current = null
      setIsRotating(false)
    }
  }, [nodeMap, marquee, view, port])

  // ── 줌 애니메이션 (RAF 보간) ────────────────────────────────
  const animateToTarget = useCallback(() => {
    if (!targetViewRef.current) return
    setView(curr => {
      const target = targetViewRef.current!
      const dz = target.zoom - curr.zoom
      const dx = target.offsetX - curr.offsetX
      const dy = target.offsetY - curr.offsetY
      if (Math.abs(dz) < 0.001 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        targetViewRef.current = null
        animFrameRef.current = null
        return target
      }
      const EASE = 0.18
      return {
        zoom: curr.zoom + dz * EASE,
        offsetX: curr.offsetX + dx * EASE,
        offsetY: curr.offsetY + dy * EASE,
      }
    })
    if (targetViewRef.current) {
      animFrameRef.current = requestAnimationFrame(animateToTarget)
    }
  }, [])

  // ── 줌 (wheel) — passive: false 필요 ───────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      // 핀치 줌 / Ctrl+wheel 줌
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const svgCoords = getSvgCoords(e)
      const curr = targetViewRef.current ?? viewRef.current
      const newZoom = Math.min(8, Math.max(0.1, curr.zoom * factor))
      const newOffsetX = svgCoords.x - (svgCoords.x - curr.offsetX) * (newZoom / curr.zoom)
      const newOffsetY = svgCoords.y - (svgCoords.y - curr.offsetY) * (newZoom / curr.zoom)
      targetViewRef.current = { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
      if (!animFrameRef.current) {
        animFrameRef.current = requestAnimationFrame(animateToTarget)
      }
    } else {
      // 2손가락 스크롤 → 패닝
      setView(prev => ({
        ...prev,
        offsetX: prev.offsetX - e.deltaX,
        offsetY: prev.offsetY - e.deltaY,
      }))
    }
  }, [getSvgCoords])

  // ── SVG 씬 내보내기 ─────────────────────────────────────────
  const handleExportSvg = useCallback(() => {
    if (!svgRef.current) return
    // 씬 콘텐츠만 포함하는 독립 SVG 생성
    const ns = 'http://www.w3.org/2000/svg'
    const exportSvg = document.createElementNS(ns, 'svg')
    exportSvg.setAttribute('xmlns', ns)
    exportSvg.setAttribute('width', String(DESIGN_W))
    exportSvg.setAttribute('height', String(DESIGN_H))
    exportSvg.setAttribute('viewBox', `${-DESIGN_W / 2} ${-DESIGN_H / 2} ${DESIGN_W} ${DESIGN_H}`)
    // 배경
    const bg = document.createElementNS(ns, 'rect')
    bg.setAttribute('x', String(-DESIGN_W / 2)); bg.setAttribute('y', String(-DESIGN_H / 2))
    bg.setAttribute('width', String(DESIGN_W)); bg.setAttribute('height', String(DESIGN_H))
    bg.setAttribute('fill', '#1a1a2e')
    exportSvg.appendChild(bg)
    // 각 노드를 사각형으로 렌더
    nodeMap.forEach(n => {
      if (!n.active) return
      const rect = document.createElementNS(ns, 'rect')
      const hw = n.width / 2; const hh = n.height / 2
      const cx = n.x - DESIGN_W / 2; const cy = -(n.y - DESIGN_H / 2)  // Cocos → SVG Y
      rect.setAttribute('x', String(cx - hw)); rect.setAttribute('y', String(cy - hh))
      rect.setAttribute('width', String(n.width)); rect.setAttribute('height', String(n.height))
      const r = n.color.r; const g = n.color.g; const b = n.color.b; const a = (n.color.a / 255).toFixed(2)
      rect.setAttribute('fill', `rgba(${r},${g},${b},${a})`)
      rect.setAttribute('stroke', 'rgba(96,165,250,0.3)'); rect.setAttribute('stroke-width', '0.5')
      exportSvg.appendChild(rect)
      if (n.name) {
        const text = document.createElementNS(ns, 'text')
        text.setAttribute('x', String(cx)); text.setAttribute('y', String(cy + 4))
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10')
        text.setAttribute('fill', 'rgba(255,255,255,0.6)'); text.setAttribute('font-family', 'sans-serif')
        text.textContent = n.name
        exportSvg.appendChild(text)
      }
    })
    const blob = new Blob([new XMLSerializer().serializeToString(exportSvg)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'scene.svg'; a.click()
    URL.revokeObjectURL(url)
  }, [svgRef, nodeMap, DESIGN_W, DESIGN_H])

  // ── PNG 내보내기 (SVG → Canvas → PNG) ──────────────────────
  const handleExportPng = useCallback(async () => {
    // 씬 SVG 직렬화 (handleExportSvg와 동일한 SVG 생성)
    if (!svgRef.current) return
    const ns = 'http://www.w3.org/2000/svg'
    const exportSvg = document.createElementNS(ns, 'svg')
    exportSvg.setAttribute('xmlns', ns)
    exportSvg.setAttribute('width', String(DESIGN_W))
    exportSvg.setAttribute('height', String(DESIGN_H))
    exportSvg.setAttribute('viewBox', `${-DESIGN_W / 2} ${-DESIGN_H / 2} ${DESIGN_W} ${DESIGN_H}`)
    const bg = document.createElementNS(ns, 'rect')
    bg.setAttribute('x', String(-DESIGN_W / 2)); bg.setAttribute('y', String(-DESIGN_H / 2))
    bg.setAttribute('width', String(DESIGN_W)); bg.setAttribute('height', String(DESIGN_H))
    bg.setAttribute('fill', '#1a1a2e')
    exportSvg.appendChild(bg)
    nodeMap.forEach(n => {
      if (!n.active) return
      const rect = document.createElementNS(ns, 'rect')
      const hw = n.width / 2; const hh = n.height / 2
      const cx = n.x - DESIGN_W / 2; const cy = -(n.y - DESIGN_H / 2)
      rect.setAttribute('x', String(cx - hw)); rect.setAttribute('y', String(cy - hh))
      rect.setAttribute('width', String(n.width)); rect.setAttribute('height', String(n.height))
      const r = n.color.r; const g2 = n.color.g; const b = n.color.b; const a = (n.color.a / 255).toFixed(2)
      rect.setAttribute('fill', `rgba(${r},${g2},${b},${a})`)
      rect.setAttribute('stroke', 'rgba(96,165,250,0.3)'); rect.setAttribute('stroke-width', '0.5')
      exportSvg.appendChild(rect)
      if (n.name) {
        const text = document.createElementNS(ns, 'text')
        text.setAttribute('x', String(cx)); text.setAttribute('y', String(cy + 4))
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10')
        text.setAttribute('fill', 'rgba(255,255,255,0.6)'); text.setAttribute('font-family', 'sans-serif')
        text.textContent = n.name
        exportSvg.appendChild(text)
      }
    })
    const svgStr = new XMLSerializer().serializeToString(exportSvg)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = DESIGN_W; canvas.height = DESIGN_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(svgUrl)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl; a.download = 'scene.png'; a.click()
    }
    img.src = svgUrl
  }, [svgRef, nodeMap, DESIGN_W, DESIGN_H])

  // ── 씬뷰 스크린샷 (SVG 캔버스 → PNG 다운로드 + 클립보드) ───────
  const [screenshotDone, setScreenshotDone] = useState(false)

  const handleScreenshot = useCallback(async () => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = svgEl.clientWidth || DESIGN_W
      canvas.height = svgEl.clientHeight || DESIGN_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(svgUrl)
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      canvas.toBlob(async (blob) => {
        if (!blob) return
        // 다운로드
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `scene-${ts}.png`
        a.click()
        URL.revokeObjectURL(url)
        // 클립보드 복사
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        } catch {
          // 클립보드 미지원 환경 무시
        }
        setScreenshotDone(true)
        setTimeout(() => setScreenshotDone(false), 1500)
      }, 'image/png')
    }
    img.src = svgUrl
  }, [svgRef, DESIGN_W, DESIGN_H])

  // ── 씬 저장 / 로드 슬롯 (localStorage) ──────────────────────
  const [activeSlot, setActiveSlot] = useState(0)
  const slotKey = (slot: number) => `claude-desktop-scene-layout-${slot}`

  const saveToSlot = useCallback((slot: number) => {
    const data = JSON.stringify([...nodeMap.entries()])
    localStorage.setItem(slotKey(slot), data)
    setIsDirty(false)
  }, [nodeMap])

  const loadFromSlot = useCallback((slot: number) => {
    try {
      const raw = localStorage.getItem(slotKey(slot))
      if (!raw) return
      const entries: [string, import('./types').SceneNode][] = JSON.parse(raw)
      const next = new Map<string, import('./types').SceneNode>(entries)
      next.forEach((node, uuid) => { updateNode(uuid, node) })
    } catch {
      // 파싱 실패 무시
    }
  }, [updateNode])

  const handleSaveScene = useCallback(() => saveToSlot(activeSlot), [saveToSlot, activeSlot])
  const handleLoadScene = useCallback(() => loadFromSlot(activeSlot), [loadFromSlot, activeSlot])

  const handleSlotChange = useCallback((newSlot: number) => {
    saveToSlot(activeSlot)       // 현재 슬롯 자동 저장
    setActiveSlot(newSlot)
    loadFromSlot(newSlot)        // 새 슬롯 로드
  }, [activeSlot, saveToSlot, loadFromSlot])

  // 비패시브 wheel 이벤트 등록 (passive: false 없이는 preventDefault 무시됨)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // 줌 RAF 애니메이션 cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // ── Inspector 업데이트 ─────────────────────────────────────
  const handleInspectorUpdate = useCallback(async (uuid: string, prop: string, value: number | boolean) => {
    const prevVal = (nodeMap.get(uuid) as Record<string, unknown>)?.[prop]
    setUndoStack(u => [...u.slice(-49), { type: 'prop', uuid, key: prop, prevVal, nextVal: value }])
    setRedoStack([])
    updateNode(uuid, { [prop]: value } as Partial<SceneNode>)
    try {
      await window.api.ccSetProperty?.(port, uuid, prop, value)
    } catch (e) {
      console.error('[SceneView] inspector update failed:', e)
    }
  }, [updateNode, port, nodeMap])

  const handleColorUpdate = useCallback((uuid: string, color: Partial<{ r: number; g: number; b: number; a: number }>) => {
    updateNode(uuid, { color: { ...((nodeMap.get(uuid)?.color) ?? { r: 255, g: 255, b: 255, a: 255 }), ...color } })
  }, [updateNode, nodeMap])

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
    const result: string[] = []
    function dfs(uuid: string) {
      result.push(uuid)
      if (collapsedUuids.has(uuid)) return
      const node = nodeMap.get(uuid)
      if (!node) return
      for (const childUuid of node.childUuids) dfs(childUuid)
    }
    dfs(rootUuid)
    return result
  }, [rootUuid, nodeMap, collapsedUuids])

  // 씬 내 컴포넌트 타입 목록 (필터 드롭다운용)
  const componentTypes = useMemo(() => {
    const types = new Set<string>()
    nodeMap.forEach(n => n.components.forEach(c => types.add(c.type)))
    return [...types].sort()
  }, [nodeMap])

  // 선택 노드 경로 (브레드크럼용: root → … → 선택 노드)
  const nodePath = useMemo(() => {
    if (!selectedUuid) return []
    const path: { uuid: string; name: string }[] = []
    let cur = nodeMap.get(selectedUuid)
    while (cur) {
      path.unshift({ uuid: cur.uuid, name: cur.name })
      cur = cur.parentUuid ? nodeMap.get(cur.parentUuid) : undefined
    }
    return path
  }, [selectedUuid, nodeMap])

  // 씬 최상위 자식 노드 목록 (레이어 = rootUuid의 직계 자식)
  const topLevelNodes = useMemo(() => {
    if (!rootUuid) return []
    const root = nodeMap.get(rootUuid)
    if (!root) return []
    return root.childUuids
      .map(uuid => nodeMap.get(uuid))
      .filter((n): n is import('./types').SceneNode => !!n)
  }, [nodeMap, rootUuid])

  // 레이어(최상위 노드) 하위 전체 uuid 수집 헬퍼
  const collectDescendants = useCallback((uuid: string): string[] => {
    const result: string[] = [uuid]
    const stack = [uuid]
    while (stack.length) {
      const cur = stack.pop()!
      const node = nodeMap.get(cur)
      if (node) { node.childUuids.forEach(c => { result.push(c); stack.push(c) }) }
    }
    return result
  }, [nodeMap])

  // 레이어 잠금 → lockedUuids 동기화
  useEffect(() => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      // 이전 레이어 잠금으로 추가된 uuid 제거 후 재계산
      topLevelNodes.forEach(layer => {
        const descs = collectDescendants(layer.uuid)
        if (lockedLayers.has(layer.uuid)) {
          descs.forEach(u => next.add(u))
        } else {
          descs.forEach(u => {
            // lockedUuids에서 개별 잠금 여부 판단 불가하므로 레이어 잠금 해제 시 해당 uuid만 제거
            // (개별 잠금은 node.locked 로 관리되므로 Set에서만 제거)
            next.delete(u)
          })
        }
      })
      return next
    })
  }, [lockedLayers, topLevelNodes, collectDescendants])

  // uuid → 최상위 조상 uuid 매핑 (hiddenLayers 필터에 사용)
  const nodeToTopLevel = useMemo(() => {
    const map = new Map<string, string>()
    topLevelNodes.forEach(layer => {
      const stack = [layer.uuid]
      while (stack.length) {
        const cur = stack.pop()!
        map.set(cur, layer.uuid)
        const node = nodeMap.get(cur)
        if (node) node.childUuids.forEach(c => stack.push(c))
      }
    })
    return map
  }, [topLevelNodes, nodeMap])

  // 씬 내 모든 태그 목록 (태그 필터 드롭다운용)
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    nodeMap.forEach(n => (n.tags ?? []).forEach(t => tags.add(t)))
    return [...tags].sort()
  }, [nodeMap])

  // 검색 매칭 노드 목록
  const searchMatches = useMemo(() =>
    canvasSearch.trim()
      ? [...nodeMap.values()].filter(n => n.name.toLowerCase().includes(canvasSearch.toLowerCase()))
      : [],
    [canvasSearch, nodeMap]
  )

  useEffect(() => { setSearchMatchIndex(0) }, [canvasSearch])

  const nodeSearchMatches = useMemo(() => {
    if (!nodeSearch.trim()) return []
    const q = nodeSearch.toLowerCase()
    return [...nodeMap.values()].filter(n => n.name.toLowerCase().includes(q))
  }, [nodeSearch, nodeMap])

  const matchedUuids = useMemo(() => {
    return new Set(nodeSearchMatches.map(n => n.uuid))
  }, [nodeSearchMatches])

  // nodeSearch 변경 시 인덱스 리셋 + 첫 번째 매칭 노드 자동선택
  useEffect(() => {
    setNodeSearchMatchIndex(0)
    if (nodeSearchMatches.length > 0) {
      const node = nodeSearchMatches[0]
      setSelectedUuid(node.uuid)
      setSelectedUuids(new Set([node.uuid]))
    }
  }, [nodeSearch])

  const handleNodeSearchNav = useCallback((dir: 1 | -1) => {
    if (nodeSearchMatches.length === 0) return
    const next = (nodeSearchMatchIndex + dir + nodeSearchMatches.length) % nodeSearchMatches.length
    setNodeSearchMatchIndex(next)
    const node = nodeSearchMatches[next]
    setSelectedUuid(node.uuid)
    setSelectedUuids(new Set([node.uuid]))
    const ancestors: string[] = []
    let cur = nodeMap.get(node.uuid)
    while (cur?.parentUuid) { ancestors.push(cur.parentUuid); cur = nodeMap.get(cur.parentUuid) }
    if (ancestors.length > 0) setCollapsedUuids(prev => { const next2 = new Set(prev); ancestors.forEach(u => next2.delete(u)); return next2 })
  }, [nodeSearchMatches, nodeSearchMatchIndex, nodeMap])

  // 씬 변경 감지 — 최초 로드 이후 nodeMap 변경 시 dirty 표시
  useEffect(() => {
    if (!nodeMapInitRef.current) {
      if (nodeMap.size > 0) nodeMapInitRef.current = true
      return
    }
    setIsDirty(true)
  }, [nodeMap])

  const handleSearchNav = useCallback((dir: 1 | -1) => {
    if (searchMatches.length === 0) return
    const next = (searchMatchIndex + dir + searchMatches.length) % searchMatches.length
    setSearchMatchIndex(next)
    const node = searchMatches[next]
    setSelectedUuid(node.uuid)
    setSelectedUuids(new Set([node.uuid]))
    // 조상 노드가 접혀 있으면 자동 펼치기
    const ancestors: string[] = []
    let cur = nodeMap.get(node.uuid)
    while (cur?.parentUuid) { ancestors.push(cur.parentUuid); cur = nodeMap.get(cur.parentUuid) }
    if (ancestors.length > 0) setCollapsedUuids(prev => { const next2 = new Set(prev); ancestors.forEach(u => next2.delete(u)); return next2 })
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)
      const targetZoom = Math.min(
        (width - 120) / Math.max(node.width, 40),
        (height - 120) / Math.max(node.height, 40),
        4
      )
      setView({ offsetX: width / 2 - sx * targetZoom, offsetY: height / 2 - sy * targetZoom, zoom: targetZoom })
    }
  }, [searchMatches, searchMatchIndex, containerRef])

  const selectedNode = selectedUuid ? nodeMap.get(selectedUuid) ?? null : null

  // 선택 노드 변경 시 인라인 편집 초기화
  useEffect(() => {
    if (selectedNode) {
      setNodeEditDraft({ x: String(selectedNode.x), y: String(selectedNode.y), w: String(selectedNode.width), h: String(selectedNode.height), r: String(Math.round(selectedNode.rotation)) })
    } else {
      setNodeEditDraft(null)
    }
  }, [selectedUuid])

  const selectionCount = selectedUuids.size > 1 ? selectedUuids.size : undefined
  const canCopy = selectedUuids.size > 0 || selectedUuid !== null
  // R655: showGroupBtn 동기화
  useEffect(() => { setShowGroupBtn(selectedUuids.size >= 2) }, [selectedUuids])
  const canPaste = clipboard.length > 0
  const canZOrder = selectedUuids.size === 1
  const canAlign = selectedUuids.size >= 2

  const handleAddAnnotation = useCallback((svgX = 0, svgY = 0) => {
    const id = `annot-${Date.now()}`
    const next = [...annotations, { id, svgX, svgY, text: '' }]
    setAnnotations(next)
    try { localStorage.setItem('sceneview-annotations', JSON.stringify(next)) } catch {}
    setEditingAnnotId(id)
  }, [annotations])

  const handleAnnotUpdate = useCallback((id: string, text: string) => {
    const next = text
      ? annotations.map(a => a.id === id ? { ...a, text } : a)
      : annotations.filter(a => a.id !== id)
    setAnnotations(next)
    try { localStorage.setItem('sceneview-annotations', JSON.stringify(next)) } catch {}
  }, [annotations])

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
  // 선택 노드 크기 맞추기 — 기준 노드(첫 번째 선택) 크기로 동일화
  const handleMatchSize = useCallback(async (dim: 'W' | 'H' | 'both') => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const ref = nodes[0]
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i]
      if (dim === 'W' || dim === 'both') {
        updateNode(n.uuid, { width: ref.width })
        try { await window.api.ccSetProperty?.(port, n.uuid, 'width', ref.width) } catch (_) {}
      }
      if (dim === 'H' || dim === 'both') {
        updateNode(n.uuid, { height: ref.height })
        try { await window.api.ccSetProperty?.(port, n.uuid, 'height', ref.height) } catch (_) {}
      }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

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

  const handleGridLayout = useCallback(async (gridGap = 20) => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return

    const cols = Math.ceil(Math.sqrt(nodes.length))
    // 시작 위치: 가장 왼쪽-상단 노드 기준
    const startX = Math.min(...nodes.map(n => n.x - n.width * (n.anchorX ?? 0.5)))
    const startY = Math.max(...nodes.map(n => n.y + n.height * (1 - (n.anchorY ?? 0.5))))

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const newX = startX + col * (n.width + gridGap) + n.width * (n.anchorX ?? 0.5)
      const newY = startY - row * (n.height + gridGap) - n.height * (1 - (n.anchorY ?? 0.5))
      updateNode(n.uuid, { x: newX, y: newY })
      try {
        await window.api.ccSetProperty?.(port, n.uuid, 'x', newX)
        await window.api.ccSetProperty?.(port, n.uuid, 'y', newY)
      } catch (e) {
        console.error('[SceneView] gridLayout failed:', e)
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
      // [C-4] SceneNode uses flat width/height (not size.width)
      const hw = (n.width ?? 50) / 2
      const hh = (n.height ?? 50) / 2
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
        onZoomChange={zoom => {
          const curr = targetViewRef.current ?? viewRef.current
          targetViewRef.current = { zoom, offsetX: curr.offsetX, offsetY: curr.offsetY }
          if (!animFrameRef.current) {
            animFrameRef.current = requestAnimationFrame(animateToTarget)
          }
        }}
        onGridToggle={() => setGridVisible(v => !v)}
        onSnapToggle={() => setSnapEnabled(v => !v)}
        snapGrid={snapGrid}
        onSnapGridChange={setSnapGrid}
        onFit={handleFit}
        onRefresh={refresh}
        showHierarchy={showHierarchy}
        onHierarchyToggle={() => setShowHierarchy(v => !v)}
        showConnections={showConnections}
        onConnectionsToggle={() => setShowConnections(v => !v)}
        showStats={showStats}
        onStatsToggle={() => setShowStats(v => !v)}
        showLabels={showLabels}
        onLabelsToggle={() => setShowLabels(v => !v)}
        sceneBg={sceneBg}
        onSceneBgChange={(bg) => {
          setSceneBg(bg)
          localStorage.setItem('scene-bg', bg)
        }}
        showMinimap={showMinimap}
        onMinimapToggle={() => setShowMinimap(v => !v)}
        canvasSize={canvasSize}
        onCanvasSizeChange={(w, h) => { setCanvasSize({ w, h }); setTimeout(handleFit, 50) }}
        onScreenshot={handleScreenshot}
        screenshotDone={screenshotDone}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onSaveScene={handleSaveScene}
        onLoadScene={handleLoadScene}
        activeSlot={activeSlot}
        onSlotChange={handleSlotChange}
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
        onMatchWidth={() => handleMatchSize('W')}
        onMatchHeight={() => handleMatchSize('H')}
        onMatchBoth={() => handleMatchSize('both')}
        onGridLayout={() => handleGridLayout()}
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
        componentFilter={componentFilter}
        componentTypes={componentTypes}
        onComponentFilterChange={setComponentFilter}
        tagFilter={tagFilter}
        allTags={allTags}
        onTagFilterChange={setTagFilter}
        focusMode={focusMode}
        onFocusModeToggle={() => setFocusMode(v => !v)}
        measureMode={measureMode}
        onMeasureModeToggle={() => { setMeasureMode(v => !v); setMeasureLine(null); measureStartRef.current = null }}
        hasRefImage={!!refImageUrl}
        onRefImageToggle={() => setShowRefImagePanel(v => !v)}
        bookmarkCount={bookmarkedUuids.size}
        showBookmarkList={showBookmarkList}
        onBookmarkListToggle={() => setShowBookmarkList(v => !v)}
        isSelectedLocked={selectedUuid ? nodeMap.get(selectedUuid)?.locked === true : false}
        onLockToggle={() => {
          if (!selectedUuid) return
          const node = nodeMap.get(selectedUuid)
          if (node) updateNode(selectedUuid, { locked: !node.locked })
        }}
        isPinned={selectedUuid ? pinnedUuids.has(selectedUuid) : false}
        onTogglePin={() => { if (selectedUuid) togglePin(selectedUuid) }}
        onAddAnnotation={() => handleAddAnnotation()}
        nodeSearch={nodeSearch}
        onNodeSearchChange={v => { setNodeSearch(v); if (!showNodeSearch) setShowNodeSearch(true) }}
        showNodeSearch={showNodeSearch}
        onNodeSearchToggle={() => { setShowNodeSearch(v => !v); if (showNodeSearch) setNodeSearch('') }}
        nodeSearchCount={nodeSearchMatches.length}
        nodeSearchIndex={nodeSearchMatchIndex}
        onNodeSearchNav={handleNodeSearchNav}
        hasSnapshot={snapshot !== null}
        showDiff={showDiff}
        onTakeSnapshot={handleTakeSnapshot}
        onToggleDiff={() => setShowDiff(v => !v)}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler(v => !v)}
        mousePos={cursorScenePos}
        showLayerPanel={showLayerPanel}
        onToggleLayerPanel={() => setShowLayerPanel(v => !v)}
        showHeatmap={showHeatmap}
        onHeatmapToggle={() => setShowHeatmap(v => !v)}
        showQuickActions={showQuickActions}
        onQuickActionsToggle={() => setShowQuickActions(v => !v)}
        onZoomTo={handleZoomTo}
      />

      {/* 스냅샷 기록 툴바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 10 }}>
        <button
          onClick={takeSnapshot}
          style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, color: '#93c5fd', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          스냅샷
        </button>
        {/* 접근 횟수 초기화 버튼 (R702) */}
        {Object.keys(nodeAccessCount).length > 0 && (
          <button
            onClick={() => setNodeAccessCount({})}
            style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, color: '#fca5a5', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            접근 횟수 초기화
          </button>
        )}
        {snapshots.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSnapshotOpen(v => !v)}
              style={{ fontSize: 11, padding: '2px 8px', background: snapshotOpen ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#cbd5e1', cursor: 'pointer' }}
            >
              기록 ({snapshots.length}) ▾
            </button>
            {snapshotOpen && (
              <div
                style={{ position: 'absolute', top: '100%', left: 0, marginTop: 2, background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, minWidth: 220, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
              >
                {snapshots.map((s) => (
                  <div
                    key={s.timestamp}
                    onClick={() => { console.log('restore snapshot:', s.label); setSnapshotOpen(false) }}
                    style={{ padding: '6px 12px', fontSize: 11, color: '#cbd5e1', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.15)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 애니메이션 미리보기 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => {
            const next = !animPreview
            setAnimPreview(next)
            if (next) {
              animPreviewIntervalRef.current = setInterval(() => {
                setAnimFrame(f => {
                  const nf = f >= 100 ? 0 : f + 1
                  console.log('anim frame:', nf)
                  return nf
                })
              }, 50)
            } else {
              if (animPreviewIntervalRef.current) {
                clearInterval(animPreviewIntervalRef.current)
                animPreviewIntervalRef.current = null
              }
            }
          }}
          style={{ fontSize: 12, padding: '1px 6px', background: animPreview ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: animPreview ? '#fbbf24' : '#94a3b8', cursor: 'pointer', flexShrink: 0 }}
          title="애니메이션 미리보기 토글"
        >
          {animPreview ? '⏸' : '▶'}
        </button>
        {animPreview && (
          <input
            className="animSlider"
            type="range"
            min={0}
            max={100}
            value={animFrame}
            onChange={e => {
              const v = Number(e.target.value)
              setAnimFrame(v)
              console.log('anim frame:', v)
            }}
            style={{ flex: 1, accentColor: '#fbbf24', cursor: 'pointer' }}
          />
        )}
        {animPreview && (
          <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 28, textAlign: 'right' }}>{animFrame}</span>
        )}
      </div>

      {/* 노드 계층 트리 패널 */}
      {showHierarchy && rootUuid && (
        <NodeHierarchyList
          rootUuid={rootUuid}
          nodeMap={nodeMap}
          selectedUuids={selectedUuids}
          focusUuid={selectedUuid}
          onToggleActive={handleHierarchyToggleActive}
          onCopyNode={(uuid) => {
            setSelectedUuid(uuid)
            setSelectedUuids(new Set([uuid]))
            const n = nodeMap.get(uuid)
            if (n) setClipboard([{ uuid: n.uuid, name: n.name, x: n.x ?? 0, y: n.y ?? 0 }])
          }}
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
          onRename={handleRename}
          onToggleLock={(uuid, locked) => {
            updateNode(uuid, { locked })
            setLockedUuids(prev => {
              const next = new Set(prev)
              if (locked) next.add(uuid)
              else next.delete(uuid)
              localStorage.setItem('scene-locked', JSON.stringify([...next]))
              return next
            })
          }}
          onToggleVisible={(uuid, visible) => updateNode(uuid, { visible })}
        />
      )}

      {/* SVG 뷰포트 */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={e => {
          // input/textarea 포커스 시 무시
          const tag = (e.target as HTMLElement).tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA') return
          if (e.key === '+' || e.key === '=') {
            e.preventDefault()
            handleZoomTo(Math.min(8, view.zoom * 1.1))
          } else if (e.key === '-') {
            e.preventDefault()
            handleZoomTo(Math.max(0.1, view.zoom / 1.1))
          } else if (e.key === '0') {
            e.preventDefault()
            handleFit()
          }
        }}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          outline: 'none',
          cursor: isPanningActive ? 'grabbing' : (activeTool === 'move' || spaceDown) ? 'grab' : 'default',
          background: sceneBg === 'checker' ? undefined
            : sceneBg === 'dark' ? '#1e1e1e'
            : sceneBg === 'light' ? '#e8e8e8'
            : sceneBg,
          backgroundImage: sceneBg === 'checker'
            ? 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%)'
            : undefined,
          backgroundSize: sceneBg === 'checker' ? '16px 16px' : undefined,
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
          onMouseLeave={() => { setCursorScenePos(null); setHoverTooltipPos(null); if (tooltipDelayRef.current) { clearTimeout(tooltipDelayRef.current); tooltipDelayRef.current = null } setTooltipVisibleUuid(null); handleMouseUp() }}
          onContextMenu={e => {
            e.preventDefault()
            setSvgContextMenu({ uuid: hoveredUuid, x: e.clientX, y: e.clientY })
          }}
        >
          <defs>

            {/* 연결선 화살표 마커 */}
            <marker id="conn-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L6,3 z" fill="rgba(96,165,250,0.5)" />
            </marker>

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

          {/* 배경 (div 레벨에서 처리됨) */}
          <rect width="100%" height="100%" fill="none" />
          {gridVisible && <rect width="100%" height="100%" fill="url(#grid)" />}

          {/* 원점(0,0) 십자선 — 씬 그룹 바깥(화면 좌표로 그림) */}
          {gridVisible && (() => {
            const ox = DESIGN_W / 2 * view.zoom + view.offsetX
            const oy = DESIGN_H / 2 * view.zoom + view.offsetY
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={ox} y1={0} x2={ox} y2="100%" stroke="rgba(96,165,250,0.2)" strokeWidth={1} strokeDasharray="4 4" />
                <line x1={0} y1={oy} x2="100%" y2={oy} stroke="rgba(96,165,250,0.2)" strokeWidth={1} strokeDasharray="4 4" />
                <circle cx={ox} cy={oy} r={3} fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth={1} />
              </g>
            )
          })()}

          {/* 정렬 가이드라인 */}
          {alignGuides.length > 0 && (() => {
            const ox = DESIGN_W / 2 * view.zoom + view.offsetX
            const oy = DESIGN_H / 2 * view.zoom + view.offsetY
            return <g style={{ pointerEvents: 'none' }}>
              {alignGuides.map((g, i) => {
                if (g.x !== undefined) {
                  const px = g.x * view.zoom + ox
                  return <line key={i} x1={px} y1={0} x2={px} y2="100%" stroke="rgba(255,100,0,0.85)" strokeWidth={1.5} strokeDasharray="5 3" />
                } else if (g.y !== undefined) {
                  const py = -g.y * view.zoom + oy
                  return <line key={i} x1={0} y1={py} x2="100%" y2={py} stroke="rgba(220,0,200,0.85)" strokeWidth={1.5} strokeDasharray="5 3" />
                }
                return null
              })}
            </g>
          })()}

          {/* 룰러는 SVG 외부 position absolute 오버레이로 이동 */}

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

            {/* 참조 이미지 오버레이 */}
            {refImageUrl && (
              <image
                href={refImageUrl}
                x={0} y={0}
                width={DESIGN_W} height={DESIGN_H}
                opacity={refImageOpacity}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: 'none' }}
              />
            )}

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

            {/* 부모-자식 연결선 */}
            {showConnections && [...nodeMap.values()].map(node => {
              if (!node.parentUuid) return null
              const parent = nodeMap.get(node.parentUuid)
              if (!parent) return null
              const { sx: x1, sy: y1 } = cocosToSvg(parent.x, parent.y, DESIGN_W, DESIGN_H)
              const { sx: x2, sy: y2 } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)
              // cubic bezier: 수직 방향으로 제어점 설정
              const midY = (y1 + y2) / 2
              const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`
              return (
                <path
                  key={`conn-${node.uuid}`}
                  d={d}
                  fill="none"
                  stroke="rgba(96,165,250,0.45)"
                  strokeWidth={1 / view.zoom}
                  markerEnd="url(#conn-arrow)"
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}

            {/* 노드 렌더링 */}
            {renderOrder.map(uuid => {
              const node = nodeMap.get(uuid)
              if (!node) return null
              if (hiddenLayers.size > 0) {
                const topUuid = nodeToTopLevel.get(uuid)
                if (topUuid && hiddenLayers.has(topUuid)) return null
              }
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
                  dimmed={
                    (componentFilter !== 'all' && !node.components.some(c => c.type === componentFilter)) ||
                    (tagFilter !== 'all' && !(node.tags ?? []).includes(tagFilter)) ||
                    (focusMode && !selectedUuids.has(uuid) && selectedUuid !== uuid) ||
                    (nodeSearch.trim().length > 0 && !matchedUuids.has(uuid))
                  }
                  hasChildren={node.childUuids.length > 0}
                  collapsed={collapsedUuids.has(uuid)}
                  bookmarked={bookmarkedUuids.has(uuid)}
                  locked={node.locked === true || lockedUuids.has(uuid)}
                  pinned={pinnedUuids.has(uuid)}
                  highlighted={matchedUuids.has(uuid)}
                  flashing={flashUuid === uuid}
                  nodeColor={showHeatmap
                    ? (() => {
                        const cnt = nodeAccessCount[uuid] ?? 0
                        if (cnt === 0) return nodeColors[uuid]
                        if (cnt <= 3) return 'rgba(253,224,71,0.45)'
                        if (cnt <= 9) return 'rgba(249,115,22,0.55)'
                        return 'rgba(239,68,68,0.65)'
                      })()
                    : nodeColors[uuid]}
                  designWidth={DESIGN_W}
                  designHeight={DESIGN_H}
                  onMouseDown={handleNodeMouseDown}
                  onMouseEnter={(uuid) => {
                    setHoveredUuid(uuid)
                    if (tooltipDelayRef.current) clearTimeout(tooltipDelayRef.current)
                    tooltipDelayRef.current = setTimeout(() => setTooltipVisibleUuid(uuid), 300)
                  }}
                  onMouseLeave={() => {
                    setHoveredUuid(null)
                    if (tooltipDelayRef.current) { clearTimeout(tooltipDelayRef.current); tooltipDelayRef.current = null }
                    setTooltipVisibleUuid(null)
                  }}
                  onDoubleClick={() => { setInspectorNameFocus(v => v + 1) }}
                />
              )
            })}

            {/* 검색 하이라이트 링 */}
            {canvasSearch.trim() && searchMatches
              .map((n, idx) => {
                const isCurrent = idx === searchMatchIndex
                const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
                const rx = sx - n.width / 2 - 3
                const ry = sy - n.height / 2 - 3
                return (
                  <rect
                    key={`hl-${n.uuid}`}
                    x={rx} y={ry}
                    width={n.width + 6} height={n.height + 6}
                    fill="none"
                    stroke={isCurrent ? '#f97316' : '#fbbf24'}
                    strokeWidth={(isCurrent ? 2.5 : 2) / view.zoom}
                    strokeDasharray={`${4 / view.zoom} ${2 / view.zoom}`}
                    rx={4}
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })
            }

            {/* 노드 태그 뱃지 */}
            {[...nodeMap.values()].filter(n => nodeTags[n.uuid]?.length).map(n => {
              const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              const tags = nodeTags[n.uuid]
              return (
                <g key={`tag-${n.uuid}`} style={{ pointerEvents: 'none' }}>
                  {tags.map((tag, i) => {
                    const bw = tag.length * 5.5 + 8
                    const bx = sx - n.width / 2 + i * (bw + 2)
                    const by = sy - n.height / 2 - 14 / view.zoom
                    return (
                      <g key={`tag-${n.uuid}-${i}`}>
                        <rect x={bx / view.zoom * view.zoom} y={by} width={bw / view.zoom} height={12 / view.zoom}
                          rx={3 / view.zoom} fill="#7c3aed" opacity={0.85} />
                        <text x={(bx + bw / 2) / view.zoom * view.zoom} y={by + 8.5 / view.zoom}
                          textAnchor="middle" fontSize={7 / view.zoom} fill="#fff" fontFamily="sans-serif">
                          {tag}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* 선택 노드 앵커 포인트 십자 마커 */}
            {selectedNode && (() => {
              const { sx, sy } = cocosToSvg(selectedNode.x, selectedNode.y, DESIGN_W, DESIGN_H)
              const r = 4 / view.zoom
              const arm = 7 / view.zoom
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <line x1={sx - arm} y1={sy} x2={sx + arm} y2={sy} stroke="#a78bfa" strokeWidth={1 / view.zoom} />
                  <line x1={sx} y1={sy - arm} x2={sx} y2={sy + arm} stroke="#a78bfa" strokeWidth={1 / view.zoom} />
                  <circle cx={sx} cy={sy} r={r} fill="none" stroke="#a78bfa" strokeWidth={1 / view.zoom} />
                </g>
              )
            })()}

            {/* 드래그 원본 위치 고스트 박스 */}
            {isDragging && dragRef.current && selectedNode && (() => {
              const drag = dragRef.current!
              const { sx, sy } = cocosToSvg(drag.startNodeX, drag.startNodeY, DESIGN_W, DESIGN_H)
              const gw = selectedNode.width
              const gh = selectedNode.height
              const rx = sx - gw * selectedNode.anchorX
              const ry = sy - gh * (1 - selectedNode.anchorY)
              return (
                <rect
                  x={rx} y={ry} width={gw} height={gh}
                  fill="rgba(96,165,250,0.07)"
                  stroke="rgba(96,165,250,0.4)"
                  strokeWidth={1 / view.zoom}
                  strokeDasharray={`${5 / view.zoom} ${3 / view.zoom}`}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })()}

            {/* 측정 도구 라인 */}
            {measureMode && measureLine && (() => {
              const dx = (measureLine.x2 - measureLine.x1) / view.zoom
              const dy = (measureLine.y2 - measureLine.y1) / view.zoom
              const tickLen = 6 / view.zoom
              const angle = Math.atan2(dy, dx)
              const perpCos = Math.cos(angle + Math.PI / 2)
              const perpSin = Math.sin(angle + Math.PI / 2)
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <line
                    x1={measureLine.x1} y1={measureLine.y1}
                    x2={measureLine.x2} y2={measureLine.y2}
                    stroke="#f97316" strokeWidth={1.5 / view.zoom}
                    strokeDasharray={`${4 / view.zoom} ${2 / view.zoom}`}
                  />
                  {/* 시작점 tick */}
                  <line
                    x1={measureLine.x1 - perpCos * tickLen} y1={measureLine.y1 - perpSin * tickLen}
                    x2={measureLine.x1 + perpCos * tickLen} y2={measureLine.y1 + perpSin * tickLen}
                    stroke="#f97316" strokeWidth={1.5 / view.zoom}
                  />
                  {/* 끝점 tick */}
                  <line
                    x1={measureLine.x2 - perpCos * tickLen} y1={measureLine.y2 - perpSin * tickLen}
                    x2={measureLine.x2 + perpCos * tickLen} y2={measureLine.y2 + perpSin * tickLen}
                    stroke="#f97316" strokeWidth={1.5 / view.zoom}
                  />
                  <circle cx={measureLine.x1} cy={measureLine.y1} r={3 / view.zoom} fill="#f97316" />
                  <circle cx={measureLine.x2} cy={measureLine.y2} r={3 / view.zoom} fill="#f97316" />
                </g>
              )
            })()}

            {/* 선택 노드 리사이즈 핸들 (단일 선택 시) */}
            {selectedNode && selectedUuids.size <= 1 && (() => {
              const n = selectedNode
              const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              const hw = n.width / 2
              const hh = n.height / 2
              const hs = 5 / view.zoom
              const handles: Array<{ id: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'; cx: number; cy: number; cursor: string; side?: boolean }> = [
                { id: 'nw', cx: sx - hw, cy: sy - hh, cursor: 'nw-resize' },
                { id: 'ne', cx: sx + hw, cy: sy - hh, cursor: 'ne-resize' },
                { id: 'se', cx: sx + hw, cy: sy + hh, cursor: 'se-resize' },
                { id: 'sw', cx: sx - hw, cy: sy + hh, cursor: 'sw-resize' },
                { id: 'n', cx: sx, cy: sy - hh, cursor: 'n-resize', side: true },
                { id: 's', cx: sx, cy: sy + hh, cursor: 's-resize', side: true },
                { id: 'e', cx: sx + hw, cy: sy, cursor: 'e-resize', side: true },
                { id: 'w', cx: sx - hw, cy: sy, cursor: 'w-resize', side: true },
              ]
              return handles.map(h => (
                <rect
                  key={h.id}
                  x={h.cx - hs / 2} y={h.cy - hs / 2}
                  width={hs} height={hs}
                  fill={h.side ? '#4096ff' : 'white'} stroke="#4096ff" strokeWidth={1 / view.zoom}
                  style={{ cursor: h.cursor, pointerEvents: 'all' }}
                  onMouseDown={e => handleResizeMouseDown(e, n.uuid, h.id)}
                />
              ))
            })()}

            {/* 선택 노드 회전 핸들 */}
            {selectedNode && selectedUuids.size <= 1 && !isDragging && !isResizing && (() => {
              const n = selectedNode
              const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              const hh = n.height * Math.abs(n.scaleY) * (1 - n.anchorY)
              const rotHandleOffset = 18 / view.zoom
              const rhx = sx
              const rhy = sy - hh - rotHandleOffset
              const r = 4 / view.zoom
              return (
                <>
                  <line
                    x1={sx} y1={sy - hh}
                    x2={rhx} y2={rhy}
                    stroke="rgba(255,165,0,0.6)"
                    strokeWidth={1 / view.zoom}
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={rhx} cy={rhy} r={r}
                    fill="rgba(255,165,0,0.9)"
                    stroke="white"
                    strokeWidth={1 / view.zoom}
                    style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                    onMouseDown={e => handleRotateMouseDown(e, n.uuid)}
                  />
                </>
              )
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

            {/* 스냅샷 diff 오버레이 — 이동된 노드의 이전 위치 표시 */}
            {showDiff && snapshot && [...snapshot.values()].map(s => {
              const { sx, sy } = cocosToSvg(s.x, s.y, DESIGN_W, DESIGN_H)
              const rx = sx - s.width * 0.5
              const ry = sy - s.height * 0.5
              const current = nodeMap.get(s.uuid)
              if (!current) return null
              const { sx: csx, sy: csy } = cocosToSvg(current.worldX ?? current.x, current.worldY ?? current.y, DESIGN_W, DESIGN_H)
              const crx = csx - current.width * 0.5
              const cry = csy - current.height * 0.5
              const moved = Math.abs(rx - crx) > 1 || Math.abs(ry - cry) > 1
              if (!moved) return null
              return (
                <g key={s.uuid} style={{ pointerEvents: 'none' }}>
                  {/* 이전 위치 — 점선 빨간 박스 */}
                  <rect x={rx} y={ry} width={s.width} height={s.height}
                    fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.5)"
                    strokeWidth={1 / view.zoom} strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`} rx={2 / view.zoom} />
                  {/* 이동 화살표 연결선 */}
                  <line x1={rx + s.width / 2} y1={ry + s.height / 2}
                        x2={crx + current.width / 2} y2={cry + current.height / 2}
                    stroke="rgba(239,68,68,0.4)" strokeWidth={1 / view.zoom} strokeDasharray={`${3 / view.zoom} ${2 / view.zoom}`} />
                </g>
              )
            })}

            {/* 히트맵 오버레이 */}
            {showHeatmap && nodeMap.size > 0 && (() => {
              const CELL = 50
              const allNodes = [...nodeMap.values()]
              const heatmap = buildHeatmap(allNodes, CELL)
              const maxCount = Math.max(...heatmap.values(), 1)
              return [...heatmap.entries()].map(([key, count]) => {
                const [cx, cy] = key.split(',').map(Number)
                const t = count / maxCount
                const r = Math.round(t * 255)
                const b = Math.round((1 - t) * 100)
                const a = 0.1 + t * 0.3
                const { sx, sy } = cocosToSvg(cx * CELL, cy * CELL, DESIGN_W, DESIGN_H)
                return (
                  <rect
                    key={`hm-${key}`}
                    x={sx}
                    y={sy - CELL}
                    width={CELL}
                    height={CELL}
                    fill={`rgba(${r},0,${b},${a.toFixed(2)})`}
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })
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

          {/* 다중 선택 합산 bounding box */}
          {selectedUuids.size > 1 && (() => {
            let gbMinX = Infinity, gbMinY = Infinity, gbMaxX = -Infinity, gbMaxY = -Infinity
            selectedUuids.forEach(uid => {
              const n = nodeMap.get(uid)
              if (!n) return
              const { sx: nsx, sy: nsy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
              gbMinX = Math.min(gbMinX, nsx - n.width / 2)
              gbMinY = Math.min(gbMinY, nsy - n.height / 2)
              gbMaxX = Math.max(gbMaxX, nsx + n.width / 2)
              gbMaxY = Math.max(gbMaxY, nsy + n.height / 2)
            })
            if (!isFinite(gbMinX)) return null
            const pad = 4 / view.zoom
            const cx = (gbMinX + gbMaxX) / 2
            const cy = (gbMinY + gbMaxY) / 2
            const arm = 5 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={gbMinX - pad} y={gbMinY - pad}
                  width={gbMaxX - gbMinX + pad * 2} height={gbMaxY - gbMinY + pad * 2}
                  fill="none"
                  stroke="rgba(96,165,250,0.5)"
                  strokeWidth={1.5 / view.zoom}
                  strokeDasharray={`${6 / view.zoom} ${3 / view.zoom}`}
                  rx={3 / view.zoom}
                />
                {/* 중앙 마커 */}
                <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} stroke="rgba(96,165,250,0.6)" strokeWidth={1 / view.zoom} />
                <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} stroke="rgba(96,165,250,0.6)" strokeWidth={1 / view.zoom} />
              </g>
            )
          })()}

          {/* 주석 (Annotation) — 씬 그룹 밖, 화면 좌표로 렌더 */}
          {annotations.map(a => {
            const ax = a.svgX * view.zoom + view.offsetX
            const ay = a.svgY * view.zoom + view.offsetY
            return (
              <g key={a.id} transform={`translate(${ax},${ay})`} style={{ cursor: 'move' }}>
                <rect x={0} y={0} width={120} height={60} rx={4} ry={4}
                  fill="#fef3c7" stroke="#f59e0b" strokeWidth={1} opacity={0.95} />
                {editingAnnotId === a.id ? (
                  <foreignObject x={2} y={2} width={116} height={56}>
                    <textarea
                      autoFocus
                      defaultValue={a.text}
                      onBlur={e => { handleAnnotUpdate(a.id, e.target.value); setEditingAnnotId(null) }}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingAnnotId(null); e.stopPropagation() }}
                      style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', resize: 'none', fontSize: 9, padding: 2, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </foreignObject>
                ) : (
                  <>
                    <text x={4} y={12} fontSize={9} fill="#92400e" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {a.text || '(빈 주석)'}
                    </text>
                    <rect x={108} y={2} width={12} height={12} rx={2} fill="#f59e0b" opacity={0}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.setAttribute('opacity', '0.3')}
                      onMouseLeave={e => e.currentTarget.setAttribute('opacity', '0')}
                      onClick={e => { e.stopPropagation(); handleAnnotUpdate(a.id, '') }}
                    />
                    <text x={114} y={11} fontSize={8} fill="#92400e" textAnchor="middle"
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={e => { e.stopPropagation(); handleAnnotUpdate(a.id, '') }}
                    >×</text>
                  </>
                )}
                <rect x={0} y={0} width={120} height={60} rx={4} ry={4} fill="transparent"
                  onDoubleClick={e => { e.stopPropagation(); setEditingAnnotId(a.id) }}
                />
              </g>
            )
          })}

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

        {/* 측정 도구 결과 오버레이 (클릭 복사 지원) */}
        {measureMode && measureLine && (() => {
          const dx = (measureLine.x2 - measureLine.x1) / view.zoom
          const dy = (measureLine.y2 - measureLine.y1) / view.zoom
          const dist = Math.sqrt(dx * dx + dy * dy)
          const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
          const mx = (measureLine.x1 + measureLine.x2) / 2
          const my = (measureLine.y1 + measureLine.y2) / 2
          const label = `${dist.toFixed(1)}px  ${angleDeg.toFixed(1)}°`
          return (
            <div
              title="클릭하여 복사"
              onClick={() => { navigator.clipboard.writeText(label) }}
              style={{
                position: 'absolute',
                left: mx,
                top: my,
                transform: 'translate(-50%, -110%)',
                background: 'rgba(0,0,0,0.82)',
                color: '#f97316',
                fontSize: 11,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '3px 8px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                userSelect: 'none',
                zIndex: 20,
                border: '1px solid rgba(249,115,22,0.4)',
                lineHeight: '1.4',
                pointerEvents: 'all',
              }}
            >
              {dist.toFixed(1)} px &nbsp; {angleDeg.toFixed(1)}°
            </div>
          )
        })()}

        {/* 눈금자 오버레이 (position absolute, SVG 외부) */}
        {showRuler && containerRef.current && (() => {
          const cw = containerRef.current!.clientWidth
          const ch = containerRef.current!.clientHeight
          return (
            <>
              {/* 상단 수평 룰러 */}
              <svg
                style={{ position: 'absolute', top: 0, left: 16, width: cw - 16, height: 16, pointerEvents: 'none', zIndex: 10 }}
                width={cw - 16}
                height={16}
              >
                <rect width="100%" height="16" fill="var(--bg-secondary)" opacity={0.9} />
                {getRulerTicks('h', cw - 16, { zoom: view.zoom, offsetX: view.offsetX - 16, offsetY: view.offsetY }).map(({ pos, label, isMajor }) => (
                  <g key={`h${pos.toFixed(1)}`}>
                    <line x1={pos} y1={isMajor ? 8 : 12} x2={pos} y2={16} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                    {isMajor && label && <text x={pos + 2} y={11} fontSize={7} fill="rgba(255,255,255,0.5)" fontFamily="monospace">{label}</text>}
                  </g>
                ))}
              </svg>
              {/* 좌측 수직 룰러 */}
              <svg
                style={{ position: 'absolute', top: 16, left: 0, width: 16, height: ch - 16, pointerEvents: 'none', zIndex: 10 }}
                width={16}
                height={ch - 16}
              >
                <rect width="16" height="100%" fill="var(--bg-secondary)" opacity={0.9} />
                {getRulerTicks('v', ch - 16, { zoom: view.zoom, offsetX: view.offsetX, offsetY: view.offsetY - 16 }).map(({ pos, label, isMajor }) => (
                  <g key={`v${pos.toFixed(1)}`}>
                    <line x1={isMajor ? 8 : 12} y1={pos} x2={16} y2={pos} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                    {isMajor && label && (
                      <text x={8} y={pos - 2} fontSize={7} fill="rgba(255,255,255,0.5)" fontFamily="monospace"
                        transform={`rotate(-90, 8, ${pos - 2})`}>{label}</text>
                    )}
                  </g>
                ))}
              </svg>
              {/* 코너 사각형 */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, background: 'var(--bg-secondary)', zIndex: 11, pointerEvents: 'none' }} />
            </>
          )
        })()}

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

        {/* 총 노드 수 표시 */}
        {nodeMap.size > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 8,
              fontSize: 9,
              color: 'var(--text-muted)',
              background: 'rgba(0,0,0,0.5)',
              padding: '1px 5px',
              borderRadius: 3,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {nodeMap.size}개 노드
            {selectedUuids.size > 1 && ` · ${selectedUuids.size} 선택`}
          </div>
        )}

        {/* R655: 다중 선택 그룹화 버튼 */}
        {showGroupBtn && (
          <div
            style={{
              position: 'absolute',
              bottom: 42,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <button
              onClick={() => console.log('group nodes:', [...multiSelected])}
              style={{
                fontSize: 10,
                padding: '3px 10px',
                background: 'rgba(96,165,250,0.18)',
                border: '1px solid rgba(96,165,250,0.5)',
                borderRadius: 4,
                color: '#60a5fa',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              그룹화 ({multiSelected.size})
            </button>
          </div>
        )}

        {/* 드래그/리사이즈 중 선택 노드 정보 */}
        {(isDragging || isResizing) && selectedNode && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 44,
              fontSize: 9,
              color: 'rgba(250,200,50,0.9)',
              background: 'rgba(0,0,0,0.6)',
              padding: '1px 6px',
              borderRadius: 3,
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'monospace',
            }}
          >
            x:{Math.round(selectedNode.x)} y:{Math.round(selectedNode.y)} w:{Math.round(selectedNode.width)} h:{Math.round(selectedNode.height)}
          </div>
        )}

        {/* 씬 통계 패널 */}
        {showStats && (() => {
          const nodes = [...nodeMap.values()]
          const total = nodes.length
          const active = nodes.filter(n => n.active).length
          const inactive = total - active
          const locked = nodes.filter(n => n.locked).length
          const hidden = nodes.filter(n => n.visible === false).length
          const tagged = nodes.filter(n => (n.tags ?? []).length > 0).length
          // 컴포넌트 타입 분포
          const compCounts: Record<string, number> = {}
          nodes.forEach(n => n.components.forEach(c => { compCounts[c.type] = (compCounts[c.type] ?? 0) + 1 }))
          const topComps = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
          const totalComps = Object.values(compCounts).reduce((s, v) => s + v, 0)
          return (
            <div
              style={{
                position: 'absolute',
                bottom: 28,
                left: 6,
                fontSize: 9,
                color: 'var(--text-muted)',
                background: 'rgba(10,10,15,0.85)',
                padding: '5px 8px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.1)',
                pointerEvents: 'none',
                lineHeight: 1.7,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>씬 통계</div>
              <div>전체: <span style={{ color: 'var(--accent)' }}>{total}</span></div>
              <div>활성: {active} / 비활성: {inactive}</div>
              <div>잠금: {locked} / 숨김: {hidden}</div>
              <div>태그 있음: {tagged}</div>
              <div>선택: {selectedUuids.size}</div>
              {topComps.length > 0 && (
                <>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 3, paddingTop: 3, color: 'var(--text-secondary)' }}>컴포넌트 ({totalComps})</div>
                  {topComps.map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{type.replace('cc.', '')}</span>
                      <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{count}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })()}

        {/* 선택 노드 인라인 편집바 */}
        {selectedNode && nodeEditDraft && (
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 0,
              right: 0,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 8px',
              background: 'rgba(10,10,15,0.88)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: 9,
              color: 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
              zIndex: 5,
            }}
          >
            <span style={{ color: 'var(--accent)', marginRight: 2 }}>⬡</span>
            <span style={{ color: 'var(--text-secondary)', marginRight: 4, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedNode.name}</span>
            {(['x', 'y', 'w', 'h', 'r'] as const).map(field => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 8 }}>{field.toUpperCase()}:</span>
                <input
                  value={nodeEditDraft[field]}
                  onChange={e => setNodeEditDraft(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseFloat(nodeEditDraft[field])
                      if (!isNaN(v)) {
                        const prop = field === 'w' ? 'width' : field === 'h' ? 'height' : field === 'r' ? 'rotation' : field
                        updateNode(selectedNode.uuid, { [prop]: v })
                      }
                      e.currentTarget.blur()
                    }
                    if (e.key === 'Escape') {
                      setNodeEditDraft({ x: String(selectedNode.x), y: String(selectedNode.y), w: String(selectedNode.width), h: String(selectedNode.height), r: String(Math.round(selectedNode.rotation)) })
                      e.currentTarget.blur()
                    }
                    e.stopPropagation()
                  }}
                  onBlur={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v)) {
                      const prop = field === 'w' ? 'width' : field === 'h' ? 'height' : field
                      updateNode(selectedNode.uuid, { [prop]: v })
                    }
                  }}
                  style={{
                    width: 38, fontSize: 9, padding: '1px 3px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 2, color: 'var(--text-primary)', outline: 'none', textAlign: 'right',
                  }}
                />
              </label>
            ))}
          </div>
        )}

        {/* 노드 경로 브레드크럼 */}
        {nodePath.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 0,
              right: 0,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '0 8px',
              background: 'rgba(10,10,15,0.7)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: 9,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {nodePath.map((item, idx) => (
              <span key={item.uuid} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {idx > 0 && <span style={{ opacity: 0.4 }}>/</span>}
                <span
                  style={{
                    cursor: 'pointer',
                    color: idx === nodePath.length - 1 ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: idx === nodePath.length - 1 ? 600 : 400,
                    maxWidth: 80,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onClick={() => { setSelectedUuid(item.uuid); setSelectedUuids(new Set([item.uuid])) }}
                  title={item.name}
                >
                  {item.name.length > 12 ? item.name.slice(0, 10) + '…' : item.name}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 상태바 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 8px',
            background: 'rgba(10,10,15,0.75)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 9,
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {spaceDown ? (
            <span style={{ color: '#f59e0b' }}>Space: 드래그로 패닝</span>
          ) : (
            <>
              <span style={{ color: activeTool === 'select' ? 'var(--accent)' : undefined }}>
                {activeTool === 'select' ? '↖ 선택' : '✥ 이동'}
              </span>
              <span>|</span>
              <span>{Math.round(view.zoom * 100)}%</span>
              {snapEnabled && <><span>|</span><span style={{ color: 'var(--success)' }}>Snap {snapGrid}px</span></>}
              {gridVisible && <><span>|</span><span>Grid</span></>}
              {selectedUuids.size > 0 && <><span>|</span><span style={{ color: '#60a5fa' }}>{selectedUuids.size}개 선택</span></>}
              {isDragging && <><span>|</span><span style={{ color: '#f59e0b' }}>드래그 중</span></>}
              {isResizing && <><span>|</span><span style={{ color: '#f59e0b' }}>리사이즈 중</span></>}
              {isDirty && <><span>|</span><span style={{ color: '#f97316' }} title="저장되지 않은 변경 사항">● 저장 안됨</span></>}
              {copiedNode && <><span>|</span><span style={{ color: '#a78bfa' }} title={`클립보드: ${copiedNode.name}`}>📋 {copiedNode.name}</span></>}
            </>
          )}
        </div>

        {/* 노드 정보 오버레이 (I키) */}
        {showNodeInfo && selectedNode && (
          <div style={{
            position: 'absolute', bottom: 28, right: 6, zIndex: 90,
            background: 'rgba(10,10,15,0.92)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, padding: '5px 8px', fontSize: 9, color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', lineHeight: 1.7, pointerEvents: 'none',
            minWidth: 140,
          }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{selectedNode.name}</div>
            <div>pos: {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}</div>
            <div>size: {Math.round(selectedNode.width)} × {Math.round(selectedNode.height)}</div>
            <div>rot: {selectedNode.rotation.toFixed(1)}°</div>
            <div>anchor: {selectedNode.anchorX.toFixed(2)}, {selectedNode.anchorY.toFixed(2)}</div>
            <div>opacity: {selectedNode.opacity ?? 255}</div>
            {selectedNode.components.length > 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>comps: {selectedNode.components.map(c => c.type.replace('cc.', '')).join(', ')}</div>
            )}
            {selectedNode.visible === false && <div style={{ color: '#f87171' }}>hidden</div>}
            {selectedNode.locked && <div style={{ color: '#fbbf24' }}>locked</div>}
          </div>
        )}

        {/* 씬 캔버스 검색 오버레이 */}
        {showCanvasSearch && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(10,10,15,0.92)',
              border: '1px solid var(--accent)',
              borderRadius: 5,
              padding: '3px 8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>🔍</span>
            <input
              ref={canvasSearchRef}
              value={canvasSearch}
              onChange={e => setCanvasSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowCanvasSearch(false); setCanvasSearch('') }
                else if (e.key === 'Enter') { e.preventDefault(); handleSearchNav(e.shiftKey ? -1 : 1) }
                e.stopPropagation()
              }}
              placeholder="노드 이름 검색..."
              style={{
                width: 140, fontSize: 10, background: 'transparent', border: 'none',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            {canvasSearch && searchMatches.length > 0 && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {searchMatchIndex + 1}/{searchMatches.length}
              </span>
            )}
            {canvasSearch && searchMatches.length === 0 && (
              <span style={{ fontSize: 9, color: 'var(--text-danger, #f87171)' }}>없음</span>
            )}
            {searchMatches.length > 1 && (
              <button onClick={() => handleSearchNav(1)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 1px' }}>↓</button>
            )}
            <button onClick={() => { setShowCanvasSearch(false); setCanvasSearch('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>×</button>
          </div>
        )}

        {/* 즐겨찾기 목록 */}
        {showBookmarkList && bookmarkedUuids.size > 0 && (
          <div style={{
            position: 'absolute', top: 6, left: 6, zIndex: 100,
            background: 'rgba(10,10,15,0.92)', border: '1px solid var(--accent)',
            borderRadius: 5, padding: '6px 8px', minWidth: 160, maxHeight: 200,
            overflowY: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', fontSize: 9,
          }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>★ 즐겨찾기</div>
            {[...bookmarkedUuids].map(uuid => {
              const n = nodeMap.get(uuid)
              if (!n) return null
              return (
                <div key={uuid}
                  onClick={() => {
                    setSelectedUuid(uuid); setSelectedUuids(new Set([uuid])); setShowBookmarkList(false)
                    // 카메라 포커스: 북마크 클릭 시 해당 노드로 이동
                    if (!containerRef.current) return
                    const n = nodeMap.get(uuid)
                    if (!n) return
                    const { width, height } = containerRef.current.getBoundingClientRect()
                    const padding = 60
                    const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
                    const pw = n.width * Math.abs(n.scaleX)
                    const ph = n.height * Math.abs(n.scaleY)
                    const rx = sx - pw * n.anchorX
                    const ry = sy - ph * (1 - n.anchorY)
                    const bboxW = Math.max(pw, 40); const bboxH = Math.max(ph, 40)
                    const cx = rx + bboxW / 2; const cy = ry + bboxH / 2
                    const targetZoom = Math.min((width - padding * 2) / bboxW, (height - padding * 2) / bboxH, 4)
                    setView({ offsetX: width / 2 - cx * targetZoom, offsetY: height / 2 - cy * targetZoom, zoom: targetZoom })
                  }}
                  style={{ padding: '2px 4px', cursor: 'pointer', borderRadius: 2, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                  <span onClick={e => { e.stopPropagation(); setBookmarkedUuids(prev => { const s = new Set(prev); s.delete(uuid); return s }) }}
                    style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>×</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 참조 이미지 설정 패널 */}
        {showRefImagePanel && (
          <div style={{
            position: 'absolute', top: 6, right: 6, zIndex: 100,
            background: 'rgba(10,10,15,0.92)', border: '1px solid var(--accent)',
            borderRadius: 5, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4,
            minWidth: 220, boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>📷 참조 이미지</div>
            <input
              placeholder="이미지 URL 입력..."
              value={refImageUrl}
              onChange={e => setRefImageUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setShowRefImagePanel(false); e.stopPropagation() }}
              style={{ fontSize: 9, padding: '2px 5px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2, color: 'var(--text-primary)', outline: 'none', width: '100%' }}
            />
            <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>투명도:</span>
              <input type="range" min={0.05} max={1} step={0.05} value={refImageOpacity}
                onChange={e => setRefImageOpacity(Number(e.target.value))}
                onKeyDown={e => e.stopPropagation()}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ minWidth: 24 }}>{Math.round(refImageOpacity * 100)}%</span>
            </label>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {refImageUrl && <button onClick={() => setRefImageUrl('')} style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 2, color: '#f87171', cursor: 'pointer' }}>제거</button>}
              <button onClick={() => setShowRefImagePanel(false)} style={{ fontSize: 9, padding: '1px 6px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}>닫기</button>
            </div>
          </div>
        )}

        {/* 마우스 씬 좌표 표시 (SceneToolbar에 표시되므로 overlay 제거) */}

        {/* 드래그 델타 오버레이 */}
        {isDragging && dragDelta && hoverTooltipPos && (
          <div
            style={{
              position: 'absolute',
              left: hoverTooltipPos.x + 8,
              top: hoverTooltipPos.y - 30,
              background: 'rgba(10,10,20,0.9)',
              color: '#facc15',
              fontSize: 9,
              padding: '3px 7px',
              borderRadius: 3,
              pointerEvents: 'none',
              border: '1px solid rgba(250,200,50,0.4)',
              fontVariantNumeric: 'tabular-nums',
              zIndex: 20,
              lineHeight: 1.5,
            }}
          >
            <div>Δx: {dragDelta.dx > 0 ? '+' : ''}{dragDelta.dx}</div>
            <div>Δy: {dragDelta.dy > 0 ? '+' : ''}{dragDelta.dy}</div>
          </div>
        )}

        {/* 노드 호버 툴팁 (300ms 딜레이) */}
        {tooltipVisibleUuid && hoverTooltipPos && !isDragging && !isResizing && (() => {
          const hn = nodeMap.get(tooltipVisibleUuid)
          if (!hn) return null
          const icon = getComponentIcon(hn.components)
          const firstComp = hn.components[0]?.type ?? null
          return (
            <div
              style={{
                position: 'absolute',
                left: hoverTooltipPos.x,
                top: hoverTooltipPos.y,
                background: 'rgba(10,10,20,0.92)',
                color: '#e5e5e5',
                fontSize: 9,
                padding: '5px 8px',
                borderRadius: 4,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                border: '1px solid rgba(255,255,255,0.15)',
                zIndex: 10,
                lineHeight: 1.6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                {icon && <span style={{ color: 'var(--accent)', marginRight: 4 }}>{icon}</span>}
                {hn.name}
              </div>
              {firstComp && (
                <div style={{ color: 'var(--accent)', marginBottom: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {firstComp}
                </div>
              )}
              <div style={{ color: 'rgba(200,200,220,0.7)' }}>
                {Math.round(hn.width)} × {Math.round(hn.height)}
              </div>
              {hn.locked && <div style={{ color: '#f87171' }}>🔒 잠금됨</div>}
              {hn.visible === false && <div style={{ color: '#9ca3af' }}>숨김</div>}
              {hn.memo && <div style={{ color: '#fbbf24', marginTop: 2, maxWidth: 180, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>📝 {hn.memo}</div>}
            </div>
          )
        })()}

        {/* 레이어 패널 (좌측 상단, 접이식) */}
        {showLayerPanel && topLevelNodes.length > 0 && (
          <div style={{
            position: 'absolute', top: 4, left: 4, zIndex: 20,
            width: 150, maxHeight: 200, overflowY: 'auto',
            background: 'rgba(0,0,0,0.7)', borderRadius: 4,
            padding: '6px 8px', fontSize: 10,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: 10 }}>Layers</span>
              <button
                onClick={() => {
                  const next = !showAllToggle
                  setShowAllToggle(next)
                  if (next) {
                    setHiddenLayers(new Set())
                  } else {
                    setHiddenLayers(new Set(topLevelNodes.map(n => n.uuid)))
                  }
                }}
                title={showAllToggle ? '모두 숨김' : '모두 표시'}
                style={{
                  fontSize: 12, padding: '1px 3px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  opacity: showAllToggle ? 1 : 0.4,
                  textDecoration: showAllToggle ? 'none' : 'line-through',
                  lineHeight: 1,
                }}
              >
                {showAllToggle ? '👁' : '🙈'}
              </button>
            </div>
            {topLevelNodes.map(layer => {
              const isHidden = hiddenLayers.has(layer.uuid)
              const isLocked = lockedLayers.has(layer.uuid)
              const childCount = collectDescendants(layer.uuid).length - 1
              return (
                <div key={layer.uuid} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={() => setHiddenLayers(prev => { const s = new Set(prev); if (s.has(layer.uuid)) s.delete(layer.uuid); else s.add(layer.uuid); return s })}
                    title={isHidden ? '표시' : '숨김'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, opacity: isHidden ? 0.4 : 1, lineHeight: 1 }}
                  >
                    {isHidden ? '🙈' : '👁'}
                  </button>
                  <button
                    onClick={() => setLockedLayers(prev => { const s = new Set(prev); if (s.has(layer.uuid)) s.delete(layer.uuid); else s.add(layer.uuid); return s })}
                    title={isLocked ? '잠금 해제' : '잠금'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, opacity: isLocked ? 1 : 0.4, lineHeight: 1 }}
                  >
                    {isLocked ? '🔒' : '🔓'}
                  </button>
                  <span
                    style={{ flex: 1, color: isHidden ? 'rgba(255,255,255,0.3)' : '#e0e0e0', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={layer.name}
                  >
                    {layer.name}
                  </span>
                  {childCount > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>{childCount}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 미니맵 오버레이 */}
        {showMinimap && nodeMap.size > 0 && (() => {
          const MM_W = 90, MM_H = 60
          // 씬 전체 노드 bounding box 계산 (디자인 좌표 기준)
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          nodeMap.forEach(n => {
            const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
            minX = Math.min(minX, sx - n.width / 2)
            minY = Math.min(minY, sy - n.height / 2)
            maxX = Math.max(maxX, sx + n.width / 2)
            maxY = Math.max(maxY, sy + n.height / 2)
          })
          // 기본 씬 영역 포함
          minX = Math.min(minX, 0); minY = Math.min(minY, 0)
          maxX = Math.max(maxX, DESIGN_W); maxY = Math.max(maxY, DESIGN_H)
          const scW = maxX - minX || DESIGN_W
          const scH = maxY - minY || DESIGN_H
          const sx = MM_W / scW, sy = MM_H / scH
          return (
            <div
              style={{
                position: 'absolute',
                bottom: 28,
                right: 6,
                width: MM_W,
                height: MM_H,
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                overflow: 'hidden',
                cursor: 'crosshair',
                userSelect: 'none',
              }}
              title="미니맵 — 클릭: 뷰포트 이동 / 더블클릭: 숨기기"
              onDoubleClick={e => { e.stopPropagation(); setShowMinimap(false) }}
              onClick={e => {
                // 미니맵 좌표 → 씬 좌표 → 뷰포트 오프셋 계산
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                const mmX = e.clientX - rect.left
                const mmY = e.clientY - rect.top
                // 씬 좌표 (SVG 공간)
                const sceneX = mmX / sx + minX
                const sceneY = mmY / sy + minY
                if (containerRef.current) {
                  const cw = containerRef.current.clientWidth
                  const ch = containerRef.current.clientHeight
                  setView(prev => ({
                    ...prev,
                    offsetX: cw / 2 - sceneX * prev.zoom,
                    offsetY: ch / 2 - sceneY * prev.zoom,
                  }))
                }
              }}
            >
              <svg width={MM_W} height={MM_H} style={{ display: 'block' }}>
                {/* 디자인 캔버스 경계 */}
                <rect
                  x={(0 - minX) * sx} y={(0 - minY) * sy}
                  width={DESIGN_W * sx} height={DESIGN_H * sy}
                  fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                />
                {/* 노드 표시 */}
                {[...nodeMap.values()].map(n => {
                  const { sx: nsx, sy: nsy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
                  const mx = (nsx - n.width / 2 - minX) * sx
                  const my = (nsy - n.height / 2 - minY) * sy
                  const mw = Math.max(1, n.width * sx)
                  const mh = Math.max(1, n.height * sy)
                  const isSelected = selectedUuids.has(n.uuid)
                  const color = n.color ? `rgba(${n.color.r ?? 255},${n.color.g ?? 255},${n.color.b ?? 255},0.7)` : 'rgba(100,180,255,0.5)'
                  return (
                    <rect key={n.uuid} x={mx} y={my} width={mw} height={mh}
                      fill={isSelected ? '#60a5fa' : color}
                      stroke={isSelected ? '#60a5fa' : 'none'}
                      strokeWidth={isSelected ? 0.5 : 0}
                      opacity={n.active ? 1 : 0.3}
                    />
                  )
                })}
                {/* 현재 뷰포트 표시 */}
                {containerRef.current && (() => {
                  const cw = containerRef.current!.clientWidth
                  const ch = containerRef.current!.clientHeight
                  const vx = (-view.offsetX / view.zoom - minX) * sx
                  const vy = (-view.offsetY / view.zoom - minY) * sy
                  const vw = (cw / view.zoom) * sx
                  const vh = (ch / view.zoom) * sy
                  return (
                    <rect x={vx} y={vy} width={vw} height={vh}
                      fill="none" stroke="rgba(250,200,50,0.7)" strokeWidth={1}
                    />
                  )
                })()}
              </svg>
            </div>
          )
        })()}

        {/* 미니맵 숨겨진 경우 복원 버튼 */}
        {!showMinimap && (
          <button
            onClick={() => setShowMinimap(true)}
            title="미니맵 표시"
            style={{
              position: 'absolute', bottom: 28, right: 6,
              fontSize: 9, padding: '1px 4px',
              background: 'rgba(15,15,20,0.8)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            ⊞
          </button>
        )}

        {/* 변경 히스토리 버튼 + 팝업 */}
        {changeHistory.length > 0 && (
          <div style={{ position: 'absolute', bottom: 52, right: 6 }}>
            <button
              onClick={() => setShowChangeHistory(v => !v)}
              title="최근 노드 이동 히스토리"
              style={{
                fontSize: 9, padding: '1px 4px',
                background: showChangeHistory ? 'var(--accent-dim)' : 'rgba(15,15,20,0.8)',
                border: `1px solid ${showChangeHistory ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 3, color: showChangeHistory ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              ↕ {changeHistory.length}
            </button>
            {showChangeHistory && (
              <div
                style={{
                  position: 'absolute', bottom: 22, right: 0,
                  width: 180, maxHeight: 200, overflowY: 'auto',
                  background: 'rgba(10,10,15,0.95)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  fontSize: 9, color: 'var(--text-muted)',
                }}
              >
                <div style={{ padding: '3px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  최근 이동 히스토리
                </div>
                {changeHistory.map((entry, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedUuid(entry.uuid); setSelectedUuids(new Set([entry.uuid])); setShowChangeHistory(false) }}
                    style={{ padding: '3px 8px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.name}</span>
                    <span style={{ flexShrink: 0, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{entry.x}, {entry.y}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 회전 각도 오버레이 */}
        {isRotating && selectedNode && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 13,
              fontWeight: 700,
              color: '#fb923c',
              background: 'rgba(0,0,0,0.65)',
              padding: '3px 10px',
              borderRadius: 4,
              pointerEvents: 'none',
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 1,
            }}
          >
            {selectedNode.rotation.toFixed(1)}°
          </div>
        )}

        {/* 퀵 액션 팝업 — 단일 노드 선택 시 우상단에 표시 */}
        {showQuickActions && !quickActionDismissed && selectedUuids.size === 1 && selectedNode && !isDragging && !isResizing && (() => {
          const n = selectedNode
          const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
          // SVG 좌표 → 화면(container) 좌표
          const screenX = sx * view.zoom + view.offsetX
          const screenY = sy * view.zoom + view.offsetY
          const PW = 100
          const PH = 32
          const containerW = containerRef.current?.clientWidth ?? 600
          const containerH = containerRef.current?.clientHeight ?? 400
          // 노드 우상단 근처에 배치, 뷰포트 클램핑
          let px = screenX + 8
          let py = screenY - PH - 8
          px = Math.max(4, Math.min(px, containerW - PW - 4))
          py = Math.max(4, Math.min(py, containerH - PH - 4))

          const isPinned = pinnedUuids.has(n.uuid)
          const isLocked = lockedUuids.has(n.uuid)
          const topUuid = nodeToTopLevel.get(n.uuid)
          const isHidden = !!(topUuid && hiddenLayers.has(topUuid))

          const btnStyle: React.CSSProperties = {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 3px',
            color: 'rgba(255,255,255,0.8)',
            userSelect: 'none',
          }
          return (
            <>
              {/* 외부 클릭 시 닫힘 — pointer-events 없는 전체 오버레이 대신 mousedown 감지 */}
              <div
                style={{ position: 'absolute', inset: 0, zIndex: 29, background: 'transparent' }}
                onMouseDown={() => setQuickActionDismissed(true)}
              />
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: px,
                  top: py,
                  width: PW,
                  height: PH,
                  zIndex: 30,
                  background: 'rgba(15,15,25,0.92)',
                  border: '1px solid rgba(96,165,250,0.45)',
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  padding: '0 4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  pointerEvents: 'all',
                }}
              >
                {/* 핀 토글 */}
                <button
                  style={{ ...btnStyle, color: isPinned ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}
                  title={isPinned ? '핀 해제' : '핀 고정'}
                  onClick={e => { e.stopPropagation(); togglePin(n.uuid) }}
                >📌</button>
                {/* 잠금 토글 */}
                <button
                  style={{ ...btnStyle, color: isLocked ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}
                  title={isLocked ? '잠금 해제' : '잠금'}
                  onClick={e => {
                    e.stopPropagation()
                    setLockedUuids(prev => {
                      const next = new Set(prev)
                      if (isLocked) next.delete(n.uuid); else next.add(n.uuid)
                      localStorage.setItem('scene-locked', JSON.stringify([...next]))
                      return next
                    })
                    updateNode(n.uuid, { locked: !isLocked })
                  }}
                >🔒</button>
                {/* 숨김 토글 */}
                <button
                  style={{ ...btnStyle, opacity: isHidden ? 0.4 : 1 }}
                  title={isHidden ? '표시' : '숨기기'}
                  onClick={e => {
                    e.stopPropagation()
                    if (!topUuid) return
                    setHiddenLayers(prev => {
                      const next = new Set(prev)
                      if (isHidden) next.delete(topUuid); else next.add(topUuid)
                      return next
                    })
                  }}
                >👁</button>
                {/* 삭제 */}
                <button
                  style={{ ...btnStyle, color: 'rgba(239,68,68,0.85)' }}
                  title="삭제"
                  onClick={e => { e.stopPropagation(); setQuickActionDismissed(true); handleDeleteNode() }}
                >✂</button>
                {/* UUID 복사 */}
                <button
                  style={{ ...btnStyle, color: 'rgba(167,243,208,0.85)' }}
                  title="UUID 복사"
                  onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(n.uuid) }}
                >📋</button>
              </div>
            </>
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
              ['Ctrl+Shift+A', '선택 반전 (비선택 ↔ 선택)'],
              ['Ctrl+C', '복사'],
              ['Ctrl+V', '붙여넣기'],
              ['Ctrl+D', '복제 (클립보드 유지)'],
              ['Escape', '선택 해제 (드래그/리사이즈 중: 취소 복원)'],
              ['Shift+리사이즈', '비례 리사이즈 (코너 핸들)'],
              ['↑↓←→', '선택 노드 1px 이동'],
              ['Shift+↑↓←→', '선택 노드 10px 이동'],
              ['Alt+↑/↓', '부모/첫 자식 노드 선택'],
              ['Ctrl+←/→', '회전 1° (Shift: 10°)'],
              ['M', '미니맵 토글'],
              ['R', '눈금자 토글'],
              ['N', '새 노드 생성'],
              ['Tab/Shift+Tab', '다음/이전 형제 노드 선택'],
              ['Ctrl+G', '선택 노드 그룹화'],
              ['Ctrl+Shift+G', '그룹 해제 (자식 노드 상위로)'],
              ['Ctrl+]', '앞으로 (z-order +1)'],
              ['Ctrl+[', '뒤로 (z-order -1)'],
              ['Del/Backspace', '선택 노드 삭제'],
              ['H', '선택 노드 숨기기/보이기 토글'],
              ['Alt+H', '좌우 반전 (scaleX 부호 반전)'],
              ['Alt+V', '상하 반전 (scaleY 부호 반전)'],
              ['Alt+L', '선택 노드 잠금/해제'],
              ['Alt+1~9', '색상 레이블 지정 (Alt+0: 초기화)'],
              ['Alt+[ / Alt+]', '선택 노드 투명도 -10 / +10'],
              ['I', '선택 노드 상세 정보 오버레이'],
              ['P', '부모 노드 선택'],
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
        onMemo={(uuid, memo) => updateNode(uuid, { memo })}
        onTagsUpdate={(uuid, tags) => updateNode(uuid, { tags })}
        onLabelColorUpdate={(uuid, color) => updateNode(uuid, { labelColor: color })}
        onColorUpdate={handleColorUpdate}
        focusNameTrigger={inspectorNameFocus}
        nodeMap={nodeMap}
        onSelectParent={uuid => { setSelectedUuid(uuid); setSelectedUuids(new Set([uuid])) }}
        connected={connected}
        onComponentClick={(uuid) => {
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
          setFlashUuid(uuid)
          flashTimerRef.current = setTimeout(() => setFlashUuid(null), 1200)
        }}
        onApplyToCocos={async (node) => {
          if (!connected) return
          try {
            await window.api.ccMoveNode?.(port, node.uuid, node.x, node.y)
            await window.api.ccSetProperty?.(port, node.uuid, 'width', node.width)
            await window.api.ccSetProperty?.(port, node.uuid, 'height', node.height)
          } catch (e) {
            console.error('[ApplyToCocos]', e)
          }
        }}
      />

      {/* SVG 우클릭 컨텍스트 메뉴 */}
      {svgContextMenu && (() => {
        const ctxUuid = svgContextMenu.uuid
        const ctxNode = ctxUuid ? nodeMap.get(ctxUuid) : null
        const close = () => setSvgContextMenu(null)
        const menuStyle: React.CSSProperties = {
          display: 'block', width: '100%', textAlign: 'left',
          padding: '5px 12px', background: 'none', border: 'none',
          color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11,
          whiteSpace: 'nowrap',
        }
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={close} onContextMenu={e => { e.preventDefault(); close() }} />
            <div style={{
              position: 'fixed', left: svgContextMenu.x, top: svgContextMenu.y,
              zIndex: 1000, background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 150, fontSize: 11,
            }}>
              {ctxNode && (
                <div style={{ padding: '3px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  {ctxNode.name}
                </div>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => { setSelectedUuid(ctxUuid!); setSelectedUuids(new Set([ctxUuid!])); close() }}>선택</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  setSelectedUuid(ctxUuid!)
                  setSelectedUuids(new Set([ctxUuid!]))
                  const n = nodeMap.get(ctxUuid!)
                  if (n) {
                    setClipboard([{ uuid: n.uuid, name: n.name, x: n.x ?? 0, y: n.y ?? 0 }])
                    setCopiedNode(n)
                  }
                  close()
                }}>복사</button>
              )}
              <button style={menuStyle} onClick={() => { handlePaste(); close() }}>붙여넣기</button>
              {ctxNode && (
                <button style={menuStyle} onClick={() => { handleDuplicate(); close() }}>복제</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  updateNode(ctxUuid!, { visible: ctxNode.visible === false ? true : false })
                  close()
                }}>{ctxNode.visible === false ? '👁 보이기' : '👁 숨기기'}</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  updateNode(ctxUuid!, { locked: !ctxNode.locked })
                  close()
                }}>{ctxNode.locked ? '🔓 잠금 해제' : '🔒 잠금'}</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  setBookmarkedUuids(prev => {
                    const next = new Set(prev)
                    if (next.has(ctxUuid!)) next.delete(ctxUuid!)
                    else next.add(ctxUuid!)
                    return next
                  })
                  close()
                }}>{bookmarkedUuids.has(ctxUuid!) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  navigator.clipboard?.writeText(ctxUuid!)
                  close()
                }}>📋 UUID 복사</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  const pathParts: string[] = []
                  let cur: SceneNode | undefined = ctxNode
                  while (cur) { pathParts.unshift(cur.name); cur = cur.parentUuid ? nodeMap.get(cur.parentUuid) : undefined }
                  navigator.clipboard?.writeText(pathParts.join('/'))
                  close()
                }}>📋 경로 복사</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  const existing = nodeTags[ctxUuid!] ?? []
                  setNodeTagDraft(existing.join(', '))
                  setNodeTagInput(ctxUuid!)
                  close()
                }}>🏷 태그 편집</button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              {ctxNode && (
                <button style={{ ...menuStyle, color: 'var(--error)' }} onClick={() => {
                  close()
                  handleDeleteNode()
                }}>삭제</button>
              )}
            </div>
          </>
        )
      })()}

      {/* 노드 태그 입력 모달 */}
      {nodeTagInput && (() => {
        const addNodeTag = () => {
          const tags = nodeTagDraft.split(',').map(t => t.trim()).filter(Boolean)
          setNodeTags(prev => {
            const next = { ...prev, [nodeTagInput]: tags }
            if (tags.length === 0) delete next[nodeTagInput]
            localStorage.setItem('node-tags', JSON.stringify(next))
            return next
          })
          setNodeTagInput(null)
          setNodeTagDraft('')
        }
        const nodeName = nodeMap.get(nodeTagInput)?.name ?? nodeTagInput
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'rgba(0,0,0,0.4)' }}
              onClick={() => { setNodeTagInput(null); setNodeTagDraft('') }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 2000, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '16px 20px', minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                태그 편집 — {nodeName}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                쉼표로 구분하여 여러 태그 입력 (예: ui, button, important)
              </div>
              <input
                autoFocus
                value={nodeTagDraft}
                onChange={e => setNodeTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addNodeTag()
                  if (e.key === 'Escape') { setNodeTagInput(null); setNodeTagDraft('') }
                }}
                placeholder="태그 입력..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '5px 8px', fontSize: 11,
                  color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setNodeTagInput(null); setNodeTagDraft('') }}
                  style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={addNodeTag}
                  style={{ fontSize: 11, padding: '4px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                  저장
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

export default SceneViewPanel
