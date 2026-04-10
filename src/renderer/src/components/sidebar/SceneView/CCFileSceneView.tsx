// QA anchors (overlays extracted): 818cf8 Sz C# ×S S× ↳N '∞' maxNodeArea depthDim 22d3ee
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { CCSceneNode, CCSceneFile, CCVec3 } from '../../../../../shared/ipc-schema'
import { sceneViewKey, ALIGN_SNAP_THRESHOLD, UUID_RE, type FlatNode, type CCFileSceneViewProps, type ViewTransformCC } from './ccSceneTypes'
import { useCCSceneOverlayState } from './useCCSceneOverlayState'
import { useCCSceneAssets } from './useCCSceneAssets'
import { useCCSceneKeyboard } from './useCCSceneKeyboard'
import { useCCSceneMouse } from './useCCSceneMouse'
import { CCSceneProvider, type CCSceneContextValue } from './CCSceneContext'
import { CCSceneToolbar } from './CCSceneToolbar'
import { CCSceneInnerHUD, CCSceneOuterHUD } from './CCSceneHUD'
import { CCSceneSVGOverlays } from './CCSceneSVGOverlays'

export function CCFileSceneView({ sceneFile, selectedUuid, onSelect, onMove, onResize, onRename, onRotate, onMultiMove, onMultiDelete, onLabelEdit, onAddNode, onAnchorMove, onMultiSelectChange, onDuplicate, onToggleActive, onReorder, pulseUuid, onGroupNodes, onOpacity, onReorderExtreme, onAltDrag, collapsedUuids }: CCFileSceneViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewTransformCC>(() => {
    // R2486: 씬 전환 시 이전 뷰 상태 복원
    try {
      const saved = localStorage.getItem(sceneViewKey(sceneFile.scenePath))
      if (saved) { const p = JSON.parse(saved); if (p.zoom) return p }
    } catch { /* ignore */ }
    return { offsetX: 0, offsetY: 0, zoom: 0.5 }
  })
  const viewRef = useRef(view)
  viewRef.current = view
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ mouseX: number; mouseY: number; offX: number; offY: number } | null>(null)
  // R2705: isAltDrag — Alt 누른 채 드래그 시 복제
  const dragRef = useRef<{ uuid: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number; isAltDrag?: boolean } | null>(null)
  const [dragOverride, setDragOverride] = useState<{ uuid: string; x: number; y: number } | null>(null)
  // R1683: 드래그 ghost (원래 위치 반투명 표시) — worldX/worldY 기준
  const [dragGhost, setDragGhost] = useState<{ uuid: string; worldX: number; worldY: number; w: number; h: number; anchorX: number; anchorY: number } | null>(null)
  // R2472: 다중 선택 노드 동시 드래그
  const multiDragRef = useRef<{ startMouseX: number; startMouseY: number; nodes: Map<string, { localX: number; localY: number }> } | null>(null)
  const [multiDragDelta, setMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null)
  const resizeRef = useRef<{ uuid: string; startMouseX: number; startMouseY: number; startW: number; startH: number; dir: 'SE' | 'S' | 'E' | 'NW' | 'N' | 'NE' | 'W' | 'SW'; startLocalX: number; startLocalY: number } | null>(null)
  const [resizeOverride, setResizeOverride] = useState<{ uuid: string; w: number; h: number; dx?: number; dy?: number } | null>(null)
  const rotateRef = useRef<{ uuid: string; centerX: number; centerY: number; startAngle: number; startRotation: number } | null>(null)
  const [rotateOverride, setRotateOverride] = useState<{ uuid: string; angle: number } | null>(null)
  // R1506: 앵커 포인트 드래그
  const anchorRef = useRef<{ uuid: string; rectX: number; rectY: number; w: number; h: number } | null>(null)
  const [anchorOverride, setAnchorOverride] = useState<{ uuid: string; ax: number; ay: number } | null>(null)
  // R1512: 정렬 가이드라인 (드래그 시 인접 노드와 정렬 스냅)
  const [alignGuides, setAlignGuides] = useState<Array<{ type: 'V' | 'H'; pos: number; label?: string }>>([])
  // ALIGN_SNAP_THRESHOLD imported from ccSceneTypes
  const [mouseScenePos, setMouseScenePos] = useState<{ x: number; y: number } | null>(null)
  const [hoverUuid, setHoverUuid] = useState<string | null>(null)
  const [hoverClientPos, setHoverClientPos] = useState<{ x: number; y: number } | null>(null)

  // Overlay toggle states (extracted to useCCSceneOverlayState hook)
  // QA anchors: R1681 selectionColor setSelectionColor | R1697 labelFontSize A- A+
  const ov = useCCSceneOverlayState()
  const { gridStyle, setGridStyle, showNodeNames, setShowNodeNames, showZOrder, setShowZOrder,
    snapSize, setSnapSize, bgColorOverride, setBgColorOverride, bgPattern, setBgPattern,
    selectionColor, setSelectionColor, showHelp, setShowHelp, showMinimap, setShowMinimap,
    showRuler, setShowRuler, showCameraFrames, setShowCameraFrames, showGrid, setShowGrid,
    showCrossGuide, setShowCrossGuide, showEdgeGuides, setShowEdgeGuides,
    showUserGuides, setShowUserGuides, viewLock, setViewLock,
    hideInactiveNodes, setHideInactiveNodes, labelFontSize, setLabelFontSize,
    showSiblingGroup, setShowSiblingGroup, wireframeMode, setWireframeMode,
    depthColorMode, setDepthColorMode, depthFilterMax, setDepthFilterMax,
    soloMode, setSoloMode, showResPicker, setShowResPicker, resOverride, setResOverride,
    showWorldPos, setShowWorldPos, compFilterType, setCompFilterType,
    showLabelText, setShowLabelText, showSceneStats, setShowSceneStats,
    showOverlayPanel, setShowOverlayPanel, showToolPanel, setShowToolPanel,
    showSizeLabels, setShowSizeLabels, showOpacityLabels, setShowOpacityLabels,
    showCompBadges, setShowCompBadges, showRotLabels, setShowRotLabels,
    showNameLabels, setShowNameLabels, showAnchorOverlay, setShowAnchorOverlay,
    showColorSwatch, setShowColorSwatch, showChildCountBadge, setShowChildCountBadge,
    showDepthLabel, setShowDepthLabel, showFlipOverlay, setShowFlipOverlay,
    showSelBBox, setShowSelBBox, showCompBadge, setShowCompBadge,
    showTagBadge, setShowTagBadge, showDupNameOverlay, setShowDupNameOverlay,
    showRotArrow, setShowRotArrow, showSizeOverlay, setShowSizeOverlay,
    showOriginCross, setShowOriginCross, showScaleLabel, setShowScaleLabel,
    showLayerBadge, setShowLayerBadge, showEventBadge, setShowEventBadge,
    showSafeZone, setShowSafeZone, showRuleOfThirds, setShowRuleOfThirds,
    showCustomRatio, setShowCustomRatio, customRatioW, setCustomRatioW,
    customRatioH, setCustomRatioH, showOOBHighlight, setShowOOBHighlight,
    showSceneBBox, setShowSceneBBox, showSelOrder, setShowSelOrder,
    showAnchorDot, setShowAnchorDot, showSelPolyline, setShowSelPolyline,
    showHierarchyLines, setShowHierarchyLines, showSelGroupBBox, setShowSelGroupBBox,
    showParentHighlight, setShowParentHighlight, showInactiveDim, setShowInactiveDim,
    showColorViz, setShowColorViz, showCrosshair, setShowCrosshair,
    showDepthHeat, setShowDepthHeat, showOpacityOverlay, setShowOpacityOverlay,
    showRotOverlay, setShowRotOverlay, showPosText, setShowPosText,
    showScaleText, setShowScaleText, showCompCountBadge, setShowCompCountBadge,
    showSizeHeat, setShowSizeHeat, showSelCenter, setShowSelCenter,
    showPairDist, setShowPairDist, showSpriteName, setShowSpriteName,
    showUuidBadge, setShowUuidBadge, showCenterDot, setShowCenterDot,
    showNonDefaultAnchor, setShowNonDefaultAnchor, showZeroSizeWarn, setShowZeroSizeWarn,
    showSelAxisLine, setShowSelAxisLine, showSiblingHighlight, setShowSiblingHighlight,
    showOpacityHud, setShowOpacityHud, showRefArrows, setShowRefArrows,
  } = ov
  const [mmPos, setMmPos] = useState<{ x: number; y: number } | null>(null)
  const [nodePickMenu, setNodePickMenu] = useState<{ x: number; y: number; nodes: Array<{ uuid: string; name: string }> } | null>(null)
  const nodePickMenuRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; uuid: string | null } | null>(null)
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number } | null>(null)
  const [userGuides, setUserGuides] = useState<Array<{ type: 'V' | 'H'; pos: number }>>([])
  const guideDragRef = useRef<{ idx: number; type: 'V' | 'H'; startMouse: number; startPos: number } | null>(null)
  const [hiddenUuids, setHiddenUuids] = useState<Set<string>>(new Set())
  const [pinMarkers, setPinMarkers] = useState<{ id: number; ccX: number; ccY: number; label?: string }[]>([])
  const pinIdRef = useRef(0)
  const hoverClientPosRef = useRef<{ x: number; y: number } | null>(null)
  const selHistoryRef = useRef<string[]>([])
  const selHistoryIdxRef = useRef(-1)
  const [histPopupOpen, setHistPopupOpen] = useState(false)
  const histPopupBtnRef = useRef<HTMLButtonElement | null>(null)
  const overlayPanelRef = useRef<HTMLSpanElement>(null)
  const toolPanelRef = useRef<HTMLSpanElement>(null)
  const [viewBookmarks, setViewBookmarks] = useState<(ViewTransformCC | null)[]>([null, null, null])
  const [screenshotSending, setScreenshotSending] = useState(false)
  const [refImgSrc, setRefImgSrc] = useState<string | null>(null)
  const [refImgOpacity, setRefImgOpacity] = useState(0.3)
  const refImgInputRef = useRef<HTMLInputElement | null>(null)
  const [editingZoom, setEditingZoom] = useState(false)
  // R1550: 씬뷰 노드 검색 + 하이라이트
  const [svSearch, setSvSearch] = useState('')
  // R2581: 검색 결과 순환 인덱스
  const svSearchMatchIdxRef = useRef(0)
  const svSearchMatches = useMemo(() => {
    if (!svSearch.trim()) return new Set<string>()
    const q = svSearch.toLowerCase()
    const matches = new Set<string>()
    const walk = (n: CCSceneNode) => {
      // R1594: 이름/UUID 외에 컴포넌트 타입도 검색 대상에 포함
      const compMatch = n.components?.some(c => c.type.toLowerCase().includes(q))
      if (n.name.toLowerCase().includes(q) || n.uuid.toLowerCase().includes(q) || compMatch) matches.add(n.uuid)
      n.children.forEach(walk)
    }
    walk(sceneFile.root)
    return matches
  }, [svSearch, sceneFile])
  // R1543: 노드 잠금 (locked nodes: drag/resize 방지)
  const [lockedUuids, setLockedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cd-sv-locked-nodes') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleLock = (uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
      localStorage.setItem('cd-sv-locked-nodes', JSON.stringify([...next]))
      return next
    })
  }
  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  // R1491: Label 텍스트 인라인 편집
  const [editingLabelUuid, setEditingLabelUuid] = useState<string | null>(null)
  const editLabelRef = useRef<HTMLInputElement | null>(null)
  const resCustomWRef = useRef<HTMLInputElement | null>(null)
  const resCustomHRef = useRef<HTMLInputElement | null>(null)
  const isSpaceDownRef = useRef(false)
  // W/E 도구 모드: W=이동, E=회전 (CC Editor 단축키)
  const [transformTool, setTransformTool] = useState<'move' | 'rotate' | 'scale'>('move')
  const transformToolRef = useRef<'move' | 'rotate' | 'scale'>('move')
  transformToolRef.current = transformTool
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const multiSelectedRef = useRef(multiSelected)
  multiSelectedRef.current = multiSelected
  // Ctrl+C/V 노드 복사용 클립보드 ref
  const clipboardNodeRef = useRef<string | null>(null)
  const selBoxRef = useRef<{ startSvgX: number; startSvgY: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  // R2740: 같은 위치 클릭 반복 → 겹친 노드 순차 선택
  const lastClickCycleRef = useRef<{ svgX: number; svgY: number; uuidList: string[]; idx: number } | null>(null)
  const [showPinPanel, setShowPinPanel] = useState(false)
  // R2465: 거리 측정 도구
  const [measureMode, setMeasureMode] = useState(false)
  const [measureLine, setMeasureLine] = useState<{ svgX1: number; svgY1: number; svgX2: number; svgY2: number } | null>(null)
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false)
  const measureStartRef = useRef<{ svgX: number; svgY: number } | null>(null)

  // R1516: 다중 선택 변경 → 부모에 알림
  useEffect(() => {
    onMultiSelectChange?.(Array.from(multiSelected))
  }, [multiSelected, onMultiSelectChange])

  // R2715: 단축키 오버레이 외부 클릭 닫기
  useEffect(() => {
    if (!showShortcutOverlay) return
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('sc-shortcut-popup')
      if (el && !el.contains(e.target as Node)) setShowShortcutOverlay(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showShortcutOverlay])

  // 노드 선택 컨텍스트 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!nodePickMenu) return
    const handler = (e: MouseEvent) => {
      if (nodePickMenuRef.current && !nodePickMenuRef.current.contains(e.target as Node)) setNodePickMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [nodePickMenu])

  // R2486: 씬 전환 시 해당 씬의 저장된 뷰 상태 복원
  const prevScenePath = useRef(sceneFile.scenePath)
  useEffect(() => {
    if (sceneFile.scenePath === prevScenePath.current) return
    prevScenePath.current = sceneFile.scenePath
    try {
      const saved = localStorage.getItem(sceneViewKey(sceneFile.scenePath))
      if (saved) { const p = JSON.parse(saved); if (p.zoom) { setView(p); return } }
    } catch { /* ignore */ }
    setView({ offsetX: 0, offsetY: 0, zoom: 0.5 })
  }, [sceneFile.scenePath])

  // R2486: 뷰 변경 시 localStorage에 저장 (debounce 500ms)
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(sceneViewKey(sceneFile.scenePath), JSON.stringify(view)) } catch { /* ignore */ }
    }, 500)
    return () => clearTimeout(t)
  }, [view, sceneFile.scenePath])

  // Space/pan handler only uses refs (svgRef, isSpaceDownRef) - empty deps is intentional
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!svgRef.current || svgRef.current.getBoundingClientRect().width === 0) return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (e.code === 'Space' && !isSpaceDownRef.current) {
        e.preventDefault()
        isSpaceDownRef.current = true
        if (svgRef.current) svgRef.current.style.cursor = 'grab'
      }
      // W/V: 이동 도구 / E: 회전 도구 / R: 스케일 도구 (CC Editor 단축키)
      if (e.key === 'w' || e.key === 'W') { setTransformTool('move') }
      if (e.key === 'v' || e.key === 'V') { setTransformTool('move') }
      if (e.key === 'e' || e.key === 'E') { setTransformTool('rotate') }
      if (e.key === 'r' || e.key === 'R') { setTransformTool('scale') }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDownRef.current = false
        if (svgRef.current) svgRef.current.style.cursor = ''
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [])
  // Sprite + Font cache refs are provided by useCCSceneAssets hook (called after flatNodes below)

  // 캔버스 크기 + 배경색 추정
  const { designW, designH, bgColor } = useMemo(() => {
    const root = sceneFile.root
    const isPrefab = sceneFile.scenePath?.endsWith('.prefab')
    // prefab: root 자체가 콘텐츠 노드 — root.size 사용
    // scene: Canvas 컴포넌트 가진 노드 또는 첫 자식 노드 사용
    const canvasNode = isPrefab ? null : root.children.find(n =>
      n.name === 'Canvas' || n.components.some(c => c.type === 'cc.Canvas')
    )
    const n = isPrefab ? root : (canvasNode ?? root.children[0])
    // Camera clearColor 또는 Canvas backgroundColor 탐색
    let bgColor = '#1a1a2e'
    const allNodes = [root, ...(root.children ?? [])]
    for (const node of allNodes) {
      for (const comp of node.components) {
        const cc = comp.props.backgroundColor as { r?: number; g?: number; b?: number } | undefined
        const cl = comp.props.clearColor as { r?: number; g?: number; b?: number } | undefined
        const src = cc ?? cl
        if (src && src.r != null) {
          bgColor = `rgb(${src.r},${src.g ?? 0},${src.b ?? 0})`
          break
        }
      }
    }
    return {
      designW: n?.size?.x || 960,
      designH: n?.size?.y || 640,
      bgColor,
    }
  }, [sceneFile])
  // R1548: resOverride가 있으면 캔버스 표시 크기만 오버라이드 (씬 파일 미수정)
  const effectiveW = resOverride?.w ?? designW
  const effectiveH = resOverride?.h ?? designH

  // 씬 트리 → flat 목록 (world position 누적)
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = []
    // Simple 2D matrix transform: parent rotation/scale applied to local offset
    const applyParentTransform = (
      parentRotDeg: number, parentSx: number, parentSy: number,
      parentWorldX: number, parentWorldY: number,
      localX: number, localY: number
    ): [number, number] => {
      const r = -parentRotDeg * Math.PI / 180
      const cos = Math.cos(r), sin = Math.sin(r)
      const wx = parentWorldX + (cos * parentSx * localX - sin * parentSy * localY)
      const wy = parentWorldY + (sin * parentSx * localX + cos * parentSy * localY)
      return [wx, wy]
    }
    function walk(node: CCSceneNode, parentWorldX: number, parentWorldY: number, parentRotDeg: number, parentSx: number, parentSy: number, depth: number, parentUuid: string | null, siblingIdx: number, siblingTotal: number, parentEffectiveActive: boolean) {
      const localX = typeof node.position === 'object' ? (node.position as { x: number }).x : 0
      const localY = typeof node.position === 'object' ? (node.position as { y: number }).y : 0
      const [worldX, worldY] = applyParentTransform(parentRotDeg, parentSx, parentSy, parentWorldX, parentWorldY, localX, localY)
      const rotZ = node.rotation.z ?? 0
      const cumRotZ = parentRotDeg + rotZ
      const sx = (node.scale as { x?: number })?.x ?? 1
      const sy = (node.scale as { y?: number })?.y ?? 1
      const cumSx = parentSx * sx
      const cumSy = parentSy * sy
      const effectiveActive = parentEffectiveActive && !!node.active
      result.push({ node, worldX, worldY, worldRotZ: cumRotZ, worldScaleX: cumSx, worldScaleY: cumSy, depth, parentUuid, siblingIdx, siblingTotal, effectiveActive })
      // R2726: 씬 트리에서 접힌 노드는 자식을 SceneView에서도 숨김
      if (collapsedUuids?.has(node.uuid)) return
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], worldX, worldY, cumRotZ, cumSx, cumSy, depth + 1, node.uuid, i, node.children.length, effectiveActive)
      }
    }
    // root부터 walk — 씬/프리펩 모두 root 포함
    // 씬 root(cc.Scene)는 size=0 이므로 렌더링에서 null 반환되어 무해
    // 프리펩 root는 실제 콘텐츠 노드이므로 반드시 포함해야 함
    walk(sceneFile.root, 0, 0, 0, 1, 1, 0, null, 0, 1, true)
    return result
  }, [sceneFile, collapsedUuids])

  // 다중 선택 UUID 배열 (multiSelected Set → string[])
  const uuids = useMemo(() => Array.from(multiSelected), [multiSelected])

  // R2718: uuid → FlatNode 맵
  const nodeMap = useMemo(() => {
    const m = new Map<string, FlatNode>()
    flatNodes.forEach(fn => m.set(fn.node.uuid, fn))
    return m
  }, [flatNodes])

  // R2718: 선택 노드 컴포넌트 props에서 uuid 참조 수집
  // UUID_RE imported from ccSceneTypes
  const refUuids = useMemo(() => {
    const selFn = selectedUuid ? nodeMap.get(selectedUuid) : null
    if (!selFn || !showRefArrows) return []
    const refs: string[] = []
    for (const comp of selFn.node.components) {
      for (const v of Object.values(comp.props ?? {})) {
        if (typeof v === 'string' && UUID_RE.test(v) && nodeMap.has(v) && v !== selectedUuid) {
          refs.push(v)
        }
      }
    }
    return [...new Set(refs)]
  }, [selectedUuid, showRefArrows, nodeMap])

  // R2651: 선택 노드 부모 UUID 집합
  const parentUuidSet = useMemo(() => {
    const result = new Set<string>()
    flatNodes.forEach(fn => { if (uuids.includes(fn.node.uuid) && fn.parentUuid) result.add(fn.parentUuid) })
    return result
  }, [flatNodes, uuids])

  // R2665/R2675: 깊이 히트맵 최대 깊이 + 크기 히트맵 최대 면적 — 단일 패스로 계산
  const { maxDepthVal, maxNodeArea } = useMemo(() => {
    let depth = 1, area = 1
    for (const fn of flatNodes) {
      if (fn.depth > depth) depth = fn.depth
      const a = (fn.node.size?.x ?? 0) * (fn.node.size?.y ?? 0)
      if (a > area) area = a
    }
    return { maxDepthVal: depth, maxNodeArea: area }
  }, [flatNodes])

  // R2324: 선택 노드 자동 팬 — 트리에서 선택 시 뷰포트 밖이면 중심 이동
  const flatNodesRef = useRef(flatNodes)
  flatNodesRef.current = flatNodes
  const ccToSvgRef = useRef<(ccX: number, ccY: number) => { x: number; y: number }>((x, y) => ({ x, y }))
  const effectiveWRef = useRef(effectiveW)
  effectiveWRef.current = effectiveW
  const effectiveHRef = useRef(effectiveH)
  effectiveHRef.current = effectiveH
  useEffect(() => {
    if (!selectedUuid) return
    const fn = flatNodesRef.current.find(f => f.node.uuid === selectedUuid)
    if (!fn) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const v = viewRef.current
    const cxV = effectiveWRef.current / 2
    const cyV = effectiveHRef.current / 2
    const svgX = cxV + fn.worldX
    const svgY = cyV - fn.worldY
    const screenX = svgX * v.zoom + v.offsetX
    const screenY = svgY * v.zoom + v.offsetY
    const margin = 50
    const inView = screenX > margin && screenX < rect.width - margin &&
                   screenY > margin && screenY < rect.height - margin
    if (!inView) {
      setView(vv => ({ ...vv,
        offsetX: rect.width / 2 - svgX * vv.zoom,
        offsetY: rect.height / 2 - svgY * vv.zoom,
      }))
    }
  }, [selectedUuid])

  // Sprite + Font asset loading (extracted hook)
  const { spriteCacheRef, fontCacheRef, fontCacheVer } = useCCSceneAssets(sceneFile, flatNodes)

  // CC 좌표 → SVG 좌표 변환
  // CC: Y-up, center origin. SVG: Y-down, top-left.
  const cx = effectiveW / 2
  const cy = effectiveH / 2
  const ccToSvg = useCallback((ccX: number, ccY: number) => ({
    x: cx + ccX,
    y: cy - ccY,
  }), [cx, cy])
  ccToSvgRef.current = ccToSvg

  // Mouse/drag handlers (extracted to useCCSceneMouse hook)
  const { handleMouseDown, handleMouseMove, handleMouseUp } = useCCSceneMouse({
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
  })

  // R2734: 가이드라인 추가
  const addUserGuide = (type: 'V' | 'H') => {
    const pos = type === 'V' ? effectiveW / 2 : effectiveH / 2
    setUserGuides(g => [...g, { type, pos }])
    setShowUserGuides(true)
  }
  const clearUserGuides = () => setUserGuides([])

  // Fit to view
  const handleFit = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const zoom = Math.min(rect.width / effectiveW, rect.height / effectiveH) * 0.9
    setView({
      zoom,
      offsetX: (rect.width - effectiveW * zoom) / 2,
      offsetY: (rect.height - effectiveH * zoom) / 2,
    })
  }, [effectiveW, effectiveH])

  // F 키: 선택 노드 중앙 포커스 (없으면 Fit all)
  const handleFitToSelected = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const fn = selectedUuid ? flatNodes.find(f => f.node.uuid === selectedUuid) : null
    if (!fn) { handleFit(); return }
    const svgPos = ccToSvg(fn.worldX, fn.worldY)
    const z = viewRef.current.zoom
    setView(v => ({
      ...v,
      offsetX: rect.width / 2 - svgPos.x * z,
      offsetY: rect.height / 2 - svgPos.y * z,
    }))
  }, [selectedUuid, flatNodes, ccToSvg, handleFit])

  // R2703: 선택된 노드(들)의 평균 중심점으로 씬뷰 팬 이동 (centerSel)
  const panToCenter = useCallback(() => {
    // centerOnSel: 선택 노드 중심으로 팬
    const targets = multiSelected.size > 0
      ? flatNodes.filter(fn => multiSelected.has(fn.node.uuid))
      : flatNodes.filter(fn => fn.node.uuid === selectedUuid)
    if (targets.length === 0) return

    const cx = targets.reduce((sum, fn) => sum + (fn.worldX ?? 0), 0) / targets.length
    const cy = targets.reduce((sum, fn) => sum + (fn.worldY ?? 0), 0) / targets.length

    const svgEl = svgRef.current
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const z = viewRef.current.zoom

    const svgPos = ccToSvg(cx, cy)
    setView(v => ({
      ...v,
      offsetX: rect.width / 2 - svgPos.x * z,
      offsetY: rect.height / 2 - svgPos.y * z,
    }))
  }, [flatNodes, selectedUuid, multiSelected, ccToSvg])

  // R1481: cc-focus-node 이벤트 수신 → 해당 UUID 노드로 pan
  useEffect(() => {
    const onFocusNode = (e: Event) => {
      const uuid = (e as CustomEvent).detail?.uuid as string | undefined
      if (!uuid) return
      const svg = svgRef.current
      if (!svg) return
      const fn = flatNodes.find(f => f.node.uuid === uuid)
      if (!fn) return
      const svgPos = ccToSvg(fn.worldX, fn.worldY)
      const rect = svg.getBoundingClientRect()
      const z = viewRef.current.zoom
      setView(v => ({
        ...v,
        offsetX: rect.width / 2 - svgPos.x * z,
        offsetY: rect.height / 2 - svgPos.y * z,
      }))
    }
    window.addEventListener('cc-focus-node', onFocusNode)
    return () => window.removeEventListener('cc-focus-node', onFocusNode)
  }, [flatNodes, ccToSvg])

  // Keyboard shortcuts (extracted to useCCSceneKeyboard hook)
  // QA anchors: Ctrl+N e.key === 'n' | KeyP parentUuid fn?.parentUuid | code === 'Enter' node.children[0].uuid 'Enter', '첫 번째 자식 선택'
  // QA anchors: code === 'Tab' shiftKey (idx - 1 + siblings.length) | key === 'a' allUuids 전체 노드 다중 선택
  // QA anchors: R1622 KeyO onMove?.(selectedUuid, 0, 0) 중앙(0,0) 이동 | R1692 hiddenUuids Shift+H
  // QA anchors: R1693 pinMarkers Ctrl+P | onDuplicate key === 'd' | R2486 sceneViewKey sv-view2- prevScenePath
  const navSkipRef = useRef(false)
  useCCSceneKeyboard({
    svgRef, viewRef, multiSelectedRef, clipboardNodeRef,
    selHistoryRef, selHistoryIdxRef, navSkipRef,
    hoverClientPosRef, measureStartRef,
    selectedUuid, flatNodes, effectiveW, effectiveH, designW, designH, viewBookmarks,
    handleFitToSelected, handleFit, toggleLock,
    setView, setViewBookmarks, setShowSiblingGroup, setHiddenUuids,
    setMeasureMode, setMeasureLine, setPinMarkers, pinIdRef,
    onSelect, onMove, onMultiMove, onMultiDelete, onAddNode, onDuplicate,
    onToggleActive, onReorder, onGroupNodes, onMultiSelectChange,
  })
  // R1705: selectedUuid 변경 시 이력 기록
  useEffect(() => {
    if (!selectedUuid) return
    if (navSkipRef.current) { navSkipRef.current = false; return }
    const hist = selHistoryRef.current
    const idx = selHistoryIdxRef.current
    // 현재 위치 이후의 이력 제거 (새 선택 시)
    const newHist = hist.slice(idx < 0 ? 0 : idx)
    if (newHist[0] === selectedUuid) return  // 중복 방지
    selHistoryRef.current = [selectedUuid, ...newHist].slice(0, 30)
    selHistoryIdxRef.current = 0
  }, [selectedUuid])

  // R2707: 히스토리 팝업 외부 클릭 닫기
  useEffect(() => {
    if (!histPopupOpen) return
    const handler = (e: MouseEvent) => {
      if (histPopupBtnRef.current && histPopupBtnRef.current.contains(e.target as Node)) return
      setHistPopupOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [histPopupOpen])

  // 오버레이/도구 패널 외부 클릭 닫기
  useEffect(() => {
    if (!showOverlayPanel && !showToolPanel) return
    const handler = (e: MouseEvent) => {
      if (showOverlayPanel && overlayPanelRef.current && !overlayPanelRef.current.contains(e.target as Node)) setShowOverlayPanel(false)
      if (showToolPanel && toolPanelRef.current && !toolPanelRef.current.contains(e.target as Node)) setShowToolPanel(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showOverlayPanel, showToolPanel])

  // R1474: SVG 캡처 → base64 → Claude 비전 분석 prefill
  // R1708: Shift+클릭 → PNG 로컬 다운로드
  const handleScreenshotAI = useCallback((e?: React.MouseEvent) => {
    if (!svgRef.current || screenshotSending) return
    const saveLocal = e?.shiftKey ?? false
    setScreenshotSending(true)
    const svgEl = svgRef.current
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = svgEl.clientWidth || designW
      canvas.height = svgEl.clientHeight || designH
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(svgUrl); setScreenshotSending(false); return }
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(svgUrl)
      if (saveLocal) {
        // R1708: PNG 파일로 다운로드
        const link = document.createElement('a')
        link.download = `scene-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      } else {
        const b64 = canvas.toDataURL('image/png')
        window.dispatchEvent(new CustomEvent('cc-chat-prefill', {
          detail: {
            text: '이 Cocos Creator 씬 스크린샷을 분석해 주세요. UI 구조, 레이아웃, 개선 가능한 부분을 설명해 주세요.',
            imageBase64: b64,
          }
        }))
      }
      setScreenshotSending(false)
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); setScreenshotSending(false) }
    img.src = svgUrl
  }, [svgRef, screenshotSending, designW, designH])

  // R2315: SVG 파일 직접 내보내기
  const handleSvgExport = useCallback(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `scene-${Date.now()}.svg`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }, [svgRef])

  // R2318: cc.Camera 뷰 프레임 오버레이 — 카메라 컴포넌트 추출
  const cameraFrames = useMemo(() => {
    return flatNodes.flatMap(fn => {
      const camComp = fn.node.components.find(c => c.type === 'cc.Camera' || c.type === 'Camera')
      if (!camComp) return []
      const props = camComp.props as Record<string, unknown>
      const rawH = (props['orthoHeight'] ?? props['_orthoHeight'] ?? (designH / 2)) as number
      const zoom = (props['zoomRatio'] as number | undefined) ?? 1
      const h = rawH * 2 / zoom
      const w = h * (designW / designH)
      return [{ worldX: fn.worldX, worldY: fn.worldY, w, h }]
    })
  }, [flatNodes, designW, designH])

  const transform = `translate(${view.offsetX}, ${view.offsetY}) scale(${view.zoom})`

  // Context value for extracted sub-components (CCSceneToolbar, etc.)
  const ccSceneCtxValue: CCSceneContextValue = {
    sceneFile, selectedUuid, onSelect, onMove, onResize, onRename, onRotate,
    onMultiMove, onMultiDelete, onLabelEdit, onAddNode, onAnchorMove,
    onMultiSelectChange, onDuplicate, onToggleActive, onReorder, onGroupNodes,
    onOpacity, onReorderExtreme, onAltDrag, pulseUuid,
    view, setView, viewRef, svgRef,
    flatNodes, nodeMap, designW, designH, effectiveW, effectiveH, bgColor, cx, cy, ccToSvg, cameraFrames,
    multiSelected, setMultiSelected, uuids,
    dragOverride, resizeOverride, rotateOverride, anchorOverride, multiDragDelta,
    dragGhost, selectionBox, alignGuides, snapIndicator,
    transformTool, setTransformTool, transformToolRef, isPanning,
    measureMode, setMeasureMode, measureLine, setMeasureLine, measureStartRef,
    lockedUuids, setLockedUuids, toggleLock,
    hiddenUuids, setHiddenUuids,
    editingUuid, setEditingUuid, editInputRef,
    editingLabelUuid, setEditingLabelUuid, editLabelRef,
    mouseScenePos, hoverUuid, setHoverUuid, hoverClientPos, setHoverClientPos, hoverClientPosRef,
    svSearch, setSvSearch, svSearchMatches, svSearchMatchIdxRef,
    ov,
    pinMarkers, setPinMarkers, showPinPanel, setShowPinPanel,
    viewBookmarks, setViewBookmarks,
    screenshotSending, handleScreenshotAI, handleSvgExport,
    handleFit, handleFitToSelected, panToCenter,
    refImgSrc, setRefImgSrc, refImgOpacity, setRefImgOpacity, refImgInputRef,
    editingZoom, setEditingZoom,
    ctxMenu, setCtxMenu, nodePickMenu, setNodePickMenu, nodePickMenuRef,
    selHistoryRef, selHistoryIdxRef, histPopupOpen, setHistPopupOpen, histPopupBtnRef, navSkipRef,
    showShortcutOverlay, setShowShortcutOverlay, overlayPanelRef, toolPanelRef,
    userGuides, setUserGuides, addUserGuide, clearUserGuides,
    resCustomWRef, resCustomHRef,
    dragRef, resizeRef, rotateRef, anchorRef, guideDragRef, selBoxRef,
    multiSelectedRef, multiDragRef, flatNodesRef, effectiveWRef, effectiveHRef,
    ccToSvgRef, lastClickCycleRef, isSpaceDownRef,
    spriteCacheRef, fontCacheRef, fontCacheVer,
    refUuids, parentUuidSet, maxDepthVal, maxNodeArea,
    viewLock: ov.viewLock,
    handleMouseDown, handleMouseMove, handleMouseUp, setMouseScenePos,
    mmPos, setMmPos,
    setDragOverride, setDragGhost, setResizeOverride, setRotateOverride,
    setAnchorOverride, setMultiDragDelta, setSelectionBox, setAlignGuides, setSnapIndicator,
  }

  return (
    <CCSceneProvider value={ccSceneCtxValue}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <CCSceneToolbar />
      {/* SVG 캔버스 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <svg
        ref={svgRef}
        data-font-ver={fontCacheVer}
        style={{ width: '100%', height: '100%', background: '#1a1a2e', cursor: isPanning ? 'grabbing' : dragOverride ? 'grabbing' : rotateOverride ? 'crosshair' : measureMode ? 'crosshair' : 'default', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setMouseScenePos(null) }}
        onContextMenu={e => {
          e.preventDefault()
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const svgX = (e.clientX - rect.left - view.offsetX) / view.zoom
          const svgY = (e.clientY - rect.top - view.offsetY) / view.zoom
          // hit test all nodes for overlapping pick menu
          // fn.worldX/Y는 CC 좌표 → SVG 좌표로 변환: sp.x = cx + worldX, sp.y = cy - worldY
          const hits = flatNodes.filter(fn => {
            if (!fn.node.size || !fn.effectiveActive) return false
            const w = fn.node.size.x, h = fn.node.size.y
            const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
            const spx = cx + fn.worldX, spy = cy - fn.worldY
            const nx = spx - ax * w, ny = spy - (1 - ay) * h
            return svgX >= nx && svgX <= nx + w && svgY >= ny && svgY <= ny + h
          }).map(fn => ({ uuid: fn.node.uuid, name: fn.node.name }))
          if (hits.length > 1) {
            setNodePickMenu({ x: e.clientX, y: e.clientY, nodes: hits })
          } else {
            setCtxMenu({ x: e.clientX, y: e.clientY, uuid: selectedUuid })
          }
        }}
        onClick={() => { onSelect(null); setMultiSelected(new Set()); selBoxRef.current = null; setSelectionBox(null) }}
        onDoubleClick={e => {
          if (e.shiftKey || !onAddNode) { handleFit(); return }
          // R1504: 빈 공간 더블클릭 → 클릭 위치에 새 노드 추가
          const svg = svgRef.current
          if (!svg) return
          const rect = svg.getBoundingClientRect()
          const z = viewRef.current.zoom
          const svgX = (e.clientX - rect.left - viewRef.current.offsetX) / z
          const svgY = (e.clientY - rect.top - viewRef.current.offsetY) / z
          // SVG → CC 좌표 (Y 반전)
          const ccX = svgX
          const ccY = -svgY
          onAddNode(selectedUuid, { x: Math.round(ccX), y: Math.round(ccY) })
        }}
      >
        <defs>
          {/* 커스텀 폰트 @font-face */}
          {fontCacheRef.current.size > 0 && (
            <style>{
              [...fontCacheRef.current.entries()]
                .filter(([, v]) => v.dataUrl)
                .map(([, { dataUrl, familyName }]) => {
                  const safeName = familyName.replace(/['"\\]/g, '_')
                  return `@font-face { font-family: '${safeName}'; src: url('${dataUrl}'); }`
                }).join('\n')
            }</style>
          )}
          {/* 캔버스 외부 빗금 패턴 */}
          <pattern id="hatchOutside" width={8 / view.zoom} height={8 / view.zoom} patternUnits="userSpaceOnUse">
            <line x1={0} y1={8 / view.zoom} x2={8 / view.zoom} y2={0} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / view.zoom} />
          </pattern>
          <mask id="outsideMask">
            <rect x={-99999} y={-99999} width={199999} height={199999} fill="white" />
            <rect x={0} y={0} width={effectiveW} height={effectiveH} fill="black" />
          </mask>
          {/* R2610: rotation 화살표 마커 */}
          <marker id="rot-arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(236,72,153,0.9)" />
          </marker>
          {/* R2718: uuid 참조 화살표 마커 */}
          <marker id="ref-arrow" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
          </marker>
          {/* R2326: 체크무늬 배경 패턴 */}
          {bgPattern === 'checker' && (() => {
            const cs = 20
            const c1 = 'rgba(255,255,255,0.06)'
            const c2 = 'rgba(0,0,0,0.08)'
            return (
              <pattern id="checkerBg" width={cs * 2} height={cs * 2} patternUnits="userSpaceOnUse">
                <rect width={cs} height={cs} fill={c1} />
                <rect x={cs} y={cs} width={cs} height={cs} fill={c1} />
                <rect x={cs} width={cs} height={cs} fill={c2} />
                <rect y={cs} width={cs} height={cs} fill={c2} />
              </pattern>
            )
          })()}
          {/* 선택 노드 마칭 앤트 애니메이션 */}
          <style>{`
            @keyframes march { to { stroke-dashoffset: -20; } }
            .cc-selected-rect { stroke-dasharray: 6 3; animation: march 0.6s linear infinite; }
            @keyframes cc-pulse { 0%,100% { opacity:0; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.06); } }
            .cc-pulse-ring { animation: cc-pulse 0.45s ease-in-out 3; pointer-events:none; }
          `}</style>
        </defs>
        <g transform={transform}>
          {/* 게임 캔버스 배경 */}
          <rect x={0} y={0} width={effectiveW} height={effectiveH}
            fill={bgColorOverride ?? bgColor} stroke="#555" strokeWidth={1 / view.zoom} />
          {/* R2326: 체크무늬 오버레이 */}
          {bgPattern === 'checker' && (
            <rect x={0} y={0} width={effectiveW} height={effectiveH} fill="url(#checkerBg)" style={{ pointerEvents: 'none' }} />
          )}
          {/* R2456: 그리드 오버레이 */}
          {showGrid && (() => {
            const gs = snapSize
            const lines: React.ReactNode[] = []
            const sw = 1 / view.zoom
            const strokeCol = 'rgba(255,255,255,0.12)'
            // 원점(중심)에서 snapSize 간격으로 그리드 (CC 좌표: origin = canvas center, SVG: 0,0 = top-left)
            const ox = effectiveW / 2  // SVG x where CC x=0
            const oy = effectiveH / 2  // SVG y where CC y=0
            // 세로선
            for (let x = ((ox % gs) + gs) % gs; x <= effectiveW; x += gs) {
              const isOrigin = Math.abs(x - ox) < 0.5
              lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={effectiveH} stroke={isOrigin ? 'rgba(255,80,80,0.3)' : strokeCol} strokeWidth={sw} />)
            }
            // 가로선
            for (let y = ((oy % gs) + gs) % gs; y <= effectiveH; y += gs) {
              const isOrigin = Math.abs(y - oy) < 0.5
              lines.push(<line key={`h${y}`} x1={0} y1={y} x2={effectiveW} y2={y} stroke={isOrigin ? 'rgba(80,200,80,0.3)' : strokeCol} strokeWidth={sw} />)
            }
            return <g style={{ pointerEvents: 'none' }}>{lines}</g>
          })()}
          {/* R2501: 중심선 가이드 — CC 좌표 원점(0,0) 수직/수평선 */}
          {showCrossGuide && (() => {
            const ox = effectiveW / 2, oy = effectiveH / 2
            const sw = 1 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={ox} y1={0} x2={ox} y2={effectiveH} stroke="rgba(251,146,60,0.5)" strokeWidth={sw} strokeDasharray={`${4 / view.zoom},${4 / view.zoom}`} />
                <line x1={0} y1={oy} x2={effectiveW} y2={oy} stroke="rgba(251,146,60,0.5)" strokeWidth={sw} strokeDasharray={`${4 / view.zoom},${4 / view.zoom}`} />
                <circle cx={ox} cy={oy} r={4 / view.zoom} fill="rgba(251,146,60,0.6)" />
              </g>
            )
          })()}
          {/* R2508: 다중 선택 중심점 마커 */}
          {multiSelected.size > 1 && (() => {
            const selFn = flatNodes.filter(fn => multiSelected.has(fn.node.uuid))
            if (selFn.length < 2) return null
            const avgX = selFn.reduce((s, fn) => s + fn.worldX, 0) / selFn.length
            const avgY = selFn.reduce((s, fn) => s + fn.worldY, 0) / selFn.length
            const sp = ccToSvg(avgX, avgY)
            const r = 5 / view.zoom, sw = 1 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={sp.x - r * 2} y1={sp.y} x2={sp.x + r * 2} y2={sp.y} stroke="rgba(251,146,60,0.7)" strokeWidth={sw} />
                <line x1={sp.x} y1={sp.y - r * 2} x2={sp.x} y2={sp.y + r * 2} stroke="rgba(251,146,60,0.7)" strokeWidth={sw} />
                <circle cx={sp.x} cy={sp.y} r={r} fill="none" stroke="rgba(251,146,60,0.7)" strokeWidth={sw} />
              </g>
            )
          })()}
          {/* R2524: 다중 선택 통합 바운딩박스 */}
          {multiSelected.size > 1 && (() => {
            const selFn = flatNodes.filter(fn => multiSelected.has(fn.node.uuid))
            if (selFn.length < 2) return null
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
            for (const fn of selFn) {
              const sp = ccToSvg(fn.worldX, fn.worldY)
              const w = fn.node.size?.x ?? 0, h = fn.node.size?.y ?? 0
              const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
              minX = Math.min(minX, sp.x - w * ax)
              maxX = Math.max(maxX, sp.x + w * (1 - ax))
              minY = Math.min(minY, sp.y - h * (1 - ay))
              maxY = Math.max(maxY, sp.y + h * ay)
            }
            const bw = maxX - minX, bh = maxY - minY
            const sw = 1 / view.zoom, ds = 4 / view.zoom
            return (
              <rect x={minX} y={minY} width={bw} height={bh}
                fill="none" stroke="rgba(251,146,60,0.5)" strokeWidth={sw}
                strokeDasharray={`${ds},${ds}`}
                style={{ pointerEvents: 'none' }} />
            )
          })()}
          {/* R2511: 선택 노드 엣지-캔버스 거리 가이드선 */}
          {showEdgeGuides && selectedUuid && (() => {
            const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!fn) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const w = fn.node.size?.x ?? 0, h = fn.node.size?.y ?? 0
            const sw = 1 / view.zoom
            const fs = 9 / view.zoom
            const canL = 0, canR = effectiveW, canT = 0, canB = effectiveH
            const nodeL = sp.x - w / 2, nodeR = sp.x + w / 2
            const nodeT = sp.y - h / 2, nodeB = sp.y + h / 2
            const dL = Math.round(fn.worldX - (-effectiveW / 2) - w / 2)
            const dR = Math.round(effectiveW / 2 - fn.worldX - w / 2)
            const dT = Math.round(effectiveH / 2 - fn.worldY - h / 2)
            const dB = Math.round(fn.worldY - (-effectiveH / 2) - h / 2)
            const gc = 'rgba(129,140,248,0.5)'
            const tc = 'rgba(129,140,248,0.8)'
            return (
              <g style={{ pointerEvents: 'none' }}>
                {/* Left guide */}
                <line x1={canL} y1={sp.y} x2={nodeL} y2={sp.y} stroke={gc} strokeWidth={sw} strokeDasharray={`${3/view.zoom},${3/view.zoom}`} />
                <text x={(canL + nodeL) / 2} y={sp.y - 2 / view.zoom} fontSize={fs} fill={tc} textAnchor="middle">{dL}</text>
                {/* Right guide */}
                <line x1={nodeR} y1={sp.y} x2={canR} y2={sp.y} stroke={gc} strokeWidth={sw} strokeDasharray={`${3/view.zoom},${3/view.zoom}`} />
                <text x={(nodeR + canR) / 2} y={sp.y - 2 / view.zoom} fontSize={fs} fill={tc} textAnchor="middle">{dR}</text>
                {/* Top guide */}
                <line x1={sp.x} y1={canT} x2={sp.x} y2={nodeT} stroke={gc} strokeWidth={sw} strokeDasharray={`${3/view.zoom},${3/view.zoom}`} />
                <text x={sp.x + 2 / view.zoom} y={(canT + nodeT) / 2} fontSize={fs} fill={tc}>{dT}</text>
                {/* Bottom guide */}
                <line x1={sp.x} y1={nodeB} x2={sp.x} y2={canB} stroke={gc} strokeWidth={sw} strokeDasharray={`${3/view.zoom},${3/view.zoom}`} />
                <text x={sp.x + 2 / view.zoom} y={(nodeB + canB) / 2} fontSize={fs} fill={tc}>{dB}</text>
              </g>
            )
          })()}
          {/* R1530: 디자인 레퍼런스 이미지 overlay */}
          {refImgSrc && (
            <image href={refImgSrc} x={0} y={0} width={effectiveW} height={effectiveH}
              opacity={refImgOpacity} style={{ pointerEvents: 'none' }} preserveAspectRatio="xMidYMid meet" />
          )}
          {/* 캔버스 치수 레이블 */}
          {view.zoom > 0.25 && (
            <text
              x={effectiveW / 2} y={-6 / view.zoom}
              fontSize={10 / view.zoom} fill={resOverride ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.25)'}
              textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}
            >{effectiveW} × {effectiveH}{resOverride ? ' ★' : ''}</text>
          )}
          {/* 좌표축 화살표 (우하단 코너) */}
          {view.zoom > 0.3 && (() => {
            const ax = effectiveW + 8 / view.zoom
            const ay = effectiveH + 8 / view.zoom
            const al = 18 / view.zoom
            const aw = 4 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {/* X축 (→) */}
                <line x1={ax} y1={ay} x2={ax + al} y2={ay} stroke="rgba(255,80,80,0.5)" strokeWidth={1.5 / view.zoom} />
                <polygon points={`${ax + al},${ay} ${ax + al - aw},${ay - aw / 1.5} ${ax + al - aw},${ay + aw / 1.5}`} fill="rgba(255,80,80,0.5)" />
                <text x={ax + al + 3 / view.zoom} y={ay + 1 / view.zoom} fontSize={8 / view.zoom} fill="rgba(255,80,80,0.5)" dominantBaseline="middle">X</text>
                {/* Y축 (CC Y-up → SVG 상단 = CC +Y) */}
                <line x1={ax} y1={ay} x2={ax} y2={ay - al} stroke="rgba(80,200,80,0.5)" strokeWidth={1.5 / view.zoom} />
                <polygon points={`${ax},${ay - al} ${ax - aw / 1.5},${ay - al + aw} ${ax + aw / 1.5},${ay - al + aw}`} fill="rgba(80,200,80,0.5)" />
                <text x={ax + 2 / view.zoom} y={ay - al - 2 / view.zoom} fontSize={8 / view.zoom} fill="rgba(80,200,80,0.5)">Y</text>
              </g>
            )
          })()}
          {/* 캔버스 외부 빗금 오버레이 */}
          <rect x={-99999} y={-99999} width={199999} height={199999}
            fill="url(#hatchOutside)" mask="url(#outsideMask)" pointerEvents="none" />
          {/* 그리드 (100px 단위) */}
          {gridStyle !== 'none' && view.zoom > 0.2 && (() => {
            const step = 100
            const els: React.ReactElement[] = []
            if (gridStyle === 'line') {
              for (let x = step; x < effectiveW; x += step) {
                els.push(<line key={`gv${x}`} x1={x} y1={0} x2={x} y2={effectiveH} stroke="rgba(255,255,255,0.05)" strokeWidth={1/view.zoom} />)
              }
              for (let y = step; y < effectiveH; y += step) {
                els.push(<line key={`gh${y}`} x1={0} y1={y} x2={effectiveW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1/view.zoom} />)
              }
            } else {
              // dot 그리드: 교차점에만 점 표시
              for (let x = step; x < effectiveW; x += step) {
                for (let y = step; y < effectiveH; y += step) {
                  els.push(<circle key={`d${x}${y}`} cx={x} cy={y} r={1/view.zoom} fill="rgba(255,255,255,0.15)" />)
                }
              }
            }
            // 중앙 십자선 (항상 표시)
            els.push(<line key="cx" x1={effectiveW/2} y1={0} x2={effectiveW/2} y2={effectiveH} stroke="rgba(88,166,255,0.15)" strokeWidth={1/view.zoom} />)
            els.push(<line key="cy" x1={0} y1={effectiveH/2} x2={effectiveW} y2={effectiveH/2} stroke="rgba(88,166,255,0.15)" strokeWidth={1/view.zoom} />)
            return els
          })()}

          {/* R1683: 드래그 ghost — 원래 위치 반투명 표시 */}
          {dragGhost && dragOverride && dragOverride.uuid === dragGhost.uuid && (() => {
            const gp = ccToSvg(dragGhost.worldX, dragGhost.worldY)
            const gSvgX = gp.x - dragGhost.w * dragGhost.anchorX
            const gSvgY = gp.y - dragGhost.h * (1 - dragGhost.anchorY)
            return (
              <rect
                x={gSvgX} y={gSvgY} width={Math.max(0, dragGhost.w)} height={Math.max(0, dragGhost.h)}
                fill="none" stroke="#ff9944" strokeWidth={1.5 / view.zoom}
                strokeDasharray={`${4 / view.zoom},${3 / view.zoom}`}
                opacity={0.5} pointerEvents="none"
              />
            )
          })()}
          {/* R1500: 스냅 포인트 시각적 피드백 */}
          {snapIndicator && (() => {
            const sp = ccToSvg(snapIndicator.x, snapIndicator.y)
            const sz = 6 / view.zoom
            return (
              <g pointerEvents="none">
                <circle cx={sp.x} cy={sp.y} r={sz} fill="none" stroke="#ffdd44" strokeWidth={1.5 / view.zoom} opacity={0.8} />
                <line x1={sp.x - sz * 1.5} y1={sp.y} x2={sp.x + sz * 1.5} y2={sp.y} stroke="#ffdd44" strokeWidth={1 / view.zoom} opacity={0.8} />
                <line x1={sp.x} y1={sp.y - sz * 1.5} x2={sp.x} y2={sp.y + sz * 1.5} stroke="#ffdd44" strokeWidth={1 / view.zoom} opacity={0.8} />
              </g>
            )
          })()}
          {/* R1640: 선택 노드 월드 좌표 가이드라인 */}
          {selectedUuid && (() => {
            const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!fn) return null
            const fnLocalX = typeof fn.node.position === 'object' ? (fn.node.position as CCVec3).x : 0
            const fnLocalY = typeof fn.node.position === 'object' ? (fn.node.position as CCVec3).y : 0
            const effX = dragOverride?.uuid === selectedUuid ? fn.worldX + (dragOverride.x - fnLocalX) : fn.worldX
            const effY = dragOverride?.uuid === selectedUuid ? fn.worldY + (dragOverride.y - fnLocalY) : fn.worldY
            const sp = ccToSvg(effX, effY)
            return (
              <g pointerEvents="none">
                <line x1={sp.x} y1={0} x2={sp.x} y2={effectiveH} stroke="rgba(88,166,255,0.12)" strokeWidth={1 / view.zoom} />
                <line x1={0} y1={sp.y} x2={effectiveW} y2={sp.y} stroke="rgba(88,166,255,0.12)" strokeWidth={1 / view.zoom} />
              </g>
            )
          })()}
          {/* R1512: 정렬 가이드라인 */}
          {alignGuides.length > 0 && (
            <g pointerEvents="none">
              {alignGuides.map((g, i) =>
                g.type === 'V'
                  ? <line key={`ag-v-${i}`} x1={g.pos} y1={0} x2={g.pos} y2={designH} stroke="#ff4488" strokeWidth={1 / view.zoom} opacity={0.7} strokeDasharray={`${4/view.zoom} ${3/view.zoom}`} />
                  : <line key={`ag-h-${i}`} x1={0} y1={g.pos} x2={designW} y2={g.pos} stroke="#ff4488" strokeWidth={1 / view.zoom} opacity={0.7} strokeDasharray={`${4/view.zoom} ${3/view.zoom}`} />
              )}
            </g>
          )}
          {/* R2734: 사용자 영구 가이드라인 */}
          {showUserGuides && userGuides.map((g, i) =>
            g.type === 'V'
              ? <g key={`ug-v-${i}`}>
                  <line x1={g.pos} y1={0} x2={g.pos} y2={effectiveH}
                    stroke="rgba(251,146,60,0.7)" strokeWidth={1 / view.zoom}
                    strokeDasharray={`${6/view.zoom},${3/view.zoom}`} pointerEvents="none" />
                  <line x1={g.pos} y1={0} x2={g.pos} y2={effectiveH}
                    stroke="rgba(251,146,60,0.7)" strokeWidth={Math.max(6, 1/view.zoom)}
                    strokeOpacity={0} pointerEvents="stroke"
                    style={{ cursor: 'ew-resize' }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      guideDragRef.current = { idx: i, type: 'V', startMouse: e.clientX, startPos: g.pos }
                    }} />
                </g>
              : <g key={`ug-h-${i}`}>
                  <line x1={0} y1={g.pos} x2={effectiveW} y2={g.pos}
                    stroke="rgba(251,146,60,0.7)" strokeWidth={1 / view.zoom}
                    strokeDasharray={`${6/view.zoom},${3/view.zoom}`} pointerEvents="none" />
                  <line x1={0} y1={g.pos} x2={effectiveW} y2={g.pos}
                    stroke="rgba(251,146,60,0.7)" strokeWidth={Math.max(6, 1/view.zoom)}
                    strokeOpacity={0} pointerEvents="stroke"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      guideDragRef.current = { idx: i, type: 'H', startMouse: e.clientY, startPos: g.pos }
                    }} />
                </g>
          )}
          {/* 노드 렌더링 (비활성 노드는 숨김) */}
          {flatNodes.map(({ node, worldX, worldY, worldRotZ, worldScaleX, worldScaleY, depth, effectiveActive }) => {
            if (!effectiveActive) return null
            const isDragged = dragOverride?.uuid === node.uuid
            const isResized = resizeOverride?.uuid === node.uuid
            // R2472: 다중 선택 동시 드래그 오프셋
            const isMultiDragged = !isDragged && !!multiDragDelta && multiSelected.has(node.uuid)
            // dragOverride는 로컬 좌표 → 월드로 변환: worldX + (newLocal - oldLocal)
            const nodeLocalX = typeof node.position === 'object' ? (node.position as CCVec3).x : 0
            const nodeLocalY = typeof node.position === 'object' ? (node.position as CCVec3).y : 0
            const resizeDx = isResized && resizeOverride!.dx ? resizeOverride!.dx : 0
            const resizeDy = isResized && resizeOverride!.dy ? resizeOverride!.dy : 0
            const effX = (isDragged ? worldX + (dragOverride!.x - nodeLocalX) : isMultiDragged ? worldX + multiDragDelta!.dx : worldX) + resizeDx
            const effY = (isDragged ? worldY + (dragOverride!.y - nodeLocalY) : isMultiDragged ? worldY + multiDragDelta!.dy : worldY) + resizeDy
            const svgPos = ccToSvg(effX, effY)
            const w = isResized ? resizeOverride!.w : (node.size?.x || 0)
            const h = isResized ? resizeOverride!.h : (node.size?.y || 0)
            if (w === 0 && h === 0) return null  // 크기 없는 노드는 점으로 표시
            if (hideInactiveNodes && !effectiveActive) return null  // R1610
            if (hiddenUuids.has(node.uuid)) return null  // R1692: 시각적 숨기기

            // 뷰포트 컬링: 선택/호버/드래그 노드는 항상 렌더링
            if (!isSelected && node.uuid !== hoverUuid && !isDragged && !isMultiDragged) {
              const svgEl = svgRef.current
              const vpW = svgEl ? svgEl.clientWidth : 800
              const vpH = svgEl ? svgEl.clientHeight : 600
              const MARGIN = 100
              const anchorX_ = node.anchor?.x ?? 0.5
              const anchorY_ = node.anchor?.y ?? 0.5
              const screenL = (svgPos.x - w * anchorX_) * view.zoom + view.offsetX
              const screenT = (svgPos.y - h * (1 - anchorY_)) * view.zoom + view.offsetY
              const screenR = screenL + w * view.zoom
              const screenB = screenT + h * view.zoom
              if (screenR < -MARGIN || screenL > vpW + MARGIN || screenB < -MARGIN || screenT > vpH + MARGIN) {
                return null
              }
            }

            // 캔버스 범위 밖 노드 감지
            const isOutOfCanvas = effX + w / 2 < -designW / 2 || effX - w / 2 > designW / 2 || effY + h / 2 < -designH / 2 || effY - h / 2 > designH / 2
            const isSelected = node.uuid === selectedUuid || multiSelected.has(node.uuid)
            const isHovered = node.uuid === hoverUuid && !isSelected
            // R1550: 검색 매칭 하이라이트
            const isSearchMatch = svSearch.trim() ? svSearchMatches.has(node.uuid) : false
            // R1626: 검색 중 비매칭 노드 dim
            const searchDim = svSearch.trim() && !isSearchMatch && !isSelected ? 0.2 : 1
            // R1659: 솔로 모드 — 선택 노드 외 흐리게
            const soloDim = soloMode && !isSelected && !isHovered ? 0.12 : 1
            // R2526: 깊이 필터 — maxDepth 초과 노드 dim
            const depthDim = depthFilterMax !== null && depth > depthFilterMax && !isSelected ? 0.08 : 1
            // R2551: 컴포넌트 타입 필터 — 해당 타입 없는 노드 dim
            const compDim = compFilterType && !isSelected ? (node.components.some(c => c.type === compFilterType) ? 1 : 0.1) : 1
            // Check cc.UIOpacity component (CC3.x)
            const uiOpacityComp = node.components?.find(c => c.type === 'cc.UIOpacity')
            const uiOpacityVal = uiOpacityComp ? Number(uiOpacityComp.props?.opacity ?? uiOpacityComp.props?._opacity ?? 255) : undefined
            const nodeOpacity = ((uiOpacityVal !== undefined ? uiOpacityVal : (node.opacity ?? 255)) / 255) * (isOutOfCanvas ? 0.4 : 1) * searchDim * soloDim * depthDim * compDim

            const anchorX = node.anchor?.x ?? 0.5
            const anchorY = node.anchor?.y ?? 0.5
            const rectX = svgPos.x - w * anchorX
            const rectY = svgPos.y - h * (1 - anchorY)
            // CC rotation: Z-euler (반시계방향 양수). SVG: 시계방향 양수 → 부호 반전
            const localRotZ = node.rotation.z ?? 0
            // rotZ = 로컬 회전값 (회전 핸들/오버레이용)
            const rotZ = rotateOverride?.uuid === node.uuid ? rotateOverride.angle : localRotZ
            // visRotZ = 월드 누적 회전 (SVG 시각 변환용) — 인터랙티브 회전 시 로컬 델타 반영
            const visRotZ = rotateOverride?.uuid === node.uuid
              ? worldRotZ - localRotZ + rotateOverride.angle
              : worldRotZ
            const sx = (node.scale as { x?: number; y?: number } | null)?.x ?? 1
            const sy = (node.scale as { x?: number; y?: number } | null)?.y ?? 1
            // visSx/visSy = 월드 누적 스케일 (SVG 시각 변환용)
            const visSx = worldScaleX
            const visSy = worldScaleY
            const rotTransform = (visSx !== 1 || visSy !== 1 || visRotZ !== 0)
              ? (visSx !== 1 || visSy !== 1)
                ? `translate(${svgPos.x},${svgPos.y}) rotate(${-visRotZ}) scale(${visSx},${visSy}) translate(${-svgPos.x},${-svgPos.y})`
                : `translate(${svgPos.x},${svgPos.y}) rotate(${-visRotZ}) translate(${-svgPos.x},${-svgPos.y})`
              : undefined

            const hasLabel = node.components.some(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
            const hasSprite = node.components.some(c => c.type === 'cc.Sprite' || c.type === 'Sprite' || c.type === 'cc.Sprite2D')
            const hasBg = node.components.some(c => ['cc.Canvas', 'cc.Layout'].includes(c.type))
            const hasButton = node.components.some(c => c.type === 'cc.Button' || c.type === 'Button')
            const hasScroll = node.components.some(c => c.type === 'cc.ScrollView' || c.type === 'cc.ScrollBar')
            const hasEdit = node.components.some(c => c.type === 'cc.EditBox')
            const hasSlider = node.components.some(c => c.type === 'cc.Slider' || c.type === 'cc.Toggle' || c.type === 'cc.ToggleGroup')
            // R2546: 빈 컨테이너 노드 (렌더링 컴포넌트 없음) — 점선 스트로크
            const isContainer = !hasLabel && !hasSprite && !hasBg && !hasButton && !hasScroll && !hasEdit && !hasSlider && node.components.filter(c => c.type !== 'cc.Node' && c.type !== 'cc.UITransform' && c.type !== 'cc.UIOpacity' && c.type !== 'cc.Widget' && c.type !== 'cc.BlockInputEvents').length === 0

            // R1623: 와이어프레임 모드시 fill 투명
            // R1641: depth 색조 — hue 순환 (30° 간격)
            const depthHue = depthColorMode ? (depth * 47) % 360 : 0
            const fillColor = wireframeMode ? 'none'
              : depthColorMode ? `hsla(${depthHue},70%,60%,0.15)`
              : isSearchMatch ? 'rgba(255,68,255,0.12)'
              : isHovered ? 'rgba(255,255,255,0.06)'
              : hasButton ? 'rgba(255,140,60,0.1)'
              : hasScroll ? 'rgba(60,220,220,0.08)'
              : hasEdit ? 'rgba(220,100,180,0.1)'
              : hasSlider ? 'rgba(160,100,255,0.1)'
              : hasBg ? 'rgba(80,120,255,0.08)'
              : hasLabel ? 'rgba(255,200,80,0.12)'
              : hasSprite ? 'rgba(80,220,120,0.12)'
              : 'rgba(150,150,255,0.08)'
            const strokeColor = isSelected ? selectionColor
              : isDragged ? '#ff9944'
              : isSearchMatch ? '#ff44ff'
              : isHovered ? 'rgba(255,255,255,0.5)'
              : hasButton ? '#ff8c3c'
              : hasScroll ? '#3ccccc'
              : hasEdit ? '#cc64b4'
              : hasSlider ? '#a064ff'
              : hasBg ? '#4466aa'
              : hasLabel ? '#ccaa44'
              : hasSprite ? '#44aa66'
              : '#666688'

            return (
              <g key={node.uuid}
                transform={rotTransform}
                opacity={nodeOpacity}
                onClick={e => {
                  e.stopPropagation()
                  if (e.shiftKey) {
                    // R1632: Shift+클릭 → 같은 이름 노드 검색
                    setSvSearch(node.name)
                    onSelect(node.uuid)
                  } else if (e.ctrlKey || e.metaKey) {
                    // Ctrl+클릭: 멀티셀렉트 토글
                    setMultiSelected(s => {
                      const n = new Set(s)
                      n.has(node.uuid) ? n.delete(node.uuid) : n.add(node.uuid)
                      return n
                    })
                  } else {
                    setMultiSelected(new Set())
                    // R2740: 같은 위치 반복 클릭 → 겹친 노드 순차 선택
                    const svg = svgRef.current
                    if (svg) {
                      const rect = svg.getBoundingClientRect()
                      const v = viewRef.current
                      const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
                      const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
                      const cxH = effectiveWRef.current / 2, cyH = effectiveHRef.current / 2
                      const hits = flatNodesRef.current
                        .filter(fn => {
                          if (!fn.node.size || !fn.effectiveActive) return false
                          const w = fn.node.size.x, h = fn.node.size.y
                          const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
                          const spx = cxH + fn.worldX, spy = cyH - fn.worldY
                          return svgX >= spx - ax * w && svgX <= spx + (1 - ax) * w
                            && svgY >= spy - (1 - ay) * h && svgY <= spy + ay * h
                        })
                        .map(fn => fn.node.uuid)
                      const last = lastClickCycleRef.current
                      const TOLE = 6
                      const isSame = last && Math.abs(last.svgX - svgX) < TOLE && Math.abs(last.svgY - svgY) < TOLE
                        && last.uuidList.join(',') === hits.join(',') && hits.length > 1
                      if (isSame && last) {
                        const nextIdx = (last.idx + 1) % hits.length
                        lastClickCycleRef.current = { ...last, idx: nextIdx }
                        onSelect(hits[nextIdx])
                      } else {
                        const idx = hits.length > 0 ? hits.length - 1 : 0
                        lastClickCycleRef.current = { svgX, svgY, uuidList: hits, idx }
                        onSelect(node.uuid)
                      }
                    } else {
                      onSelect(node.uuid)
                    }
                  }
                }}
                onMouseEnter={e => { setHoverUuid(node.uuid); setHoverClientPos({ x: e.clientX, y: e.clientY }); hoverClientPosRef.current = { x: e.clientX, y: e.clientY } }}
                onMouseMove={e => { if (hoverUuid === node.uuid) { setHoverClientPos({ x: e.clientX, y: e.clientY }); hoverClientPosRef.current = { x: e.clientX, y: e.clientY } } }}
                onMouseLeave={() => { setHoverUuid(null); setHoverClientPos(null) }}
                onMouseDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  // R2566: Ctrl+Click → 다중 선택 토글 (add/remove from multiSelected)
                  if (e.ctrlKey || e.metaKey) {
                    onSelect(node.uuid)
                    setMultiSelected(prev => {
                      const next = new Set(prev)
                      if (next.has(node.uuid)) next.delete(node.uuid)
                      else next.add(node.uuid)
                      return next
                    })
                    return
                  }
                  if (viewLock || lockedUuids.has(node.uuid)) return  // R1605 / R1543: 잠금
                  // E 도구: 회전 모드
                  if (transformToolRef.current === 'rotate') {
                    e.stopPropagation()
                    const svg = svgRef.current
                    if (!svg) return
                    const svgRect = svg.getBoundingClientRect()
                    const v = viewRef.current
                    const svgMouseX = (e.clientX - svgRect.left - v.offsetX) / v.zoom
                    const svgMouseY = (e.clientY - svgRect.top - v.offsetY) / v.zoom
                    const sp = ccToSvgRef.current(worldX, worldY)
                    const rotZ = node.rotation.z ?? 0
                    const startAngle = Math.atan2(svgMouseY - sp.y, svgMouseX - sp.x) * 180 / Math.PI
                    rotateRef.current = { uuid: node.uuid, centerX: sp.x, centerY: sp.y, startAngle, startRotation: rotZ }
                    return
                  }
                  // R 도구: 스케일(리사이즈) 모드 — SE 방향 리사이즈 시작
                  if (transformToolRef.current === 'scale') {
                    e.stopPropagation()
                    const curW = node.size?.x ?? 100
                    const curH = node.size?.y ?? 100
                    const nodeLocalX = typeof node.position === 'object' ? (node.position as { x: number }).x : 0
                    const nodeLocalY = typeof node.position === 'object' ? (node.position as { y: number }).y : 0
                    resizeRef.current = { uuid: node.uuid, startMouseX: e.clientX, startMouseY: e.clientY, startW: curW, startH: curH, dir: 'SE', startLocalX: nodeLocalX, startLocalY: nodeLocalY }
                    return
                  }
                  const pos = node.position as CCVec3
                  // R2472: 다중 선택 노드 동시 드래그
                  const multiSel = multiSelectedRef.current
                  if (multiSel.has(node.uuid) && multiSel.size > 1) {
                    const nodesMap = new Map<string, { localX: number; localY: number }>()
                    for (const fn2 of flatNodesRef.current) {
                      if (multiSel.has(fn2.node.uuid)) {
                        const p2 = fn2.node.position as CCVec3
                        nodesMap.set(fn2.node.uuid, { localX: p2.x, localY: p2.y })
                      }
                    }
                    multiDragRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, nodes: nodesMap }
                    return
                  }
                  dragRef.current = {
                    uuid: node.uuid,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startNodeX: pos.x,
                    startNodeY: pos.y,
                    // R2705: altDrag — Alt 누른 채 드래그 시 복제
                    isAltDrag: e.altKey && !!onAltDrag,
                  }
                  // R1683: ghost 저장 (원래 world 위치)
                  setDragGhost({ uuid: node.uuid, worldX, worldY, w: node.size?.x ?? 0, h: node.size?.y ?? 0, anchorX: node.anchor?.x ?? 0.5, anchorY: node.anchor?.y ?? 0.5 })
                }}
                style={{ cursor: lockedUuids.has(node.uuid) ? 'not-allowed' : isDragged ? 'grabbing' : transformTool === 'rotate' ? 'crosshair' : transformTool === 'scale' ? 'nwse-resize' : 'grab' }}
              >
                <title>{node.name}{node.components.length > 0 ? '\n' + node.components.map(c => c.type.split('.').pop()).join(', ') : ''}</title>
                <rect
                  x={rectX} y={rectY} width={Math.max(0, w)} height={Math.max(0, h)}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={(isSelected ? 2 : 1) / view.zoom}
                  strokeDasharray={isContainer && !isSelected ? `${4 / view.zoom},${4 / view.zoom}` : undefined}
                  className={isSelected ? 'cc-selected-rect' : undefined}
                />
                {/* R2576: 노드 크기 W×H 오버레이 */}
                {showSizeLabels && view.zoom > 0.3 && (() => {
                  const sw = Math.round(node.size?.x ?? 0), sh = Math.round(node.size?.y ?? 0)
                  if (sw === 0 && sh === 0) return null
                  const fs = 9 / view.zoom
                  return (
                    <text
                      x={svgPos.x} y={rectY + h + fs * 1.2}
                      textAnchor="middle"
                      fontSize={fs} fill="rgba(52,211,153,0.85)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{sw}×{sh}</text>
                  )
                })()}
                {/* R2583: 회전값 ∠° 오버레이 */}
                {showRotLabels && view.zoom > 0.3 && (() => {
                  const rot = node.rotation
                  const deg = typeof rot === 'number' ? rot : (rot as { z?: number })?.z ?? 0
                  if (Math.abs(deg) < 0.5) return null
                  const fs = 9 / view.zoom
                  return (
                    <text
                      x={rectX + fs * 0.3} y={rectY + h - fs * 0.5}
                      textAnchor="start"
                      fontSize={fs} fill="rgba(236,72,153,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >∠{Math.round(deg)}°</text>
                  )
                })()}
                {/* R2585: 노드 이름 레이블 오버레이 */}
                {showNameLabels && view.zoom > 0.3 && (() => {
                  const fs = 9 / view.zoom
                  const maxChars = Math.max(4, Math.floor(w / (fs * 0.6)))
                  const label = node.name.length > maxChars ? node.name.slice(0, maxChars - 1) + '…' : node.name
                  return (
                    <text
                      x={svgPos.x} y={rectY + fs * 1.1}
                      textAnchor="middle"
                      fontSize={fs} fill="rgba(96,165,250,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{label}</text>
                  )
                })()}
                {/* R2586: 앵커 포인트 전체 오버레이 */}
                {showAnchorOverlay && view.zoom > 0.2 && (() => {
                  const ax = node.anchor?.x ?? 0.5
                  const ay = node.anchor?.y ?? 0.5
                  const apX = rectX + w * ax
                  const apY = rectY + h * (1 - ay)
                  const cs = 5 / view.zoom
                  const sw = Math.max(0.5, 1 / view.zoom)
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <line x1={apX - cs} y1={apY} x2={apX + cs} y2={apY} stroke="rgba(251,146,60,0.85)" strokeWidth={sw} />
                      <line x1={apX} y1={apY - cs} x2={apX} y2={apY + cs} stroke="rgba(251,146,60,0.85)" strokeWidth={sw} />
                      <circle cx={apX} cy={apY} r={cs * 0.4} fill="rgba(251,146,60,0.6)" />
                    </g>
                  )
                })()}
                {/* R2588: 노드 색상 스와치 오버레이 */}
                {showColorSwatch && view.zoom > 0.25 && (() => {
                  const c = node.color ?? { r: 255, g: 255, b: 255, a: 255 }
                  if (c.r === 255 && c.g === 255 && c.b === 255) return null
                  const ss = 8 / view.zoom
                  return (
                    <rect
                      x={rectX + w - ss - 1 / view.zoom} y={rectY + 1 / view.zoom}
                      width={ss} height={ss}
                      fill={`rgb(${c.r},${c.g},${c.b})`}
                      stroke="rgba(0,0,0,0.4)" strokeWidth={0.5 / view.zoom}
                      style={{ pointerEvents: 'none' }}
                      title={`색상: rgb(${c.r},${c.g},${c.b})`}
                    />
                  )
                })()}
                {/* R2591: 자식 수 배지 오버레이 */}
                {showChildCountBadge && view.zoom > 0.3 && node.children.length > 0 && (() => {
                  const cnt = node.children.length
                  const fs = 8 / view.zoom
                  const pad = fs * 0.4
                  const bw = (cnt >= 10 ? fs * 1.6 : fs * 1.2) + pad * 2
                  const bh = fs + pad * 2
                  const bx = rectX + 1 / view.zoom
                  const by = rectY + h - bh - 1 / view.zoom
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={bx} y={by} width={bw} height={bh} rx={bh * 0.3} fill="rgba(167,139,250,0.75)" />
                      <text x={bx + bw / 2} y={by + bh / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fill="#fff" fontFamily="monospace" style={{ userSelect: 'none' }}>{cnt}</text>
                    </g>
                  )
                })()}
                {/* R2592: 깊이 레이블 오버레이 (D:N) */}
                {showDepthLabel && view.zoom > 0.3 && (() => {
                  const fs = 8 / view.zoom
                  return (
                    <text
                      x={rectX + 1 / view.zoom} y={rectY + fs * 1.1}
                      textAnchor="start"
                      fontSize={fs} fill="rgba(134,239,172,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >D:{depth}</text>
                  )
                })()}
                {/* R2598: flip(음수 scale) 노드 표시 */}
                {showFlipOverlay && (() => {
                  const sc = node.scale as { x?: number; y?: number } | null
                  const fx = (sc?.x ?? 1) < 0, fy = (sc?.y ?? 1) < 0
                  if (!fx && !fy) return null
                  const label = fx && fy ? '↔↕' : fx ? '↔' : '↕'
                  const fs = 10 / view.zoom
                  return (
                    <text
                      x={rectX + w / 2} y={rectY + h / 2 + fs * 0.35}
                      textAnchor="middle"
                      fontSize={fs} fill="rgba(250,204,21,0.9)" fontFamily="monospace" fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{label}</text>
                  )
                })()}
                {/* R2610: rotation 방향 화살표 */}
                {showRotArrow && view.zoom > 0.3 && (() => {
                  const rotDeg = node.rotation.z ?? 0
                  if (Math.abs(rotDeg) < 1) return null
                  const mcx = rectX + w / 2, mcy = rectY + h / 2
                  const arrowLen = Math.max(6, Math.min(w, h) * 0.4)
                  const rad = rotDeg * Math.PI / 180  // CC: CCW positive, SVG Y축 반전이므로 그대로 사용
                  const ex = mcx + arrowLen * Math.sin(rad)
                  const ey = mcy - arrowLen * Math.cos(rad)
                  return (
                    <line x1={mcx} y1={mcy} x2={ex} y2={ey}
                      stroke="rgba(236,72,153,0.9)" strokeWidth={1.5 / view.zoom}
                      markerEnd="url(#rot-arrow)" style={{ pointerEvents: 'none' }} />
                  )
                })()}
                {/* R2615: W×H 크기 표시 */}
                {showSizeOverlay && w > 0 && h > 0 && view.zoom > 0.3 && (() => {
                  const fs = 7 / view.zoom
                  return (
                    <text
                      x={rectX + w / 2} y={rectY + h + fs * 1.2}
                      textAnchor="middle"
                      fontSize={fs} fill="rgba(34,211,238,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{Math.round(w)}×{Math.round(h)}</text>
                  )
                })()}
                {/* R2601: component 타입 배지 */}
                {showCompBadge && view.zoom > 0.3 && (() => {
                  const ccIgnore = new Set(['cc.Node','cc.UITransform','cc.UIOpacity','cc.Widget','cc.BlockInputEvents','cc.Canvas'])
                  const mainComp = node.components.find(c => !ccIgnore.has(c.type))
                  if (!mainComp) return null
                  const short = mainComp.type.includes('.') ? mainComp.type.split('.').pop()!.slice(0, 4) : mainComp.type.slice(0, 4)
                  const fs = 7 / view.zoom
                  return (
                    <text
                      x={rectX + w - 1/view.zoom} y={rectY + h - 1/view.zoom}
                      textAnchor="end" dominantBaseline="text-after-edge"
                      fontSize={fs} fill="rgba(192,132,252,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{short}</text>
                  )
                })()}
                {/* R2603: tag 배지 */}
                {showTagBadge && (node.tag ?? 0) !== 0 && view.zoom > 0.3 && (() => {
                  const fs = 7 / view.zoom
                  return (
                    <text
                      x={rectX + 1/view.zoom} y={rectY + h - 1/view.zoom}
                      textAnchor="start" dominantBaseline="text-after-edge"
                      fontSize={fs} fill="rgba(56,189,248,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >#{node.tag}</text>
                  )
                })()}
                {/* R2578: 노드 불투명도 α% 오버레이 */}
                {showOpacityLabels && view.zoom > 0.3 && (() => {
                  const pct = Math.round(((node.opacity ?? 255) / 255) * 100)
                  if (pct === 100) return null
                  const fs = 9 / view.zoom
                  return (
                    <text
                      x={rectX + w - fs * 0.3} y={rectY + fs * 1.2}
                      textAnchor="end"
                      fontSize={fs} fill="rgba(251,191,36,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{pct}%</text>
                  )
                })()}
                {/* R2620: 스케일 배수 텍스트 오버레이 */}
                {showScaleLabel && view.zoom > 0.3 && (() => {
                  const sc = node.scale as { x: number; y: number }
                  const sx = sc?.x ?? 1, sy = sc?.y ?? 1
                  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return null
                  const fmtN = (v: number) => (Math.abs(v - Math.round(v)) < 0.01 ? Math.round(v).toString() : v.toFixed(2))
                  const label = sx === sy ? `×${fmtN(sx)}` : `×${fmtN(sx)},${fmtN(sy)}`
                  const fs = 7 / view.zoom
                  return (
                    <text
                      x={rectX + 1/view.zoom} y={rectY + fs * 1.2}
                      textAnchor="start"
                      fontSize={fs} fill="rgba(250,204,21,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{label}</text>
                  )
                })()}
                {/* R2624: 레이어 배지 오버레이 */}
                {showLayerBadge && node.layer != null && view.zoom > 0.3 && (() => {
                  const LAYER_NAMES: Record<number, string> = {
                    1: 'DEF', 2: 'IGN', 16: 'UI3D', 524288: 'UI2D', 1048576: 'GFX',
                    1073741824: 'ALL',
                  }
                  const layerName = LAYER_NAMES[node.layer] ?? `L${node.layer}`
                  if (node.layer === 1048576) return null  // default CC3.x layer — skip
                  const fs = 7 / view.zoom
                  return (
                    <text
                      x={rectX + w / 2} y={rectY + fs * 1.2}
                      textAnchor="middle"
                      fontSize={fs} fill="rgba(99,102,241,0.9)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{layerName}</text>
                  )
                })()}
                {/* R2640: 선택 순서 번호 오버레이 */}
                {showSelOrder && (() => {
                  const selIdx = uuids.indexOf(node.uuid)
                  if (selIdx < 0) return null
                  const fs = 9 / view.zoom
                  const pad = 2 / view.zoom
                  return (
                    <text
                      x={rectX + pad} y={rectY + pad}
                      dominantBaseline="hanging"
                      fontSize={fs} fill="rgba(52,211,153,0.95)" fontFamily="monospace" fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{selIdx + 1}</text>
                  )
                })()}
                {/* R2641: 앵커 포인트 십자 마커 */}
                {showAnchorDot && w > 0 && h > 0 && (() => {
                  const ax = node.anchor?.x ?? 0.5
                  const ay = node.anchor?.y ?? 0.5
                  const apx = rectX + w * ax
                  const apy = rectY + h * (1 - ay)
                  const r = 4 / view.zoom
                  const sw = 1 / view.zoom
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <line x1={apx - r} y1={apy} x2={apx + r} y2={apy} stroke="#fb923c" strokeWidth={sw} />
                      <line x1={apx} y1={apy - r} x2={apx} y2={apy + r} stroke="#fb923c" strokeWidth={sw} />
                      <circle cx={apx} cy={apy} r={sw * 1.5} fill="#fb923c" />
                    </g>
                  )
                })()}
                {/* R2658: 노드 색상 tint 시각화 */}
                {showColorViz && w > 0 && h > 0 && (() => {
                  const c = node.color
                  if (!c || (c.r === 255 && c.g === 255 && c.b === 255)) return null
                  return (
                    <rect x={rectX} y={rectY} width={w} height={h}
                      fill={`rgba(${c.r},${c.g},${c.b},0.3)`}
                      style={{ pointerEvents: 'none' }} />
                  )
                })()}
                {/* R2665: 깊이 히트맵 오버레이 */}
                {showDepthHeat && w > 0 && h > 0 && (() => {
                  const t = maxDepthVal > 0 ? depth / maxDepthVal : 0
                  const r = Math.round(t * 220)
                  const g = Math.round((1 - t) * 200)
                  return (
                    <rect x={rectX} y={rectY} width={w} height={h}
                      fill={`rgba(${r},${g},40,0.28)`}
                      style={{ pointerEvents: 'none' }} />
                  )
                })()}
                {/* R2666: opacity 값 텍스트 오버레이 */}
                {showOpacityOverlay && w > 0 && h > 0 && view.zoom > 0.3 && (() => {
                  const op = node.opacity ?? 255
                  if (op >= 255) return null
                  return (
                    <text x={rectX + w / 2} y={rectY + h / 2 + 4 / view.zoom}
                      fontSize={9 / view.zoom} fill="#fbbf24" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>α{op}</text>
                  )
                })()}
                {/* R2668: 회전각 텍스트 오버레이 */}
                {showRotOverlay && w > 0 && h > 0 && view.zoom > 0.3 && (() => {
                  const rot = node.rotation.z ?? 0
                  if (rot === 0) return null
                  return (
                    <text x={rectX + w / 2} y={rectY + h - 2 / view.zoom}
                      fontSize={8 / view.zoom} fill="#a78bfa" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>{Math.round(rot)}°</text>
                  )
                })()}
                {/* R2670: 선택 노드 위치 텍스트 오버레이 */}
                {showPosText && (node.uuid === selectedUuid || multiSelected.has(node.uuid)) && view.zoom > 0.25 && (() => {
                  const pos = node.position as { x: number; y: number }
                  return (
                    <text x={rectX + (w > 0 ? w / 2 : 0)} y={rectY - 3 / view.zoom}
                      fontSize={8 / view.zoom} fill="#34d399" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>{Math.round(pos.x)},{Math.round(pos.y)}</text>
                  )
                })()}
                {/* R2717: 선택 노드 opacity HUD 배지 */}
                {showOpacityHud && isSelected && (() => {
                  return (
                    <text
                      x={rectX + (w > 0 ? w : 0)}
                      y={rectY - 4 / view.zoom}
                      fontSize={8 / view.zoom}
                      fill="#fbbf24"
                      textAnchor="end"
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >{`op:${node.opacity ?? 255}`}</text>
                  )
                })()}
                {/* R2672: scale 값 텍스트 오버레이 */}
                {showScaleText && w > 0 && h > 0 && view.zoom > 0.3 && (() => {
                  const sc = node.scale as { x: number; y: number }
                  if (Math.abs((sc?.x ?? 1) - 1) < 0.001 && Math.abs((sc?.y ?? 1) - 1) < 0.001) return null
                  const sx = Math.round((sc?.x ?? 1) * 100) / 100
                  const sy = Math.round((sc?.y ?? 1) * 100) / 100
                  return (
                    <text x={rectX + w - 2 / view.zoom} y={rectY + 10 / view.zoom}
                      fontSize={8 / view.zoom} fill="#22d3ee" textAnchor="end"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>{sx}×{sy}</text>
                  )
                })()}
                {/* R2673: 컴포넌트 수 배지 */}
                {showCompCountBadge && view.zoom > 0.25 && (() => {
                  const ignore = new Set(['cc.Node', 'cc.UITransform', 'cc.UIOpacity'])
                  const cnt = node.components.filter(c => !ignore.has(c.type)).length
                  if (cnt === 0) return null
                  const bx = rectX + 2 / view.zoom
                  const by = rectY + 2 / view.zoom
                  const bw = 12 / view.zoom
                  const bh = 10 / view.zoom
                  return (
                    <g pointerEvents="none">
                      <rect x={bx} y={by} width={bw} height={bh} fill="rgba(129,140,248,0.85)" rx={2 / view.zoom} />
                      <text x={bx + bw / 2} y={by + bh - 2 / view.zoom} fontSize={7 / view.zoom} fill="#fff" textAnchor="middle" style={{ userSelect: 'none' }}>{cnt}</text>
                    </g>
                  )
                })()}
                {/* R2686: Sprite spriteFrame 이름 배지 */}
                {showSpriteName && w > 0 && h > 0 && view.zoom > 0.25 && (() => {
                  const spr = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'Sprite')
                  if (!spr?.props) return null
                  const frame = spr.props['_spriteFrame'] as { __uuid__?: string } | string | null | undefined
                  let name = ''
                  if (typeof frame === 'string') name = frame.split('/').pop()?.replace(/\.\w+$/, '') ?? ''
                  else if (frame && typeof frame === 'object' && frame.__uuid__) name = frame.__uuid__.slice(0, 8)
                  if (!name) return null
                  return (
                    <text x={rectX + w / 2} y={rectY + h + 10 / view.zoom}
                      fontSize={7 / view.zoom} fill="#fb923c" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>{name}</text>
                  )
                })()}
                {/* R2688: UUID 앞 8자리 배지 */}
                {showUuidBadge && view.zoom > 0.3 && (() => {
                  const short = node.uuid.slice(0, 8)
                  const bx = rectX + (w > 0 ? w / 2 : 0)
                  const by = rectY - 3 / view.zoom
                  return (
                    <text x={bx} y={by}
                      fontSize={6 / view.zoom} fill="rgba(100,116,139,0.8)" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>{short}</text>
                  )
                })()}
                {/* R2691: 노드 중심 점 마커 */}
                {showCenterDot && (
                  <circle cx={svgPos.x} cy={svgPos.y} r={2.5 / view.zoom}
                    fill="rgba(248,113,113,0.8)" stroke="rgba(255,255,255,0.6)" strokeWidth={0.8 / view.zoom}
                    style={{ pointerEvents: 'none' }} />
                )}
                {/* R2694: 비기본 앵커 강조 */}
                {showNonDefaultAnchor && w > 0 && h > 0 && (() => {
                  const ax = node.anchor?.x ?? 0.5, ay = node.anchor?.y ?? 0.5
                  if (Math.abs(ax - 0.5) < 0.001 && Math.abs(ay - 0.5) < 0.001) return null
                  const fs = 8 / view.zoom
                  const label = `(${ax.toFixed(1)},${ay.toFixed(1)})`
                  return (
                    <text x={rectX + w * ax} y={rectY + h * (1 - ay)}
                      fontSize={fs} fill="rgba(251,191,36,0.9)" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>⚓{label}</text>
                  )
                })()}
                {/* R2675: 노드 크기 히트맵 */}
                {showSizeHeat && w > 0 && h > 0 && (() => {
                  const area = w * h
                  const t = maxNodeArea > 0 ? Math.min(area / maxNodeArea, 1) : 0
                  const r = Math.round(t * 250)
                  const g2 = Math.round(t * 200 + (1 - t) * 80)
                  const b = Math.round((1 - t) * 250)
                  return (
                    <rect x={rectX} y={rectY} width={w} height={h}
                      fill={`rgba(${r},${g2},${b},0.25)`}
                      style={{ pointerEvents: 'none' }} />
                  )
                })()}
                {/* R2652: 비활성 노드 반투명 오버레이 */}
                {showInactiveDim && node.active === false && w > 0 && h > 0 && (
                  <rect x={rectX} y={rectY} width={w} height={h}
                    fill="rgba(0,0,0,0.45)"
                    style={{ pointerEvents: 'none' }} />
                )}
                {/* R2651: 선택 노드 부모 하이라이트 */}
                {showParentHighlight && parentUuidSet.has(node.uuid) && w > 0 && h > 0 && (
                  <rect x={rectX} y={rectY} width={w} height={h}
                    fill="none" stroke="rgba(251,146,60,0.8)" strokeWidth={2 / view.zoom}
                    style={{ pointerEvents: 'none' }} />
                )}
                {/* R2636: 캔버스 경계 초과 노드 강조 */}
                {showOOBHighlight && isOutOfCanvas && (
                  <rect x={rectX} y={rectY} width={w} height={h}
                    fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.8)"
                    strokeWidth={2 / view.zoom}
                    strokeDasharray={`${4/view.zoom} ${2/view.zoom}`}
                    style={{ pointerEvents: 'none' }} />
                )}
                {/* R2625: 이벤트 핸들러 배지 오버레이 */}
                {showEventBadge && view.zoom > 0.3 && (() => {
                  const interactiveTypes = new Set(['cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.EditBox', 'cc.PageView'])
                  const hasInteractive = node.components.some(c => interactiveTypes.has(c.type)) || (node.eventHandlers && node.eventHandlers.length > 0)
                  if (!hasInteractive) return null
                  const fs = 8 / view.zoom
                  return (
                    <text
                      x={rectX + w - 1/view.zoom} y={rectY + 1/view.zoom}
                      textAnchor="end" dominantBaseline="hanging"
                      fontSize={fs} fill="rgba(234,179,8,0.95)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >⚡</text>
                  )
                })()}
                {/* R2557: Label 텍스트 콘텐츠 오버레이 */}
                {showLabelText && hasLabel && (() => {
                  const labelComp = node.components.find(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
                  const txt = (labelComp?.props?.string as string | undefined) ?? ''
                  if (!txt) return null
                  const fs = Math.max(6, Math.min(16, (labelComp?.props?.fontSize as number | undefined ?? 20) * view.zoom * 0.6))
                  const isSystemFont = (labelComp?.props?.isSystemFontUsed as boolean | undefined) ?? true
                  const sysFontFamily = labelComp?.props?.fontFamily as string | undefined
                  const fontUuid = (labelComp?.props?.font as { __uuid__?: string } | undefined)?.__uuid__
                               ?? (labelComp?.props?._font as { __uuid__?: string } | undefined)?.__uuid__
                               ?? (labelComp?.props?._N$file as { __uuid__?: string } | undefined)?.__uuid__
                               ?? (labelComp?.props?.file as { __uuid__?: string } | undefined)?.__uuid__
                               ?? (labelComp?.props?._file as { __uuid__?: string } | undefined)?.__uuid__
                  const cachedFont = fontUuid ? fontCacheRef.current.get(fontUuid) : undefined
                  const isBMFontFallback = !!(cachedFont?.fallback)
                  const fontFamilyName = (isBMFontFallback ? '' : (!isSystemFont && cachedFont?.familyName))
                    || (isSystemFont && sysFontFamily)
                    || sysFontFamily
                    || 'sans-serif'
                  return (
                    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      <text
                        x={svgPos.x} y={svgPos.y + fs / 3}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={fs} fill="rgba(255,220,80,0.9)" fontFamily={fontFamilyName}
                      >{txt.length > 12 ? txt.slice(0, 11) + '…' : txt}</text>
                      {isBMFontFallback && (
                        <text
                          x={rectX + 2 / view.zoom} y={rectY + 8 / view.zoom}
                          fontSize={7 / view.zoom} fill="rgba(255,160,60,0.7)"
                        >BMFont</text>
                      )}
                    </g>
                  )
                })()}
                {/* R1666: pulse 미리보기 링 */}
                {node.uuid === pulseUuid && (
                  <rect
                    key={`pulse-${pulseUuid}`}
                    x={rectX - 4 / view.zoom} y={rectY - 4 / view.zoom}
                    width={Math.max(0, w) + 8 / view.zoom} height={Math.max(0, h) + 8 / view.zoom}
                    fill="none" stroke="#fbbf24" strokeWidth={3 / view.zoom} rx={3 / view.zoom}
                    className="cc-pulse-ring"
                    style={{ transformOrigin: `${svgPos.x}px ${svgPos.y}px` }}
                  />
                )}
                {/* 앵커 포인트 */}
                <circle
                  cx={svgPos.x} cy={svgPos.y}
                  r={3 / view.zoom}
                  fill={isSelected ? '#58a6ff' : '#888'}
                />
                {/* R1510: Widget alignFlags 제약 시각화 */}
                {showCompBadges && (() => {
                  const widgetComp = node.components.find(c => c.type === 'cc.Widget')
                  if (!widgetComp) return null
                  const alignFlags = (widgetComp.props.alignFlags ?? widgetComp.props._alignFlags ?? 0) as number
                  const flags = alignFlags
                  if (!flags) return null
                  const color = '#7c3aed'
                  const sz = 4 / view.zoom
                  const indicators: React.ReactNode[] = []
                  if (flags & 1) indicators.push(<line key="L" x1={rectX} y1={rectY + h/2} x2={rectX - sz*2} y2={rectY + h/2} stroke={color} strokeWidth={1.5/view.zoom} style={{ pointerEvents: 'none' }} />)
                  if (flags & 2) indicators.push(<line key="R" x1={rectX + w} y1={rectY + h/2} x2={rectX + w + sz*2} y2={rectY + h/2} stroke={color} strokeWidth={1.5/view.zoom} style={{ pointerEvents: 'none' }} />)
                  if (flags & 4) indicators.push(<line key="T" x1={rectX + w/2} y1={rectY} x2={rectX + w/2} y2={rectY - sz*2} stroke={color} strokeWidth={1.5/view.zoom} style={{ pointerEvents: 'none' }} />)
                  if (flags & 8) indicators.push(<line key="B" x1={rectX + w/2} y1={rectY + h} x2={rectX + w/2} y2={rectY + h + sz*2} stroke={color} strokeWidth={1.5/view.zoom} style={{ pointerEvents: 'none' }} />)
                  // Widget offset value labels
                  const OFFSET_KEYS: Record<string, string[]> = {
                    L: ['left', '_left', '_N$left'],
                    R: ['right', '_right', '_N$right'],
                    T: ['top', '_top', '_N$top'],
                    B: ['bottom', '_bottom', '_N$bottom'],
                  }
                  const getOffset = (keys: string[]) => {
                    for (const k of keys) {
                      const v = widgetComp.props[k]
                      if (v !== undefined && v !== null) return Number(v)
                    }
                    return null
                  }
                  if (flags & 1) {
                    const val = getOffset(OFFSET_KEYS.L)
                    if (val !== null && view.zoom > 0.4) {
                      indicators.push(
                        <text key="Lv" x={rectX - sz * 2 - 2/view.zoom} y={rectY + h/2}
                          fontSize={7/view.zoom} fill={color} textAnchor="end" dominantBaseline="middle"
                          style={{ pointerEvents: 'none', userSelect: 'none' }} fontFamily="monospace"
                        >{Math.round(val)}</text>
                      )
                    }
                  }
                  if (flags & 2) {
                    const val = getOffset(OFFSET_KEYS.R)
                    if (val !== null && view.zoom > 0.4) {
                      indicators.push(
                        <text key="Rv" x={rectX + w + sz * 2 + 2/view.zoom} y={rectY + h/2}
                          fontSize={7/view.zoom} fill={color} textAnchor="start" dominantBaseline="middle"
                          style={{ pointerEvents: 'none', userSelect: 'none' }} fontFamily="monospace"
                        >{Math.round(val)}</text>
                      )
                    }
                  }
                  if (flags & 4) {
                    const val = getOffset(OFFSET_KEYS.T)
                    if (val !== null && view.zoom > 0.4) {
                      indicators.push(
                        <text key="Tv" x={rectX + w/2} y={rectY - sz * 2 - 2/view.zoom}
                          fontSize={7/view.zoom} fill={color} textAnchor="middle" dominantBaseline="auto"
                          style={{ pointerEvents: 'none', userSelect: 'none' }} fontFamily="monospace"
                        >{Math.round(val)}</text>
                      )
                    }
                  }
                  if (flags & 8) {
                    const val = getOffset(OFFSET_KEYS.B)
                    if (val !== null && view.zoom > 0.4) {
                      indicators.push(
                        <text key="Bv" x={rectX + w/2} y={rectY + h + sz * 2 + 8/view.zoom}
                          fontSize={7/view.zoom} fill={color} textAnchor="middle" dominantBaseline="hanging"
                          style={{ pointerEvents: 'none', userSelect: 'none' }} fontFamily="monospace"
                        >{Math.round(val)}</text>
                      )
                    }
                  }
                  if (flags & 16) indicators.push(<line key="HC" x1={rectX + w/2} y1={rectY + h/2} x2={rectX + w/2 - sz*2} y2={rectY + h/2} stroke={color} strokeWidth={1/view.zoom} strokeDasharray={`${2/view.zoom},${2/view.zoom}`} style={{ pointerEvents: 'none' }} />)
                  if (flags & 32) indicators.push(<line key="VC" x1={rectX + w/2} y1={rectY + h/2} x2={rectX + w/2} y2={rectY + h/2 - sz*2} stroke={color} strokeWidth={1/view.zoom} strokeDasharray={`${2/view.zoom},${2/view.zoom}`} style={{ pointerEvents: 'none' }} />)
                  // Stretch: L+R active = width stretch, T+B active = height stretch
                  const isStretchW = (flags & 3) === 3
                  const isStretchH = (flags & 12) === 12
                  if (isStretchW) {
                    indicators.push(
                      <line key="SW"
                        x1={rectX - sz*2} y1={rectY + h/2}
                        x2={rectX + w + sz*2} y2={rectY + h/2}
                        stroke={color} strokeWidth={1/view.zoom}
                        strokeDasharray={`${3/view.zoom},${2/view.zoom}`}
                        style={{ pointerEvents: 'none' }}
                      />
                    )
                  }
                  if (isStretchH) {
                    indicators.push(
                      <line key="SH"
                        x1={rectX + w/2} y1={rectY - sz*2}
                        x2={rectX + w/2} y2={rectY + h + sz*2}
                        stroke={color} strokeWidth={1/view.zoom}
                        strokeDasharray={`${3/view.zoom},${2/view.zoom}`}
                        style={{ pointerEvents: 'none' }}
                      />
                    )
                  }
                  if (indicators.length === 0) return null
                  return <>{indicators}</>
                })()}
                {/* R2579: 컴포넌트 배지 오버레이 */}
                {showCompBadges && view.zoom > 0.25 && node.components.length > 0 && (() => {
                  const BADGE_ICONS: Record<string, string> = {
                    'cc.Label': 'T', 'cc.Sprite': '🖼', 'cc.Button': '⬜', 'cc.Toggle': '☑',
                    'cc.Slider': '⊟', 'cc.ScrollView': '⊠', 'cc.RichText': '✍', 'cc.AudioSource': '♪',
                    'cc.Widget': '⚓', 'cc.Layout': '▤', 'cc.Animation': '▶', 'cc.ProgressBar': '▰',
                    'cc.VideoPlayer': '▷', 'cc.Camera': '📷', 'sp.Skeleton': '🦴', 'dragonBones.ArmatureDisplay': '🐉',
                  }
                  const ignore = new Set(['cc.UITransform','cc.UIOpacity','cc.BlockInputEvents'])
                  const shown = node.components.filter(c => !ignore.has(c.type)).slice(0, 3)
                  if (shown.length === 0) return null
                  const fs = 10 / view.zoom
                  const badges = shown.map(c => BADGE_ICONS[c.type] ?? c.type.split('.').pop()?.slice(0, 3) ?? '?').join(' ')
                  return (
                    <text
                      x={rectX + w / 2} y={rectY - fs * 0.5}
                      textAnchor="middle"
                      fontSize={fs} fill="rgba(250,204,21,0.8)" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{badges}</text>
                  )
                })()}
                {/* 노드 이름 레이블 */}
                {showNodeNames && view.zoom > 0.3 && editingUuid !== node.uuid && (
                  <text
                    x={rectX + 3 / view.zoom}
                    y={rectY + labelFontSize / view.zoom}
                    fontSize={labelFontSize / view.zoom}
                    fill={isSelected ? '#58a6ff' : '#ccc'}
                    style={{ pointerEvents: isSelected ? 'auto' : 'none', userSelect: 'none', cursor: 'text' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingUuid(node.uuid); setTimeout(() => editInputRef.current?.focus(), 30) }}
                  >
                    {node.name}
                    {/* R1555: CC3.x layer 번호 표시 (기본 레이어=1048576 제외) */}
                    {node.layer != null && node.layer !== 1048576 && (
                      <tspan fontSize={8 / view.zoom} fill="rgba(251,191,36,0.7)" dx={3 / view.zoom}>[L{node.layer}]</tspan>
                    )}
                    {/* R1578: 색상 tint 표시 (흰색/기본이 아닐 때) */}
                    {(() => {
                      const c = node.color as { r?: number; g?: number; b?: number } | undefined
                      if (!c) return null
                      const { r = 255, g = 255, b = 255 } = c
                      if (r === 255 && g === 255 && b === 255) return null
                      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                      return <tspan fontSize={8 / view.zoom} fill={hex} dx={3 / view.zoom}>■</tspan>
                    })()}
                    {/* R1615: cc.Label 텍스트 미리보기 */}
                    {(() => {
                      const lbl = node.components?.find(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
                      const str = lbl?.props?.string as string | undefined
                      if (!str) return null
                      const preview = str.length > 18 ? str.slice(0, 16) + '…' : str
                      return <tspan x={rectX + 3 / view.zoom} dy={12 / view.zoom} fontSize={9 / view.zoom} fill="rgba(126,231,135,0.75)">{preview}</tspan>
                    })()}
                  </text>
                )}
                {/* R1687: z-order 배지 */}
                {showZOrder && view.zoom > 0.25 && (() => {
                  const fn2 = flatNodes.find(f => f.node.uuid === node.uuid)
                  if (!fn2) return null
                  return (
                    <g pointerEvents="none">
                      <rect x={rectX + w - 16 / view.zoom} y={rectY + 2 / view.zoom} width={14 / view.zoom} height={10 / view.zoom} fill="rgba(0,0,0,0.55)" rx={2 / view.zoom} />
                      <text x={rectX + w - 9 / view.zoom} y={rectY + 10 / view.zoom} fontSize={8 / view.zoom} fill="#fbbf24" textAnchor="middle" style={{ userSelect: 'none' }}>{fn2.siblingIdx}</text>
                    </g>
                  )
                })()}
                {/* 인라인 이름 편집 (더블클릭 시) */}
                {editingUuid === node.uuid && (
                  <foreignObject
                    x={rectX} y={rectY}
                    width={Math.max(w, 80 / view.zoom)} height={18 / view.zoom}
                    style={{ overflow: 'visible' }}
                  >
                    <input
                      ref={editInputRef}
                      defaultValue={node.name}
                      onBlur={e => { onRename?.(node.uuid, e.target.value); setEditingUuid(null) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRename?.(node.uuid, e.currentTarget.value); setEditingUuid(null) }
                        if (e.key === 'Escape') setEditingUuid(null)
                        e.stopPropagation()
                      }}
                      style={{
                        width: '100%', fontSize: 11 / view.zoom, padding: '1px 3px',
                        background: '#1a1a2e', border: '1px solid #58a6ff', color: '#58a6ff',
                        borderRadius: 2, outline: 'none',
                        transform: `scale(${1 / view.zoom})`, transformOrigin: 'top left',
                      }}
                    />
                  </foreignObject>
                )}
                {/* Sprite 이미지 렌더링 */}
                {hasSprite && (() => {
                  const sc = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'Sprite' || c.type === 'cc.Sprite2D')
                  const sfUuid = (sc?.props?.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__
                  const spriteEntry = sfUuid ? spriteCacheRef.current.get(sfUuid) : undefined
                  const imgUrl = spriteEntry?.dataUrl
                  if (!imgUrl) return null
                  const texW = spriteEntry?.w || 0
                  const texH = spriteEntry?.h || 0
                  const iw = Math.abs(w) || 1
                  const ih = Math.abs(h) || 1
                  const { r: tr = 255, g: tg = 255, b: tb = 255 } = (node.color as { r?: number; g?: number; b?: number } | null) ?? {}
                  const hasTint = tr !== 255 || tg !== 255 || tb !== 255
                  const isGrayscale = !!(sc?.props?.grayscale ?? sc?.props?._grayscale ?? sc?.props?.['_N$grayscale'] ?? false)
                  // Sprite type badge (only for non-simple types)
                  const spriteType = Number(sc?.props?.type ?? sc?.props?._type ?? sc?.props?.['_N$type'] ?? 0)
                  // 0=Simple, 1=Sliced, 2=Tiled, 3=Filled
                  const SPRITE_TYPE_LABELS: Record<number, string> = { 1: '9', 2: '⊞', 3: '◔' }
                  const spriteTypeLabel = SPRITE_TYPE_LABELS[spriteType]
                  // 0=Custom, 1=Trimmed, 2=Raw
                  const sizeMode = Number(sc?.props?.sizeMode ?? sc?.props?._sizeMode ?? sc?.props?.['_N$sizeMode'] ?? 1)
                  // Sliced (type=1) 9-slice 렌더링
                  if (spriteType === 1 && texW > 0 && texH > 0) {
                    const capL = spriteEntry?.bL ?? 0
                    const capT = spriteEntry?.bT ?? 0
                    const capR = spriteEntry?.bR ?? 0
                    const capB = spriteEntry?.bB ?? 0
                    // atlas frame이 있으면 frame 내부 좌표 기준으로 9-slice
                    const sliceFrame = spriteEntry?.frame
                    // rotated atlas frame + 9-slice는 복잡하므로 frame 무시 (드문 케이스)
                    const fOx = (sliceFrame && !sliceFrame.rotated) ? sliceFrame.x : 0
                    const fOy = (sliceFrame && !sliceFrame.rotated) ? sliceFrame.y : 0
                    const fW = (sliceFrame && !sliceFrame.rotated) ? sliceFrame.w : texW
                    const fH = (sliceFrame && !sliceFrame.rotated) ? sliceFrame.h : texH

                    const srcCW = Math.max(1, fW - capL - capR)
                    const srcCH = Math.max(1, fH - capT - capB)
                    const dstCW = Math.max(0, iw - capL - capR)
                    const dstCH = Math.max(0, ih - capT - capB)
                    const filterStyle = isGrayscale ? 'grayscale(1)' : undefined

                    // 9개 조각: [srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH]
                    const pieces: [number,number,number,number, number,number,number,number][] = [
                      [fOx, fOy, capL, capT,  0, 0, capL, capT],
                      [fOx+capL, fOy, srcCW, capT,  capL, 0, dstCW, capT],
                      [fOx+fW-capR, fOy, capR, capT,  iw-capR, 0, capR, capT],
                      [fOx, fOy+capT, capL, srcCH,  0, capT, capL, dstCH],
                      [fOx+capL, fOy+capT, srcCW, srcCH,  capL, capT, dstCW, dstCH],
                      [fOx+fW-capR, fOy+capT, capR, srcCH,  iw-capR, capT, capR, dstCH],
                      [fOx, fOy+fH-capB, capL, capB,  0, ih-capB, capL, capB],
                      [fOx+capL, fOy+fH-capB, srcCW, capB,  capL, ih-capB, dstCW, capB],
                      [fOx+fW-capR, fOy+fH-capB, capR, capB,  iw-capR, ih-capB, capR, capB],
                    ]

                    return (
                      <>
                        {pieces.map(([sx, sy, sw, sh, dx, dy, dw, dh], pi) => {
                          if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return null
                          return (
                            <svg key={pi}
                              x={rectX + dx} y={rectY + dy}
                              width={dw} height={dh}
                              viewBox={`${sx} ${sy} ${sw} ${sh}`}
                              preserveAspectRatio="none" overflow="hidden"
                              style={{ pointerEvents: 'none' }}
                            >
                              <image href={imgUrl} x={0} y={0} width={texW} height={texH}
                                preserveAspectRatio="none"
                                style={{ filter: filterStyle }}
                              />
                            </svg>
                          )
                        })}
                        {hasTint && (
                          <rect x={rectX} y={rectY} width={iw} height={ih}
                            fill={`rgb(${tr},${tg},${tb})`} opacity={0.45}
                            style={{ pointerEvents: 'none', mixBlendMode: 'multiply' as const }} />
                        )}
                      </>
                    )
                  }
                  // atlas frame 정보
                  const atlasFrame = spriteEntry?.frame
                  return (
                    <>
                      {atlasFrame ? (
                        <>
                          {/* atlas 프레임 크롭: SVG viewBox로 해당 영역만 표시 */}
                          {atlasFrame.rotated ? (
                            /* rotated=true: atlas에서 90도 CW 회전 저장 → 실제 차지 영역은 (x, y, h, w) */
                            <svg
                              x={rectX} y={rectY} width={iw} height={ih}
                              viewBox={`0 0 ${atlasFrame.w} ${atlasFrame.h}`}
                              preserveAspectRatio="none" overflow="hidden"
                              style={{ pointerEvents: 'none' }}
                            >
                              <g transform={`translate(${atlasFrame.w}, 0) rotate(90)`}>
                                <image href={imgUrl}
                                  x={-atlasFrame.x} y={-atlasFrame.y}
                                  width={texW} height={texH}
                                  preserveAspectRatio="none"
                                  style={{ filter: isGrayscale ? 'grayscale(1)' : undefined }}
                                />
                              </g>
                            </svg>
                          ) : (
                            <svg
                              x={rectX} y={rectY} width={iw} height={ih}
                              viewBox={`${atlasFrame.x} ${atlasFrame.y} ${atlasFrame.w} ${atlasFrame.h}`}
                              preserveAspectRatio="none" overflow="hidden"
                              style={{ pointerEvents: 'none' }}
                            >
                              <image href={imgUrl} x={0} y={0} width={texW} height={texH}
                                preserveAspectRatio="none"
                                style={{ filter: isGrayscale ? 'grayscale(1)' : undefined }}
                              />
                            </svg>
                          )}
                          {hasTint && (
                            <rect x={rectX} y={rectY} width={iw} height={ih}
                              fill={`rgb(${tr},${tg},${tb})`} opacity={0.45}
                              style={{ pointerEvents: 'none', mixBlendMode: 'multiply' as const }} />
                          )}
                        </>
                      ) : hasTint ? (
                        <>
                          <image
                            href={imgUrl}
                            x={rectX} y={rectY}
                            width={iw} height={ih}
                            preserveAspectRatio="none"
                            style={{ pointerEvents: 'none', filter: isGrayscale ? 'grayscale(1)' : undefined }}
                          />
                          <rect
                            x={rectX} y={rectY} width={iw} height={ih}
                            fill={`rgb(${tr},${tg},${tb})`}
                            opacity={0.45}
                            style={{ pointerEvents: 'none', mixBlendMode: 'multiply' as const }}
                          />
                        </>
                      ) : (
                        <image
                          href={imgUrl}
                          x={rectX} y={rectY}
                          width={iw} height={ih}
                          preserveAspectRatio="none"
                          style={{ pointerEvents: 'none', filter: isGrayscale ? 'grayscale(1)' : undefined }}
                        />
                      )}
                      {spriteTypeLabel && view.zoom > 0.3 && (
                        <text
                          x={rectX + 2 / view.zoom}
                          y={rectY + 10 / view.zoom}
                          fontSize={9 / view.zoom}
                          fill="rgba(250,204,21,0.85)"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                          fontFamily="monospace"
                        >{spriteTypeLabel}</text>
                      )}
                      {sizeMode === 0 && view.zoom > 0.3 && (
                        <text x={rectX + w - 8/view.zoom} y={rectY + 10/view.zoom}
                          fontSize={7/view.zoom} fill="rgba(148,163,184,0.7)"
                          textAnchor="end" style={{ pointerEvents: 'none', userSelect: 'none' }}
                          fontFamily="monospace">C</text>
                      )}
                      {spriteType === 3 && (() => {
                        const fillRange = Number(sc?.props?.fillRange ?? sc?.props?._fillRange ?? 1)
                        const cx2 = rectX + iw / 2, cy2 = rectY + ih / 2
                        const r2 = Math.min(iw, ih) / 2 * 0.8
                        const angle = fillRange * 2 * Math.PI
                        const x2end = cx2 + r2 * Math.sin(angle)
                        const y2end = cy2 - r2 * Math.cos(angle)
                        const largeArc = fillRange > 0.5 ? 1 : 0
                        return (
                          <path
                            d={`M ${cx2} ${cy2 - r2} A ${r2} ${r2} 0 ${largeArc} 1 ${x2end} ${y2end}`}
                            fill="none" stroke="rgba(250,204,21,0.6)" strokeWidth={1.5 / view.zoom}
                            style={{ pointerEvents: 'none' }}
                          />
                        )
                      })()}
                    </>
                  )
                })()}
                {/* Label 텍스트 렌더링 + R1491 더블클릭 인라인 편집 */}
                {hasLabel && (() => {
                  const lc = node.components.find(c => c.type === 'cc.Label' || c.type === 'Label' || c.type === 'cc.RichText')
                  // enabled=false 시 라벨 숨기기
                  if (!(lc?.props?.enabled ?? lc?.props?._enabled ?? true)) return null
                  const str = (lc?.props?.string as string | undefined) ?? (lc?.props?._string as string | undefined) ?? ''
                  if (!str && editingLabelUuid !== node.uuid) return null
                  const rawFs = Math.min(Math.max((lc?.props?.fontSize as number | undefined) ?? 20, 8), 200)
                  // Overflow: 0=None, 1=Clamp, 2=Shrink — SHRINK 모드는 fontSize 축소로 텍스트가 바운딩박스 안에 맞게 함
                  const _overflowModeEarly = Number(lc?.props?.overflow ?? lc?.props?._overflow ?? lc?.props?.['_N$overflow'] ?? 0)
                  let fs = rawFs
                  if (_overflowModeEarly === 2 && w > 0) {
                    const isKorean = /[\uAC00-\uD7A3]/.test(str)
                    const charWidthRatio = isKorean ? 0.9 : 0.6
                    const estimatedW = str.length * rawFs * charWidthRatio
                    if (estimatedW > w) {
                      fs = Math.max(rawFs * (w / estimatedW), 6)
                    }
                  }
                  // Label 텍스트 색상: comp.props.color 우선, 없으면 노드 tint
                  const labelTextColorProp = lc?.props?.color as { r?: number; g?: number; b?: number } | undefined
                  const { r: cr = 255, g: cg = 255, b: cb = 255 } = labelTextColorProp ?? node.color ?? {}
                  if (editingLabelUuid === node.uuid) {
                    return (
                      <foreignObject
                        x={rectX} y={rectY + h / 2 - 10 / view.zoom}
                        width={Math.max(w, 80 / view.zoom)} height={20 / view.zoom}
                        style={{ overflow: 'visible' }}
                      >
                        <input
                          ref={editLabelRef}
                          defaultValue={str}
                          onBlur={e => { onLabelEdit?.(node.uuid, e.target.value); setEditingLabelUuid(null) }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { onLabelEdit?.(node.uuid, e.currentTarget.value); setEditingLabelUuid(null) }
                            if (e.key === 'Escape') setEditingLabelUuid(null)
                            e.stopPropagation()
                          }}
                          style={{
                            width: '100%', fontSize: fs / view.zoom, padding: '1px 4px',
                            background: 'rgba(10,10,20,0.9)', border: '1px solid #ccaa44', color: '#ffdd88',
                            borderRadius: 2, outline: 'none',
                            transform: `scale(${1 / view.zoom})`, transformOrigin: 'top left',
                          }}
                        />
                      </foreignObject>
                    )
                  }
                  const fontUuid = (lc?.props?.font as { __uuid__?: string } | undefined)?.__uuid__
                             ?? (lc?.props?._font as { __uuid__?: string } | undefined)?.__uuid__
                             ?? (lc?.props?._N$file as { __uuid__?: string } | undefined)?.__uuid__
                             ?? (lc?.props?.file as { __uuid__?: string } | undefined)?.__uuid__
                             ?? (lc?.props?._file as { __uuid__?: string } | undefined)?.__uuid__
                  const fontEntry = fontUuid ? fontCacheRef.current.get(fontUuid) : undefined
                  const isBMFontFallback2 = !!(fontEntry?.fallback)
                  // fontUuid가 있으면 커스텀 폰트 모드 (isSystemFontUsed 기본값 false)
                  const isSystemFont = !!(lc?.props?.isSystemFontUsed ?? lc?.props?.['_N$isSystemFontUsed'] ?? !fontUuid)
                  const fontFamilyName = (isBMFontFallback2 ? '' : (!isSystemFont && fontEntry?.familyName))
                    || (lc?.props?.fontFamily as string | undefined)
                    || (lc?.props?._fontFamily as string | undefined)
                    || (lc?.props?.['_N$fontFamily'] as string | undefined)
                    || 'sans-serif'
                  // Outline: CC3.x enableOutline 또는 cc.LabelOutline 컴포넌트
                  const enableOutline = !!(lc?.props?.enableOutline ?? lc?.props?._enableOutline ?? false)
                  const outlineComp = node.components.find(c => c.type === 'cc.LabelOutline')
                  const hasOutline = enableOutline || !!outlineComp
                  const outlineColorProp = (enableOutline
                    ? lc?.props?.outlineColor
                    : outlineComp?.props?.color ?? outlineComp?.props?._color) as { r?: number; g?: number; b?: number } | undefined
                  const { r: or = 0, g: og = 0, b: ob = 0 } = outlineColorProp ?? {}
                  const outlineWidth = enableOutline
                    ? Number(lc?.props?.outlineWidth ?? lc?.props?._outlineWidth ?? lc?.props?.['_N$outlineWidth'] ?? 1)
                    : Number(outlineComp?.props?.width ?? outlineComp?.props?._width ?? outlineComp?.props?.['_N$width'] ?? 1)
                  // Shadow: CC3.x enableShadow or cc.LabelShadow component
                  const enableShadow = !!(lc?.props?.enableShadow ?? lc?.props?._enableShadow ?? false)
                  const shadowComp = node.components.find(c => c.type === 'cc.LabelShadow')
                  const hasShadow = enableShadow || !!shadowComp

                  const shadowColorProp = (enableShadow
                    ? lc?.props?.shadowColor
                    : shadowComp?.props?.color ?? shadowComp?.props?._color) as { r?: number; g?: number; b?: number; a?: number } | undefined
                  const { r: shr = 0, g: shg = 0, b: shb = 0, a: sha = 200 } = shadowColorProp ?? {}

                  const shadowOffsetProp = (enableShadow
                    ? lc?.props?.shadowOffset
                    : shadowComp?.props?.offset ?? shadowComp?.props?._offset) as { x?: number; y?: number } | undefined
                  // CSS drop-shadow 필터는 화면 픽셀 기준으로 동작 → game pixel 그대로 사용
                  // (scale(zoom)과 무관하게 화면에서 고정 픽셀로 렌더링됨)
                  const shOffX = Number(shadowOffsetProp?.x ?? 2)
                  const shOffY = -Number(shadowOffsetProp?.y ?? -2)

                  const shadowBlurVal = enableShadow
                    ? Number(lc?.props?.shadowBlur ?? lc?.props?._shadowBlur ?? 2)
                    : Number(shadowComp?.props?.blur ?? shadowComp?.props?._blur ?? 2)
                  const shBlur = shadowBlurVal

                  // Gradient: CC3.x enableGradient
                  const enableGradient = !!(lc?.props?.enableGradient ?? lc?.props?._enableGradient ?? false)
                  // DashLine: CC3.x enableDashLine
                  const enableDashLine = !!(lc?.props?.enableDashLine ?? lc?.props?._enableDashLine ?? lc?.props?.['_N$enableDashLine'] ?? false)
                  const colorTopProp = lc?.props?.colorTop as { r?: number; g?: number; b?: number } | undefined
                  const colorBotProp = lc?.props?.colorBottom as { r?: number; g?: number; b?: number } | undefined
                  const { r: gtr = cr, g: gtg = cg, b: gtb = cb } = colorTopProp ?? {}
                  const { r: gbr = cr, g: gbg = cg, b: gbb = cb } = colorBotProp ?? {}
                  const gradientId = enableGradient ? `lbl-grad-${node.uuid.replace(/[^a-z0-9]/gi, '')}` : undefined

                  // RichText: strip markup tags for display
                  const stripRichText = (src: string) => src
                    .replace(/<color=[^>]+>/g, '').replace(/<\/color>/g, '')
                    .replace(/<b>/g, '').replace(/<\/b>/g, '')
                    .replace(/<i>/g, '').replace(/<\/i>/g, '')
                    .replace(/<u>/g, '').replace(/<\/u>/g, '')
                    .replace(/<size=\d+>/g, '').replace(/<\/size>/g, '')
                    .replace(/<br\/>/g, '\n').replace(/<\/br>/g, '\n')
                  const displayStr = lc?.type === 'cc.RichText' ? stripRichText(str) : str

                  // Overflow: 0=None, 1=Clamp, 2=Shrink, 3=ResizeH
                  const overflowMode = Number(lc?.props?.overflow ?? lc?.props?._overflow ?? lc?.props?.['_N$overflow'] ?? 0)
                  const needsClip = overflowMode >= 1
                  const clipId = needsClip ? `lbl-clip-${node.uuid.replace(/[^a-z0-9]/gi, '')}` : undefined

                  // Horizontal alignment: 0=Left, 1=Center, 2=Right
                  const hAlign = Number(lc?.props?.horizontalAlign ?? lc?.props?._horizontalAlign ?? lc?.props?.['_N$horizontalAlign'] ?? 1)
                  // Vertical alignment: 0=Top, 1=Center/Middle, 2=Bottom
                  const vAlign = Number(lc?.props?.verticalAlign ?? lc?.props?._verticalAlign ?? lc?.props?.['_N$verticalAlign'] ?? 1)

                  const textAnchorVal = hAlign === 0 ? 'start' : hAlign === 2 ? 'end' : 'middle'
                  const textX = hAlign === 0 ? rectX : hAlign === 2 ? rectX + w : rectX + w / 2
                  const dominantBaselineVal = vAlign === 0 ? 'hanging' : vAlign === 2 ? 'auto' : 'middle'
                  const textY = vAlign === 0 ? rectY : vAlign === 2 ? rectY + h : rectY + h / 2

                  const lines = displayStr.split('\n')
                  const lineHeightProp = Number(lc?.props?.lineHeight ?? lc?.props?._lineHeight ?? 0)
                  const lineH = lineHeightProp > 0 ? lineHeightProp : fs * 1.2

                  const totalHeight = lines.length * lineH
                  const startY = vAlign === 0
                    ? textY
                    : vAlign === 2
                      ? textY - totalHeight + lineH
                      : textY - (totalHeight - lineH) / 2

                  return (
                    <>
                      {needsClip && (
                        <defs>
                          <clipPath id={clipId}>
                            <rect x={rectX} y={rectY} width={Math.max(w, 0)} height={Math.max(h, 0)} />
                          </clipPath>
                        </defs>
                      )}
                      {enableGradient && gradientId && (
                        <defs>
                          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={rectX} y1={rectY} x2={rectX} y2={rectY + Math.max(h, 1)}>
                            <stop offset="0%" stopColor={`rgb(${gtr},${gtg},${gtb})`} />
                            <stop offset="100%" stopColor={`rgb(${gbr},${gbg},${gbb})`} />
                          </linearGradient>
                        </defs>
                      )}
                      <text
                        x={textX}
                        y={lines.length === 1 ? textY : startY}
                        fontSize={fs}
                        fill={enableGradient && gradientId ? `url(#${gradientId})` : `rgb(${cr},${cg},${cb})`}
                        textAnchor={textAnchorVal}
                        dominantBaseline={lines.length === 1 ? dominantBaselineVal : 'auto'}
                        fontFamily={fontFamilyName}
                        stroke={hasOutline ? `rgb(${or},${og},${ob})` : undefined}
                        strokeWidth={hasOutline ? Math.max(outlineWidth, 0.5) : undefined}
                        paintOrder={hasOutline ? 'stroke' : undefined}
                        filter={hasShadow ? `drop-shadow(${shOffX}px ${shOffY}px ${shBlur}px rgba(${shr},${shg},${shb},${sha / 255}))` : undefined}
                        clipPath={needsClip ? `url(#${clipId})` : undefined}
                        style={{ pointerEvents: isSelected ? 'auto' : 'none', userSelect: 'none', cursor: 'text' }}
                        onDoubleClick={e => {
                          e.stopPropagation()
                          setEditingLabelUuid(node.uuid)
                          setTimeout(() => editLabelRef.current?.focus(), 30)
                        }}
                      >
                        {lines.length === 1 ? displayStr : lines.map((line, i) => (
                          <tspan key={i} x={textX} dy={i === 0 ? 0 : lineH}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                      {enableDashLine && lines.map((line, i) => {
                        // shadow 수정과 동일: SVG transform scale(zoom) 적용 중이므로 game pixel 그대로 사용
                        const dashY = lines.length === 1
                          ? textY + fs * 0.2
                          : startY + i * lineH + fs * 0.2
                        return (
                          <line
                            key={`dash-${i}`}
                            x1={rectX} y1={dashY}
                            x2={rectX + Math.max(w, 1)} y2={dashY}
                            stroke={`rgb(${cr},${cg},${cb})`}
                            strokeWidth={Math.max(fs * 0.06, 0.5 / view.zoom)}
                            strokeDasharray={`${Math.max(fs * 0.3, 2 / view.zoom)},${Math.max(fs * 0.15, 1 / view.zoom)}`}
                            clipPath={needsClip ? `url(#${clipId})` : undefined}
                            style={{ pointerEvents: 'none' }}
                          />
                        )
                      })}
                      {isBMFontFallback2 && (
                        <text
                          x={rectX + w - 2} y={rectY + 8}
                          fontSize={7} fill="rgba(255,160,60,0.7)"
                          textAnchor="end"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >BMFont</text>
                      )}
                    </>
                  )
                })()}
                {/* R1543: 잠금 아이콘 (locked nodes) */}
                {lockedUuids.has(node.uuid) && (
                  <text
                    x={rectX + 2 / view.zoom} y={rectY + 10 / view.zoom}
                    fontSize={10 / view.zoom}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    opacity={0.8}
                  >🔒</text>
                )}
                {/* 8방향 리사이즈 핸들 (선택된 노드만, 잠긴/뷰잠금 노드 제외) */}
                {isSelected && !viewLock && !lockedUuids.has(node.uuid) && (() => {
                  const curW = resizeOverride?.uuid === node.uuid ? resizeOverride.w : w
                  const curH = resizeOverride?.uuid === node.uuid ? resizeOverride.h : h
                  const nodeLocalXVal = typeof node.position === 'object' ? (node.position as { x: number }).x : 0
                  const nodeLocalYVal = typeof node.position === 'object' ? (node.position as { y: number }).y : 0
                  const startResize = (e: React.MouseEvent, dir: 'SE' | 'S' | 'E' | 'NW' | 'N' | 'NE' | 'W' | 'SW') => {
                    e.stopPropagation()
                    resizeRef.current = { uuid: node.uuid, startMouseX: e.clientX, startMouseY: e.clientY, startW: curW, startH: curH, dir, startLocalX: nodeLocalXVal, startLocalY: nodeLocalYVal }
                  }
                  const hs = 8 / view.zoom  // R1619: S 핸들 / E 핸들 + 8방향 확장
                  return (
                    <>
                      {/* NW 핸들 */}
                      <rect x={rectX - hs / 2} y={rectY - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'nw-resize' }} onMouseDown={e => startResize(e, 'NW')} />
                      {/* N 핸들 */}
                      <rect x={rectX + curW / 2 - hs / 2} y={rectY - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'n-resize' }} onMouseDown={e => startResize(e, 'N')} />
                      {/* NE 핸들 */}
                      <rect x={rectX + curW - hs / 2} y={rectY - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'ne-resize' }} onMouseDown={e => startResize(e, 'NE')} />
                      {/* W 핸들 */}
                      <rect x={rectX - hs / 2} y={rectY + curH / 2 - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'w-resize' }} onMouseDown={e => startResize(e, 'W')} />
                      {/* E 핸들 (너비만) */}
                      <rect x={rectX + curW - hs / 2} y={rectY + curH / 2 - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'e-resize' }} onMouseDown={e => startResize(e, 'E')} />
                      {/* SW 핸들 */}
                      <rect x={rectX - hs / 2} y={rectY + curH - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'sw-resize' }} onMouseDown={e => startResize(e, 'SW')} />
                      {/* S 핸들 (높이만) */}
                      <rect x={rectX + curW / 2 - hs / 2} y={rectY + curH - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 's-resize' }} onMouseDown={e => startResize(e, 'S')} />
                      {/* SE 핸들 */}
                      <rect x={rectX + curW - hs / 2} y={rectY + curH - hs / 2} width={hs} height={hs} fill="#58a6ff" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'se-resize' }} onMouseDown={e => startResize(e, 'SE')} />
                    </>
                  )
                })()}
                {/* 치수 레이블 (선택된 노드, 줌 > 0.3 시만) */}
                {isSelected && view.zoom > 0.3 && (
                  <text
                    x={rectX + w / 2}
                    y={rectY - 4 / view.zoom}
                    fontSize={9 / view.zoom}
                    fill="#58a6ff"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {Math.round(w)}×{Math.round(h)}
                  </text>
                )}
                {/* 회전 핸들 (선택된 노드) */}
                {isSelected && (
                  <>
                    {/* 핸들 연결선 */}
                    <line
                      x1={svgPos.x} y1={rectY}
                      x2={svgPos.x} y2={rectY - 22 / view.zoom}
                      stroke={selectionColor} strokeWidth={1 / view.zoom}
                      strokeDasharray={`${3 / view.zoom},${2 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* R1506: 앵커 포인트 다이아몬드 (선택 노드만) */}
                    {onAnchorMove && (() => {
                      const effAx = anchorOverride?.uuid === node.uuid ? anchorOverride.ax : anchorX
                      const effAy = anchorOverride?.uuid === node.uuid ? anchorOverride.ay : anchorY
                      const apX = rectX + w * effAx
                      const apY = rectY + h * (1 - effAy)
                      const ds = 5 / view.zoom
                      return (
                        <polygon
                          points={`${apX},${apY - ds} ${apX + ds},${apY} ${apX},${apY + ds} ${apX - ds},${apY}`}
                          fill={anchorOverride?.uuid === node.uuid ? '#ffdd44' : '#1a1a2e'}
                          stroke="#ffdd44"
                          strokeWidth={1.5 / view.zoom}
                          style={{ cursor: 'crosshair' }}
                          title={`앵커: (${effAx.toFixed(2)}, ${effAy.toFixed(2)}) — 드래그로 편집`}
                          onMouseDown={e => {
                            e.stopPropagation()
                            if (viewLock) return
                            anchorRef.current = {
                              uuid: node.uuid,
                              rectX: rectX,
                              rectY: rectY,
                              w,
                              h,
                            }
                          }}
                        />
                      )
                    })()}
                    {/* R1552/R1574: cc.BoxCollider/CircleCollider/PolygonCollider 시각화 */}
                    {(() => {
                      const boxComp = node.components.find(c => c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D')
                      const circComp = node.components.find(c => c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D')
                      const polyComp = node.components.find(c => c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D')
                      if (!boxComp && !circComp && !polyComp) return null
                      const colliderStroke = '#22cc88'
                      const sw = 1.2 / view.zoom
                      if (boxComp) {
                        const off = boxComp.props.offset as { x?: number; y?: number } | undefined
                        const csz = boxComp.props.size as { width?: number; height?: number } | undefined
                        const cw = csz?.width ?? w
                        const ch = csz?.height ?? h
                        const ox = off?.x ?? 0
                        const oy = off?.y ?? 0
                        const cx3 = svgPos.x + ox
                        const cy3 = svgPos.y - oy  // CC Y-up 반전
                        return <rect x={cx3 - cw / 2} y={cy3 - ch / 2} width={cw} height={ch}
                          fill="none" stroke={colliderStroke} strokeWidth={sw} strokeDasharray={`${3/view.zoom} ${2/view.zoom}`}
                          opacity={0.7} style={{ pointerEvents: 'none' }} />
                      }
                      if (circComp) {
                        const off = circComp.props.offset as { x?: number; y?: number } | undefined
                        const r = (circComp.props.radius as number | undefined) ?? Math.min(w, h) / 2
                        const ox = off?.x ?? 0
                        const oy = off?.y ?? 0
                        return <circle cx={svgPos.x + ox} cy={svgPos.y - oy} r={r}
                          fill="none" stroke={colliderStroke} strokeWidth={sw} strokeDasharray={`${3/view.zoom} ${2/view.zoom}`}
                          opacity={0.7} style={{ pointerEvents: 'none' }} />
                      }
                      if (polyComp) {
                        const off = polyComp.props.offset as { x?: number; y?: number } | undefined
                        const pts = polyComp.props.points as Array<{ x?: number; y?: number }> | undefined
                        if (pts && pts.length >= 3) {
                          const ox = off?.x ?? 0, oy = off?.y ?? 0
                          const d = pts.map((p, i) => {
                            const px = svgPos.x + ox + (p.x ?? 0)
                            const py = svgPos.y - oy - (p.y ?? 0)  // CC Y-up
                            return `${i === 0 ? 'M' : 'L'}${px},${py}`
                          }).join(' ') + 'Z'
                          return <path d={d} fill="rgba(34,204,136,0.08)" stroke={colliderStroke}
                            strokeWidth={sw} strokeDasharray={`${3/view.zoom} ${2/view.zoom}`}
                            opacity={0.8} style={{ pointerEvents: 'none' }} />
                        }
                      }
                      return null
                    })()}
                    {/* 회전 핸들 원 */}
                    <circle
                      cx={svgPos.x} cy={rectY - 22 / view.zoom}
                      r={5 / view.zoom}
                      fill={rotateOverride?.uuid === node.uuid ? '#ff9944' : '#1a1a2e'}
                      stroke={rotateOverride?.uuid === node.uuid ? '#ff9944' : '#58a6ff'}
                      strokeWidth={1.5 / view.zoom}
                      style={{ cursor: 'crosshair' }}
                      title={`회전: ${Math.round(rotZ)}° (Shift: 15° 스냅)`}
                      onMouseDown={e => {
                        e.stopPropagation()
                        if (viewLock) return
                        const svg = svgRef.current
                        if (!svg) return
                        const svgRect = svg.getBoundingClientRect()
                        const v = viewRef.current
                        const svgMouseX = (e.clientX - svgRect.left - v.offsetX) / v.zoom
                        const svgMouseY = (e.clientY - svgRect.top - v.offsetY) / v.zoom
                        const startAngle = Math.atan2(svgMouseY - svgPos.y, svgMouseX - svgPos.x) * 180 / Math.PI
                        rotateRef.current = {
                          uuid: node.uuid,
                          centerX: svgPos.x,
                          centerY: svgPos.y,
                          startAngle,
                          startRotation: rotZ,
                        }
                      }}
                    />
                    {/* R1690: 회전 핸들 옆 각도 표시 */}
                    {rotateOverride?.uuid === node.uuid && (
                      <text
                        x={svgPos.x + 8 / view.zoom}
                        y={rectY - 24 / view.zoom}
                        fontSize={9 / view.zoom}
                        fill="#ff9944"
                        fontFamily="monospace"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {(((rotateOverride.angle % 360) + 360) % 360).toFixed(1)}°
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          })}
          <CCSceneSVGOverlays />
        </g>
        {/* R1602: 눈금자 오버레이 (SVG viewport 좌표계) */}
        {showRuler && (() => {
          const svgEl = svgRef.current
          const svgW = svgEl?.clientWidth ?? 600
          const svgH = svgEl?.clientHeight ?? 400
          const THICK = 14
          const step = view.zoom > 2 ? 10 : view.zoom > 1 ? 20 : view.zoom > 0.5 ? 50 : view.zoom > 0.25 ? 100 : 200
          const labelStep = step * 5
          const xTicks: React.ReactNode[] = []
          const x0 = Math.ceil(-view.offsetX / view.zoom / step) * step
          const x1 = Math.floor((svgW - view.offsetX) / view.zoom / step) * step
          for (let c = x0; c <= x1; c += step) {
            const px = c * view.zoom + view.offsetX
            const isMajor = c % labelStep === 0
            xTicks.push(
              <g key={`xr${c}`} pointerEvents="none">
                <line x1={px} y1={isMajor ? 0 : THICK * 0.45} x2={px} y2={THICK} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                {isMajor && <text x={px + 2} y={THICK - 2} fontSize={7} fill="rgba(255,255,255,0.5)">{c}</text>}
              </g>
            )
          }
          const yTicks: React.ReactNode[] = []
          const y0 = Math.ceil((view.offsetY - svgH) / view.zoom / step) * step
          const y1 = Math.floor(view.offsetY / view.zoom / step) * step
          for (let c = y0; c <= y1; c += step) {
            const py = -c * view.zoom + view.offsetY
            const isMajor = c % labelStep === 0
            yTicks.push(
              <g key={`yr${c}`} pointerEvents="none">
                <line x1={isMajor ? 0 : THICK * 0.45} y1={py} x2={THICK} y2={py} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                {isMajor && <text x={1} y={py - 1} fontSize={7} fill="rgba(255,255,255,0.5)" transform={`rotate(-90,${THICK / 2},${py})`}>{c}</text>}
              </g>
            )
          }
          return (
            <g pointerEvents="none">
              <rect x={THICK} y={0} width={svgW - THICK} height={THICK} fill="rgba(0,0,0,0.72)" />
              <rect x={0} y={THICK} width={THICK} height={svgH - THICK} fill="rgba(0,0,0,0.72)" />
              <rect x={0} y={0} width={THICK} height={THICK} fill="rgba(15,15,25,0.9)" />
              {xTicks}
              {yTicks}
              {view.offsetX > THICK && view.offsetX < svgW && (
                <line x1={view.offsetX} y1={0} x2={view.offsetX} y2={THICK} stroke="#58a6ff" strokeWidth={1.5} />
              )}
              {view.offsetY > THICK && view.offsetY < svgH && (
                <line x1={0} y1={view.offsetY} x2={THICK} y2={view.offsetY} stroke="#58a6ff" strokeWidth={1.5} />
              )}
            </g>
          )
        })()}
        {/* R2465: 거리 측정 도구 오버레이 */}
        {measureLine && measureMode && (() => {
          const { svgX1, svgY1, svgX2, svgY2 } = measureLine
          const dx = svgX2 - svgX1; const dy = svgY2 - svgY1
          const dist = Math.sqrt(dx * dx + dy * dy)
          const midX = (svgX1 + svgX2) / 2; const midY = (svgY1 + svgY2) / 2
          const sz = 3 / view.zoom; const fs = 9 / view.zoom; const lw = 1.5 / view.zoom
          return (
            <g pointerEvents="none" transform={`translate(${view.offsetX},${view.offsetY}) scale(${view.zoom})`}>
              <line x1={svgX1} y1={svgY1} x2={svgX2} y2={svgY2} stroke="#ff6b6b" strokeWidth={lw} strokeDasharray={`${5 / view.zoom},${2 / view.zoom}`} />
              <circle cx={svgX1} cy={svgY1} r={sz} fill="#ff6b6b" />
              <circle cx={svgX2} cy={svgY2} r={sz} fill="#ff6b6b" />
              <rect x={midX - 32 / view.zoom} y={midY - 9 / view.zoom} width={64 / view.zoom} height={15 / view.zoom} fill="rgba(0,0,0,0.75)" rx={2 / view.zoom} />
              <text x={midX} y={midY + 4 / view.zoom} textAnchor="middle" fontSize={fs} fill="#ff6b6b" fontFamily="monospace">{dist.toFixed(1)}px</text>
            </g>
          )
        })()}
      </svg>
      <CCSceneInnerHUD />
      </div>
      <CCSceneOuterHUD />
    </div>
    </CCSceneProvider>
  )
}
