import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SceneNode, ViewTransform, DragState, ResizeState, MarqueeState, UndoEntry, ClipboardEntry } from './types'
import { useSceneSync } from './useSceneSync'
import { NodeRenderer } from './NodeRenderer'
import { SceneToolbar } from './SceneToolbar'
import type { SceneBgValue } from './SceneToolbar'
import { SceneInspector } from './SceneInspector'
import { getRenderOrder, cocosToSvg, getComponentIcon } from './utils'
import { NodeHierarchyList } from './NodeHierarchyList'
import { useSceneViewKeyboard } from './useSceneViewKeyboard'
import { useSceneViewMouse } from './useSceneViewMouse'
import { useSceneViewActions } from './useSceneViewActions'
import {
  type Annotation, type SnapshotEntry, type NodeSnapshot, type EditHistoryEntry,
  type ViewportPreset, type NodeTemplate, type CameraBookmark, type SceneViewPanelProps,
  CC_LAYER_NAMES, CANVAS_PRESETS, COLOR_TAG_PALETTE, LAYER_COLOR_PALETTE,
  VP_KEY, NT_KEY, VB_KEY, DEFAULT_PRESETS, DEFAULT_TEMPLATES, PNG_BG_COLORS,
  getRulerTicks, buildHeatmap, slotKey,
} from './sceneViewConstants'

// Types and constants imported from ./sceneViewConstants

