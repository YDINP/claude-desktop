import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SceneNode, ViewTransform, DragState, ResizeState, MarqueeState, UndoEntry, ClipboardEntry } from './types'
import { useSceneSync } from './useSceneSync'
import { NodeRenderer } from './NodeRenderer'
import { SceneToolbar, type SceneBgValue } from './SceneToolbar'
import { SceneInspector } from './SceneInspector'
import { cocosToSvg } from './utils'
import { NodeHierarchyList } from './NodeHierarchyList'
import { useSceneViewKeyboard } from './useSceneViewKeyboard'
import { useSceneViewMouse } from './useSceneViewMouse'
import { useSceneViewActions } from './useSceneViewActions'
import {
  type Annotation, type SnapshotEntry, type NodeSnapshot, type EditHistoryEntry,
  type ViewportPreset, type NodeTemplate, type CameraBookmark, type SceneViewPanelProps,
  VP_KEY, NT_KEY, VB_KEY,
  buildHeatmap, slotKey,
} from './sceneViewConstants'
import { SceneViewProvider, type SceneViewContextValue } from './SceneViewContext'
import { SceneViewContextMenu } from './SceneViewContextMenu'
import { SceneViewOverlays } from './SceneViewOverlays'
import { SceneViewSnapshotBar } from './SceneViewSnapshotBar'
import { SceneViewToolbarExtras } from './SceneViewToolbarExtras'
import { SceneViewShortcutsHelp } from './SceneViewShortcutsHelp'
import { SceneViewEditBar } from './SceneViewEditBar'
import { SceneViewQuickActions } from './SceneViewQuickActions'
import { SceneViewInfoPanels } from './SceneViewInfoPanels'

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
  // R1404: PNG 내보내기 설정 (배경색, 해상도) — useSceneViewActions에서 참조하므로 먼저 선언
  const [pngExportBg, setPngExportBg] = useState<'dark' | 'light' | 'transparent'>('dark')
  const [pngExportScale, setPngExportScale] = useState<1 | 2 | 4>(1)
  const [screenshotDone, setScreenshotDone] = useState(false)
  // saveScene ref — useSceneViewActions보다 먼저 선언, 나중에 실제 함수 할당
  const saveSceneRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const saveSceneForActions = useCallback(async () => { await saveSceneRef.current() }, [])
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
    try { return new Set(JSON.parse(localStorage.getItem('cd-scene-pinned') ?? '[]')) }
    catch { return new Set() }
  })
  const [lockedUuids, setLockedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cd-scene-locked') ?? '[]')) }
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
  // QA: compareScene setCompareScene — R748 placeholder
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
  // QA: sceneLoadProgress setSceneLoadProgress — R1393 placeholder
  // QA: sceneLoadStatus setSceneLoadStatus — R1394 placeholder

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
  // QA: sceneOverlay setSceneOverlay — R1341 placeholder
  const [showOverlayPanel, setShowOverlayPanel] = useState(false)
  // ── 씬 그리드 (R1347) ────────────────────────────────────────
  // QA: sceneGrid setSceneGrid — R1347 placeholder
  // QA: sceneGridSize setSceneGridSize — R1347 placeholder
  // ── 씬 카메라 (R1353) ────────────────────────────────────────
  // QA: sceneCamera setSceneCamera — R1353 placeholder
  // QA: sceneCameraFov setSceneCameraFov — R1353 placeholder
  // ── 씬 라이팅 (R1359) ────────────────────────────────────────
  // QA: sceneLighting setSceneLighting — R1359 placeholder
  // QA: lightingIntensity setLightingIntensity — R1359 placeholder

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
  // QA: showNodeLinks setShowNodeLinks — R1473 placeholder
  const [nodeLinkFilter, setNodeLinkFilter] = useState<'all' | 'script' | 'prefab'>('all')
  const [treeFilter, setTreeFilter] = useState('')
  const [treeFilterResults, setTreeFilterResults] = useState<string[]>([])
  const [nodeAliases, setNodeAliases] = useState<Record<string, string>>({})
  const [showAliasEditor, setShowAliasEditor] = useState(false)
  const [nodeVisibilityGroups, setNodeVisibilityGroups] = useState<Record<string, boolean>>({})
  const [showVisibilityGroups, setShowVisibilityGroups] = useState(false)
  const [componentSearch, setComponentSearch] = useState('')
  const [componentSearchResults, setComponentSearchResults] = useState<string[]>([])
  // QA: nodePrefabLinks setNodePrefabLinks — R1483 placeholder
  // QA: showPrefabLinks setShowPrefabLinks — R1484 placeholder
  const [sceneNotes, setSceneNotes] = useState<Record<string, string>>({})
  const [showNotesPanel, setShowNotesPanel] = useState(false)
  // QA: showBoundingBoxes setShowBoundingBoxes — R1487 placeholder
  // QA: boundingBoxColor setBoundingBoxColor — R1488 placeholder
  // QA: sceneProfiler setSceneProfiler — R1489 placeholder
  // QA: profilerStats setProfilerStats — R1490 placeholder
  // QA: renderMode setRenderMode — R1491 placeholder
  // QA: showRenderOptions setShowRenderOptions — R1492 placeholder
  // QA: lightingDebug setLightingDebug — R1493 placeholder
  // QA: lightingOverlay setLightingOverlay — R1494 placeholder
  // QA: cameraFov setCameraFov — R1495 placeholder
  // QA: showCameraControls setShowCameraControls — R1496 placeholder
  // QA: gizmoSize setGizmoSize — R1497 placeholder
  // QA: showGizmoSettings setShowGizmoSettings — R1498 placeholder
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
    updateNode, refresh, saveScene: saveSceneForActions,
  })

  // ── Keyboard hook (단축키 + Space패닝 + Ctrl+1~5 뷰북마크 + 전체선택 + 방향키) ──
  useSceneViewKeyboard({
    nodeMap, selectedUuid, selectedUuids, rootUuid, isDragging, isResizing,
    spaceDown, port, view, viewRef, viewHistoryRef, viewHistIdxRef,
    dragRef, resizeRef, canvasSearchRef, viewBookmarks, viewBookmarkToastRef,
    setActiveTool, setSelectedUuid,
    setSelectedUuids: fn => setSelectedUuids(fn as React.SetStateAction<Set<string>>),
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
    setSelectedUuids: fn => setSelectedUuids(fn as React.SetStateAction<Set<string>>),
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
      localStorage.setItem('cd-scene-pinned', JSON.stringify([...next]))
      return next
    })
  }, [])

  const toggleLocked = useCallback((uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('cd-scene-locked', JSON.stringify([...next]))
      return next
    })
  }, [])

  // handleNodeMouseDown → useSceneViewMouse에서 제공

  // hitTestAtPoint → useSceneViewMouse에서 제공
  // R1404: PNG 내보내기 설정 — 선언이 useSceneViewActions 이후로 이동됨 (위에서 선언됨)
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
  const saveSceneAsync = useCallback(async () => { saveToSlot(activeSlot) }, [saveToSlot, activeSlot])
  saveSceneRef.current = saveSceneAsync  // ref 갱신 — useSceneViewActions가 항상 최신 함수 사용
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

  // ── Context 값 구성 (하위 추출 컴포넌트에 전달) ──────────────
  const ctxValue: SceneViewContextValue = {
    nodeMap, rootUuid, updateNode, refresh,
    view, setView, DESIGN_W, DESIGN_H,
    selectedUuid, setSelectedUuid, selectedUuids, setSelectedUuids,
    selectedNode,
    bookmarkedUuids, setBookmarkedUuids,
    pinnedUuids, lockedUuids, setLockedUuids,
    hiddenLayers, setHiddenLayers, lockedLayers, setLockedLayers,
    collapsedUuids, setCollapsedUuids,
    nodeColors, setNodeColors, nodeColorTags, setNodeColorTags,
    nodeTags, setNodeTags, layerColors, setLayerColors,
    handleDeleteNode, handleCopy, handlePaste, handleDuplicate,
    togglePin,
    clipboard, setClipboard, setCopiedNode,
    topLevelNodes, nodeToTopLevel, collectDescendants, allLayers,
    connected, port, containerRef,
    savedSnapshot, changedUuids,
    diffModeR1381, setDiffModeR1381,
    beforeAfterMode, setBeforeAfterMode, sliderX, setSliderX,
    snapshot, showDiff, setShowDiff,
    editHistory, showEditHistory, setShowEditHistory,
    showJsonViewer, setShowJsonViewer, jsonViewScope, setJsonViewScope,
    shareUrl, setShareUrl, shareLoading, setShareLoading,
    showImportModal, setShowImportModal, importJson, setImportJson, importError, setImportError,
    showCenterGuide, setShowCenterGuide, snapThreshold, setSnapThreshold,
    blockInactiveClick, setBlockInactiveClick,
    snapshots, snapshotOpen, setSnapshotOpen, takeSnapshot, handleTakeSnapshot,
    nodeAccessCount, setNodeAccessCount,
    showLayerPanel, showAllToggle, setShowAllToggle,
    layerDragIdx, setLayerDragIdx, layerDropIdx, setLayerDropIdx,
    animPlayingUuid, handleAnimPreviewStart, handleAnimPreviewStop, handleAiAnalyze,
    nodeTemplates, setNodeTemplates, showTemplateDropdown, setShowTemplateDropdown,
    svgContextMenu, setSvgContextMenu,
    showColorTagPicker, setShowColorTagPicker,
    nodeTagInput, setNodeTagInput, nodeTagDraft, setNodeTagDraft,
    sceneTabFiles, sceneHistory,
    showMinimap, setShowMinimap,
    flashUuid, setFlashUuid, flashTimerRef,
    svgRef,
    changeHistory, showChangeHistory, setShowChangeHistory,
    beforeAfterDragRef,
    compareScenePath, setCompareScenePath,
  }

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
    <SceneViewProvider value={ctxValue}>
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

      {/* 그리드 설정 + 템플릿/프리셋 바 + 씬 탭 (추출) */}
      <SceneViewToolbarExtras
        showGridSettings={showGridSettings}
        setShowGridSettings={setShowGridSettings}
        gridSettings={gridSettings}
        setGridSettings={setGridSettings}
        viewportPresets={viewportPresets}
        setViewportPresets={setViewportPresets}
        activeSceneTab={activeSceneTab}
        setActiveSceneTab={setActiveSceneTab}
        setShowSceneHistory={setShowSceneHistory}
      />

      {/* 스냅샷 기록 툴바 (추출) */}
      <SceneViewSnapshotBar />

      {/* 애니메이션 미리보기 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => {
            const next = !animPreview
            setAnimPreview(next)
            if (next) {
              animPreviewIntervalRef.current = setInterval(() => {
                setAnimFrame(f => (f >= 100 ? 0 : f + 1))
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
            onChange={e => setAnimFrame(Number(e.target.value))}
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
              localStorage.setItem('cd-scene-locked', JSON.stringify([...next]))
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

        {/* Before/After, Compare, JSON, Measure, Ruler, Stats, 상태바 등 오버레이 (추출) */}
        <SceneViewInfoPanels
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          measureMode={measureMode}
          measureLine={measureLine}
          showRuler={showRuler}
          loading={loading}
          handleFit={handleFit}
          handleZoomTo={handleZoomTo}
          showGroupBtn={showGroupBtn}
          multiSelectedSize={multiSelected.size}
          isDragging={isDragging}
          isResizing={isResizing}
          isRotating={isRotating}
          dragDelta={dragDelta}
          hoverTooltipPos={hoverTooltipPos}
          tooltipVisibleUuid={tooltipVisibleUuid}
          showStats={showStats}
          showNodeInfo={showNodeInfo}
          showStatsOverlay={showStatsOverlay}
          showPngExportPanel={showPngExportPanel}
          setShowPngExportPanel={setShowPngExportPanel}
          pngExportBg={pngExportBg}
          setPngExportBg={setPngExportBg}
          pngExportScale={pngExportScale}
          setPngExportScale={setPngExportScale}
          handleExportPng={handleExportPng}
          showCanvasSearch={showCanvasSearch}
          setShowCanvasSearch={setShowCanvasSearch}
          canvasSearch={canvasSearch}
          setCanvasSearch={setCanvasSearch}
          canvasSearchRef={canvasSearchRef}
          searchMatches={searchMatches}
          searchMatchIndex={searchMatchIndex}
          handleSearchNav={handleSearchNav}
          showBookmarkList={showBookmarkList}
          setShowBookmarkList={setShowBookmarkList}
          showRefImagePanel={showRefImagePanel}
          setShowRefImagePanel={setShowRefImagePanel}
          refImageUrl={refImageUrl}
          setRefImageUrl={setRefImageUrl}
          refImageOpacity={refImageOpacity}
          setRefImageOpacity={setRefImageOpacity}
          spaceDown={spaceDown}
          activeTool={activeTool}
          snapEnabled={snapEnabled}
          snapGrid={snapGrid}
          gridVisible={gridVisible}
          isDirty={isDirty}
          copiedNode={copiedNode}
          isPanningActive={isPanningActive}
          nodePath={nodePath}
          overlayImageSrc={overlayImageSrc}
          setOverlayImageSrc={setOverlayImageSrc}
          overlayOpacity={overlayOpacity}
        />

        {/* 선택 노드 인라인 편집바 (추출) */}
        {selectedNode && nodeEditDraft && (
          <SceneViewEditBar
            selectedNode={selectedNode}
            nodeEditDraft={nodeEditDraft}
            setNodeEditDraft={setNodeEditDraft}
            updateNode={updateNode}
          />
        )}

        {/* 레이어/편집 이력/미니맵/변경 히스토리 오버레이 (추출) */}
        <SceneViewOverlays />

        {/* 퀵 액션 팝업 (추출) */}
        <SceneViewQuickActions show={showQuickActions} dismissed={quickActionDismissed} setDismissed={setQuickActionDismissed} isDragging={isDragging} isResizing={isResizing} />

      </div>

      {/* 단축키 도움말 (추출) */}
      <SceneViewShortcutsHelp show={showShortcuts} onClose={() => setShowShortcuts(false)} />

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

      {/* 컨텍스트 메뉴 + 태그 모달 + 색상 피커 + 임포트 모달 (추출) */}
      <SceneViewContextMenu />
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
    </SceneViewProvider>
  )
}

export default SceneViewPanel