export function SceneViewPanel({ connected, port = 9091 }: SceneViewPanelProps) {
  // ── 씬 데이터 ──────────────────────────────────────────────
  const { nodeMap, rootUuid, loading, refresh, refreshNode, updateNode } = useSceneSync(connected, port)

  // ── 뷰 상태 ────────────────────────────────────────────────
  const [view, setView] = useState<ViewTransform>(() => {
    try {
      const z = localStorage.getItem('scene-view-zoom')
      const p = localStorage.getItem('scene-view-pan')
      const zoom = z ? parseFloat(z) : 1
      const pan = p ? JSON.parse(p) : { x: 0, y: 0 }
      return { offsetX: pan.x, offsetY: pan.y, zoom }
    } catch { return { offsetX: 0, offsetY: 0, zoom: 1 } }
  })
  const [activeTool, setActiveTool] = useState<'select' | 'move'>('select')
  const [showRuler, setShowRuler] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 640 })
  const DESIGN_W = canvasSize.w
  const DESIGN_H = canvasSize.h
  const [gridVisible, setGridVisible] = useState(true)
  // R1422: 그리드 커스터마이즈 (크기/색상/불투명도) — localStorage grid-settings
  const [gridSettings, setGridSettings] = useState<{ size: number; theme: 'light' | 'dark'; opacity: number }>(() => {
    try {
      const raw = localStorage.getItem('grid-settings')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { size: 50, theme: 'dark', opacity: 0.04 }
  })
  const [showGridSettings, setShowGridSettings] = useState(false)
  const gridSettingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    try { localStorage.setItem('grid-settings', JSON.stringify(gridSettings)) } catch { /* ignore */ }
  }, [gridSettings])
  // R1422: 그리드 설정 팝업 외부 클릭 닫기
  useEffect(() => {
    if (!showGridSettings) return
    const handleClick = (e: MouseEvent) => {
      if (gridSettingsRef.current && !gridSettingsRef.current.contains(e.target as Node)) {
        setShowGridSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showGridSettings])
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
  // R1401: 씬 통계 오버레이 (localStorage 영구 저장)
  const [showStatsOverlay, setShowStatsOverlay] = useState(() => {
    try { return localStorage.getItem('scene-stats-overlay') === 'true' } catch { return false }
  })
  const [showChangeHistory, setShowChangeHistory] = useState(false)
  const [componentFilter, setComponentFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [flashUuid, setFlashUuid] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [collapsedUuids, setCollapsedUuids] = useState<Set<string>>(new Set())
  const [focusMode, setFocusMode] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [refImageUrl, setRefImageUrl] = useState('')
  // R1378: 북마크를 localStorage per scene으로 영구 저장
  const [bookmarkedUuids, setBookmarkedUuids] = useState<Set<string>>(() => {
    try {
      const key = `scene-bookmarks-${rootUuid ?? 'default'}`
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'))
    } catch { return new Set() }
  })
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
  // R1407: 노드 색상 태그 (7색 팔레트, localStorage per scene)
  const [nodeColorTags, setNodeColorTags] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`node-color-tags-${rootUuid ?? 'default'}`) ?? '{}') } catch { return {} }
  })
  const [showColorTagPicker, setShowColorTagPicker] = useState<{ uuid: string; x: number; y: number } | null>(null)
  useEffect(() => {
    try { localStorage.setItem(`node-color-tags-${rootUuid ?? 'default'}`, JSON.stringify(nodeColorTags)) } catch { /* ignore */ }
  }, [nodeColorTags, rootUuid])
  const viewHistoryRef = useRef<ViewTransform[]>([])
  const viewHistIdxRef = useRef(-1)
  const viewRef = useRef(view)
  viewRef.current = view
  useEffect(() => {
    try {
      localStorage.setItem('scene-view-zoom', String(view.zoom))
      localStorage.setItem('scene-view-pan', JSON.stringify({ x: view.offsetX, y: view.offsetY }))
    } catch { /* ignore */ }
  }, [view.zoom, view.offsetX, view.offsetY])
  // R1378: 북마크 localStorage 영구 저장
  useEffect(() => {
    try {
      const key = `scene-bookmarks-${rootUuid ?? 'default'}`
      localStorage.setItem(key, JSON.stringify([...bookmarkedUuids]))
    } catch { /* ignore */ }
  }, [bookmarkedUuids, rootUuid])
  // R1401: 통계 오버레이 localStorage 영구 저장
  useEffect(() => {
    try { localStorage.setItem('scene-stats-overlay', String(showStatsOverlay)) } catch { /* ignore */ }
  }, [showStatsOverlay])
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
  // R1395: 레이어 가시성/잠금 localStorage 영구 저장 + 색상 라벨
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-hidden-layers') ?? '[]')) } catch { return new Set() }
  })
  const [showAllToggle, setShowAllToggle] = useState(true)
  const [lockedLayers, setLockedLayers] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-locked-layers') ?? '[]')) } catch { return new Set() }
  })
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [layerColors, setLayerColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('scene-layer-colors') ?? '{}') } catch { return {} }
  })
  // LAYER_COLOR_PALETTE imported from sceneViewConstants
  const [sceneAtlas, setSceneAtlas] = useState<string[]>([])
  const [showAtlasPanel, setShowAtlasPanel] = useState(false)
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const canvasSearchRef = useRef<HTMLInputElement>(null)

  // ── R1419: 뷰포트 프리셋 ─────────────────────────────────────
  const [viewportPresets, setViewportPresets] = useState<ViewportPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(VP_KEY) ?? '[]') } catch { return [] }
  })
  const [showViewportPresets, setShowViewportPresets] = useState(false)

  // ── R1435: 씬 JSON 뷰어 ─────────────────────────────────────
  const [showJsonViewer, setShowJsonViewer] = useState(false)
  const [jsonViewScope, setJsonViewScope] = useState<'selected' | 'full'>('selected')

  // ── R1438: 씬 공유 로컬 서버 ────────────────────────────────
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  // ── R1440: 씬 JSON 임포트 모달 ────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  // ── R1446: 씬 편집 이력 (리플레이용) ──────────────────────
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([])
  const [showEditHistory, setShowEditHistory] = useState(false)
  const addEditHistory = useCallback((action: string, nodeUuid: string, nodeName: string, before: Record<string, unknown>, after: Record<string, unknown>) => {
    setEditHistory(prev => [{ timestamp: Date.now(), action, nodeUuid, nodeName, before, after }, ...prev].slice(0, 100))
  }, [])

  // ── R1450: 레이어 드래그 재배치 상태 ──────────────────────
  const [layerDragIdx, setLayerDragIdx] = useState<number | null>(null)
  const [layerDropIdx, setLayerDropIdx] = useState<number | null>(null)

  // ── R1452: 씬 노드 템플릿 라이브러리 ──────────────────────
  const [nodeTemplates, setNodeTemplates] = useState<NodeTemplate[]>(() => {
    try { const raw = localStorage.getItem(NT_KEY); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)

  // ── R1455: 씬 뷰 북마크 (카메라 포지션) ──────────────────
  const [viewBookmarks, setViewBookmarks] = useState<(CameraBookmark)[]>(() => {
    try { const raw = localStorage.getItem(VB_KEY); return raw ? JSON.parse(raw) : [null, null, null, null, null] } catch { return [null, null, null, null, null] }
  })
  const [viewBookmarkToast, setViewBookmarkToast] = useState<string | null>(null)
  const viewBookmarkToastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── R1442: 정렬 가이드라인 고도화 ─────────────────────────
  const [showCenterGuide, setShowCenterGuide] = useState(false)
  const [snapThreshold, setSnapThreshold] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('align-snap-threshold') ?? '8') } catch { return 8 }
  })
  useEffect(() => {
    try { localStorage.setItem('align-snap-threshold', String(snapThreshold)) } catch { /* ignore */ }
  }, [snapThreshold])

  // ── R1424: 다중 씬 비교 뷰 ─────────────────────────────────
  const [compareMode, setCompareMode] = useState(false)
  const [compareScenePath, setCompareScenePath] = useState<string | null>(null)
  const [compareView, setCompareView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 1 })

  // ── 스냅샷 / diff 상태 ─────────────────────────────────────
  const [snapshot, setSnapshot] = useState<Map<string, SnapshotEntry> | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  // ── R1381: 씬 diff 뷰어 — savedSnapshot + diffMode ────────
  const [savedSnapshot, setSavedSnapshot] = useState<Map<string, NodeSnapshot>>(new Map())
  const [diffModeR1381, setDiffModeR1381] = useState(false)

  // savedSnapshot 생성 (씬 로드 시)
  useEffect(() => {
    if (nodeMap.size === 0) return
    const snap = new Map<string, NodeSnapshot>()
    for (const [uuid, n] of nodeMap.entries()) {
      snap.set(uuid, { x: n.x, y: n.y, w: n.width, h: n.height, name: n.name, active: n.active })
    }
    setSavedSnapshot(snap)
  }, [rootUuid])  // rootUuid 변경 = 새 씬 로드

  // changedUuids 계산
  const changedUuids = useMemo(() => {
    if (!diffModeR1381 || savedSnapshot.size === 0) return new Set<string>()
    const changed = new Set<string>()
    for (const [uuid, n] of nodeMap.entries()) {
      const s = savedSnapshot.get(uuid)
      if (!s) { changed.add(uuid); continue }
      if (s.x !== n.x || s.y !== n.y || s.w !== n.width || s.h !== n.height || s.name !== n.name || s.active !== n.active) {
        changed.add(uuid)
      }
    }
    return changed
  }, [diffModeR1381, savedSnapshot, nodeMap])

  // R1431: Before/After 슬라이더 비교 모드
  const [beforeAfterMode, setBeforeAfterMode] = useState(false)
  const [sliderX, setSliderX] = useState(0.5) // 0~1 비율
  const beforeAfterDragRef = useRef(false)

  // ── 스냅샷 기록 상태 ────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<Array<{ label: string; timestamp: number; nodes: unknown[] }>>([])
  const [snapshotOpen, setSnapshotOpen] = useState(false)

  // ── 히트맵 상태 ────────────────────────────────────────────
  const [showHeatmap, setShowHeatmap] = useState(false)
  // ── 노드 접근 빈도 히트맵 (R702) ───────────────────────────
  const [nodeAccessCount, setNodeAccessCount] = useState<Record<string, number>>({})
  // ── R1460: 노드 클릭 횟수 히트맵 ────────────────────────────
  const [nodeClickCount, setNodeClickCount] = useState<Map<string, number>>(new Map())
  const [showClickHeatmap, setShowClickHeatmap] = useState(false)
  const maxClickCount = useMemo(() => {
    if (nodeClickCount.size === 0) return 1
    return Math.max(...nodeClickCount.values(), 1)
  }, [nodeClickCount])
  // ── R1464: 씬 노드 애니메이션 프리뷰 ─────────────────────────
  const [animPlayingUuid, setAnimPlayingUuid] = useState<string | null>(null)
  const animCssRef = useRef<HTMLStyleElement | null>(null)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleAnimPreviewStart = useCallback((uuid: string, durationMs: number) => {
    // 이전 애니메이션 정리
    if (animCssRef.current) { animCssRef.current.remove(); animCssRef.current = null }
    if (animTimerRef.current) { clearTimeout(animTimerRef.current); animTimerRef.current = null }
    const style = document.createElement('style')
    style.textContent = `
      @keyframes cc-anim-preview-${uuid.replace(/[^a-zA-Z0-9]/g, '_')} {
        0% { opacity: 1; transform: translate(0, 0); }
        25% { opacity: 0.3; transform: translate(2px, -2px); }
        50% { opacity: 1; transform: translate(0, 0); }
        75% { opacity: 0.3; transform: translate(-2px, 2px); }
        100% { opacity: 1; transform: translate(0, 0); }
      }
      [data-uuid="${uuid}"] {
        animation: cc-anim-preview-${uuid.replace(/[^a-zA-Z0-9]/g, '_')} ${durationMs}ms infinite ease-in-out !important;
      }
    `
    document.head.appendChild(style)
    animCssRef.current = style
    setAnimPlayingUuid(uuid)
  }, [])
  const handleAnimPreviewStop = useCallback(() => {
    if (animCssRef.current) { animCssRef.current.remove(); animCssRef.current = null }
    if (animTimerRef.current) { clearTimeout(animTimerRef.current); animTimerRef.current = null }
    setAnimPlayingUuid(null)
  }, [])

  // ── R1468: AI 분석 요청 ─────────────────────────────────────
  const handleAiAnalyze = useCallback((uuid: string) => {
    const n = nodeMap.get(uuid)
    if (!n) return
    const comps = n.components.map(c => c.type).join(', ')
    const msg = `이 Cocos Creator 노드를 분석해줘:\n노드: ${n.name}\n컴포넌트: ${comps}\n주요 속성: position=(${n.x},${n.y}), size=(${n.width},${n.height}), active=${n.active}, opacity=${n.opacity}`
    // 채팅창에 프리필 (cc-chat-prefill 이벤트)
    window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { message: msg } }))
  }, [nodeMap])

  // ── 노드 그룹 색상 (R709) ──────────────────────────────────
  const [nodeGroupColors, setNodeGroupColors] = useState<Record<string, string>>({})
  const [colorPickerNode, setColorPickerNode] = useState<string | null>(null)
  // ── 노드 메모 (R716) ──────────────────────────────────────────
  const [nodeMemos, setNodeMemos] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('node-memos') ?? '{}'))
  const [editingNodeMemo, setEditingNodeMemo] = useState<string | null>(null)
  // ── 노드 링크 (R721) ──────────────────────────────────────────
  const [nodeLinks, setNodeLinks] = useState<Record<string, string[]>>({})
  // ── 노드 배지 (R725) ──────────────────────────────────────────
  const [nodeBadges, setNodeBadges] = useState<Record<string, string>>({})
  const [badgeEditNode, setBadgeEditNode] = useState<string | null>(null)
  // ── 씬 히스토리 (R730) ──────────────────────────────────────────
  const [sceneHistory, setSceneHistory] = useState<string[]>([])
  const [showSceneHistory, setShowSceneHistory] = useState(false)
  // ── R1383: 씬 파일 탭 바 ──────────────────────────────────────
  const [sceneTabFiles, setSceneTabFiles] = useState<string[]>([])
  const [activeSceneTab, setActiveSceneTab] = useState<string | null>(null)
  // 씬 히스토리에서 탭 목록 자동 생성 (최대 5개)
  useEffect(() => {
    const unique = [...new Set(sceneHistory)].slice(0, 5)
    setSceneTabFiles(unique)
    if (unique.length > 0 && !activeSceneTab) setActiveSceneTab(unique[0])
  }, [sceneHistory])
  // ── 즐겨찾기 씬 (R736) ──────────────────────────────────────────
  const [favoriteScenes, setFavoriteScenes] = useState<string[]>(() => JSON.parse(localStorage.getItem('fav-scenes') ?? '[]'))
  const [showFavScenes, setShowFavScenes] = useState(false)
  // ── 노드 잠금 (R742) ────────────────────────────────────────────
  const [lockAll, setLockAll] = useState(false)
  const [lockMode, setLockMode] = useState<'none' | 'selected' | 'all'>('none')
  // ── 씬 비교 (R748) ──────────────────────────────────────────────
  const [compareScene, setCompareScene] = useState<string | null>(null)
  const [showSceneCompare, setShowSceneCompare] = useState(false)
  // ── 씬 태그 (R752) ──────────────────────────────────────────────
  const [sceneTags, setSceneTags] = useState<Record<string, string[]>>(() => JSON.parse(localStorage.getItem('scene-tags') ?? '{}'))
  const [sceneTagInput, setSceneTagInput] = useState('')
  // ── 씬 메모 (R757) ──────────────────────────────────────────────
  const [sceneMemos, setSceneMemos] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('scene-memos') ?? '{}'))
  const [editingSceneMemo, setEditingSceneMemo] = useState<string | null>(null)
  // ── 노드 필터 (R763) ─────────────────────────────────────────
  const [visFilter, setVisFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string[]>([])
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [sceneModified, setSceneModified] = useState(false)
  const [sceneBookmarks, setSceneBookmarks] = useState<Array<{ path: string; label: string }>>(() => JSON.parse(localStorage.getItem('scene-bookmarks') ?? '[]'))
  const [showSceneBookmarks, setShowSceneBookmarks] = useState(false)
  const [sceneVersions, setSceneVersions] = useState<Array<{ timestamp: number; label: string }>>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [gridSnap, setGridSnap] = useState(false)
  const [gridSize, setGridSize] = useState(10)
  const [sceneStats, setSceneStats] = useState<{ nodeCount: number; componentCount: number; depth: number }>({ nodeCount: 0, componentCount: 0, depth: 0 })
  const [showSceneStats, setShowSceneStats] = useState(false)
  const [nodeSortKey, setNodeSortKey] = useState<'name' | 'type' | 'order'>('order')
  const [nodeSortAsc, setNodeSortAsc] = useState<boolean>(true)
  const [sceneLoadProgress, setSceneLoadProgress] = useState(0)
  const [sceneLoadStatus, setSceneLoadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

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
  // ── 씬 오버레이 (R1341) ─────────────────────────────────────
  const [sceneOverlay, setSceneOverlay] = useState(false)
  const [showOverlayPanel, setShowOverlayPanel] = useState(false)
  // ── 씬 그리드 (R1347) ────────────────────────────────────────
  const [sceneGrid, setSceneGrid] = useState(false)
  const [sceneGridSize, setSceneGridSize] = useState(32)
  // ── 씬 카메라 (R1353) ────────────────────────────────────────
  const [sceneCamera, setSceneCamera] = useState(false)
  const [sceneCameraFov, setSceneCameraFov] = useState(60)
  // ── 씬 라이팅 (R1359) ────────────────────────────────────────
  const [sceneLighting, setSceneLighting] = useState(false)
  const [lightingIntensity, setLightingIntensity] = useState(1.0)

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

  // buildHeatmap imported from sceneViewConstants

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
  const [favNodeGroups, setFavNodeGroups] = useState<Array<{ name: string; nodeIds: string[] }>>([])
  const [showFavGroups, setShowFavGroups] = useState(false)
  const [sceneSnapshots, setSceneSnapshots] = useState<Array<{ label: string; data: string; ts: number }>>([])
  const [showSnapshotDiff, setShowSnapshotDiff] = useState(false)
  const [diffMode, setDiffMode] = useState(false)
  const [diffBaseSnapshot, setDiffBaseSnapshot] = useState<string | null>(null)
  const [nodePresets, setNodePresets] = useState<Array<{ name: string; props: Record<string, unknown> }>>([])
  const [showPresetPanel, setShowPresetPanel] = useState(false)

  // ── 마퀴 선택 상태 ─────────────────────────────────────────
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [autoLayout, setAutoLayout] = useState<'none' | 'tree' | 'grid' | 'radial'>('none')
  const [layoutSpacing, setLayoutSpacing] = useState(60)
  const [showNodeLinks, setShowNodeLinks] = useState(false)
  const [nodeLinkFilter, setNodeLinkFilter] = useState<'all' | 'script' | 'prefab'>('all')
  const [treeFilter, setTreeFilter] = useState('')
  const [treeFilterResults, setTreeFilterResults] = useState<string[]>([])
  const [nodeAliases, setNodeAliases] = useState<Record<string, string>>({})
  const [showAliasEditor, setShowAliasEditor] = useState(false)
  const [nodeVisibilityGroups, setNodeVisibilityGroups] = useState<Record<string, boolean>>({})
  const [showVisibilityGroups, setShowVisibilityGroups] = useState(false)
  const [componentSearch, setComponentSearch] = useState('')
  const [componentSearchResults, setComponentSearchResults] = useState<string[]>([])
  const [nodePrefabLinks, setNodePrefabLinks] = useState<Record<string, string>>({})
  const [showPrefabLinks, setShowPrefabLinks] = useState(false)
  const [sceneNotes, setSceneNotes] = useState<Record<string, string>>({})
  const [showNotesPanel, setShowNotesPanel] = useState(false)
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(false)
  const [boundingBoxColor, setBoundingBoxColor] = useState('#00ff00')
  const [sceneProfiler, setSceneProfiler] = useState(false)
  const [profilerStats, setProfilerStats] = useState<{ fps: number; drawCalls: number; triangles: number } | null>(null)
  const [renderMode, setRenderMode] = useState<'normal' | 'wireframe' | 'overdraw'>('normal')
  const [showRenderOptions, setShowRenderOptions] = useState(false)
  const [lightingDebug, setLightingDebug] = useState(false)
  const [lightingOverlay, setLightingOverlay] = useState<'none' | 'diffuse' | 'specular' | 'ambient'>('none')
  const [cameraFov, setCameraFov] = useState(60)
  const [showCameraControls, setShowCameraControls] = useState(false)
  const [gizmoSize, setGizmoSize] = useState(1.0)
  const [showGizmoSettings, setShowGizmoSettings] = useState(false)
  // R1428: 히트 테스트 정밀화 상태
  const [blockInactiveClick, setBlockInactiveClick] = useState(false)
  const tabCycleRef = useRef<{ lastClickPos: { x: number; y: number }; candidates: string[]; index: number } | null>(null)
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

  // ── Actions hook (copy/paste/group/align/export 등) ─────────
  const {
    handleCopy, handlePaste, handleDuplicate,
    handleGroup, handleUngroup,
    handleCreateNode, handleDeleteNode,
    handleZOrder, handleAlign,
    handleMatchSize, handleDistribute, handleGridLayout,
    handleDistributeHEqual, handleDistributeVEqual, handleCircularLayout,
    handleExportSvg, handleExportPng, handleScreenshot,
  } = useSceneViewActions({
    nodeMap, selectedUuid, selectedUuids, rootUuid, port,
    DESIGN_W, DESIGN_H, clipboard, svgRef, pngExportScale, pngExportBg,
    setSelectedUuid, setSelectedUuidsReplace: setSelectedUuids as unknown as (s: Set<string>) => void,
    setClipboard, setCopiedNode, setScreenshotDone,
    updateNode, refresh,
  })

  // ── Keyboard hook (단축키 + Space패닝 + Ctrl+1~5 뷰북마크 + 전체선택 + 방향키) ──
  useSceneViewKeyboard({
    nodeMap, selectedUuid, selectedUuids, rootUuid, isDragging, isResizing,
    spaceDown, port, view, viewRef, viewHistoryRef, viewHistIdxRef,
    dragRef, resizeRef, canvasSearchRef, viewBookmarks, viewBookmarkToastRef,
    setActiveTool, setSelectedUuid,
    setSelectedUuids: fn => setSelectedUuids(fn as any),
    setSelectedUuidsReplace: s => setSelectedUuids(s),
    setView, setShowStatsOverlay, setShowNodeInfo, setShowMinimap, setShowRuler,
    setShowCanvasSearch, setShowShortcuts, setSpaceDown,
    setIsDragging, setIsResizing, setMarquee: () => setMarquee(null),
    setUndoStack, setRedoStack,
    setBookmarkedUuids: fn => setBookmarkedUuids(fn),
    setFocusMode, setMeasureMode,
    setMeasureLine: () => setMeasureLine(null),
    setCollapsedUuids,
    setViewBookmarks, setViewBookmarkToast,
    handleFit, handleFocusSelected, handleCopy, handlePaste, handleDuplicate,
    handleGroup, handleUngroup, handleCreateNode, handleDeleteNode,
    updateNode, measureStartRef,
  })

  // Space키/뷰북마크/전체선택/방향키 → useSceneViewKeyboard에서 처리

  // R1412: 채팅 연동 노드 하이라이트 (cc-highlight-node 커스텀 이벤트)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { nodeName?: string; uuid?: string } | undefined
      if (!detail) return
      let targetUuid: string | null = null
      if (detail.uuid && nodeMap.has(detail.uuid)) {
        targetUuid = detail.uuid
      } else if (detail.nodeName) {
        const lower = detail.nodeName.toLowerCase()
        for (const [uuid, n] of nodeMap.entries()) {
          if (n.name.toLowerCase() === lower) { targetUuid = uuid; break }
        }
      }
      if (targetUuid) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlashUuid(targetUuid)
        flashTimerRef.current = setTimeout(() => setFlashUuid(null), 3000)
      }
    }
    window.addEventListener('cc-highlight-node', handler)
    return () => window.removeEventListener('cc-highlight-node', handler)
  }, [nodeMap])

  // Ctrl+A, nudge 등 → useSceneViewKeyboard에서 처리

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

  // ── Mouse hook (SVG좌표변환 + 드래그/리사이즈/회전/줌/패닝) ──
  const {
    getSvgCoords, svgToScene, hitTestAtPoint,
    handleSvgMouseDown, handleNodeMouseDown,
    handleResizeMouseDown, handleRotateMouseDown,
    handleMouseMove, handleMouseUp,
    animateToTarget,
  } = useSceneViewMouse({
    nodeMap, selectedUuid, selectedUuids, view, viewRef,
    activeTool, spaceDown, snapEnabled, snapGrid, measureMode,
    blockInactiveClick, port, DESIGN_W, DESIGN_H,
    svgRef, dragRef, resizeRef, rotateRef, isPanning, panStart,
    measureStartRef, marqueeRef, tabCycleRef, targetViewRef, animFrameRef,
    pinnedUuids, lockedUuids, marquee,
    setView, setSelectedUuid,
    setSelectedUuidsReplace: s => setSelectedUuids(s),
    setSelectedUuids: fn => setSelectedUuids(fn as any),
    setHoveredUuid, setIsDragging, setIsResizing, setIsRotating,
    setIsPanningActive, setCursorScenePos, setHoverTooltipPos, setTooltipVisibleUuid,
    setDragDelta, setAlignGuides, setMarquee, setMeasureLine,
    setUndoStack, setRedoStack: v => setRedoStack(v),
    setChangeHistory, setNodeAccessCount, setNodeClickCount, setCollapsedUuids,
    tooltipDelayRef, updateNode, addEditHistory,
  })

  // handleSvgMouseDown → useSceneViewMouse에서 제공

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

  // handleNodeMouseDown → useSceneViewMouse에서 제공

  // hitTestAtPoint → useSceneViewMouse에서 제공
  // R1404: PNG 내보내기 설정 (배경색, 해상도)
  const [pngExportBg, setPngExportBg] = useState<'dark' | 'light' | 'transparent'>('dark')
  const [pngExportScale, setPngExportScale] = useState<1 | 2 | 4>(1)
  const [showPngExportPanel, setShowPngExportPanel] = useState(false)
  // PNG_BG_COLORS imported from sceneViewConstants

  // ── 씬 저장 / 로드 슬롯 (localStorage) ──────────────────────
  const [activeSlot, setActiveSlot] = useState(0)
  const [sceneLayers, setSceneLayers] = React.useState<string[]>([])
  const [snapSettings, setSnapSettings] = React.useState<Record<string, number>>({})
  const [showSnapPanel, setShowSnapPanel] = React.useState(false)
  const [showGrid, setShowGrid] = React.useState(false)
  const [sceneColorTheme, setSceneColorTheme] = React.useState('dark')
  const [showThemePanel, setShowThemePanel] = React.useState(false)
  const [multiSelect, setMultiSelect] = React.useState(false)
  const [selectedNodes, setSelectedNodes] = React.useState<string[]>([])
  const [animTimeline, setAnimTimeline] = React.useState(false)
  const [sceneLocked, setSceneLocked] = React.useState(false)
  const [lockReason, setLockReason] = React.useState('')
  const [dragMode, setDragMode] = React.useState<'move' | 'copy' | 'none'>('none')
  const [dragTarget, setDragTarget] = React.useState<string | null>(null)
  const [sceneMemo, setSceneMemo] = React.useState('')
  const [showSceneMemo, setShowSceneMemo] = React.useState(false)
  const [sceneHistoryIdx, setSceneHistoryIdx] = React.useState(-1)
  const [renderStats, setRenderStats] = React.useState<Record<string, number>>({})
  const [showRenderStats, setShowRenderStats] = React.useState(false)
  const [advancedSearch, setAdvancedSearch] = React.useState(false)
  const [searchScope, setSearchScope] = React.useState<'name' | 'tag' | 'component'>('name')
  const [modifiedNodes, setModifiedNodes] = React.useState<string[]>([])
  const [sceneLog, setSceneLog] = React.useState<string[]>([])
  const [showSceneLog, setShowSceneLog] = React.useState(false)
  const [pinnedNodes, setPinnedNodes] = React.useState<string[]>([])
  const [showPinnedPanel, setShowPinnedPanel] = React.useState(false)
  const [sceneFavorites, setSceneFavorites] = React.useState<string[]>([])
  const [showFavoritesPane, setShowFavoritesPane] = React.useState(false)
  const [sceneDiff, setSceneDiff] = React.useState<string | null>(null)
  const [showDiffPanel, setShowDiffPanel] = React.useState(false)
  const [sceneMeta, setSceneMeta] = React.useState<Record<string, string>>({})
  const [showMetaPanel, setShowMetaPanel] = React.useState(false)
  const [cloneSceneName, setCloneSceneName] = React.useState('')
  const [showCloneDialog, setShowCloneDialog] = React.useState(false)
  const [quickActions, setQuickActions] = React.useState<string[]>([])
  const [layoutName, setLayoutName] = React.useState('')
  const [showLayoutSave, setShowLayoutSave] = React.useState(false)
  const [workflowSteps, setWorkflowSteps] = React.useState<string[]>([])
  const [showWorkflow, setShowWorkflow] = React.useState(false)
  const [perfMode, setPerfMode] = React.useState<'normal' | 'high'>('normal')
  const [showPerfOptions, setShowPerfOptions] = React.useState(false)
  const [heatmapMode, setHeatmapMode] = React.useState(false)
  const [heatmapType, setHeatmapType] = React.useState<'draw' | 'update'>('draw')
  const [sceneChecklist, setSceneChecklist] = React.useState<string[]>([])
  const [showChecklist, setShowChecklist] = React.useState(false)
  const [darkOverlay, setDarkOverlay] = React.useState(false)
  const [overlayOpacity, setOverlayOpacity] = React.useState(0.3)
  // R1364: 목업 이미지 오버레이
  const [overlayImageSrc, setOverlayImageSrc] = React.useState<string | null>(null)

  const handleOverlayDrop = React.useCallback((e: React.DragEvent) => {
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    e.preventDefault()
    const reader = new FileReader()
    reader.onload = ev => setOverlayImageSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
  }, [])
  const [sceneLinks, setSceneLinks] = React.useState<Record<string, string>>({})
  const [showLinkPanel, setShowLinkPanel] = React.useState(false)
  const [batchOps, setBatchOps] = React.useState<string[]>([])
  const [showBatchPanel, setShowBatchPanel] = React.useState(false)
  const [sceneDeps, setSceneDeps] = React.useState<string[]>([])
  const [showDepsGraph, setShowDepsGraph] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<string[]>([])
  const [searchResultIdx, setSearchResultIdx] = React.useState(0)
  // R1149: node layers
  const [nodeLayers, setNodeLayers] = React.useState<Record<string, number>>({})
  // R1155: node comments
  const [nodeComments, setNodeComments] = React.useState<Record<string, string>>({})
  const [showNodeComments, setShowNodeComments] = React.useState(false)
  // R1161: node animations
  const [nodeAnimations, setNodeAnimations] = React.useState<Record<string, string[]>>({})
  const [showAnimPanel, setShowAnimPanel] = React.useState(false)
  // R1173: node physics
  const [nodePhysics, setNodePhysics] = React.useState<Record<string, boolean>>({})
  const [showPhysicsPanel, setShowPhysicsPanel] = React.useState(false)
  // R1179: node scripts
  const [nodeScripts, setNodeScripts] = React.useState<Record<string, string[]>>({})
  const [showScriptPanel, setShowScriptPanel] = React.useState(false)
  // R1185: scene events
  const [sceneEvents, setSceneEvents] = React.useState<string[]>([])
  const [showEventLog, setShowEventLog] = React.useState(false)
  // R1191: node properties
  const [nodeProps, setNodeProps] = React.useState<Record<string, Record<string, unknown>>>({})
  const [showPropsPanel, setShowPropsPanel] = React.useState(false)
  // R1197: node groups
  const [nodeGroups, setNodeGroups] = React.useState<Record<string, string[]>>({})
  const [showGroupPanel, setShowGroupPanel] = React.useState(false)
  // R1203: scene metrics
  const [sceneMetrics, setSceneMetrics] = React.useState<Record<string, number>>({})
  const [showMetricsPanel, setShowMetricsPanel] = React.useState(false)
  // R1209: scene optimize
  const [optimizeSuggestions, setOptimizeSuggestions] = React.useState<string[]>([])
  const [showOptimizePanel, setShowOptimizePanel] = React.useState(false)
  // R1215: node selection history
  const [selectionHistory, setSelectionHistory] = React.useState<string[][]>([])
  const [selHistoryIdx, setSelHistoryIdx] = React.useState(-1)
  // R1221: node search advanced
  const [nodeSearchFilters, setNodeSearchFilters] = React.useState<Record<string, string>>({})
  const [showAdvancedSearch, setShowAdvancedSearch] = React.useState(false)
  // R1227: scene camera
  const [sceneCameras, setSceneCameras] = React.useState<string[]>([])
  const [activeCamera, setActiveCamera] = React.useState<string | null>(null)
  // R1233: scene lights
  const [sceneLights, setSceneLights] = React.useState<string[]>([])
  const [showLightPanel, setShowLightPanel] = React.useState(false)
  // R1239: scene materials
  const [sceneMaterials, setSceneMaterials] = React.useState<string[]>([])
  const [showMaterialPanel, setShowMaterialPanel] = React.useState(false)
  const [sceneAudio, setSceneAudio] = useState<string[]>([])
  const [showAudioPanel, setShowAudioPanel] = useState(false)
  const [sceneParticles, setSceneParticles] = useState<string[]>([])
  const [showParticlePanel, setShowParticlePanel] = useState(false)
  const [sceneShaders, setSceneShaders] = useState<string[]>([])
  const [showShaderPanel, setShowShaderPanel] = useState(false)
  const [sceneScripts, setSceneScripts] = useState<string[]>([])
  const [sceneColliders, setSceneColliders] = useState<string[]>([])
  const [showColliderPanel, setShowColliderPanel] = useState(false)
  const [sceneRigidbodies, setSceneRigidbodies] = useState<string[]>([])
  const [showRigidbodyPanel, setShowRigidbodyPanel] = useState(false)
  const [sceneConstraints, setSceneConstraints] = useState<string[]>([])
  const [showConstraintPanel, setShowConstraintPanel] = useState(false)
  const [sceneTileMap, setSceneTileMap] = useState<string | null>(null)
  const [showTileMapPanel, setShowTileMapPanel] = useState(false)
  const [sceneSprites, setSceneSprites] = useState<string[]>([])
  const [showSpritePanel, setShowSpritePanel] = useState(false)
  const [sceneUI, setSceneUI] = useState<string[]>([])
  const [showUIPanel, setShowUIPanel] = useState(false)
  const [sceneNetworks, setSceneNetworks] = useState<string[]>([])
  const [showNetworkPanel, setShowNetworkPanel] = useState(false)
  const [scenePrefabs, setScenePrefabs] = useState<string[]>([])
  const [showPrefabPanel, setShowPrefabPanel] = useState(false)
  const [sceneTextures, setSceneTextures] = useState<string[]>([])
  const [showTexturePanel, setShowTexturePanel] = useState(false)
  const [sceneFonts, setSceneFonts] = useState<string[]>([])
  const [showFontPanel, setShowFontPanel] = useState(false)
  const [sceneTimers, setSceneTimers] = useState<Array<{ id: string; interval: number }>>([])
  const [showTimerPanel, setShowTimerPanel] = useState(false)
  // slotKey imported from sceneViewConstants

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
    const prevNode = nodeMap.get(uuid)
    // R1446: 편집 이력 기록 (이름 변경)
    if (prevNode && prevNode.name !== name) {
      addEditHistory('rename', uuid, name, { name: prevNode.name }, { name })
    }
    updateNode(uuid, { name })
    try {
      await window.api.ccSetProperty?.(port, uuid, 'name', name)
    } catch (e) {
      console.error('[SceneView] rename failed:', e)
    }
  }, [updateNode, port, nodeMap, addEditHistory])

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

  // R523: 레이어 이름 목록 (가시성 토글 팝업용)
  const allLayers = useMemo(() => [...new Set(topLevelNodes.map(n => n.name))], [topLevelNodes])

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

  // R1395: 레이어 상태 localStorage 영구 저장
  useEffect(() => { localStorage.setItem('scene-hidden-layers', JSON.stringify([...hiddenLayers])) }, [hiddenLayers])
  useEffect(() => { localStorage.setItem('scene-locked-layers', JSON.stringify([...lockedLayers])) }, [lockedLayers])
  useEffect(() => { localStorage.setItem('scene-layer-colors', JSON.stringify(layerColors)) }, [layerColors])

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

  // handleCreateNode~handleCircularLayout -> useSceneViewActions에서 제공
  // ── R1458: 자동정렬 드롭다운 상태 ──────────────────────────
  const [showAutoLayoutMenu, setShowAutoLayoutMenu] = useState(false)
  const autoLayoutMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showAutoLayoutMenu) return
    const handleClick = (e: MouseEvent) => {
      if (autoLayoutMenuRef.current && !autoLayoutMenuRef.current.contains(e.target as Node)) {
        setShowAutoLayoutMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAutoLayoutMenu])

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
  // R1422: 그리드 크기를 사용자 설정에서 가져옴
  const gridStep = gridSettings.size

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
        onGridSettings={() => setShowGridSettings(v => !v)}
        compareMode={compareMode}
        onCompareToggle={() => setCompareMode(v => !v)}
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
        showStatsOverlay={showStatsOverlay}
        onStatsOverlayToggle={() => setShowStatsOverlay(v => !v)}
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
        onExportPng={() => setShowPngExportPanel(v => !v)}
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
        onDistributeHEqual={handleDistributeHEqual}
        onDistributeVEqual={handleDistributeVEqual}
        onCircularLayout={handleCircularLayout}
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
        showClickHeatmap={showClickHeatmap}
        onClickHeatmapToggle={() => setShowClickHeatmap(v => !v)}
        onClickHeatmapReset={() => setNodeClickCount(new Map())}
        showQuickActions={showQuickActions}
        onQuickActionsToggle={() => setShowQuickActions(v => !v)}
        onZoomTo={handleZoomTo}
        hasOverlayImage={!!overlayImageSrc}
        onClearOverlayImage={() => setOverlayImageSrc(null)}
        showEditHistory={showEditHistory}
        onToggleEditHistory={() => setShowEditHistory(v => !v)}
        editHistoryCount={editHistory.length}
      />

      {/* R1422: 그리드 설정 팝업 — Grid 버튼 우클릭으로 열기 */}
      {showGridSettings && (
        <div
          ref={gridSettingsRef}
          style={{
            position: 'absolute', top: 30, left: 120, zIndex: 9999,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: 10, minWidth: 180,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Grid Settings</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>Size</span>
            <select
              value={gridSettings.size}
              onChange={e => setGridSettings(prev => ({ ...prev, size: Number(e.target.value) }))}
              style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px' }}
            >
              {[8, 16, 32, 50, 64, 128].map(v => (
                <option key={v} value={v}>{v}px</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>Color</span>
            <button
              onClick={() => setGridSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
              style={{
                flex: 1, fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                background: gridSettings.theme === 'light' ? '#e0e0e0' : '#333',
                color: gridSettings.theme === 'light' ? '#333' : '#e0e0e0',
                border: '1px solid var(--border)',
              }}
            >{gridSettings.theme === 'light' ? 'Light' : 'Dark'}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>Alpha</span>
            <input
              type="range" min={0.02} max={0.5} step={0.01}
              value={gridSettings.opacity}
              onChange={e => setGridSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 8, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{gridSettings.opacity.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* R1452: 노드 템플릿 + R1455: 뷰 북마크 + R1419: 뷰포트 프리셋 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px', background: 'rgba(0,0,0,0.15)', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* R1452: 템플릿 드롭다운 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTemplateDropdown(v => !v)}
            title="R1452: 노드 템플릿 라이브러리"
            style={{ fontSize: 9, padding: '1px 4px', background: showTemplateDropdown ? 'rgba(96,165,250,0.2)' : 'none', border: '1px solid var(--border)', borderRadius: 2, color: showTemplateDropdown ? '#93c5fd' : 'var(--text-muted)', cursor: 'pointer' }}
          >{'\uD83D\uDCCC'}</button>
          {showTemplateDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 9999,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              minWidth: 160, maxHeight: 220, overflowY: 'auto',
            }}>
              <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                {'\uD83D\uDCCC'} 노드 템플릿
              </div>
              {DEFAULT_TEMPLATES.concat(nodeTemplates).map((tmpl, i) => (
                <button
                  key={`${tmpl.name}-${i}`}
                  onClick={() => {
                    const newUuid = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                    const n = tmpl.node as Record<string, unknown>
                    const newNode: SceneNode = {
                      uuid: newUuid, name: (n.name as string) ?? 'Template',
                      active: (n.active as boolean) ?? true,
                      x: 0, y: 0, width: ((n.size as { x?: number })?.x) ?? 0,
                      height: ((n.size as { y?: number })?.y) ?? 0,
                      anchorX: ((n.anchor as { x?: number })?.x) ?? 0.5,
                      anchorY: ((n.anchor as { y?: number })?.y) ?? 0.5,
                      scaleX: ((n.scale as { x?: number })?.x) ?? 1,
                      scaleY: ((n.scale as { y?: number })?.y) ?? 1,
                      rotation: (n.rotation as number) ?? 0,
                      opacity: (n.opacity as number) ?? 255,
                      color: (n.color as { r: number; g: number; b: number; a: number }) ?? { r: 255, g: 255, b: 255, a: 255 },
                      parentUuid: rootUuid, childUuids: [],
                      components: (n.components as SceneNode['components']) ?? [],
                    }
                    updateNode(newUuid, newNode)
                    if (rootUuid) {
                      const root = nodeMap.get(rootUuid)
                      if (root) updateNode(rootUuid, { childUuids: [...root.childUuids, newUuid] })
                    }
                    setSelectedUuid(newUuid)
                    setSelectedUuids(new Set([newUuid]))
                    setShowTemplateDropdown(false)
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '4px 8px', background: 'none', border: 'none',
                    color: i < DEFAULT_TEMPLATES.length ? 'var(--text-muted)' : '#60a5fa',
                    cursor: 'pointer', fontSize: 10,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {i < DEFAULT_TEMPLATES.length ? `[기본] ${tmpl.name}` : tmpl.name}
                </button>
              ))}
              {nodeTemplates.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '2px 8px' }}>
                  <button
                    onClick={() => { setNodeTemplates([]); localStorage.removeItem(NT_KEY); setShowTemplateDropdown(false) }}
                    style={{ fontSize: 8, color: '#f85149', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                  >모든 사용자 템플릿 삭제</button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* R1455: 뷰 북마크 숫자 뱃지 */}
        {viewBookmarks.map((bm, i) => (
          <button
            key={`vb-${i}`}
            onClick={() => {
              if (!bm) return
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
            }}
            title={bm ? `뷰 ${i + 1} (zoom:${bm.zoom.toFixed(1)}) — 클릭으로 이동, Ctrl+${i + 1}로 저장` : `뷰 ${i + 1} 비어있음 (Ctrl+${i + 1}로 저장)`}
            style={{
              fontSize: 8, width: 16, height: 16, padding: 0, lineHeight: '16px', textAlign: 'center',
              background: bm ? 'rgba(96,165,250,0.2)' : 'none',
              border: '1px solid ' + (bm ? 'rgba(96,165,250,0.4)' : 'var(--border)'),
              borderRadius: 2, color: bm ? '#93c5fd' : 'var(--text-muted)',
              cursor: bm ? 'pointer' : 'default', fontWeight: bm ? 700 : 400,
            }}
          >{i + 1}</button>
        ))}
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px' }} />
        <button
          onClick={() => {
            const name = `뷰 ${viewportPresets.length + 1}`
            const preset: ViewportPreset = { name, zoom: view.zoom, panX: view.offsetX, panY: view.offsetY }
            setViewportPresets(prev => {
              const next = [...prev, preset].slice(-5)
              localStorage.setItem(VP_KEY, JSON.stringify(next))
              return next
            })
          }}
          title="현재 뷰를 프리셋으로 저장 (최대 5개)"
          style={{ fontSize: 9, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
        >{'\uD83D\uDCD0'}+</button>
        {/* 기본 프리셋 */}
        <button
          onClick={() => { setView({ offsetX: 0, offsetY: 0, zoom: 1 }) }}
          title="1:1 뷰"
          style={{ fontSize: 8, padding: '1px 4px', background: view.zoom === 1 ? 'rgba(96,165,250,0.2)' : 'none', border: '1px solid var(--border)', borderRadius: 2, color: view.zoom === 1 ? '#93c5fd' : 'var(--text-muted)', cursor: 'pointer' }}
        >1:1</button>
        <button
          onClick={() => { setView({ offsetX: 0, offsetY: 0, zoom: 2 }) }}
          title="2:1 뷰"
          style={{ fontSize: 8, padding: '1px 4px', background: view.zoom === 2 ? 'rgba(96,165,250,0.2)' : 'none', border: '1px solid var(--border)', borderRadius: 2, color: view.zoom === 2 ? '#93c5fd' : 'var(--text-muted)', cursor: 'pointer' }}
        >2:1</button>
        {/* 사용자 프리셋 */}
        {viewportPresets.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button
              onClick={() => setView({ offsetX: p.panX, offsetY: p.panY, zoom: p.zoom })}
              title={`${p.name} (zoom:${p.zoom.toFixed(1)} pan:${Math.round(p.panX)},${Math.round(p.panY)})`}
              style={{ fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: '2px 0 0 2px', color: '#60a5fa', cursor: 'pointer' }}
            >{p.name}</button>
            <button
              onClick={() => {
                setViewportPresets(prev => {
                  const next = prev.filter((_, j) => j !== i)
                  localStorage.setItem(VP_KEY, JSON.stringify(next))
                  return next
                })
              }}
              title="프리셋 삭제"
              style={{ fontSize: 8, padding: '1px 2px', background: 'none', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 2px 2px 0', color: '#f85149', cursor: 'pointer', lineHeight: 1 }}
            >x</button>
          </div>
        ))}
      </div>

      {/* R1383: 씬 파일 탭 바 */}
      {sceneTabFiles.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto', flexShrink: 0,
        }}>
          {sceneTabFiles.map(path => {
            const name = path.split(/[\\/]/).pop() ?? path
            const isActive = path === activeSceneTab
            return (
              <button
                key={path}
                onClick={() => setActiveSceneTab(path)}
                title={path}
                style={{
                  padding: '3px 10px', fontSize: 10, border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(96,165,250,0.2)' : 'transparent',
                  color: isActive ? '#93c5fd' : '#94a3b8',
                  borderBottom: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {name}
              </button>
            )
          })}
          {sceneHistory.length > 5 && (
            <button
              onClick={() => setShowSceneHistory(true)}
              style={{ padding: '3px 8px', fontSize: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b' }}
              title="더 많은 씬 보기"
            >+</button>
          )}
        </div>
      )}

      {/* 스냅샷 기록 툴바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 10 }}>
        <button
          onClick={takeSnapshot}
          style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, color: '#93c5fd', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          스냅샷
        </button>
        {/* R1381: 씬 diff 뷰어 토글 */}
        <button
          onClick={() => setDiffModeR1381(v => !v)}
          title={diffModeR1381 ? '씬 diff 뷰어 끄기' : '변경된 노드 주황 테두리 강조'}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: diffModeR1381 ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.06)',
            border: diffModeR1381 ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(255,255,255,0.15)',
            color: diffModeR1381 ? '#fb923c' : '#cbd5e1',
          }}
        >
          diff {changedUuids.size > 0 ? `(${changedUuids.size})` : ''}
        </button>
        {/* R1431: Before/After 슬라이더 비교 토글 */}
        <button
          onClick={() => { setBeforeAfterMode(v => !v); if (!beforeAfterMode) setSliderX(0.5) }}
          title={beforeAfterMode ? 'Before/After 비교 끄기' : 'Before/After 슬라이더 비교'}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: beforeAfterMode ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)',
            border: beforeAfterMode ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.15)',
            color: beforeAfterMode ? '#c084fc' : '#cbd5e1',
          }}
        >
          B/A
        </button>
        {/* R1435: 씬 JSON 뷰어 토글 */}
        <button
          onClick={() => setShowJsonViewer(v => !v)}
          title={showJsonViewer ? '씬 JSON 뷰어 닫기' : '씬 JSON 뷰어 열기'}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: showJsonViewer ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)',
            border: showJsonViewer ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.15)',
            color: showJsonViewer ? '#60a5fa' : '#cbd5e1', fontFamily: 'monospace',
          }}
        >
          {'{ }'}
        </button>
        {/* R1438: 씬 공유 링크 */}
        <button
          onClick={async () => {
            setShareLoading(true)
            try {
              const data = Array.from(nodeMap.values()).map(n => ({ name: n.name, uuid: n.uuid, x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.width), height: Math.round(n.height), rotation: n.rotation, active: n.active, components: n.components }))
              const sceneJson = JSON.stringify({ nodeCount: nodeMap.size, rootUuid, nodes: data }, null, 2)
              const result = await window.api.ccFileServeScene?.(sceneJson)
              if (result?.success && result.url) {
                await navigator.clipboard.writeText(result.url)
                setShareUrl(result.url)
                setTimeout(() => setShareUrl(null), 5000)
              }
            } catch { /* ignore */ }
            setShareLoading(false)
          }}
          disabled={shareLoading || nodeMap.size === 0}
          title={shareUrl ? `공유 URL: ${shareUrl}` : '씬 로컬 HTTP 공유 (60초, 클립보드 복사)'}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: shareUrl ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)',
            border: shareUrl ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.15)',
            color: shareUrl ? '#4ade80' : '#cbd5e1',
            opacity: shareLoading || nodeMap.size === 0 ? 0.5 : 1,
          }}
        >
          {shareLoading ? '...' : shareUrl ? '✓ 복사됨' : '\u{1F517}'}
        </button>
        {/* R1440: 씬 JSON 임포트 버튼 */}
        <button
          onClick={() => { setShowImportModal(true); setImportJson(''); setImportError(null) }}
          title="외부 씬 JSON 붙여넣기로 노드 임포트"
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: showImportModal ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)',
            border: showImportModal ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.15)',
            color: showImportModal ? '#4ade80' : '#cbd5e1',
          }}
        >
          {'\uD83D\uDCE5'} 임포트
        </button>
        {/* R1442: Center Guide 토글 */}
        <button
          onClick={() => setShowCenterGuide(v => !v)}
          title={showCenterGuide ? '씬 중앙선 숨기기' : '씬 중앙선 표시 (0,0 기준)'}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: showCenterGuide ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)',
            border: showCenterGuide ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.15)',
            color: showCenterGuide ? '#60a5fa' : '#cbd5e1',
          }}
        >
          {'\u271A'}
        </button>
        {/* R1442: 스냅 거리 임계값 설정 */}
        <select
          value={snapThreshold}
          onChange={e => setSnapThreshold(Number(e.target.value))}
          title={`정렬 스냅 거리: ${snapThreshold}px`}
          style={{
            fontSize: 9, padding: '2px 4px', borderRadius: 3, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#cbd5e1',
          }}
        >
          {[4, 8, 12, 16].map(v => (
            <option key={v} value={v}>{v}px</option>
          ))}
        </select>
        {/* R1428: 비활성 노드 클릭 방지 토글 */}
        <button
          onClick={() => setBlockInactiveClick(v => !v)}
          title={blockInactiveClick ? '비활성 노드 클릭 허용' : '비활성 노드 클릭 방지'}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
            background: blockInactiveClick ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
            border: blockInactiveClick ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.15)',
            color: blockInactiveClick ? '#fca5a5' : '#cbd5e1',
          }}
        >
          {blockInactiveClick ? '비활성 차단' : '비활성 허용'}
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
          nodeColorTags={nodeColorTags}
        />
      )}

      {/* SVG 뷰포트 */}
      <div
        ref={containerRef}
        tabIndex={0}
        onDragOver={e => { e.preventDefault() }}
        onDrop={handleOverlayDrop}
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
                  stroke={gridSettings.theme === 'light' ? `rgba(0,0,0,${gridSettings.opacity})` : `rgba(255,255,255,${gridSettings.opacity})`}
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

          {/* R1392+R1442: 정렬 가이드라인 (스마트 가이드) — 거리 레이블 + 중앙선 */}
          {(() => {
            const ox = DESIGN_W / 2 * view.zoom + view.offsetX
            const oy = DESIGN_H / 2 * view.zoom + view.offsetY
            return <g style={{ pointerEvents: 'none' }}>
              {/* R1442: 씬 중앙선 (0,0 기준) 항상 표시 옵션 */}
              {showCenterGuide && (
                <>
                  <line x1={ox} y1={0} x2={ox} y2="100%" stroke="rgba(251,191,36,0.35)" strokeWidth={1} strokeDasharray="6 3" />
                  <line x1={0} y1={oy} x2="100%" y2={oy} stroke="rgba(251,191,36,0.35)" strokeWidth={1} strokeDasharray="6 3" />
                  <text x={ox + 4} y={oy - 4} fill="rgba(251,191,36,0.6)" fontSize={8} fontFamily="monospace">0,0</text>
                </>
              )}
              {/* 정렬 가이드 + R1442 거리 레이블 */}
              {alignGuides.map((g, i) => {
                if (g.x !== undefined) {
                  const px = g.x * view.zoom + ox
                  return <g key={i}>
                    <line x1={px} y1={0} x2={px} y2="100%" stroke="#4af" strokeWidth={1} strokeDasharray="4 2" />
                    <text x={px + 3} y={12} fill="#4af" fontSize={8} fontFamily="monospace" opacity={0.8}>{Math.round(g.x)}px</text>
                  </g>
                } else if (g.y !== undefined) {
                  const py = -g.y * view.zoom + oy
                  return <g key={i}>
                    <line x1={0} y1={py} x2="100%" y2={py} stroke="#4af" strokeWidth={1} strokeDasharray="4 2" />
                    <text x={4} y={py - 3} fill="#4af" fontSize={8} fontFamily="monospace" opacity={0.8}>{Math.round(g.y)}px</text>
                  </g>
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
                  heatmapIntensity={showClickHeatmap ? ((nodeClickCount.get(uuid) ?? 0) / maxClickCount) : undefined}
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

            {/* R1381: diff 모드 — 변경된 노드에 주황 테두리 */}
            {diffModeR1381 && changedUuids.size > 0 && [...changedUuids].map(uuid => {
              const n = nodeMap.get(uuid)
              if (!n) return null
              const { sx, sy } = cocosToSvg(n.worldX ?? n.x, n.worldY ?? n.y, DESIGN_W, DESIGN_H)
              const rx = sx - n.width * 0.5
              const ry = sy - n.height * 0.5
              return (
                <rect key={`diff-${uuid}`} x={rx} y={ry} width={n.width} height={n.height}
                  fill="none" stroke="rgba(251,146,60,0.8)"
                  strokeWidth={2 / view.zoom} rx={3 / view.zoom}
                  style={{ pointerEvents: 'none' }} />
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
            {/* R1364: 목업 이미지 오버레이 */}
            {overlayImageSrc && (
              <image
                href={overlayImageSrc}
                x={0} y={0}
                width={DESIGN_W} height={DESIGN_H}
                opacity={overlayOpacity}
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

        {/* R1431: Before/After 슬라이더 비교 오버레이 */}
        {beforeAfterMode && savedSnapshot.size > 0 && (() => {
          const svgRect = svgRef.current?.getBoundingClientRect()
          const svgW = svgRect?.width ?? 400
          const svgH = svgRect?.height ?? 300
          const pixelX = sliderX * svgW
          return (
            <div
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}
            >
              {/* Before 영역 라벨 */}
              <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 9, color: 'rgba(239,68,68,0.8)', pointerEvents: 'none', zIndex: 2 }}>BEFORE</div>
              {/* After 영역 라벨 */}
              <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, color: 'rgba(96,165,250,0.8)', pointerEvents: 'none', zIndex: 2 }}>AFTER</div>
              {/* Before 사이드 오버레이 — savedSnapshot 기준 변경된 노드 표시 */}
              <svg width={svgW} height={svgH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <defs>
                  <clipPath id="r1431-before-clip"><rect x={0} y={0} width={pixelX} height={svgH} /></clipPath>
                </defs>
                <g clipPath="url(#r1431-before-clip)">
                  {[...savedSnapshot.entries()].map(([uuid, snap]) => {
                    const current = nodeMap.get(uuid)
                    if (!current) return null
                    if (snap.x === current.x && snap.y === current.y && snap.w === current.width && snap.h === current.height) return null
                    const { sx, sy } = cocosToSvg(snap.x, snap.y, DESIGN_W, DESIGN_H)
                    const rx = sx - snap.w * 0.5
                    const ry = sy - snap.h * 0.5
                    return (
                      <rect key={uuid} x={rx} y={ry} width={snap.w} height={snap.h}
                        fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.6)"
                        strokeWidth={1.5 / view.zoom} rx={2 / view.zoom}
                        strokeDasharray={`${3 / view.zoom} ${2 / view.zoom}`}
                      />
                    )
                  })}
                </g>
              </svg>
              {/* 슬라이더 바 (드래그 가능) */}
              <div
                style={{
                  position: 'absolute', top: 0, left: pixelX - 1, width: 3, height: '100%',
                  background: 'rgba(255,255,255,0.8)', cursor: 'ew-resize', pointerEvents: 'auto', zIndex: 3,
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                }}
                onMouseDown={e => {
                  e.preventDefault()
                  beforeAfterDragRef.current = true
                  const handleMove = (ev: MouseEvent) => {
                    if (!beforeAfterDragRef.current || !svgRef.current) return
                    const r = svgRef.current.getBoundingClientRect()
                    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width))
                    setSliderX(x)
                  }
                  const handleUp = () => {
                    beforeAfterDragRef.current = false
                    window.removeEventListener('mousemove', handleMove)
                    window.removeEventListener('mouseup', handleUp)
                  }
                  window.addEventListener('mousemove', handleMove)
                  window.addEventListener('mouseup', handleUp)
                }}
              >
                {/* 드래그 핸들 */}
                <div style={{
                  position: 'absolute', top: '50%', left: -8, width: 19, height: 24, marginTop: -12,
                  background: 'rgba(255,255,255,0.9)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#333', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }}>⟺</div>
              </div>
            </div>
          )
        })()}

        {/* R1424: 씬 비교 뷰 — 오른쪽 절반에 비교 패널 오버레이 */}
        {compareMode && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
            background: 'var(--bg-primary)', borderLeft: '2px solid var(--accent)',
            display: 'flex', flexDirection: 'column', zIndex: 50,
          }}>
            <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>COMPARE</span>
              {sceneTabFiles.length > 0 && (
                <select
                  value={compareScenePath ?? ''}
                  onChange={e => setCompareScenePath(e.target.value || null)}
                  style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px' }}
                >
                  <option value="">씬 선택...</option>
                  {sceneTabFiles.map(p => (
                    <option key={p} value={p}>{p.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => { setCompareMode(false); setCompareScenePath(null) }}
                style={{ fontSize: 9, padding: '1px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}
              >X</button>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>
              {!compareScenePath ? (
                <span>비교할 씬을 선택하세요</span>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, marginBottom: 4 }}>비교 씬: {compareScenePath.split(/[\\/]/).pop()}</div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>읽기 전용 비교 뷰</div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>독립 pan/zoom 지원</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* R1435: 씬 JSON 뷰어 패널 */}
        {showJsonViewer && (() => {
          const selNode = selectedUuid ? nodeMap.get(selectedUuid) : null
          const jsonSource = jsonViewScope === 'selected' && selNode
            ? { name: selNode.name, uuid: selNode.uuid, x: selNode.x, y: selNode.y, width: selNode.width, height: selNode.height, rotation: selNode.rotation, anchorX: selNode.anchorX, anchorY: selNode.anchorY, opacity: selNode.opacity, active: selNode.active, components: selNode.components, childCount: selNode.children?.length ?? 0 }
            : { nodeCount: nodeMap.size, rootUuid, nodes: Array.from(nodeMap.values()).slice(0, 50).map(n => ({ name: n.name, uuid: n.uuid, x: Math.round(n.x), y: Math.round(n.y) })) }
          const jsonStr = JSON.stringify(jsonSource, null, 2)
          // R1435: 간단한 syntax highlight
          const highlighted = jsonStr.replace(
            /("(?:\\.|[^"\\])*")\s*:/g, '<span style="color:var(--accent,#60a5fa)">$1</span>:'
          ).replace(
            /:\s*("(?:\\.|[^"\\])*")/g, ': <span style="color:var(--success,#34d399)">$1</span>'
          ).replace(
            /:\s*(-?\d+\.?\d*)/g, ': <span style="color:var(--warning,#fbbf24)">$1</span>'
          )
          return (
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 240, height: '100%',
              background: 'var(--bg-primary)', borderLeft: '2px solid var(--accent)',
              display: 'flex', flexDirection: 'column', zIndex: 55,
            }}>
              <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'monospace' }}>JSON</span>
                <button
                  onClick={() => setJsonViewScope(v => v === 'selected' ? 'full' : 'selected')}
                  style={{ fontSize: 8, padding: '1px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', cursor: 'pointer' }}
                >{jsonViewScope === 'selected' ? '선택 노드' : '전체 씬'}</button>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => { navigator.clipboard.writeText(jsonStr) }}
                  style={{ fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}
                  title="JSON 복사"
                >복사</button>
                <button
                  onClick={() => setShowJsonViewer(false)}
                  style={{ fontSize: 9, padding: '1px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}
                >X</button>
              </div>
              <pre
                style={{ flex: 1, overflow: 'auto', margin: 0, padding: 8, fontSize: 9, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </div>
          )
        })()}

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

        {/* R1401: 씬 통계 오버레이 */}
        {showStatsOverlay && (() => {
          // 전체/활성 노드 수 + 상위 5개 컴포넌트 타입
          let totalNodes = 0
          let activeNodes = 0
          const compCounts: Record<string, number> = {}
          nodeMap.forEach(n => {
            totalNodes++
            if (n.active && n.visible !== false) activeNodes++
            n.components?.forEach(c => { compCounts[c.type] = (compCounts[c.type] ?? 0) + 1 })
          })
          const topComps = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
          return (
            <div style={{
              position: 'absolute', bottom: 8, right: 8, zIndex: 90,
              background: 'rgba(10,10,15,0.88)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, padding: '5px 8px', fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', lineHeight: 1.7, pointerEvents: 'none',
              minWidth: 120,
            }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2, fontSize: 10 }}>Scene Stats</div>
              <div>Nodes: {totalNodes}</div>
              <div>Active: {activeNodes}</div>
              {topComps.length > 0 && (
                <>
                  <div style={{ marginTop: 3, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 3, fontSize: 9, color: 'var(--text-secondary)' }}>Top Components</div>
                  {topComps.map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9 }}>
                      <span>{type.replace('cc.', '')}</span>
                      <span style={{ color: 'var(--accent)' }}>{count}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })()}

        {/* R1404: PNG 내보내기 설정 패널 */}
        {showPngExportPanel && (
          <div style={{
            position: 'absolute', top: 40, right: 8, zIndex: 110,
            background: 'rgba(10,10,15,0.94)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 10px', fontSize: 10, color: 'var(--text-primary)',
            minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PNG Export</span>
              <button onClick={() => setShowPngExportPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>x</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>BG</span>
              {(['dark', 'light', 'transparent'] as const).map(bg => (
                <button key={bg} onClick={() => setPngExportBg(bg)} style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                  background: pngExportBg === bg ? 'var(--accent)' : 'var(--bg-primary)',
                  color: pngExportBg === bg ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}>{bg}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>Scale</span>
              {([1, 2, 4] as const).map(s => (
                <button key={s} onClick={() => setPngExportScale(s)} style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                  background: pngExportScale === s ? 'var(--accent)' : 'var(--bg-primary)',
                  color: pngExportScale === s ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}>{s}x</button>
              ))}
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 4 }}>
              Output: {DESIGN_W * pngExportScale} x {DESIGN_H * pngExportScale}px
            </div>
            <button onClick={() => { handleExportPng(); setShowPngExportPanel(false) }} style={{
              width: '100%', padding: '4px 0', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
            }}>Export PNG</button>
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
              <span style={{ fontWeight: 700, color: '#fff', fontSize: 10 }}>Layers ({allLayers.length})</span>
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
            {/* R1395+R1450: 레이어 목록 (가시성/잠금/색상 라벨 + 드래그 재배치) */}
            {topLevelNodes.map((layer, layerIdx) => {
              const isHidden = hiddenLayers.has(layer.uuid)
              const isLocked = lockedLayers.has(layer.uuid)
              const childCount = collectDescendants(layer.uuid).length - 1
              const lc = layerColors[layer.uuid]
              return (
                <div
                  key={layer.uuid}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    borderTop: layerDropIdx === layerIdx && layerDragIdx !== null && layerDragIdx !== layerIdx ? '2px solid #60a5fa' : 'none',
                    opacity: layerDragIdx === layerIdx ? 0.4 : 1,
                  }}
                  onDragOver={e => { e.preventDefault(); setLayerDropIdx(layerIdx) }}
                  onDragLeave={() => { if (layerDropIdx === layerIdx) setLayerDropIdx(null) }}
                  onDrop={e => {
                    e.preventDefault()
                    if (layerDragIdx !== null && layerDragIdx !== layerIdx && rootUuid) {
                      // R1450: 레이어 순서 변경 — rootUuid의 childUuids 재배치
                      const root = nodeMap.get(rootUuid)
                      if (root) {
                        const uuids = [...root.childUuids]
                        const [moved] = uuids.splice(layerDragIdx, 1)
                        uuids.splice(layerIdx, 0, moved)
                        updateNode(rootUuid, { childUuids: uuids })
                      }
                    }
                    setLayerDragIdx(null)
                    setLayerDropIdx(null)
                  }}
                >
                  {/* R1450: 드래그 핸들 */}
                  <span
                    draggable
                    onDragStart={() => setLayerDragIdx(layerIdx)}
                    onDragEnd={() => { setLayerDragIdx(null); setLayerDropIdx(null) }}
                    style={{ cursor: 'grab', color: 'rgba(255,255,255,0.3)', fontSize: 10, flexShrink: 0, userSelect: 'none' }}
                    title="R1450: 드래그하여 레이어 순서 변경"
                  >{'⋮⋮'}</span>
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
                  {/* R1395: 색상 라벨 버튼 — 클릭 시 팔레트 순환 */}
                  <button
                    onClick={() => {
                      setLayerColors(prev => {
                        const next = { ...prev }
                        const curIdx = lc ? LAYER_COLOR_PALETTE.indexOf(lc) : -1
                        if (curIdx >= LAYER_COLOR_PALETTE.length - 1 || curIdx < 0 && lc) {
                          delete next[layer.uuid]
                        } else {
                          next[layer.uuid] = LAYER_COLOR_PALETTE[(curIdx + 1) % LAYER_COLOR_PALETTE.length]
                        }
                        return next
                      })
                    }}
                    title={lc ? `색상: ${lc} (클릭하여 변경)` : '색상 라벨 추가'}
                    style={{
                      width: 8, height: 8, borderRadius: '50%', padding: 0, flexShrink: 0,
                      background: lc ?? 'rgba(255,255,255,0.15)',
                      border: lc ? `1px solid ${lc}` : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{ flex: 1, color: isHidden ? 'rgba(255,255,255,0.3)' : (lc ?? '#e0e0e0'), fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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

        {/* R1446: 편집 이력 패널 (우측 상단) */}
        {showEditHistory && editHistory.length > 0 && (
          <div style={{
            position: 'absolute', top: 4, right: 4, zIndex: 20,
            width: 200, maxHeight: 240, overflowY: 'auto',
            background: 'rgba(0,0,0,0.75)', borderRadius: 4,
            padding: '6px 8px', fontSize: 10,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: 10 }}>Edit History ({editHistory.length})</span>
              <button
                onClick={() => setShowEditHistory(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1, padding: 0 }}
              >x</button>
            </div>
            {editHistory.map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                onClick={() => {
                  setSelectedUuid(entry.nodeUuid)
                  setSelectedUuids(new Set([entry.nodeUuid]))
                }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 1, padding: '3px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span style={{ color: entry.action === 'move' ? '#60a5fa' : entry.action === 'resize' ? '#34d399' : '#fbbf24', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
                    {entry.action}
                  </span>
                </div>
                <span style={{ color: '#e0e0e0', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.nodeName}
                </span>
              </div>
            ))}
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
              ['I', '씬 통계 오버레이 (노드수/컴포넌트 분포)'],
              ['Shift+I', '선택 노드 상세 정보 오버레이'],
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
        multiSelectedUuids={selectedUuids}
        onBatchUpdate={(uuids, updates) => { for (const u of uuids) { for (const up of updates) { updateNode(u, { [up.prop]: up.value }) } } }}
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
        bookmarkedUuids={bookmarkedUuids}
        onToggleBookmark={(uuid) => {
          setBookmarkedUuids(prev => {
            const next = new Set(prev)
            if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
            return next
          })
        }}
        nodeColorTags={nodeColorTags}
        onSelectNode={(uuid) => { setSelectedUuid(uuid); setSelectedUuids(new Set([uuid])) }}
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
              {/* R1464: 애니메이션 프리뷰 */}
              {ctxNode && (() => {
                const hasAnim = ctxNode.components.some(c =>
                  c.type === 'cc.Tween' || c.type === 'cc.TweenSystem' ||
                  c.type === 'cc.Animation' || c.type === 'cc.AnimationComponent' ||
                  c.type === 'cc.SkeletalAnimation'
                )
                if (!hasAnim) return null
                const isPlaying = animPlayingUuid === ctxUuid
                return isPlaying ? (
                  <button style={menuStyle} onClick={() => { handleAnimPreviewStop(); close() }}>{'■'} 애니 정지</button>
                ) : (
                  <button style={menuStyle} onClick={() => {
                    const comp = ctxNode.components.find(c =>
                      c.type === 'cc.Animation' || c.type === 'cc.AnimationComponent' ||
                      c.type === 'cc.Tween' || c.type === 'cc.TweenSystem'
                    )
                    const dur = (comp?.props as Record<string, unknown> | undefined)?.duration as number | undefined
                    handleAnimPreviewStart(ctxUuid!, dur ? dur * 1000 : 1000)
                    close()
                  }}>{'▶'} 애니 프리뷰</button>
                )
              })()}
              {/* R1468: AI 분석 요청 */}
              {ctxNode && (
                <button style={menuStyle} onClick={() => { handleAiAnalyze(ctxUuid!); close() }}>{'\uD83E\uDD16'} AI 분석</button>
              )}
              {/* R1452: 템플릿으로 저장 */}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  const name = prompt('템플릿 이름:')
                  if (!name?.trim()) { close(); return }
                  const n = nodeMap.get(ctxUuid!)
                  if (!n) { close(); return }
                  const tmplNode = {
                    uuid: '', name: n.name, active: n.active,
                    position: { x: n.x, y: n.y, z: 0 }, rotation: n.rotation,
                    scale: { x: n.scaleX, y: n.scaleY, z: 1 }, size: { x: n.width, y: n.height },
                    anchor: { x: n.anchorX, y: n.anchorY }, opacity: n.opacity, color: n.color,
                    components: n.components, children: [],
                  }
                  setNodeTemplates(prev => {
                    const next = [{ name: name.trim(), node: tmplNode }, ...prev].slice(0, 10)
                    localStorage.setItem(NT_KEY, JSON.stringify(next))
                    return next
                  })
                  close()
                }}>{'\uD83D\uDCCC'} 템플릿으로 저장</button>
              )}
              {/* R1407: 색상 태그 */}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  setShowColorTagPicker({ uuid: ctxUuid!, x: svgContextMenu!.x + 160, y: svgContextMenu!.y })
                  close()
                }}>🎨 색상 태그</button>
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

      {/* R1407: 색상 태그 피커 */}
      {showColorTagPicker && (() => {
        const closeTag = () => setShowColorTagPicker(null)
        const currentColor = nodeColorTags[showColorTagPicker.uuid]
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1999 }} onClick={closeTag} />
            <div style={{
              position: 'fixed', left: showColorTagPicker.x, top: showColorTagPicker.y,
              zIndex: 2000, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>색상 태그</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {COLOR_TAG_PALETTE.map(c => (
                  <span
                    key={c}
                    onClick={() => {
                      setNodeColorTags(prev => ({ ...prev, [showColorTagPicker.uuid]: c }))
                      setNodeColors(prev => { const next = { ...prev, [showColorTagPicker.uuid]: c }; localStorage.setItem('node-colors', JSON.stringify(next)); return next })
                      closeTag()
                    }}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: currentColor === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: currentColor === c ? '0 0 4px rgba(255,255,255,0.4)' : 'none',
                    }}
                  />
                ))}
                {/* 태그 제거 */}
                <span
                  onClick={() => {
                    setNodeColorTags(prev => { const next = { ...prev }; delete next[showColorTagPicker.uuid]; return next })
                    setNodeColors(prev => { const next = { ...prev }; delete next[showColorTagPicker.uuid]; localStorage.setItem('node-colors', JSON.stringify(next)); return next })
                    closeTag()
                  }}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                    border: '1px dashed var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--text-muted)',
                  }}
                  title="색상 제거"
                >x</span>
              </div>
            </div>
          </>
        )
      })()}

      {/* R1440: 씬 JSON 임포트 모달 */}
      {showImportModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowImportModal(false)}>
          <div
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16, width: 400, maxHeight: '70vh',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {'\uD83D\uDCE5'} 씬 JSON 임포트
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
              CCSceneNode JSON을 붙여넣으세요. UUID 충돌 시 자동 재생성됩니다.
            </div>
            <textarea
              value={importJson}
              onChange={e => { setImportJson(e.target.value); setImportError(null) }}
              placeholder='{"uuid":"...","name":"Node","active":true,...}'
              style={{
                width: '100%', height: 160, fontSize: 10, fontFamily: 'monospace',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: importError ? '1px solid var(--error, #f85149)' : '1px solid var(--border)',
                borderRadius: 4, padding: 8, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            {importError && (
              <div style={{ fontSize: 9, color: 'var(--error, #f85149)', marginTop: 4 }}>{importError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}
              >취소</button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(importJson)
                    // validate minimal CCSceneNode shape
                    if (!parsed || typeof parsed !== 'object') throw new Error('JSON 객체가 아닙니다')
                    const node = parsed as Record<string, unknown>
                    if (typeof node.name !== 'string' && typeof node.uuid !== 'string') {
                      throw new Error('유효한 CCSceneNode가 아닙니다 (name/uuid 필수)')
                    }
                    // UUID 충돌 검사 → 자동 재생성
                    const existingUuids = new Set<string>()
                    nodeMap.forEach((_, uuid) => existingUuids.add(uuid))
                    function regenerateUuids(obj: Record<string, unknown>): void {
                      if (typeof obj.uuid === 'string' && existingUuids.has(obj.uuid)) {
                        obj.uuid = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                      }
                      if (Array.isArray(obj.children)) {
                        for (const child of obj.children) {
                          if (child && typeof child === 'object') regenerateUuids(child as Record<string, unknown>)
                        }
                      }
                    }
                    regenerateUuids(node)
                    // 노드를 현재 씬에 삽입 — 선택 상태로 설정
                    const uuid = (node.uuid as string) ?? `import-${Date.now()}`
                    const name = (node.name as string) ?? 'Imported'
                    const pos = (node.position as { x?: number; y?: number }) ?? {}
                    const size = (node.size as { x?: number; y?: number; width?: number; height?: number }) ?? {}
                    const w = size.width ?? size.x ?? 100
                    const h = size.height ?? size.y ?? 100
                    updateNode(uuid, {
                      name,
                      x: pos.x ?? 0,
                      y: pos.y ?? 0,
                      width: typeof w === 'number' ? w : 100,
                      height: typeof h === 'number' ? h : 100,
                      active: (node.active as boolean) ?? true,
                    })
                    setSelectedUuid(uuid)
                    setSelectedUuids(new Set([uuid]))
                    setShowImportModal(false)
                    setImportJson('')
                  } catch (err: unknown) {
                    setImportError((err as Error).message ?? 'JSON 파싱 실패')
                  }
                }}
                disabled={!importJson.trim()}
                style={{
                  fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  opacity: importJson.trim() ? 1 : 0.5,
                }}
              >임포트</button>
            </div>
          </div>
        </div>
      )}
      {/* R1455: 뷰 북마크 저장 토스트 */}
      {viewBookmarkToast && (
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '4px 14px', borderRadius: 4,
          background: 'rgba(96,165,250,0.9)', color: '#fff', fontSize: 11,
          fontWeight: 600, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {viewBookmarkToast}
        </div>
      )}
    </div>
  )
}

export default SceneViewPanel
