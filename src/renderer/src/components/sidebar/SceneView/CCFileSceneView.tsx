import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { CCSceneNode, CCSceneFile, CCVec3 } from '../../../../../shared/ipc-schema'

interface ViewTransform {
  offsetX: number
  offsetY: number
  zoom: number
}

interface FlatNode {
  node: CCSceneNode
  worldX: number
  worldY: number
  depth: number
  parentUuid: string | null  // R1570
  siblingIdx: number  // R1687
  siblingTotal: number  // R1687
}

interface CCFileSceneViewProps {
  sceneFile: CCSceneFile
  selectedUuid: string | null
  onSelect: (uuid: string | null) => void
  onMove?: (uuid: string, x: number, y: number) => void
  onResize?: (uuid: string, w: number, h: number) => void
  onRename?: (uuid: string, name: string) => void
  onRotate?: (uuid: string, angle: number) => void
  onMultiMove?: (moves: Array<{ uuid: string; x: number; y: number }>) => void
  onMultiDelete?: (uuids: string[]) => void
  onLabelEdit?: (uuid: string, text: string) => void
  /** R1504: 새 노드 추가 (parentUuid=null → root의 자식) */
  onAddNode?: (parentUuid: string | null, pos?: { x: number; y: number }) => void
  /** R1506: 앵커 포인트 드래그 편집 (0~1 범위) */
  onAnchorMove?: (uuid: string, ax: number, ay: number) => void
  /** R1516: 다중 선택 변경 알림 */
  onMultiSelectChange?: (uuids: string[]) => void
  /** R1563: 선택 노드 복제 (Ctrl+D) */
  onDuplicate?: (uuid: string) => void
  /** R1565: 선택 노드 active 토글 (H 키) */
  onToggleActive?: (uuid: string) => void
  /** R1567: Ctrl+↑↓ 형제 순서 변경 (1=위로, -1=아래로) */
  onReorder?: (uuid: string, direction: 1 | -1) => void
  /** R1666: 선택 노드 pulse 미리보기 uuid */
  pulseUuid?: string | null
  /** R2466: 다중 선택 노드 그룹화 */
  onGroupNodes?: (uuids: string[]) => void
  /** R2476: 선택 노드 opacity 인라인 편집 */
  onOpacity?: (uuid: string, opacity: number) => void
  /** R2549: 형제 순서를 맨 앞(first) / 맨 뒤(last)로 이동 */
  onReorderExtreme?: (uuid: string, to: 'first' | 'last') => void
  /** R2705: Alt+drag 노드 복제 — 원본 uuid + 드래그 목적지 x/y */
  onAltDrag?: (uuid: string, x: number, y: number) => void
  /** R2726: 씬 트리 접힌 노드 — 자식을 SceneView에서 숨김 */
  collapsedUuids?: Set<string>
}

/**
 * CC 파일 기반 씬뷰 (Phase A)
 * SVG 렌더링, 팬/줌, 노드 선택
 * WS Extension 없이 파싱된 CCSceneNode 트리를 직접 표시
 */
// R2486: 씬별 뷰 상태 영속화 — scenePath 기반 localStorage 키
function sceneViewKey(scenePath: string) {
  // Use full path to avoid truncation collision
  const sanitized = scenePath.replace(/[^a-zA-Z0-9]/g, '_')
  return 'sv-view2-' + sanitized.slice(-80)  // increased from 60 to 80
}

export function CCFileSceneView({ sceneFile, selectedUuid, onSelect, onMove, onResize, onRename, onRotate, onMultiMove, onMultiDelete, onLabelEdit, onAddNode, onAnchorMove, onMultiSelectChange, onDuplicate, onToggleActive, onReorder, pulseUuid, onGroupNodes, onOpacity, onReorderExtreme, onAltDrag, collapsedUuids }: CCFileSceneViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewTransform>(() => {
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
  const resizeRef = useRef<{ uuid: string; startMouseX: number; startMouseY: number; startW: number; startH: number; dir: 'SE' | 'S' | 'E' } | null>(null)
  const [resizeOverride, setResizeOverride] = useState<{ uuid: string; w: number; h: number } | null>(null)
  const rotateRef = useRef<{ uuid: string; centerX: number; centerY: number; startAngle: number; startRotation: number } | null>(null)
  const [rotateOverride, setRotateOverride] = useState<{ uuid: string; angle: number } | null>(null)
  // R1506: 앵커 포인트 드래그
  const anchorRef = useRef<{ uuid: string; rectX: number; rectY: number; w: number; h: number } | null>(null)
  const [anchorOverride, setAnchorOverride] = useState<{ uuid: string; ax: number; ay: number } | null>(null)
  // R1512: 정렬 가이드라인 (드래그 시 인접 노드와 정렬 스냅)
  const [alignGuides, setAlignGuides] = useState<Array<{ type: 'V' | 'H'; pos: number; label?: string }>>([])
  const ALIGN_SNAP_THRESHOLD = 6 // SVG 픽셀 기준
  const [mouseScenePos, setMouseScenePos] = useState<{ x: number; y: number } | null>(null)
  const [hoverUuid, setHoverUuid] = useState<string | null>(null)
  const [hoverClientPos, setHoverClientPos] = useState<{ x: number; y: number } | null>(null)
  const [gridStyle, setGridStyle] = useState<'line' | 'dot' | 'none'>('line')
  const [showNodeNames, setShowNodeNames] = useState(true)
  // R1687: 형제 순서 인덱스 표시 토글
  const [showZOrder, setShowZOrder] = useState(false)
  const [snapSize, setSnapSize] = useState(10)
  const [bgColorOverride, setBgColorOverride] = useState<string | null>(null)
  // R2326: 배경 패턴 모드 (solid | checker)
  const [bgPattern, setBgPattern] = useState<'solid' | 'checker'>('solid')
  // R1681: 선택 노드 테두리 색상 사용자 설정
  const [selectionColor, setSelectionColor] = useState('#58a6ff')
  const [showHelp, setShowHelp] = useState(false)
  // R1489: 미니맵
  const [showMinimap, setShowMinimap] = useState(true)
  const [mmPos, setMmPos] = useState<{ x: number; y: number } | null>(null)
  const mmDragRef = useRef<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null)
  // 노드 선택 컨텍스트 메뉴 (겹친 노드 우클릭)
  const [nodePickMenu, setNodePickMenu] = useState<{ x: number; y: number; nodes: Array<{ uuid: string; name: string }> } | null>(null)
  const nodePickMenuRef = useRef<HTMLDivElement>(null)
  // R1496: 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; uuid: string | null } | null>(null)
  // R1500: 스냅 포인트 시각적 피드백
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number } | null>(null)
  // R1602: 눈금자 오버레이
  const [showRuler, setShowRuler] = useState(false)
  // R2319: 카메라 프레임 토글
  const [showCameraFrames, setShowCameraFrames] = useState(true)
  // R2456: 그리드 오버레이 토글
  const [showGrid, setShowGrid] = useState(false)
  // R2501: 중심선 가이드 오버레이 (CC 좌표 원점 기준 수직/수평선)
  const [showCrossGuide, setShowCrossGuide] = useState(false)
  // R2511: 선택 노드 엣지-캔버스 거리 가이드선
  const [showEdgeGuides, setShowEdgeGuides] = useState(false)
  // R2734: 사용자 영구 가이드라인
  const [userGuides, setUserGuides] = useState<Array<{ type: 'V' | 'H'; pos: number }>>([])
  const [showUserGuides, setShowUserGuides] = useState(false)
  // R2740: 가이드라인 드래그
  const guideDragRef = useRef<{ idx: number; type: 'V' | 'H'; startMouse: number; startPos: number } | null>(null)
  // R1605: 편집 잠금 (View-only lock)
  const [viewLock, setViewLock] = useState(false)
  // R1610: 비활성 노드 완전 숨기기
  const [hideInactiveNodes, setHideInactiveNodes] = useState(false)
  // R1692: 시각적 숨기기 (에디터 전용, active 불변)
  const [hiddenUuids, setHiddenUuids] = useState<Set<string>>(new Set())
  // R1693: 좌표 핀 마커 (Ctrl+P로 추가, 클릭으로 삭제)
  // R2529: 핀 마커 레이블 포함
  const [pinMarkers, setPinMarkers] = useState<{ id: number; ccX: number; ccY: number; label?: string }[]>([])
  const pinIdRef = useRef(0)
  const hoverClientPosRef = useRef<{ x: number; y: number } | null>(null)
  // R1697: 노드 레이블 폰트 크기 (기본 11px)
  const [labelFontSize, setLabelFontSize] = useState(11)
  // R1703: 형제 그룹 하이라이트
  const [showSiblingGroup, setShowSiblingGroup] = useState(false)
  // R1705: 선택 이력 (Alt+← / Alt+→)
  const selHistoryRef = useRef<string[]>([])
  const selHistoryIdxRef = useRef(-1)
  // R2707: 선택 히스토리 팝업
  const [histPopupOpen, setHistPopupOpen] = useState(false)
  const histPopupBtnRef = useRef<HTMLButtonElement | null>(null)
  const overlayPanelRef = useRef<HTMLSpanElement>(null)
  const toolPanelRef = useRef<HTMLSpanElement>(null)
  // R1623: 와이어프레임 모드 (선만 표시)
  const [wireframeMode, setWireframeMode] = useState(false)
  // R1641: depth 색조 시각화
  const [depthColorMode, setDepthColorMode] = useState(false)
  // R2543: 뷰 북마크 (1~3번 슬롯)
  const [viewBookmarks, setViewBookmarks] = useState<(ViewTransform | null)[]>([null, null, null])
  // R2526: 깊이 필터 (최대 표시 depth)
  const [depthFilterMax, setDepthFilterMax] = useState<number | null>(null)
  // R1659: 솔로 모드 (선택 노드 외 흐리게)
  const [soloMode, setSoloMode] = useState(false)
  // R1474: 씬뷰 스크린샷 → Claude 비전 분석
  const [screenshotSending, setScreenshotSending] = useState(false)
  // R1530: 디자인 레퍼런스 이미지 overlay
  const [refImgSrc, setRefImgSrc] = useState<string | null>(null)
  const [refImgOpacity, setRefImgOpacity] = useState(0.3)
  const refImgInputRef = useRef<HTMLInputElement | null>(null)
  // R1545: 줌 % 인라인 편집
  const [editingZoom, setEditingZoom] = useState(false)
  // R1548: 캔버스 해상도 오버레이 picker
  const [showResPicker, setShowResPicker] = useState(false)
  const [resOverride, setResOverride] = useState<{ w: number; h: number } | null>(null)
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
    try { return new Set(JSON.parse(localStorage.getItem('sv-locked-uuids') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleLock = (uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
      localStorage.setItem('sv-locked-uuids', JSON.stringify([...next]))
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
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const multiSelectedRef = useRef(multiSelected)
  multiSelectedRef.current = multiSelected
  const selBoxRef = useRef<{ startSvgX: number; startSvgY: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  // R2544: 핀 마커 목록 패널 토글
  const [showPinPanel, setShowPinPanel] = useState(false)
  // R2521: 세계 좌표 표시 토글
  const [showWorldPos, setShowWorldPos] = useState(false)
  // R2551: 컴포넌트 타입 필터 — 선택 타입 외 노드 dim
  const [compFilterType, setCompFilterType] = useState<string | null>(null)
  // R2557: Label 텍스트 콘텐츠 SVG 오버레이 토글
  const [showLabelText, setShowLabelText] = useState(false)
  // R2558: 씬 통계 팝업 토글
  const [showSceneStats, setShowSceneStats] = useState(false)
  // 툴바 드롭다운 패널
  const [showOverlayPanel, setShowOverlayPanel] = useState(false)
  const [showToolPanel, setShowToolPanel] = useState(false)
  // R2576: 노드 크기 레이블 오버레이 (W×H)
  const [showSizeLabels, setShowSizeLabels] = useState(false)
  // R2578: 노드 불투명도 오버레이 (α%)
  const [showOpacityLabels, setShowOpacityLabels] = useState(false)
  // R2579: 컴포넌트 배지 오버레이
  const [showCompBadges, setShowCompBadges] = useState(false)
  // R2583: 회전값 레이블 오버레이 (∠°)
  const [showRotLabels, setShowRotLabels] = useState(false)
  // R2585: 노드 이름 레이블 오버레이
  const [showNameLabels, setShowNameLabels] = useState(false)
  // R2586: 앵커 포인트 전체 오버레이 (⊕)
  const [showAnchorOverlay, setShowAnchorOverlay] = useState(false)
  // R2588: 노드 색상 스와치 오버레이
  const [showColorSwatch, setShowColorSwatch] = useState(false)
  // R2591: 자식 수 배지 오버레이
  const [showChildCountBadge, setShowChildCountBadge] = useState(false)
  // R2592: 깊이(Depth) 레이블 오버레이
  const [showDepthLabel, setShowDepthLabel] = useState(false)
  // R2598: flip(음수 scale) 노드 표시 오버레이
  const [showFlipOverlay, setShowFlipOverlay] = useState(false)
  // R2600: 다중 선택 bounding box 오버레이
  const [showSelBBox, setShowSelBBox] = useState(false)
  // R2601: component 타입 배지 오버레이
  const [showCompBadge, setShowCompBadge] = useState(false)
  // R2603: tag 배지 오버레이
  const [showTagBadge, setShowTagBadge] = useState(false)
  // R2607: 중복 이름 노드 강조 오버레이
  const [showDupNameOverlay, setShowDupNameOverlay] = useState(false)
  // R2610: rotation 방향 화살표 오버레이
  const [showRotArrow, setShowRotArrow] = useState(false)
  // R2615: W×H 크기 표시 오버레이
  const [showSizeOverlay, setShowSizeOverlay] = useState(false)
  // R2617: 원점(0,0) 십자선 오버레이
  const [showOriginCross, setShowOriginCross] = useState(false)
  // R2620: 스케일 배수 텍스트 오버레이 (scale≠1 노드에 ×sx,sy 표시)
  const [showScaleLabel, setShowScaleLabel] = useState(false)
  // R2624: 레이어 배지 오버레이 (CC3.x 비기본 레이어 노드에 레이어명 표시)
  const [showLayerBadge, setShowLayerBadge] = useState(false)
  // R2625: 이벤트 핸들러 배지 오버레이 (Button/Toggle/Slider 있는 노드에 ⚡ 표시)
  const [showEventBadge, setShowEventBadge] = useState(false)
  // R2629: 안전 영역 + 비율 가이드 오버레이
  const [showSafeZone, setShowSafeZone] = useState(false)
  // R2630: 삼분법(Rule of Thirds) 가이드 오버레이
  const [showRuleOfThirds, setShowRuleOfThirds] = useState(false)
  // R2709: 커스텀 비율 가이드 오버레이
  const [showCustomRatio, setShowCustomRatio] = useState(false)
  const [customRatioW, setCustomRatioW] = useState(16)
  const [customRatioH, setCustomRatioH] = useState(9)
  // R2636: 캔버스 경계 초과 노드 강조 오버레이
  const [showOOBHighlight, setShowOOBHighlight] = useState(false)
  // R2637: 씬 전체 바운딩박스 오버레이
  const [showSceneBBox, setShowSceneBBox] = useState(false)
  // R2640: 선택 순서 번호 오버레이
  const [showSelOrder, setShowSelOrder] = useState(false)
  // R2641: 앵커 포인트 시각화 오버레이
  const [showAnchorDot, setShowAnchorDot] = useState(false)
  // R2645: 선택 노드 연결선 오버레이
  const [showSelPolyline, setShowSelPolyline] = useState(false)
  // R2646: 계층 구조 연결선 오버레이
  const [showHierarchyLines, setShowHierarchyLines] = useState(false)
  // R2647: 선택 노드 그룹 바운딩박스
  const [showSelGroupBBox, setShowSelGroupBBox] = useState(false)
  // R2651: 선택 노드 부모 하이라이트
  const [showParentHighlight, setShowParentHighlight] = useState(false)
  // R2652: 비활성 노드 반투명 오버레이
  const [showInactiveDim, setShowInactiveDim] = useState(false)
  // R2658: 노드 색상 tint 시각화
  const [showColorViz, setShowColorViz] = useState(false)
  // R2661: 마우스 크로스헤어 가이드라인
  const [showCrosshair, setShowCrosshair] = useState(false)
  // R2665: 깊이 히트맵 오버레이 (shallow=초록, deep=빨강)
  const [showDepthHeat, setShowDepthHeat] = useState(false)
  // R2666: opacity 값 텍스트 오버레이
  const [showOpacityOverlay, setShowOpacityOverlay] = useState(false)
  // R2668: 회전각 텍스트 오버레이
  const [showRotOverlay, setShowRotOverlay] = useState(false)
  // R2670: 선택 노드 위치 텍스트 오버레이
  const [showPosText, setShowPosText] = useState(false)
  // R2672: scale 값 텍스트 오버레이
  const [showScaleText, setShowScaleText] = useState(false)
  // R2673: 컴포넌트 수 배지 오버레이
  const [showCompCountBadge, setShowCompCountBadge] = useState(false)
  // R2675: 노드 크기 히트맵 (큰=노란, 작은=파란)
  const [showSizeHeat, setShowSizeHeat] = useState(false)
  // R2680: 선택 그룹 중심 마커
  const [showSelCenter, setShowSelCenter] = useState(false)
  // R2682: 선택 노드 간 거리 텍스트
  const [showPairDist, setShowPairDist] = useState(false)
  // R2686: Sprite spriteFrame 이름 배지
  const [showSpriteName, setShowSpriteName] = useState(false)
  // R2688: UUID 앞 8자리 배지
  const [showUuidBadge, setShowUuidBadge] = useState(false)
  // R2691: 노드 중심 점 마커
  const [showCenterDot, setShowCenterDot] = useState(false)
  // R2694: 비기본 앵커 강조 오버레이 (anchor ≠ 0.5,0.5)
  const [showNonDefaultAnchor, setShowNonDefaultAnchor] = useState(false)
  // R2696: 크기 0 노드 경고 오버레이
  const [showZeroSizeWarn, setShowZeroSizeWarn] = useState(false)
  // R2698: 선택 노드 위치 가이드 십자선 오버레이
  const [showSelAxisLine, setShowSelAxisLine] = useState(false)
  // R2700: 선택 노드 형제 강조 오버레이
  const [showSiblingHighlight, setShowSiblingHighlight] = useState(false)
  // R2717: 선택 노드 opacity HUD 배지
  const [showOpacityHud, setShowOpacityHud] = useState(false)
  // R2718: 선택 노드 uuid 참조 화살표 오버레이
  const [showRefArrows, setShowRefArrows] = useState(false)
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
      if (e.code === 'Space' && !isSpaceDownRef.current) {
        const el = e.target as HTMLElement
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
        e.preventDefault()
        isSpaceDownRef.current = true
        if (svgRef.current) svgRef.current.style.cursor = 'grab'
      }
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
  // Sprite 텍스처 캐시: UUID → local:// URL (null = 해상 불가)
  const spriteCacheRef = useRef<Map<string, string>>(new Map())
  const [, setSpriteCacheVer] = useState(0)
  // Font 캐시: UUID → { dataUrl, familyName }
  const fontCacheRef = useRef<Map<string, { dataUrl: string; familyName: string }>>(new Map())
  const [fontCacheVer, setFontCacheVer] = useState(0)

  // 캔버스 크기 + 배경색 추정
  const { designW, designH, bgColor } = useMemo(() => {
    const root = sceneFile.root
    const canvasNode = root.children.find(n =>
      n.name === 'Canvas' || n.components.some(c => c.type === 'cc.Canvas')
    )
    const n = canvasNode ?? root.children[0]
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
    function walk(node: CCSceneNode, parentWorldX: number, parentWorldY: number, parentRotDeg: number, parentSx: number, parentSy: number, depth: number, parentUuid: string | null, siblingIdx: number, siblingTotal: number) {
      const localX = typeof node.position === 'object' ? (node.position as { x: number }).x : 0
      const localY = typeof node.position === 'object' ? (node.position as { y: number }).y : 0
      const [worldX, worldY] = applyParentTransform(parentRotDeg, parentSx, parentSy, parentWorldX, parentWorldY, localX, localY)
      const rotZ = typeof node.rotation === 'number' ? node.rotation : (node.rotation as { z?: number })?.z ?? 0
      const cumRotZ = parentRotDeg + rotZ
      const sx = (node.scale as { x?: number })?.x ?? 1
      const sy = (node.scale as { y?: number })?.y ?? 1
      const cumSx = parentSx * sx
      const cumSy = parentSy * sy
      result.push({ node, worldX, worldY, depth, parentUuid, siblingIdx, siblingTotal })
      // R2726: 씬 트리에서 접힌 노드는 자식을 SceneView에서도 숨김
      if (collapsedUuids?.has(node.uuid)) return
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], worldX, worldY, cumRotZ, cumSx, cumSy, depth + 1, node.uuid, i, node.children.length)
      }
    }
    // Scene 루트 자체는 건너뜀 (이름 없는 컨테이너)
    for (let i = 0; i < sceneFile.root.children.length; i++) {
      walk(sceneFile.root.children[i], 0, 0, 0, 1, 1, 0, null, i, sceneFile.root.children.length)
    }
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
  const UUID_RE = /^[0-9a-f]{14,36}$/
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

  // R2665: 깊이 히트맵용 최대 깊이
  const maxDepthVal = useMemo(() => Math.max(...flatNodes.map(fn => fn.depth), 1), [flatNodes])
  // R2675: 크기 히트맵용 최대 노드 면적
  const maxNodeArea = useMemo(() => Math.max(...flatNodes.map(fn => (fn.node.size?.x ?? 0) * (fn.node.size?.y ?? 0)), 1), [flatNodes])

  // R2324: 선택 노드 자동 팬 — 트리에서 선택 시 뷰포트 밖이면 중심 이동
  const flatNodesRef = useRef(flatNodes)
  flatNodesRef.current = flatNodes
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

  // Sprite UUID → base64 data URL 비동기 해상
  useEffect(() => {
    const assetsDir = sceneFile.projectInfo.assetsDir
    if (!assetsDir) {
      console.debug('[SceneView] sprite load skipped: no assetsDir')
      return
    }
    const spriteComps = flatNodes.flatMap(fn =>
      fn.node.components.filter(c => c.type === 'cc.Sprite' || c.type === 'Sprite' || c.type === 'cc.Sprite2D')
    )
    const uuids = spriteComps
      .map(c => (c.props.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__)
      .filter((u): u is string => !!u && !spriteCacheRef.current.has(u))
    console.debug(`[SceneView] sprite comps=${spriteComps.length} new UUIDs=${uuids.length}`, uuids[0])
    if (!uuids.length) return
    uuids.forEach(uuid => {
      spriteCacheRef.current.set(uuid, '') // pending sentinel
      window.api.ccFileResolveTexture?.(uuid, assetsDir).then(url => {
        console.debug(`[SceneView] resolveTexture ${uuid.slice(0,8)}… →`, url ? url.slice(0, 40) : null)
        if (url) {
          spriteCacheRef.current.set(uuid, url)
        } else {
          spriteCacheRef.current.delete(uuid) // null 반환 시 sentinel 제거
        }
        setSpriteCacheVer(v => v + 1)
      }).catch((e) => {
        console.debug('[SceneView] resolveTexture error', uuid.slice(0,8), e)
        spriteCacheRef.current.delete(uuid)
      })
    })
  }, [sceneFile, flatNodes])

  // Font 로딩: cc.Label 컴포넌트의 font UUID → TTF base64
  useEffect(() => {
    const assetsDir = sceneFile?.projectInfo?.assetsDir
    if (!assetsDir) return
    const labelComps = flatNodes.flatMap(fn =>
      fn.node.components.filter(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
    )
    const uuids = labelComps
      .map(c => (c.props.font as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props._font as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props._N$file as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props.file as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props._file as { __uuid__?: string } | undefined)?.__uuid__)
      .filter((u): u is string => !!u && !fontCacheRef.current.has(u))
    const uniqueUuids = [...new Set(uuids)]
    if (!uniqueUuids.length) return
    let cancelled = false
    uniqueUuids.forEach(uuid => {
      fontCacheRef.current.set(uuid, { dataUrl: '', familyName: '' }) // pending sentinel
      window.api.ccFileResolveFont?.(uuid, assetsDir).then((result: { dataUrl: string; familyName: string } | null) => {
        if (cancelled) return
        if (result) {
          fontCacheRef.current.set(uuid, result)
        } else {
          fontCacheRef.current.delete(uuid)
        }
        setFontCacheVer(v => v + 1)
      }).catch(() => { if (!cancelled) fontCacheRef.current.delete(uuid) })
    })
    return () => {
      cancelled = true
      // 클린업 시 미완료 sentinel 제거 → 다음 effect 재실행 시 UUID 재로딩 보장
      // (sentinel이 남으면 "이미 있음"으로 오판해 폰트 영구 미로딩 버그 방지)
      uniqueUuids.forEach(uuid => {
        const entry = fontCacheRef.current.get(uuid)
        if (entry && !entry.dataUrl) fontCacheRef.current.delete(uuid)
      })
    }
  }, [sceneFile, flatNodes])

  // CC 좌표 → SVG 좌표 변환
  // CC: Y-up, center origin. SVG: Y-down, top-left.
  const cx = effectiveW / 2
  const cy = effectiveH / 2
  const ccToSvg = useCallback((ccX: number, ccY: number) => ({
    x: cx + ccX,
    y: cy - ccY,
  }), [cx, cy])

  // 휠 줌 — native listener로 passive: false 강제 (React onWheel은 passive라 preventDefault 불가)
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
  }, [])

  // 패닝 (중간 버튼 또는 Space+드래그)
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
  }, [view, measureMode])

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
      const dx = e.clientX - resizeRef.current.startMouseX
      const dy = e.clientY - resizeRef.current.startMouseY
      const z = viewRef.current.zoom
      const { dir, startW, startH } = resizeRef.current
      let newW = dir !== 'S' ? Math.max(1, startW + dx / z) : startW
      let newH = dir !== 'E' ? Math.max(1, startH + dy / z) : startH
      // R1638: Shift+리사이즈 — SE 핸들에서 종횡비 유지
      if (e.shiftKey && dir === 'SE' && startW > 0 && startH > 0) {
        const ratio = startW / startH
        if (Math.abs(dx) / z > Math.abs(dy) / z) newH = Math.max(1, newW / ratio)
        else newW = Math.max(1, newH * ratio)
      }
      setResizeOverride({ uuid: resizeRef.current.uuid, w: newW, h: newH })
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
        const guides: typeof alignGuides = []
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
  }, [isPanning, cx, cy, snapSize, flatNodes])

  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
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
      onRotate?.(rotateOverride.uuid, rotateOverride.angle)
      rotateRef.current = null
      setRotateOverride(null)
      return
    }
    rotateRef.current = null
    setRotateOverride(null)
    if (resizeRef.current && resizeOverride) {
      onResize?.(resizeOverride.uuid, resizeOverride.w, resizeOverride.h)
      resizeRef.current = null
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
  }, [anchorOverride, rotateOverride, dragOverride, resizeOverride, selectionBox, flatNodes, ccToSvg, onAnchorMove, onRotate, onMove, onResize, onSelect])

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!svgRef.current || svgRef.current.getBoundingClientRect().width === 0) return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) {
        handleFitToSelected()
        return
      }
      // 화살표 키: 선택 노드 이동 (1px, Shift+10px)
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, 1], ArrowDown: [0, -1],
      }
      // R1583: Ctrl+A — 전체 노드 다중 선택
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
      // R1504: Ctrl+N — 새 노드 추가
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        onAddNode?.(selectedUuid, undefined)
        return
      }
      // R1563: Ctrl+D — 선택 노드 복제
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        if (selectedUuid) onDuplicate?.(selectedUuid)
        return
      }
      // R1693: Ctrl+P — 마우스 위치에 핀 마커 추가
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
      // R1570: P — 선택 노드 부모 노드로 포커스
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (fn?.parentUuid) {
          const parentFn = flatNodes.find(f => f.node.uuid === fn.parentUuid)
          if (parentFn) onSelect(parentFn.node.uuid)
        }
        return
      }
      // R1580: Tab / Shift+Tab — 형제 노드 탐색 (다음/이전)
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
      // R1571: Enter — 선택 노드의 첫 번째 자식으로 포커스
      if (e.code === 'Enter' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (fn && fn.node.children.length > 0) {
          e.preventDefault()
          onSelect(fn.node.children[0].uuid)
          return
        }
      }
      // R1703: G — 형제 그룹 하이라이트 토글
      if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setShowSiblingGroup(s => !s)
        return
      }
      // R1705: Alt+← / Alt+→ — 선택 이력 앞/뒤 탐색
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
      // R2543: 1/2/3 — 뷰 북마크 복원, Ctrl+1/2/3 — 저장
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
      // R1565: H — 선택 노드 active 토글 (숨기기/보이기)
      if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.shiftKey && selectedUuid) {
        e.preventDefault()
        onToggleActive?.(selectedUuid)
        return
      }
      // R1692: Shift+H — 선택 노드 시각적 숨기기 토글 (active 불변)
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
      // R2465: M — 거리 측정 도구 토글
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setMeasureMode(m => !m)
        setMeasureLine(null)
        measureStartRef.current = null
        return
      }
      // R2477: Escape — 부모 노드 선택 (없으면 선택 해제)
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
      // R1622: O — 선택 노드 캔버스 중앙(0,0) 이동
      if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        onMove?.(selectedUuid, 0, 0)
        return
      }
      // R1483: Delete/Backspace — 다중 선택 일괄 삭제
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const multi = multiSelectedRef.current
        if (multi.size > 1) {
          e.preventDefault()
          onMultiDelete?.(Array.from(multi))
          return
        }
      }
      // R1567: Ctrl+↑↓ — 형제 순서 변경 (위/아래)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'ArrowUp' || e.code === 'ArrowDown') && selectedUuid) {
        e.preventDefault()
        onReorder?.(selectedUuid, e.code === 'ArrowUp' ? 1 : -1)
        return
      }
      if (e.code in arrows && selectedUuid) {
        if (e.ctrlKey || e.metaKey) return  // Ctrl+Arrow는 위에서 처리됨
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const [dx, dy] = arrows[e.code]
        const multi = multiSelectedRef.current
        // 멀티셀렉트: 모든 선택 노드 일괄 이동
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
  }, [handleFitToSelected, selectedUuid, flatNodes, onMove, onMultiMove, onMultiDelete, onAddNode, onDuplicate, onToggleActive, onReorder])

  // R1705: selectedUuid 변경 시 이력 기록
  const navSkipRef = useRef(false)
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {/* 툴바 */}
      <div style={{
        display: 'flex', gap: 4, padding: '3px 8px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, alignItems: 'center', fontSize: 11,
      }}>
        {/* R1548: 해상도 표시 클릭 → preset picker */}
        <span style={{ color: resOverride ? '#fbbf24' : 'var(--text-muted)', flex: 1, position: 'relative' }}>
          <span
            onClick={() => setShowResPicker(p => !p)}
            title="클릭: 캔버스 해상도 preset 선택 (뷰 전용)"
            style={{ cursor: 'pointer', borderBottom: '1px dashed currentColor' }}
          >{effectiveW}×{effectiveH}</span>
          {resOverride && (
            <span onClick={() => setResOverride(null)} title="해상도 리셋" style={{ marginLeft: 3, cursor: 'pointer', color: '#f85149', fontSize: 8 }}>↺</span>
          )}
          {' '}| {flatNodes.length}개
          {/* R1596: 활성 노드 수 표시 */}
          {(() => {
            const activeCount = flatNodes.filter(fn => fn.node.active !== false).length
            if (activeCount === flatNodes.length) return null
            return <span style={{ color: '#4ade80', marginLeft: 2 }}>{activeCount}활성</span>
          })()}
          {showResPicker && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 60,
              background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
              borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: 140, fontSize: 9,
            }} onClick={e => e.stopPropagation()}>
              {[
                { label: '960×640 (CC2 기본)', w: 960, h: 640 },
                { label: '1280×720 (HD)', w: 1280, h: 720 },
                { label: '1920×1080 (FHD)', w: 1920, h: 1080 },
                { label: '750×1334 (iPhone SE)', w: 750, h: 1334 },
                { label: '1080×1920 (세로 FHD)', w: 1080, h: 1920 },
                { label: '2048×1536 (iPad)', w: 2048, h: 1536 },
                { label: '480×320 (작은 모바일)', w: 480, h: 320 },
              ].map(p => (
                <div key={p.label}
                  onClick={() => { setResOverride({ w: p.w, h: p.h }); setShowResPicker(false) }}
                  style={{
                    padding: '4px 8px', cursor: 'pointer',
                    color: effectiveW === p.w && effectiveH === p.h ? '#fbbf24' : 'var(--text-primary)',
                    background: effectiveW === p.w && effectiveH === p.h ? 'rgba(251,191,36,0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                  onMouseLeave={e => (e.currentTarget.style.background = effectiveW === p.w && effectiveH === p.h ? 'rgba(251,191,36,0.08)' : 'transparent')}
                >{p.label}</div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', padding: '4px 8px', display: 'flex', gap: 4 }}>
                <input type="number" placeholder="W" defaultValue={effectiveW}
                  ref={resCustomWRef}
                  style={{ width: 50, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>×</span>
                <input type="number" placeholder="H" defaultValue={effectiveH}
                  ref={resCustomHRef}
                  style={{ width: 50, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                />
                <button onClick={() => {
                  const w = parseInt(resCustomWRef.current?.value ?? '')
                  const h = parseInt(resCustomHRef.current?.value ?? '')
                  if (w > 0 && h > 0) { setResOverride({ w, h }); setShowResPicker(false) }
                }} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', background: 'none', color: '#4ade80', cursor: 'pointer' }}>OK</button>
              </div>
            </div>
          )}
        </span>
        {/* R1550: 씬뷰 노드 검색 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="🔍 노드 검색"
            value={svSearch}
            onChange={e => setSvSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSvSearch('') }}
            style={{
              width: 100, fontSize: 10, background: svSearchMatches.size > 0 ? 'rgba(88,166,255,0.08)' : 'var(--bg-primary)',
              border: `1px solid ${svSearchMatches.size > 0 ? '#58a6ff' : 'var(--border)'}`,
              color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px',
            }}
          />
          {svSearch && (
            <span style={{ position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: svSearchMatches.size > 0 ? '#58a6ff' : '#f85149' }}>
              {svSearchMatches.size}
            </span>
          )}
        </div>
        {/* R2581: 검색 결과 ← / → 순환 버튼 */}
        {svSearch.trim() && svSearchMatches.size > 0 && (() => {
          const orderedMatches = flatNodes.filter(fn => svSearchMatches.has(fn.node.uuid)).map(fn => fn.node.uuid)
          const navigate = (dir: 1 | -1) => {
            if (orderedMatches.length === 0) return
            svSearchMatchIdxRef.current = ((svSearchMatchIdxRef.current + dir) + orderedMatches.length) % orderedMatches.length
            onSelect(orderedMatches[svSearchMatchIdxRef.current])
          }
          return (
            <>
              <span onClick={() => navigate(-1)} title="이전 검색 결과 (R2581)"
                style={{ fontSize: 9, padding: '1px 4px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#58a6ff', userSelect: 'none', flexShrink: 0 }}>‹</span>
              <span onClick={() => navigate(1)} title="다음 검색 결과 (R2581)"
                style={{ fontSize: 9, padding: '1px 4px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#58a6ff', userSelect: 'none', flexShrink: 0 }}>›</span>
            </>
          )
        })()}
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(88,166,255,0.15)',
          color: '#58a6ff', flexShrink: 0,
        }}>
          CC {sceneFile.projectInfo.creatorVersion ?? (sceneFile.projectInfo.version === '3x' ? '3.x' : '2.x')}
        </span>
        <input
          type="color"
          value={bgColorOverride ?? bgColor.startsWith('rgb') ? (() => {
            const m = (bgColorOverride ?? bgColor).match(/\d+/g)
            if (!m) return '#1a1a2e'
            return `#${m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`
          })() : (bgColorOverride ?? bgColor)}
          title="배경색 변경 (뷰 전용)"
          onChange={e => setBgColorOverride(e.target.value)}
          onDoubleClick={() => setBgColorOverride(null)}
          style={{ width: 18, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
        />
        {/* ── 오버레이 패널 ── */}
        <span ref={overlayPanelRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setShowOverlayPanel(p => !p); setShowToolPanel(false) }}
            title="오버레이 표시 설정 패널"
            style={{ padding: '1px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showOverlayPanel ? '#58a6ff' : 'var(--border)'}`, background: showOverlayPanel ? 'rgba(88,166,255,0.15)' : 'none', color: showOverlayPanel ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
          >오버레이 {showOverlayPanel ? '▲' : '▼'}</button>
          {showOverlayPanel && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', minWidth: 300, maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* 기본 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>기본</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setBgPattern(p => p === 'solid' ? 'checker' : 'solid')} title={`배경 패턴: ${bgPattern === 'solid' ? '단색' : '체크무늬'}`} style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: bgPattern === 'checker' ? 'rgba(88,166,255,0.12)' : 'none', color: bgPattern === 'checker' ? '#58a6ff' : 'var(--text-muted)' }}>⊞ 배경</button>
                <button onClick={() => setShowGrid(g => !g)} title={`그리드 오버레이 (${snapSize}px)`} style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showGrid ? 'rgba(100,220,100,0.5)' : 'var(--border)'}`, background: showGrid ? 'rgba(100,220,100,0.1)' : 'none', color: showGrid ? 'rgba(100,220,100,0.9)' : 'var(--text-muted)' }}># 그리드</button>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>스냅</span>
                  {/* R1674: SceneView snap 간격 custom 입력 — datalist 로 프리셋 제공 */}
                  <datalist id="snap-size-list-panel"><option value={1}/><option value={5}/><option value={10}/><option value={25}/><option value={50}/><option value={100}/></datalist>
                  <input type="number" min={1} max={500} value={snapSize} list="snap-size-list-panel" onChange={e => { const v = parseInt(e.target.value); if (v > 0) setSnapSize(v) }} title={`Ctrl+드래그 스냅 크기: ${snapSize}px`} style={{ width: 36, fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', padding: '1px 3px', textAlign: 'center' }} />
                </span>
                <button onClick={() => setGridStyle(s => s === 'none' ? 'line' : s === 'line' ? 'dot' : 'none')} title={`그리드: ${gridStyle === 'none' ? '없음' : gridStyle === 'line' ? '선' : '점'}`} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: gridStyle !== 'none' ? 'rgba(88,166,255,0.12)' : 'none', color: gridStyle !== 'none' ? '#58a6ff' : 'var(--text-muted)' }}>{gridStyle === 'dot' ? '· 점' : '⊹ 선'}</button>
                <button onClick={() => setShowCrossGuide(g => !g)} title="중심선 가이드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCrossGuide ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showCrossGuide ? 'rgba(251,146,60,0.1)' : 'none', color: showCrossGuide ? 'rgba(251,146,60,0.9)' : 'var(--text-muted)' }}>⊕ 중심선</button>
                <button onClick={() => setShowEdgeGuides(g => !g)} title="엣지 가이드선" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showEdgeGuides ? 'rgba(129,140,248,0.5)' : 'var(--border)'}`, background: showEdgeGuides ? 'rgba(129,140,248,0.1)' : 'none', color: showEdgeGuides ? 'rgba(129,140,248,0.9)' : 'var(--text-muted)' }}>⊢ 엣지</button>
                <button onClick={() => addUserGuide('V')} title="수직 가이드라인 추가 (R2734)" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: showUserGuides ? 'rgba(251,146,60,0.9)' : 'var(--text-muted)', opacity: showUserGuides ? 1 : 0.5 }}>┃V</button>
                <button onClick={() => addUserGuide('H')} title="수평 가이드라인 추가 (R2734)" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: showUserGuides ? 'rgba(251,146,60,0.9)' : 'var(--text-muted)', opacity: showUserGuides ? 1 : 0.5 }}>━H</button>
                <button onClick={() => setShowUserGuides(g => !g)} title="가이드라인 표시/숨김 (R2734)" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showUserGuides ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showUserGuides ? 'rgba(251,146,60,0.2)' : 'none', color: showUserGuides ? 'rgba(251,146,60,0.9)' : 'var(--text-muted)' }}>🔸</button>
                <button onClick={clearUserGuides} title="가이드라인 전체 삭제 (R2734)" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>✕G</button>
                <button onClick={() => setShowRuler(r => !r)} title="눈금자" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showRuler ? 'rgba(88,166,255,0.12)' : 'none', color: showRuler ? '#58a6ff' : 'var(--text-muted)' }}>尺 눈금자</button>
                <button onClick={() => setShowCrosshair(v => !v)} title="마우스 크로스헤어" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCrosshair ? 'rgba(148,163,184,0.5)' : 'var(--border)'}`, background: showCrosshair ? 'rgba(148,163,184,0.12)' : 'none', color: showCrosshair ? '#94a3b8' : 'var(--text-muted)' }}>✛ 크로스</button>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>선택색</span>
                  <input type="color" value={selectionColor} title="선택 노드 테두리 색상 (더블클릭: 초기화)" onChange={e => setSelectionColor(e.target.value)} onDoubleClick={() => setSelectionColor('#58a6ff')} style={{ width: 18, height: 18, border: `2px solid ${selectionColor}`, borderRadius: 3, padding: 0, cursor: 'pointer', background: 'transparent' }} />
                </span>
              </div>
              {/* 렌더링 모드 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>렌더링 모드</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setWireframeMode(w => !w)} title="와이어프레임 모드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${wireframeMode ? '#58a6ff' : 'var(--border)'}`, background: wireframeMode ? 'rgba(88,166,255,0.12)' : 'none', color: wireframeMode ? '#58a6ff' : 'var(--text-muted)' }}>⬚ 와이어프레임</button>
                <button onClick={() => setSoloMode(m => !m)} title="솔로 모드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${soloMode ? '#f97316' : 'var(--border)'}`, background: soloMode ? 'rgba(249,115,22,0.12)' : 'none', color: soloMode ? '#f97316' : 'var(--text-muted)' }}>◎ 솔로</button>
                <button onClick={() => setDepthColorMode(d => !d)} title="Depth별 색조 시각화" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${depthColorMode ? '#a78bfa' : 'var(--border)'}`, background: depthColorMode ? 'rgba(167,139,250,0.12)' : 'none', color: depthColorMode ? '#a78bfa' : 'var(--text-muted)' }}>⧫ 깊이색</button>
                <button onClick={() => setDepthFilterMax(v => v === null ? 2 : null)} title={depthFilterMax !== null ? `깊이 필터 해제 (D${depthFilterMax})` : '깊이 필터'} style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${depthFilterMax !== null ? 'rgba(52,211,153,0.5)' : 'var(--border)'}`, background: depthFilterMax !== null ? 'rgba(52,211,153,0.1)' : 'none', color: depthFilterMax !== null ? '#34d399' : 'var(--text-muted)' }}>D{depthFilterMax !== null ? `≤${depthFilterMax}` : '∞'}</button>
                {depthFilterMax !== null && (<input type="range" min={0} max={10} value={depthFilterMax} onChange={e => setDepthFilterMax(parseInt(e.target.value))} title={`깊이 제한: D${depthFilterMax}`} style={{ width: 60, cursor: 'pointer', accentColor: '#34d399' }} />)}
                <button onClick={() => setShowColorViz(v => !v)} title="색상 tint 시각화" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showColorViz ? 'rgba(217,119,6,0.5)' : 'var(--border)'}`, background: showColorViz ? 'rgba(217,119,6,0.12)' : 'none', color: showColorViz ? '#d97706' : 'var(--text-muted)' }}>🎨 tint</button>
                <button onClick={() => setShowDepthHeat(v => !v)} title="깊이 히트맵" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showDepthHeat ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showDepthHeat ? 'rgba(251,146,60,0.1)' : 'none', color: showDepthHeat ? '#fb923c' : 'var(--text-muted)' }}>🌡 깊이열</button>
                <button onClick={() => setShowSizeHeat(v => !v)} title="크기 히트맵" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSizeHeat ? 'rgba(250,204,21,0.5)' : 'var(--border)'}`, background: showSizeHeat ? 'rgba(250,204,21,0.1)' : 'none', color: showSizeHeat ? '#facc15' : 'var(--text-muted)' }}>Sz 크기열</button>
                <button onClick={() => setShowInactiveDim(v => !v)} title="비활성 노드 반투명" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showInactiveDim ? 'rgba(148,163,184,0.5)' : 'var(--border)'}`, background: showInactiveDim ? 'rgba(148,163,184,0.12)' : 'none', color: showInactiveDim ? '#94a3b8' : 'var(--text-muted)' }}>⊡ 비활성dim</button>
              </div>
              {/* 레이블 오버레이 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>레이블</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowNodeNames(n => !n)} title="노드 이름 표시" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showNodeNames ? 'rgba(88,166,255,0.12)' : 'none', color: showNodeNames ? '#58a6ff' : 'var(--text-muted)' }}>T 노드이름</button>
                {showNodeNames && (<>
                  <span onClick={() => setLabelFontSize(s => Math.max(6, s - 1))} title="레이블 폰트 감소" style={{ fontSize: 9, cursor: 'pointer', color: 'var(--text-muted)', userSelect: 'none', padding: '0 2px' }}>A-</span>
                  <span style={{ fontSize: 8, color: '#555', minWidth: 14, textAlign: 'center' }}>{labelFontSize}</span>
                  <span onClick={() => setLabelFontSize(s => Math.min(20, s + 1))} title="레이블 폰트 증가" style={{ fontSize: 9, cursor: 'pointer', color: 'var(--text-muted)', userSelect: 'none', padding: '0 2px' }}>A+</span>
                </>)}
                <button onClick={() => setShowNameLabels(v => !v)} title="이름 텍스트 오버레이" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showNameLabels ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`, background: showNameLabels ? 'rgba(96,165,250,0.12)' : 'none', color: showNameLabels ? '#60a5fa' : 'var(--text-muted)' }}>이름</button>
                <button onClick={() => setShowLabelText(v => !v)} title="Label 텍스트 오버레이" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showLabelText ? 'rgba(139,92,246,0.5)' : 'var(--border)'}`, background: showLabelText ? 'rgba(139,92,246,0.12)' : 'none', color: showLabelText ? '#a78bfa' : 'var(--text-muted)' }}>T Label</button>
                <button onClick={() => setShowZOrder(n => !n)} title="z-order 인덱스" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showZOrder ? 'rgba(251,191,36,0.12)' : 'none', color: showZOrder ? '#fbbf24' : 'var(--text-muted)' }}># z순서</button>
                <button onClick={() => setShowSiblingGroup(s => !s)} title="형제 그룹 하이라이트" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSiblingGroup ? '#fbbf24' : 'var(--border)'}`, background: showSiblingGroup ? 'rgba(251,191,36,0.12)' : 'none', color: showSiblingGroup ? '#fbbf24' : 'var(--text-muted)' }}>G 형제</button>
                <button onClick={() => setShowSizeLabels(v => !v)} title="W×H 크기 레이블" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSizeLabels ? 'rgba(52,211,153,0.5)' : 'var(--border)'}`, background: showSizeLabels ? 'rgba(52,211,153,0.12)' : 'none', color: showSizeLabels ? '#34d399' : 'var(--text-muted)' }}>W×H</button>
                <button onClick={() => setShowSizeOverlay(v => !v)} title="노드 크기 텍스트" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSizeOverlay ? 'rgba(34,211,238,0.5)' : 'var(--border)'}`, background: showSizeOverlay ? 'rgba(34,211,238,0.12)' : 'none', color: showSizeOverlay ? '#22d3ee' : 'var(--text-muted)' }}>WH</button>
                <button onClick={() => setShowOpacityLabels(v => !v)} title="불투명도 α%" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showOpacityLabels ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, background: showOpacityLabels ? 'rgba(251,191,36,0.12)' : 'none', color: showOpacityLabels ? '#fbbf24' : 'var(--text-muted)' }}>α%</button>
                <button onClick={() => setShowOpacityOverlay(v => !v)} title="opacity 값" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showOpacityOverlay ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, background: showOpacityOverlay ? 'rgba(251,191,36,0.1)' : 'none', color: showOpacityOverlay ? '#fbbf24' : 'var(--text-muted)' }}>α</button>
                <button onClick={() => setShowOpacityHud(v => !v)} title="선택 노드 opacity HUD" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showOpacityHud ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, background: showOpacityHud ? 'rgba(251,191,36,0.1)' : 'none', color: showOpacityHud ? '#fbbf24' : 'var(--text-muted)' }}>op</button>
                <button onClick={() => setShowRotLabels(v => !v)} title="회전 레이블" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showRotLabels ? 'rgba(236,72,153,0.5)' : 'var(--border)'}`, background: showRotLabels ? 'rgba(236,72,153,0.12)' : 'none', color: showRotLabels ? '#ec4899' : 'var(--text-muted)' }}>∠°</button>
                <button onClick={() => setShowRotOverlay(v => !v)} title="회전각 텍스트" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showRotOverlay ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`, background: showRotOverlay ? 'rgba(167,139,250,0.1)' : 'none', color: showRotOverlay ? '#a78bfa' : 'var(--text-muted)' }}>∠</button>
                <button onClick={() => setShowScaleLabel(v => !v)} title="스케일 배수" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showScaleLabel ? 'rgba(250,204,21,0.5)' : 'var(--border)'}`, background: showScaleLabel ? 'rgba(250,204,21,0.12)' : 'none', color: showScaleLabel ? '#facc15' : 'var(--text-muted)' }}>×S</button>
                <button onClick={() => setShowScaleText(v => !v)} title="scale 값" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showScaleText ? 'rgba(34,211,238,0.5)' : 'var(--border)'}`, background: showScaleText ? 'rgba(34,211,238,0.1)' : 'none', color: showScaleText ? '#22d3ee' : 'var(--text-muted)' }}>S×</button>
                <button onClick={() => setShowPosText(v => !v)} title="position 텍스트" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showPosText ? 'rgba(52,211,153,0.5)' : 'var(--border)'}`, background: showPosText ? 'rgba(52,211,153,0.1)' : 'none', color: showPosText ? '#34d399' : 'var(--text-muted)' }}>xy</button>
                <button onClick={() => setShowDepthLabel(v => !v)} title="계층 깊이 D:N" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showDepthLabel ? 'rgba(134,239,172,0.5)' : 'var(--border)'}`, background: showDepthLabel ? 'rgba(134,239,172,0.12)' : 'none', color: showDepthLabel ? '#86efac' : 'var(--text-muted)' }}>D:</button>
              </div>
              {/* 배지 오버레이 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>배지</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowCompBadges(v => !v)} title="컴포넌트 아이콘 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCompBadges ? 'rgba(250,204,21,0.5)' : 'var(--border)'}`, background: showCompBadges ? 'rgba(250,204,21,0.12)' : 'none', color: showCompBadges ? '#facc15' : 'var(--text-muted)' }}>⚙ 컴포</button>
                <button onClick={() => setShowCompBadge(v => !v)} title="컴포넌트 타입 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCompBadge ? 'rgba(192,132,252,0.5)' : 'var(--border)'}`, background: showCompBadge ? 'rgba(192,132,252,0.12)' : 'none', color: showCompBadge ? '#c084fc' : 'var(--text-muted)' }}>CT</button>
                <button onClick={() => setShowCompCountBadge(v => !v)} title="컴포넌트 수 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCompCountBadge ? 'rgba(129,140,248,0.5)' : 'var(--border)'}`, background: showCompCountBadge ? 'rgba(129,140,248,0.1)' : 'none', color: showCompCountBadge ? '#818cf8' : 'var(--text-muted)' }}>C#</button>
                <button onClick={() => setShowTagBadge(v => !v)} title="tag 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showTagBadge ? 'rgba(56,189,248,0.5)' : 'var(--border)'}`, background: showTagBadge ? 'rgba(56,189,248,0.12)' : 'none', color: showTagBadge ? '#38bdf8' : 'var(--text-muted)' }}>#T</button>
                <button onClick={() => setShowLayerBadge(v => !v)} title="레이어 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showLayerBadge ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, background: showLayerBadge ? 'rgba(99,102,241,0.12)' : 'none', color: showLayerBadge ? '#6366f1' : 'var(--text-muted)' }}>L</button>
                <button onClick={() => setShowEventBadge(v => !v)} title="이벤트 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showEventBadge ? 'rgba(234,179,8,0.5)' : 'var(--border)'}`, background: showEventBadge ? 'rgba(234,179,8,0.12)' : 'none', color: showEventBadge ? '#eab308' : 'var(--text-muted)' }}>⚡</button>
                <button onClick={() => setShowChildCountBadge(v => !v)} title="자식 수 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showChildCountBadge ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`, background: showChildCountBadge ? 'rgba(167,139,250,0.12)' : 'none', color: showChildCountBadge ? '#a78bfa' : 'var(--text-muted)' }}>↳N</button>
                <button onClick={() => setShowColorSwatch(v => !v)} title="색상 스와치" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showColorSwatch ? 'rgba(244,114,182,0.5)' : 'var(--border)'}`, background: showColorSwatch ? 'rgba(244,114,182,0.12)' : 'none', color: showColorSwatch ? '#f472b6' : 'var(--text-muted)' }}>🎨 스와치</button>
                <button onClick={() => setShowSpriteName(v => !v)} title="Sprite 이름 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSpriteName ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showSpriteName ? 'rgba(251,146,60,0.1)' : 'none', color: showSpriteName ? '#fb923c' : 'var(--text-muted)' }}>Sp</button>
                <button onClick={() => setShowUuidBadge(v => !v)} title="UUID 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showUuidBadge ? 'rgba(100,116,139,0.5)' : 'var(--border)'}`, background: showUuidBadge ? 'rgba(100,116,139,0.1)' : 'none', color: showUuidBadge ? '#64748b' : 'var(--text-muted)' }}>ID</button>
                <button onClick={() => setShowDupNameOverlay(v => !v)} title="중복 이름 강조" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showDupNameOverlay ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showDupNameOverlay ? 'rgba(251,146,60,0.12)' : 'none', color: showDupNameOverlay ? '#fb923c' : 'var(--text-muted)' }}>=N</button>
                <button onClick={() => setShowZeroSizeWarn(v => !v)} title="크기 0 경고" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showZeroSizeWarn ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`, background: showZeroSizeWarn ? 'rgba(239,68,68,0.1)' : 'none', color: showZeroSizeWarn ? '#ef4444' : 'var(--text-muted)' }}>⚠</button>
                <button onClick={() => setShowNonDefaultAnchor(v => !v)} title="비기본 앵커 강조" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showNonDefaultAnchor ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, background: showNonDefaultAnchor ? 'rgba(251,191,36,0.1)' : 'none', color: showNonDefaultAnchor ? '#fbbf24' : 'var(--text-muted)' }}>⚓</button>
              </div>
              {/* 노드 관계 오버레이 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>노드 관계</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowAnchorOverlay(v => !v)} title="앵커 포인트 전체" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showAnchorOverlay ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showAnchorOverlay ? 'rgba(251,146,60,0.12)' : 'none', color: showAnchorOverlay ? '#fb923c' : 'var(--text-muted)' }}>⊕ 앵커전체</button>
                <button onClick={() => setShowAnchorDot(v => !v)} title="앵커 포인트 마커" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showAnchorDot ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showAnchorDot ? 'rgba(251,146,60,0.12)' : 'none', color: showAnchorDot ? '#fb923c' : 'var(--text-muted)' }}>⊕ 앵커점</button>
                <button onClick={() => setShowHierarchyLines(v => !v)} title="계층 연결선" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showHierarchyLines ? 'rgba(103,232,249,0.5)' : 'var(--border)'}`, background: showHierarchyLines ? 'rgba(103,232,249,0.12)' : 'none', color: showHierarchyLines ? '#67e8f9' : 'var(--text-muted)' }}>⊣ 계층선</button>
                <button onClick={() => setShowParentHighlight(v => !v)} title="부모 강조" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showParentHighlight ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showParentHighlight ? 'rgba(251,146,60,0.12)' : 'none', color: showParentHighlight ? '#fb923c' : 'var(--text-muted)' }}>⊘ 부모</button>
                <button onClick={() => setShowSiblingHighlight(v => !v)} title="형제 강조" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSiblingHighlight ? 'rgba(139,92,246,0.5)' : 'var(--border)'}`, background: showSiblingHighlight ? 'rgba(139,92,246,0.1)' : 'none', color: showSiblingHighlight ? '#8b5cf6' : 'var(--text-muted)' }}>≡ 형제</button>
                <button onClick={() => setShowRotArrow(v => !v)} title="회전 방향 화살표" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showRotArrow ? 'rgba(236,72,153,0.5)' : 'var(--border)'}`, background: showRotArrow ? 'rgba(236,72,153,0.12)' : 'none', color: showRotArrow ? '#ec4899' : 'var(--text-muted)' }}>↗R</button>
                <button onClick={() => setShowFlipOverlay(v => !v)} title="flip 노드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showFlipOverlay ? 'rgba(250,204,21,0.5)' : 'var(--border)'}`, background: showFlipOverlay ? 'rgba(250,204,21,0.12)' : 'none', color: showFlipOverlay ? '#facc15' : 'var(--text-muted)' }}>↔↕ flip</button>
                <button onClick={() => setShowRefArrows(v => !v)} title="uuid 참조 화살표" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showRefArrows ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`, background: showRefArrows ? 'rgba(249,115,22,0.1)' : 'none', color: showRefArrows ? '#f97316' : 'var(--text-muted)' }}>🔗 참조</button>
                <button onClick={() => setShowCenterDot(v => !v)} title="중심점 마커" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCenterDot ? 'rgba(248,113,113,0.5)' : 'var(--border)'}`, background: showCenterDot ? 'rgba(248,113,113,0.1)' : 'none', color: showCenterDot ? '#f87171' : 'var(--text-muted)' }}>· 중심점</button>
              </div>
              {/* 선택 오버레이 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>선택 오버레이</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowSelBBox(v => !v)} title="선택 BBox" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSelBBox ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`, background: showSelBBox ? 'rgba(96,165,250,0.12)' : 'none', color: showSelBBox ? '#60a5fa' : 'var(--text-muted)' }}>⬚ selBBox</button>
                <button onClick={() => setShowSelGroupBBox(v => !v)} title="선택 그룹 BBox" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSelGroupBBox ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`, background: showSelGroupBBox ? 'rgba(96,165,250,0.12)' : 'none', color: showSelGroupBBox ? '#60a5fa' : 'var(--text-muted)' }}>▣ 그룹BBox</button>
                <button onClick={() => setShowSelPolyline(v => !v)} title="선택 연결선" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSelPolyline ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`, background: showSelPolyline ? 'rgba(167,139,250,0.12)' : 'none', color: showSelPolyline ? '#a78bfa' : 'var(--text-muted)' }}>⌇ 연결선</button>
                <button onClick={() => setShowSelCenter(v => !v)} title="선택 중심 마커" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSelCenter ? 'rgba(52,211,153,0.5)' : 'var(--border)'}`, background: showSelCenter ? 'rgba(52,211,153,0.1)' : 'none', color: showSelCenter ? '#34d399' : 'var(--text-muted)' }}>⊕ 중심</button>
                <button onClick={() => setShowSelOrder(v => !v)} title="선택 순서 번호" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSelOrder ? 'rgba(52,211,153,0.5)' : 'var(--border)'}`, background: showSelOrder ? 'rgba(52,211,153,0.12)' : 'none', color: showSelOrder ? '#34d399' : 'var(--text-muted)' }}>① 순서</button>
                <button onClick={() => setShowSelAxisLine(v => !v)} title="선택 위치 가이드선" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSelAxisLine ? 'rgba(34,211,238,0.5)' : 'var(--border)'}`, background: showSelAxisLine ? 'rgba(34,211,238,0.1)' : 'none', color: showSelAxisLine ? '#22d3ee' : 'var(--text-muted)' }}>╋ 가이드선</button>
                <button onClick={() => setShowPairDist(v => !v)} title="노드 간 거리" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showPairDist ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`, background: showPairDist ? 'rgba(167,139,250,0.1)' : 'none', color: showPairDist ? '#a78bfa' : 'var(--text-muted)' }}>↔ 거리</button>
              </div>
              {/* 씬 가이드 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>씬 가이드</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowSafeZone(v => !v)} title="안전 영역 가이드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSafeZone ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, background: showSafeZone ? 'rgba(251,191,36,0.12)' : 'none', color: showSafeZone ? '#fbbf24' : 'var(--text-muted)' }}>☰ 안전영역</button>
                <button onClick={() => setShowRuleOfThirds(v => !v)} title="삼분법 가이드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showRuleOfThirds ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`, background: showRuleOfThirds ? 'rgba(167,139,250,0.12)' : 'none', color: showRuleOfThirds ? '#a78bfa' : 'var(--text-muted)' }}>⊞ 삼분법</button>
                <button onClick={() => setShowCustomRatio(v => !v)} title="커스텀 비율 가이드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCustomRatio ? 'rgba(234,179,8,0.5)' : 'var(--border)'}`, background: showCustomRatio ? 'rgba(234,179,8,0.12)' : 'none', color: showCustomRatio ? '#eab308' : 'var(--text-muted)' }}>⊞R 비율</button>
                {showCustomRatio && (<>
                  <input type="number" min={1} value={customRatioW} onChange={e => setCustomRatioW(Math.max(1, Number(e.target.value)))} style={{ width: 30, fontSize: 9, padding: '1px 2px' }} title="비율 W" />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>:</span>
                  <input type="number" min={1} value={customRatioH} onChange={e => setCustomRatioH(Math.max(1, Number(e.target.value)))} style={{ width: 30, fontSize: 9, padding: '1px 2px' }} title="비율 H" />
                </>)}
                <button onClick={() => setShowOOBHighlight(v => !v)} title="경계 초과 노드 강조" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showOOBHighlight ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`, background: showOOBHighlight ? 'rgba(239,68,68,0.12)' : 'none', color: showOOBHighlight ? '#ef4444' : 'var(--text-muted)' }}>⬚ 경계초과</button>
                <button onClick={() => setShowSceneBBox(v => !v)} title="씬 전체 바운딩박스" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSceneBBox ? 'rgba(248,113,113,0.5)' : 'var(--border)'}`, background: showSceneBBox ? 'rgba(248,113,113,0.12)' : 'none', color: showSceneBBox ? '#f87171' : 'var(--text-muted)' }}>⊏ 씬BBox</button>
              </div>
              {/* 컴포넌트 타입 필터 */}
              {(() => {
                const ignore = new Set(['cc.Node','cc.UITransform','cc.UIOpacity','cc.Widget','cc.BlockInputEvents','cc.Canvas'])
                const typeCounts = new Map<string, number>()
                flatNodes.forEach(fn => fn.node.components.forEach(c => { if (!ignore.has(c.type)) typeCounts.set(c.type, (typeCounts.get(c.type) ?? 0) + 1) }))
                const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)
                if (types.length === 0) return null
                const shortName = (t: string) => t.replace('cc.','').replace('dragonBones.','').slice(0, 8)
                return (<>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>컴포넌트 필터</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {types.map(t => (
                      <button key={t} onClick={() => setCompFilterType(v => v === t ? null : t)}
                        title={`${t} 노드만 강조`}
                        style={{ padding: '1px 4px', fontSize: 8, borderRadius: 3, cursor: 'pointer', border: `1px solid ${compFilterType === t ? 'rgba(139,92,246,0.6)' : 'var(--border)'}`, background: compFilterType === t ? 'rgba(139,92,246,0.15)' : 'none', color: compFilterType === t ? '#a78bfa' : 'var(--text-muted)' }}
                      >{shortName(t)}</button>
                    ))}
                  </div>
                </>)
              })()}
            </div>
          )}
        </span>
        {/* ── 도구 패널 ── */}
        <span ref={toolPanelRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setShowToolPanel(p => !p); setShowOverlayPanel(false) }}
            title="뷰/도구 패널"
            style={{ padding: '1px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showToolPanel ? '#58a6ff' : 'var(--border)'}`, background: showToolPanel ? 'rgba(88,166,255,0.15)' : 'none', color: showToolPanel ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
          >도구 {showToolPanel ? '▲' : '▼'}</button>
          {showToolPanel && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', minWidth: 200, maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* 뷰 이동 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>뷰 이동</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={handleFit} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>⊞ Fit</button>
                <button onClick={panToCenter} disabled={!selectedUuid && multiSelected.size === 0} title="선택 노드 중심으로 이동" style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: !selectedUuid && multiSelected.size === 0 ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'none', color: !selectedUuid && multiSelected.size === 0 ? 'var(--text-muted-disabled)' : 'var(--text-muted)', opacity: !selectedUuid && multiSelected.size === 0 ? 0.5 : 1 }}>⊕C 중심이동</button>
                {/* R2540: Go-to XY — CC 좌표 직접 입력으로 뷰 이동 */}
                <input placeholder="x,y 이동" title="R2540 Go-to XY: CC 좌표로 이동 (예: 100,-50) Enter"
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    const svg = svgRef.current; if (!svg) return
                    const val = (e.target as HTMLInputElement).value.trim()
                    const m = val.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/); if (!m) return
                    const ccX = parseFloat(m[1]), ccY = parseFloat(m[2])
                    const rect = svg.getBoundingClientRect()
                    const svgPos = ccToSvg(ccX, ccY)
                    const z = viewRef.current.zoom
                    setView(v => ({ ...v, offsetX: rect.width / 2 - svgPos.x * z, offsetY: rect.height / 2 - svgPos.y * z }))
                    ;(e.target as HTMLInputElement).value = ''
                    ;(e.target as HTMLInputElement).blur()
                  }}
                  style={{ width: 60, fontSize: 8, padding: '0 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 2, height: 16 }}
                />
              </div>
              {/* 북마크 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>뷰 북마크 (Ctrl+클릭: 저장)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {viewBookmarks.map((bm, i) => (
                  <button key={i}
                    onClick={e => { if (e.ctrlKey || e.metaKey) setViewBookmarks(prev => { const n=[...prev]; n[i]=viewRef.current; return n }); else if (bm) setView(bm) }}
                    title={bm ? `북마크 ${i+1} 복원 (Ctrl: 저장)` : `북마크 ${i+1} 비어있음`}
                    style={{ padding: '0 6px', fontSize: 9, borderRadius: 2, cursor: 'pointer', border: `1px solid ${bm ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: bm ? 'rgba(251,146,60,0.08)' : 'none', color: bm ? '#fb923c' : 'var(--text-muted)', lineHeight: '18px' }}
                  >북마크 {i+1}</button>
                ))}
              </div>
              {/* 편집 잠금 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>잠금</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setViewLock(l => !l)} title={viewLock ? '편집 잠금 해제' : '편집 잠금'} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${viewLock ? '#f85149' : 'var(--border)'}`, background: viewLock ? 'rgba(248,81,73,0.12)' : 'none', color: viewLock ? '#f85149' : 'var(--text-muted)' }}>{viewLock ? '🔒 잠금됨' : '🔓 잠금해제'}</button>
                {/* R2711: 노드 잠금 버튼 */}
                {!viewLock && selectedUuid && (
                  <button onClick={() => toggleLock(selectedUuid)} title={lockedUuids.has(selectedUuid) ? '노드 잠금 해제' : '노드 잠금'} style={{ fontSize: 9, padding: '1px 5px', background: lockedUuids.has(selectedUuid) ? 'rgba(251,191,36,0.12)' : 'var(--bg-secondary)', border: `1px solid ${lockedUuids.has(selectedUuid) ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, borderRadius: 3, color: lockedUuids.has(selectedUuid) ? '#fbbf24' : 'var(--text-muted)', cursor: 'pointer' }}>{lockedUuids.has(selectedUuid) ? '🔒 노드잠금' : '🔓 노드잠금'}</button>
                )}
                <button onClick={() => setHideInactiveNodes(h => !h)} title={hideInactiveNodes ? '비활성 노드 표시' : '비활성 노드 숨기기'} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${hideInactiveNodes ? '#fbbf24' : 'var(--border)'}`, background: hideInactiveNodes ? 'rgba(251,191,36,0.12)' : 'none', color: hideInactiveNodes ? '#fbbf24' : 'var(--text-muted)' }}>👁 비활성 숨기기</button>
              </div>
              {/* 미니맵/도구 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>도구</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowMinimap(m => !m)} title="미니맵" style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showMinimap ? 'rgba(88,166,255,0.12)' : 'none', color: showMinimap ? '#58a6ff' : 'var(--text-muted)' }}>⊟ 미니맵</button>
                <button onClick={() => { setMeasureMode(m => { if (m) setMeasureLine(null); return !m }); measureStartRef.current = null }} title={measureMode ? '측정 도구 종료' : '거리 측정'} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${measureMode ? '#ff6b6b' : 'var(--border)'}`, background: measureMode ? 'rgba(255,107,107,0.12)' : 'none', color: measureMode ? '#ff6b6b' : 'var(--text-muted)' }}>📏 거리측정</button>
                <button onClick={() => refImgSrc ? setRefImgSrc(null) : refImgInputRef.current?.click()} title={refImgSrc ? '레퍼런스 이미지 제거' : '레퍼런스 이미지 로드'} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: refImgSrc ? 'rgba(100,200,100,0.12)' : 'none', color: refImgSrc ? '#4ade80' : 'var(--text-muted)' }}>📐 레퍼런스</button>
                {refImgSrc && (<input type="range" min={0.05} max={1} step={0.05} value={refImgOpacity} onChange={e => setRefImgOpacity(parseFloat(e.target.value))} title={`투명도 ${Math.round(refImgOpacity * 100)}%`} style={{ width: 60 }} />)}
                <button onClick={handleSvgExport} title="씬 SVG 파일 내보내기" style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>SVG</button>
                {cameraFrames.length > 0 && (
                  <button onClick={() => setShowCameraFrames(v => !v)} title={showCameraFrames ? '카메라 프레임 숨기기' : '카메라 프레임 표시'} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCameraFrames ? 'rgba(255,200,60,0.5)' : 'var(--border)'}`, background: showCameraFrames ? 'rgba(255,200,60,0.1)' : 'none', color: showCameraFrames ? 'rgba(255,200,60,0.9)' : 'var(--text-muted)' }}>📷</button>
                )}
                <button onClick={e => handleScreenshotAI(e)} title="씬 스크린샷 → Claude 분석 / Shift+클릭: PNG 저장" disabled={screenshotSending} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: screenshotSending ? 'wait' : 'pointer', border: '1px solid var(--border)', background: screenshotSending ? 'rgba(255,200,50,0.12)' : 'none', color: screenshotSending ? '#fbbf24' : 'var(--text-muted)', opacity: screenshotSending ? 0.6 : 1 }}>{screenshotSending ? '⟳' : '📷'} 스크린샷</button>
              </div>
            </div>
          )}
        </span>
        {/* R2543: 뷰 북마크 1/2/3 (Ctrl+클릭 저장, 클릭 복원) */}
        {viewBookmarks.map((bm, i) => (
          <button key={i}
            onClick={e => { if (e.ctrlKey || e.metaKey) setViewBookmarks(prev => { const n=[...prev]; n[i]=viewRef.current; return n }); else if (bm) setView(bm) }}
            title={bm ? `북마크 ${i+1} 복원 (Ctrl+클릭: 현재 뷰 저장) (R2543)` : `북마크 ${i+1} 비어있음 — Ctrl+클릭으로 저장 (R2543)`}
            style={{ padding: '0 4px', fontSize: 8, borderRadius: 2, cursor: 'pointer', border: `1px solid ${bm ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: bm ? 'rgba(251,146,60,0.08)' : 'none', color: bm ? '#fb923c' : 'var(--text-muted)', lineHeight: '14px' }}
          >{i+1}</button>
        ))}
        <button
          onClick={handleFit}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
        >
          ⊞ Fit
        </button>
        {/* R2703: 선택 노드 중심으로 뷰 팬 이동 */}
        <button
          onClick={panToCenter}
          disabled={!selectedUuid && multiSelected.size === 0}
          title="선택된 노드(들)의 중심으로 뷰 이동 (R2703)"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: !selectedUuid && multiSelected.size === 0 ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'none', color: !selectedUuid && multiSelected.size === 0 ? 'var(--text-muted-disabled)' : 'var(--text-muted)', opacity: !selectedUuid && multiSelected.size === 0 ? 0.5 : 1 }}
        >
          ⊕C
        </button>
        <button
          onClick={() => setView(v => ({ ...v, zoom: Math.min(5, v.zoom * 1.25) }))}
          style={{ padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
        >+</button>
        {/* R1545: 줌 % 클릭 → 인라인 입력 */}
        {editingZoom ? (
          <input
            autoFocus
            defaultValue={Math.round(view.zoom * 100)}
            onBlur={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v > 0) setView(vv => ({ ...vv, zoom: Math.max(0.05, Math.min(10, v / 100)) }))
              setEditingZoom(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingZoom(false)
            }}
            style={{ width: 36, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid #58a6ff', color: '#58a6ff', borderRadius: 3, padding: '1px 3px', textAlign: 'center' }}
          />
        ) : (
          <span
            onClick={() => setEditingZoom(true)}
            title="클릭하여 줌 % 직접 입력 (더블클릭: 1:1 리셋)"
            onDoubleClick={() => setView(v => ({ ...v, zoom: 1 }))}
            style={{ fontSize: 9, color: 'var(--text-muted)', width: 30, textAlign: 'center', cursor: 'text' }}
          >
            {Math.round(view.zoom * 100)}%
          </span>
        )}
        <button
          onClick={() => setView(v => ({ ...v, zoom: Math.max(0.1, v.zoom / 1.25) }))}
          style={{ padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
        >−</button>
        {/* R1601: 줌 퀵점프 버튼 */}
        {([0.5, 1, 2] as const).map(z => (
          <button key={z}
            onClick={() => setView(v => ({ ...v, zoom: z }))}
            title={`줌 ${z * 100}%로 고정`}
            style={{ padding: '0 3px', fontSize: 8, borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', background: Math.abs(view.zoom - z) < 0.01 ? 'rgba(88,166,255,0.15)' : 'none', color: Math.abs(view.zoom - z) < 0.01 ? '#58a6ff' : 'var(--text-muted)', lineHeight: '14px' }}
          >{z === 1 ? '1×' : z === 0.5 ? '½' : '2×'}</button>
        ))}
        {/* R1692: 시각적 숨김 노드 카운트 + 초기화 */}
        {hiddenUuids.size > 0 && (
          <button
            onClick={() => setHiddenUuids(new Set())}
            title={`시각적으로 숨긴 노드 ${hiddenUuids.size}개 — 클릭하여 모두 표시 (R1692)`}
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,146,60,0.5)', background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}
          >👁‍🗨 {hiddenUuids.size}</button>
        )}
        {/* R1693/R2544: 핀 마커 카운트 + 드롭다운 패널 */}
        {pinMarkers.length > 0 && (
          <span style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowPinPanel(p => !p)}
              title={`핀 마커 ${pinMarkers.length}개 — 클릭: 목록 패널 (R2544) / Shift+클릭: 전체 삭제`}
              onClickCapture={e => { if (e.shiftKey) { e.stopPropagation(); setPinMarkers([]); setShowPinPanel(false) } }}
              style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showPinPanel ? '#f472b6' : 'rgba(244,114,182,0.5)'}`, background: showPinPanel ? 'rgba(244,114,182,0.25)' : 'rgba(244,114,182,0.12)', color: '#f472b6' }}
            >📌 {pinMarkers.length}</button>
            {showPinPanel && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: 4, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                {pinMarkers.map(pm => (
                  <div key={pm.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span onClick={() => {
                      const svg = svgRef.current; if (!svg) return
                      const rect = svg.getBoundingClientRect()
                      const sp = ccToSvg(pm.ccX, pm.ccY)
                      const z = viewRef.current.zoom
                      setView(v => ({ ...v, offsetX: rect.width / 2 - sp.x * z, offsetY: rect.height / 2 - sp.y * z }))
                      setShowPinPanel(false)
                    }} title="이 핀으로 이동" style={{ flex: 1, cursor: 'pointer', fontSize: 9, color: '#f472b6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pm.label ?? `${pm.ccX},${pm.ccY}`}
                    </span>
                    <span onClick={() => setPinMarkers(prev => prev.filter(p => p.id !== pm.id))} style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 8, flexShrink: 0 }}>✕</span>
                  </div>
                ))}
                <div onClick={() => { setPinMarkers([]); setShowPinPanel(false) }} style={{ cursor: 'pointer', fontSize: 8, color: 'var(--text-muted)', paddingTop: 4, textAlign: 'center' }}>전체 삭제</div>
              </div>
            )}
          </span>
        )}
        {/* R2329: 선택 이력 이전/다음 버튼 (R1705 Alt+←/→ UI 연동) */}
        {selHistoryRef.current.length > 1 && (<>
          <button
            onClick={() => {
              const hist = selHistoryRef.current
              const idx = selHistoryIdxRef.current
              if (idx < hist.length - 1) {
                const newIdx = idx + 1
                selHistoryIdxRef.current = newIdx
                navSkipRef.current = true
                onSelect(hist[newIdx])
              }
            }}
            disabled={selHistoryIdxRef.current >= selHistoryRef.current.length - 1}
            title="이전 선택으로 (Alt+←)"
            style={{ padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: selHistoryIdxRef.current >= selHistoryRef.current.length - 1 ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'none', color: selHistoryIdxRef.current >= selHistoryRef.current.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: selHistoryIdxRef.current >= selHistoryRef.current.length - 1 ? 0.3 : 1 }}
          >←</button>
          <button
            onClick={() => {
              const idx = selHistoryIdxRef.current
              if (idx > 0) {
                const newIdx = idx - 1
                selHistoryIdxRef.current = newIdx
                navSkipRef.current = true
                onSelect(selHistoryRef.current[newIdx])
              }
            }}
            disabled={selHistoryIdxRef.current <= 0}
            title="다음 선택으로 (Alt+→)"
            style={{ padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: selHistoryIdxRef.current <= 0 ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'none', color: selHistoryIdxRef.current <= 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: selHistoryIdxRef.current <= 0 ? 0.3 : 1 }}
          >→</button>
          {/* R2707: 선택 히스토리 팝업 버튼 */}
          <span style={{ position: 'relative' }}>
            <button
              ref={histPopupBtnRef}
              onClick={() => setHistPopupOpen(prev => !prev)}
              title="선택 히스토리 (R2707)"
              style={{ padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer', border: `1px solid ${histPopupOpen ? '#58a6ff' : 'var(--border)'}`, background: histPopupOpen ? 'rgba(88,166,255,0.12)' : 'none', color: histPopupOpen ? '#58a6ff' : 'var(--text-muted)' }}
            >⏱</button>
            {histPopupOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, zIndex: 250, minWidth: 160, maxWidth: 260, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {selHistoryRef.current.slice(0, 8).map((uuid, i) => {
                  const fn = flatNodes.find(f => f.node.uuid === uuid)
                  const label = fn ? fn.node.name : uuid.slice(0, 8)
                  return (
                    <div
                      key={uuid}
                      onClick={() => { onSelect(uuid); setHistPopupOpen(false) }}
                      style={{ padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: uuid === selectedUuid ? 'var(--text)' : 'var(--text-muted)', background: uuid === selectedUuid ? 'rgba(88,166,255,0.1)' : 'transparent', borderBottom: i < Math.min(selHistoryRef.current.length, 8) - 1 ? '1px solid var(--border)' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(88,166,255,0.15)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = uuid === selectedUuid ? 'rgba(88,166,255,0.1)' : 'transparent' }}
                    >
                      <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 9 }}>{i + 1}</span>{label}
                    </div>
                  )
                })}
              </div>
            )}
          </span>
        </>)}
        {/* R2532: 선택 노드 위치 정수화 (snap-to-pixel) */}
        {(selectedUuid || multiSelected.size > 0) && (onMove || onMultiMove) && (() => {
          const targets = multiSelected.size > 0 ? [...multiSelected] : (selectedUuid ? [selectedUuid] : [])
          return (
            <button
              onClick={() => {
                const moves = targets.flatMap(uid => {
                  const fn = flatNodes.find(f => f.node.uuid === uid)
                  if (!fn) return []
                  const pos = fn.node.position as { x: number; y: number; z?: number }
                  const rx = Math.round(pos.x), ry = Math.round(pos.y)
                  if (rx === pos.x && ry === pos.y) return []
                  return [{ uuid: uid, x: rx, y: ry }]
                })
                if (moves.length === 0) return
                if (moves.length === 1) onMove?.(moves[0].uuid, moves[0].x, moves[0].y)
                else onMultiMove?.(moves)
              }}
              title={`선택 노드 위치 정수화 — position.x/y를 Math.round() 적용 (R2532)`}
              style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
            >⊹px</button>
          )
        })()}
        {/* R2555: 같은 이름 노드 순환 선택 */}
        {selectedUuid && (() => {
          const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
          if (!fn) return null
          const sameNameNodes = flatNodes.filter(f => f.node.name === fn.node.name)
          if (sameNameNodes.length <= 1) return null
          const curIdx = sameNameNodes.findIndex(f => f.node.uuid === selectedUuid)
          return (
            <button
              onClick={() => {
                const nextIdx = (curIdx + 1) % sameNameNodes.length
                onSelect(sameNameNodes[nextIdx].node.uuid)
              }}
              title={`같은 이름 "${fn.node.name}" 노드 순환 선택 (${curIdx + 1}/${sameNameNodes.length}) (R2555)`}
              style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.4)', background: 'none', color: '#fbbf24' }}
            >↻{sameNameNodes.length}</button>
          )
        })()}
        {/* R2537: 선택 노드 W/H 인라인 편집 */}
        {selectedUuid && onResize && (() => {
          const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
          if (!fn) return null
          const w = Math.round(fn.node.size?.x ?? fn.node.size?.width ?? 0)
          const h = Math.round(fn.node.size?.y ?? fn.node.size?.height ?? 0)
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>W</span>
              <input type="number" defaultValue={w} key={`w-${selectedUuid}-${w}`}
                onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0 && v !== w) onResize!(selectedUuid, v, h) }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) onResize!(selectedUuid, v, h); (e.target as HTMLInputElement).blur() } }}
                title={`선택 노드 너비 인라인 편집 (R2537)`}
                style={{ width: 38, fontSize: 9, padding: '0 2px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }} />
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>H</span>
              <input type="number" defaultValue={h} key={`h-${selectedUuid}-${h}`}
                onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0 && v !== h) onResize!(selectedUuid, w, v) }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) onResize!(selectedUuid, w, v); (e.target as HTMLInputElement).blur() } }}
                title={`선택 노드 높이 인라인 편집 (R2537)`}
                style={{ width: 38, fontSize: 9, padding: '0 2px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }} />
            </span>
          )
        })()}
        {/* R2534: 선택 노드 회전 리셋(0°) + ±90° 버튼 */}
        {selectedUuid && onRotate && (() => {
          const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
          if (!fn) return null
          const rot = typeof fn.node.rotation === 'number' ? fn.node.rotation : (fn.node.rotation as { x: number; y: number; z: number })?.z ?? 0
          return (
            <>
              <button onClick={() => onRotate!(selectedUuid, rot - 90)}
                title="반시계 90° 회전 (R2534)" style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>↺90</button>
              <button onClick={() => onRotate!(selectedUuid, rot + 90)}
                title="시계 90° 회전 (R2534)" style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>↻90</button>
              {rot !== 0 && (
                <button onClick={() => onRotate!(selectedUuid, 0)}
                  title={`회전 리셋 (현재 ${Math.round(rot)}°→0°) (R2534)`} style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,146,60,0.4)', background: 'none', color: '#fb923c' }}>∠0</button>
              )}
            </>
          )
        })()}
        {/* R2549: 선택 노드 형제 순서 맨 앞/뒤 이동 버튼 */}
        {selectedUuid && onReorderExtreme && (() => {
          const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
          if (!fn || fn.siblingTotal <= 1) return null
          return (
            <>
              {fn.siblingIdx > 0 && (
                <button onClick={() => onReorderExtreme!(selectedUuid, 'first')}
                  title="맨 뒤로 (형제 중 첫 번째 — CC 렌더 순서상 뒤) (R2549)"
                  style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>⤒</button>
              )}
              {fn.siblingIdx < fn.siblingTotal - 1 && (
                <button onClick={() => onReorderExtreme!(selectedUuid, 'last')}
                  title="맨 앞으로 (형제 중 마지막 — CC 렌더 순서상 앞) (R2549)"
                  style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>⤓</button>
              )}
            </>
          )
        })()}
        {/* R1474: 씬뷰 스크린샷 → Claude AI 분석 */}
        <button
          onClick={e => handleScreenshotAI(e)}
          title="씬 스크린샷 → Claude 비전 분석 / Shift+클릭: PNG 저장 (R1708)"
          disabled={screenshotSending}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: screenshotSending ? 'wait' : 'pointer', border: '1px solid var(--border)', background: screenshotSending ? 'rgba(255,200,50,0.12)' : 'none', color: screenshotSending ? '#fbbf24' : 'var(--text-muted)', opacity: screenshotSending ? 0.6 : 1 }}
        >{screenshotSending ? '⟳' : '📷'}</button>
        {/* R2558: 씬 통계 팝업 버튼 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSceneStats(v => !v)}
            title="씬 통계 팝업 — 노드/컴포넌트 수, 활성 여부 (R2558)"
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSceneStats ? 'rgba(88,166,255,0.5)' : 'var(--border)'}`, background: showSceneStats ? 'rgba(88,166,255,0.1)' : 'none', color: showSceneStats ? '#58a6ff' : 'var(--text-muted)' }}
          >ⓘ</button>
          {showSceneStats && (() => {
            const total = flatNodes.length
            const activeCount = flatNodes.filter(fn => fn.node.active !== false).length
            const compCounts = new Map<string, number>()
            flatNodes.forEach(fn => fn.node.components.forEach(c => { if (c.type !== 'cc.Node') compCounts.set(c.type, (compCounts.get(c.type) ?? 0) + 1) }))
            const topComps = [...compCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8)
            const maxDepth = Math.max(...flatNodes.map(fn => fn.depth), 0)
            return (
              <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 60, marginTop: 4, background: 'rgba(10,14,28,0.95)', border: '1px solid rgba(88,166,255,0.3)', borderRadius: 5, padding: '8px 10px', minWidth: 160, fontSize: 9, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <div style={{ fontWeight: 700, marginBottom: 5, color: '#c9d1d9' }}>씬 통계 (R2558)</div>
                <div style={{ color: '#58a6ff' }}>노드: {total}개 (활성 {activeCount} / 비활성 {total - activeCount})</div>
                <div style={{ color: '#aaa', marginTop: 2 }}>최대 깊이: D{maxDepth}</div>
                <div style={{ marginTop: 5, color: '#94a3b8', fontWeight: 600 }}>컴포넌트 Top 8</div>
                {topComps.map(([t, n]) => (
                  <div key={t} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#aaa', marginTop: 1 }}>
                    <span>{t.replace('cc.','').replace('dragonBones.','dB.')}</span>
                    <span style={{ color: '#58a6ff' }}>{n}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
        {/* R1530: hidden file input for ref image */}
        <input ref={refImgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = ev => setRefImgSrc(ev.target?.result as string)
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />
        {/* R1486: 다중 선택 정렬 툴바 */}
        {multiSelected.size > 1 && (() => {
          const selNodes = flatNodes.filter(fn => multiSelected.has(fn.node.uuid))
          const alignBtn = (label: string, title: string, getMoves: () => Array<{ uuid: string; x: number; y: number }>) => (
            <button
              key={label}
              title={title}
              onClick={() => { const moves = getMoves(); if (moves.length > 0) onMultiMove?.(moves) }}
              style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid #404060', background: 'rgba(88,166,255,0.15)', color: '#88aaff' }}
            >{label}</button>
          )
          const xs = selNodes.map(fn => (fn.node.position as { x: number }).x)
          const ys = selNodes.map(fn => (fn.node.position as { y: number }).y)
          const minX = Math.min(...xs), maxX = Math.max(...xs)
          const minY = Math.min(...ys), maxY = Math.max(...ys)
          const avgX = xs.reduce((a, b) => a + b, 0) / xs.length
          const avgY = ys.reduce((a, b) => a + b, 0) / ys.length
          const sortedByX = [...selNodes].sort((a, b) => (a.node.position as { x: number }).x - (b.node.position as { x: number }).x)
          const sortedByY = [...selNodes].sort((a, b) => (a.node.position as { y: number }).y - (b.node.position as { y: number }).y)
          return <>
            <span style={{ width: 1, height: 12, background: 'var(--border)', flexShrink: 0 }} />
            {alignBtn('◂|', '좌측 맞춤', () => selNodes.map(fn => ({ uuid: fn.node.uuid, x: minX, y: (fn.node.position as { y: number }).y })))}
            {alignBtn('|▸', '우측 맞춤', () => selNodes.map(fn => ({ uuid: fn.node.uuid, x: maxX, y: (fn.node.position as { y: number }).y })))}
            {alignBtn('↔', 'X 중앙 맞춤', () => selNodes.map(fn => ({ uuid: fn.node.uuid, x: avgX, y: (fn.node.position as { y: number }).y })))}
            {alignBtn('▴—', '상단 맞춤', () => selNodes.map(fn => ({ uuid: fn.node.uuid, x: (fn.node.position as { x: number }).x, y: maxY })))}
            {alignBtn('—▾', '하단 맞춤', () => selNodes.map(fn => ({ uuid: fn.node.uuid, x: (fn.node.position as { x: number }).x, y: minY })))}
            {alignBtn('↕', 'Y 중앙 맞춤', () => selNodes.map(fn => ({ uuid: fn.node.uuid, x: (fn.node.position as { x: number }).x, y: avgY })))}
            {selNodes.length >= 3 && alignBtn('⇔', '수평 간격 균등', () => {
              const gap = (maxX - minX) / (sortedByX.length - 1)
              return sortedByX.map((fn, i) => ({ uuid: fn.node.uuid, x: minX + gap * i, y: (fn.node.position as { y: number }).y }))
            })}
            {selNodes.length >= 3 && alignBtn('⇕', '수직 간격 균등', () => {
              const gap = (maxY - minY) / (sortedByY.length - 1)
              return sortedByY.map((fn, i) => ({ uuid: fn.node.uuid, x: (fn.node.position as { x: number }).x, y: minY + gap * i }))
            })}
          </>
        })()}
        {/* R2550: 다중 선택 일괄 잠금/해제 버튼 */}
        {multiSelected.size >= 2 && (() => {
          const allLocked = [...multiSelected].every(u => lockedUuids.has(u))
          const anyLocked = [...multiSelected].some(u => lockedUuids.has(u))
          return (
            <button
              onClick={() => {
                setLockedUuids(prev => {
                  const next = new Set(prev)
                  if (anyLocked) [...multiSelected].forEach(u => next.delete(u))
                  else [...multiSelected].forEach(u => next.add(u))
                  localStorage.setItem('sv-locked-uuids', JSON.stringify([...next]))
                  return next
                })
              }}
              title={`선택 ${multiSelected.size}개 노드 일괄 ${anyLocked ? '잠금 해제' : '잠금'} (R2550)`}
              style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${allLocked ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, background: allLocked ? 'rgba(251,191,36,0.1)' : 'none', color: allLocked ? '#fbbf24' : 'var(--text-muted)' }}
            >{allLocked ? '🔒' : anyLocked ? '🔓±' : '🔒'}</button>
          )
        })()}
        {/* R2466: 다중 선택 그룹화 버튼 */}
        {multiSelected.size >= 2 && onGroupNodes && (
          <button
            onClick={() => onGroupNodes(Array.from(multiSelected))}
            title={`선택 ${multiSelected.size}개 노드를 Group 노드 아래로 묶기 (R2466)`}
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.5)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
          >📦</button>
        )}
        {/* R1599: 두 노드 선택 시 거리 표시 */}
        {multiSelected.size === 2 && (() => {
          const [a, b] = flatNodes.filter(fn => multiSelected.has(fn.node.uuid))
          if (!a || !b) return null
          const dx = a.worldX - b.worldX
          const dy = a.worldY - b.worldY
          const dist = Math.sqrt(dx * dx + dy * dy)
          return <span style={{ fontSize: 9, color: '#aaa', marginLeft: 4 }} title="두 노드 중심 간 거리">↔ {dist.toFixed(1)}px</span>
        })()}
        {/* R1504: 새 노드 추가 */}
        {onAddNode && (
          <button
            onClick={() => onAddNode(selectedUuid, undefined)}
            title={selectedUuid ? '선택된 노드 하위에 새 노드 추가 (Ctrl+N)' : '루트 하위에 새 노드 추가 (Ctrl+N)'}
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontWeight: 'bold' }}
          >＋</button>
        )}
        <button
          onClick={() => setShowShortcutOverlay(v => !v)}
          title="단축키 목록"
          style={{ fontSize: 10, padding: '1px 5px', background: showShortcutOverlay ? '#3b82f6' : '#374151', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', position: 'relative' }}
        >
          ?
          {showShortcutOverlay && (
            <div id="sc-shortcut-popup" style={{
              position: 'absolute', bottom: '110%', right: 0, background: '#1e293b', border: '1px solid #334155',
              borderRadius: 6, padding: '8px 12px', zIndex: 200, minWidth: 260, textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', pointerEvents: 'all'
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>단축키</div>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {[
                    ['Ctrl+D', '노드 복제'],
                    ['H', 'active 토글'],
                    ['Ctrl+↑/↓', '형제 순서 이동'],
                    ['Home/End', '맨 앞/뒤 이동'],
                    ['Alt+←/→', '선택 히스토리'],
                    ['Ctrl+P', '핀 마커 토글'],
                    ['G', '그룹화'],
                    ['M', '거리 측정 도구'],
                    ['Ctrl+A', '전체 선택'],
                    ['Del', '다중 삭제'],
                    ['Ctrl+Z/Y', 'Undo/Redo'],
                    ['1/2/3', '뷰 북마크'],
                    ['Shift+클릭', '다중 선택'],
                    ['Esc', '선택 해제'],
                  ].map(([key, desc]) => (
                    <tr key={key}>
                      <td style={{ padding: '2px 8px 2px 0', color: '#fbbf24', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{key}</td>
                      <td style={{ padding: '2px 0', color: '#e2e8f0', fontSize: 11 }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </button>
      </div>

      {/* R2539: 선택 노드 계층 breadcrumb */}
      {selectedUuid && (() => {
        const chain: { uuid: string; name: string }[] = []
        let cur = flatNodes.find(f => f.node.uuid === selectedUuid)
        while (cur) {
          chain.unshift({ uuid: cur.node.uuid, name: cur.node.name })
          cur = cur.parentUuid ? flatNodes.find(f => f.node.uuid === cur!.parentUuid) : undefined
        }
        if (chain.length <= 1) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 8px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>
            {chain.map((item, i) => (
              <span key={item.uuid} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
                <span
                  onClick={e => { e.stopPropagation(); onSelect(item.uuid) }}
                  style={{ cursor: i < chain.length - 1 ? 'pointer' : 'default', color: i === chain.length - 1 ? '#e2e8f0' : 'var(--text-muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={`${item.name} (R2539 breadcrumb)`}
                >{item.name}</span>
              </span>
            ))}
          </div>
        )
      })()}

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
          const hits = flatNodes.filter(fn => {
            if (!fn.node.size) return false
            const nx = fn.worldX - (fn.node.anchor?.x ?? 0.5) * fn.node.size.x
            const ny = fn.worldY - (1 - (fn.node.anchor?.y ?? 0.5)) * fn.node.size.y
            return svgX >= nx && svgX <= nx + fn.node.size.x && svgY >= ny && svgY <= ny + fn.node.size.y
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
          {/* 노드 렌더링 (비활성 노드는 반투명 표시) */}
          {flatNodes.map(({ node, worldX, worldY, depth }) => {
            const isDragged = dragOverride?.uuid === node.uuid
            const isResized = resizeOverride?.uuid === node.uuid
            // R2472: 다중 선택 동시 드래그 오프셋
            const isMultiDragged = !isDragged && !!multiDragDelta && multiSelected.has(node.uuid)
            // dragOverride는 로컬 좌표 → 월드로 변환: worldX + (newLocal - oldLocal)
            const nodeLocalX = typeof node.position === 'object' ? (node.position as CCVec3).x : 0
            const nodeLocalY = typeof node.position === 'object' ? (node.position as CCVec3).y : 0
            const effX = isDragged ? worldX + (dragOverride!.x - nodeLocalX) : isMultiDragged ? worldX + multiDragDelta!.dx : worldX
            const effY = isDragged ? worldY + (dragOverride!.y - nodeLocalY) : isMultiDragged ? worldY + multiDragDelta!.dy : worldY
            const svgPos = ccToSvg(effX, effY)
            const w = isResized ? resizeOverride!.w : (node.size?.x || 0)
            const h = isResized ? resizeOverride!.h : (node.size?.y || 0)
            if (w === 0 && h === 0) return null  // 크기 없는 노드는 점으로 표시
            if (hideInactiveNodes && node.active === false) return null  // R1610
            if (hiddenUuids.has(node.uuid)) return null  // R1692: 시각적 숨기기

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
            const nodeOpacity = (node.active !== false ? (uiOpacityVal !== undefined ? uiOpacityVal : (node.opacity ?? 255)) / 255 : 0.2) * (isOutOfCanvas ? 0.4 : 1) * searchDim * soloDim * depthDim * compDim

            const anchorX = node.anchor?.x ?? 0.5
            const anchorY = node.anchor?.y ?? 0.5
            const rectX = svgPos.x - w * anchorX
            const rectY = svgPos.y - h * (1 - anchorY)
            // CC rotation: Z-euler (반시계방향 양수). SVG: 시계방향 양수 → 부호 반전
            const rotZ = rotateOverride?.uuid === node.uuid
              ? rotateOverride.angle
              : (typeof node.rotation === 'number' ? node.rotation : (node.rotation as { z?: number }).z ?? 0)
            const sx = (node.scale as { x?: number; y?: number } | null)?.x ?? 1
            const sy = (node.scale as { x?: number; y?: number } | null)?.y ?? 1
            const rotTransform = (sx !== 1 || sy !== 1 || rotZ !== 0)
              ? (sx !== 1 || sy !== 1)
                ? `translate(${svgPos.x},${svgPos.y}) rotate(${-rotZ}) scale(${sx},${sy}) translate(${-svgPos.x},${-svgPos.y})`
                : `translate(${svgPos.x},${svgPos.y}) rotate(${-rotZ}) translate(${-svgPos.x},${-svgPos.y})`
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
                    onSelect(node.uuid)
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
                style={{ cursor: lockedUuids.has(node.uuid) ? 'not-allowed' : isDragged ? 'grabbing' : 'grab' }}
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
                  const fs = Math.max(6, 9 / view.zoom)
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
                  const fs = Math.max(6, 9 / view.zoom)
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
                  const fs = Math.max(6, 9 / view.zoom)
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
                  const cs = Math.max(3, 5 / view.zoom)
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
                  const ss = Math.max(4, 8 / view.zoom)
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
                  const fs = Math.max(5, 8 / view.zoom)
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
                  const fs = Math.max(5, 8 / view.zoom)
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
                  const fs = Math.max(7, 10 / view.zoom)
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
                  const rotDeg = typeof node.rotation === 'number' ? node.rotation : ((node.rotation as { z?: number })?.z ?? 0)
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
                  const fs = Math.max(5, 7 / view.zoom)
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
                  const fs = Math.max(5, 7 / view.zoom)
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
                  const fs = Math.max(5, 7 / view.zoom)
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
                  const fs = Math.max(6, 9 / view.zoom)
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
                  const fs = Math.max(5, 7 / view.zoom)
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
                  const fs = Math.max(5, 7 / view.zoom)
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
                  const fs = Math.max(7, 9 / view.zoom)
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
                  const r = Math.max(2, 4 / view.zoom)
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
                  const rot = typeof node.rotation === 'number' ? node.rotation : (node.rotation as { x: number; y: number; z: number })?.z ?? 0
                  if (rot === 0) return null
                  return (
                    <text x={rectX + w / 2} y={rectY + h - 2 / view.zoom}
                      fontSize={8 / view.zoom} fill="#a78bfa" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>{Math.round(rot)}°</text>
                  )
                })()}
                {/* R2670: 선택 노드 위치 텍스트 오버레이 */}
                {showPosText && uuidSet.has(node.uuid) && view.zoom > 0.25 && (() => {
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
                  const fs = Math.max(6, 8 / view.zoom)
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
                  const fs = Math.max(6, 8 / view.zoom)
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
                  const fontFamilyName = (!isSystemFont && cachedFont?.familyName)
                    || (isSystemFont && sysFontFamily)
                    || sysFontFamily
                    || 'sans-serif'
                  return (
                    <text
                      x={svgPos.x} y={svgPos.y + fs / 3}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={fs} fill="rgba(255,220,80,0.9)" fontFamily={fontFamilyName}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{txt.length > 12 ? txt.slice(0, 11) + '…' : txt}</text>
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
                  const fs = Math.max(7, 10 / view.zoom)
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
                  const imgUrl = sfUuid ? spriteCacheRef.current.get(sfUuid) : undefined
                  if (!imgUrl) return null
                  const iw = Math.abs(w) || 1
                  const ih = Math.abs(h) || 1
                  const { r: tr = 255, g: tg = 255, b: tb = 255 } = (node.color as { r?: number; g?: number; b?: number } | null) ?? {}
                  const hasTint = tr !== 255 || tg !== 255 || tb !== 255
                  const isGrayscale = !!(sc?.props?.grayscale ?? sc?.props?._grayscale ?? sc?.props?.['_N$grayscale'] ?? false)
                  // Sprite type badge (only for non-simple types)
                  const spriteType = Number(sc?.props?.type ?? sc?.props?._type ?? 0)
                  // 0=Simple, 1=Sliced, 2=Tiled, 3=Filled
                  const SPRITE_TYPE_LABELS: Record<number, string> = { 1: '9', 2: '⊞', 3: '◔' }
                  const spriteTypeLabel = SPRITE_TYPE_LABELS[spriteType]
                  // 0=Custom, 1=Trimmed, 2=Raw
                  const sizeMode = Number(sc?.props?.sizeMode ?? sc?.props?._sizeMode ?? 1)
                  return (
                    <>
                      {hasTint ? (
                        <>
                          <image
                            href={imgUrl}
                            x={rectX} y={rectY}
                            width={iw} height={ih}
                            preserveAspectRatio="xMidYMid meet"
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
                          preserveAspectRatio="xMidYMid meet"
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
                  const fs = Math.min(Math.max((lc?.props?.fontSize as number | undefined) ?? 20, 8), 200)
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
                  // fontUuid가 있으면 커스텀 폰트 모드 (isSystemFontUsed 기본값 false)
                  const isSystemFont = !!(lc?.props?.isSystemFontUsed ?? lc?.props?.['_N$isSystemFontUsed'] ?? !fontUuid)
                  const fontFamilyName = (!isSystemFont && fontEntry?.familyName)
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
                    ? Number(lc?.props?.outlineWidth ?? lc?.props?._outlineWidth ?? 1)
                    : Number(outlineComp?.props?.width ?? outlineComp?.props?._width ?? 1)
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
                  // SVG transform="scale(zoom)"이 적용되므로 shadow 값은 게임 픽셀 그대로 사용
                  // fontSize={fs}와 동일하게 zoom 보정 없이 → zoom 시 텍스트와 함께 비례 스케일
                  // (/ view.zoom 제거: 기존 코드에서 shadow가 zoom에 따라 동적으로 변하는 버그 수정)
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
                        strokeWidth={hasOutline ? Math.max(outlineWidth, 0.5) / view.zoom : undefined}
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
                {/* SE/S/E 리사이즈 핸들 (선택된 노드만, 잠긴/뷰잠금 노드 제외) */}
                {isSelected && !viewLock && !lockedUuids.has(node.uuid) && (() => {
                  const curW = resizeOverride?.uuid === node.uuid ? resizeOverride.w : w
                  const curH = resizeOverride?.uuid === node.uuid ? resizeOverride.h : h
                  const startResize = (e: React.MouseEvent, dir: 'SE' | 'S' | 'E') => {
                    e.stopPropagation()
                    resizeRef.current = { uuid: node.uuid, startMouseX: e.clientX, startMouseY: e.clientY, startW: curW, startH: curH, dir }
                  }
                  const hs = 8 / view.zoom  // handle size
                  return (
                    <>
                      {/* SE 핸들 */}
                      <rect x={rectX + w - hs / 2} y={rectY + h - hs / 2} width={hs} height={hs} fill="#58a6ff" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'se-resize' }} onMouseDown={e => startResize(e, 'SE')} />
                      {/* R1619: S 핸들 (높이만) */}
                      <rect x={rectX + w / 2 - hs / 2} y={rectY + h - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 's-resize' }} onMouseDown={e => startResize(e, 'S')} />
                      {/* R1619: E 핸들 (너비만) */}
                      <rect x={rectX + w - hs / 2} y={rectY + h / 2 - hs / 2} width={hs} height={hs} fill="rgba(88,166,255,0.6)" stroke="#fff" strokeWidth={1 / view.zoom} style={{ cursor: 'e-resize' }} onMouseDown={e => startResize(e, 'E')} />
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

          {/* R2696: 크기 0 노드 경고 오버레이 */}
          {showZeroSizeWarn && flatNodes.map(fn => {
            if ((fn.node.size?.x ?? 0) !== 0 && (fn.node.size?.y ?? 0) !== 0) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const fs = Math.max(8, 11 / view.zoom)
            return (
              <g key={`zw-${fn.node.uuid}`} style={{ pointerEvents: 'none' }}>
                <text x={sp.x} y={sp.y + fs * 0.4} textAnchor="middle" fontSize={fs}
                  fill="rgba(239,68,68,0.9)" style={{ userSelect: 'none' }}>⚠</text>
              </g>
            )
          })}
          {/* R2728: 잠금 노드 🔒 아이콘 오버레이 */}
          {lockedUuids.size > 0 && flatNodes.map(fn => {
            if (!lockedUuids.has(fn.node.uuid)) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const w = fn.node.size?.x ?? 0
            const h = fn.node.size?.y ?? 0
            const ax = fn.node.anchor?.x ?? 0.5
            const ay = fn.node.anchor?.y ?? 0.5
            const iconSize = Math.max(8, 9 / view.zoom)
            // 노드 우상단 모서리 기준
            const iconX = sp.x + w * (1 - ax) - iconSize * 0.1 / view.zoom
            const iconY = sp.y - h * (1 - ay) + iconSize * 1.1 / view.zoom
            return (
              <text key={`lk-${fn.node.uuid}`}
                x={iconX} y={iconY} fontSize={iconSize / view.zoom}
                textAnchor="end" fill="rgba(251,191,36,0.9)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >🔒</text>
            )
          })}
          {/* R2645: 선택 노드 순서 연결선 오버레이 */}
          {showSelPolyline && uuids.length >= 2 && (() => {
            const ordered: { x: number; y: number }[] = []
            uuids.forEach(uid => {
              const found = flatNodes.find(fn => fn.node.uuid === uid)
              if (found) ordered.push(ccToSvg(found.worldX, found.worldY))
            })
            if (ordered.length < 2) return null
            const pts = ordered.map(p => `${p.x},${p.y}`).join(' ')
            const sw = 1.5 / view.zoom
            return (
              <polyline points={pts}
                fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth={sw}
                strokeDasharray={`${4/view.zoom} ${2/view.zoom}`}
                style={{ pointerEvents: 'none' }} />
            )
          })()}
          {/* R2646: 계층 구조 연결선 오버레이 */}
          {showHierarchyLines && (() => {
            const posMap = new Map<string, { x: number; y: number }>()
            flatNodes.forEach(fn => { posMap.set(fn.node.uuid, ccToSvg(fn.worldX, fn.worldY)) })
            const sw = 1 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {flatNodes.map(fn => {
                  if (!fn.parentUuid) return null
                  const from = posMap.get(fn.parentUuid)
                  const to = posMap.get(fn.node.uuid)
                  if (!from || !to) return null
                  return (
                    <line key={fn.node.uuid}
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke="rgba(103,232,249,0.35)" strokeWidth={sw}
                      style={{ pointerEvents: 'none' }} />
                  )
                })}
              </g>
            )
          })()}
          {/* R2661: 마우스 크로스헤어 가이드라인 */}
          {showCrosshair && mouseScenePos && (() => {
            const sp = ccToSvg(mouseScenePos.x, mouseScenePos.y)
            const sw = 1 / view.zoom
            const viewW = svgRef.current?.clientWidth ?? 800
            const viewH = svgRef.current?.clientHeight ?? 600
            const left = (0 - view.offsetX) / view.zoom
            const right = (viewW - view.offsetX) / view.zoom
            const top = (0 - view.offsetY) / view.zoom
            const bottom = (viewH - view.offsetY) / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={left} y1={sp.y} x2={right} y2={sp.y} stroke="rgba(148,163,184,0.5)" strokeWidth={sw} />
                <line x1={sp.x} y1={top} x2={sp.x} y2={bottom} stroke="rgba(148,163,184,0.5)" strokeWidth={sw} />
              </g>
            )
          })()}
          {/* R2698: 선택 노드 위치 가이드 십자선 */}
          {showSelAxisLine && selectedUuid && (() => {
            const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!fn) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const viewW = svgRef.current?.clientWidth ?? 800
            const viewH = svgRef.current?.clientHeight ?? 600
            const left = (0 - view.offsetX) / view.zoom
            const right = (viewW - view.offsetX) / view.zoom
            const top = (0 - view.offsetY) / view.zoom
            const bottom = (viewH - view.offsetY) / view.zoom
            const sw = 1 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={left} y1={sp.y} x2={right} y2={sp.y} stroke="rgba(34,211,238,0.45)" strokeWidth={sw} strokeDasharray={`${5/view.zoom} ${3/view.zoom}`} />
                <line x1={sp.x} y1={top} x2={sp.x} y2={bottom} stroke="rgba(34,211,238,0.45)" strokeWidth={sw} strokeDasharray={`${5/view.zoom} ${3/view.zoom}`} />
              </g>
            )
          })()}
          {/* R2700: 선택 노드 형제 강조 오버레이 */}
          {showSiblingHighlight && selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn || !selFn.parentUuid) return null
            const siblings = flatNodes.filter(f => f.parentUuid === selFn.parentUuid && f.node.uuid !== selectedUuid)
            if (siblings.length === 0) return null
            const sw = 1.5 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {siblings.map(fn => {
                  const sp2 = ccToSvg(fn.worldX, fn.worldY)
                  const w2 = fn.node.size?.x ?? 0, h2 = fn.node.size?.y ?? 0
                  const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
                  const rx = sp2.x - w2 * ax, ry = sp2.y - h2 * (1 - ay)
                  return (
                    <rect key={fn.node.uuid} x={rx} y={ry} width={w2} height={h2}
                      fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.7)" strokeWidth={sw}
                      strokeDasharray={`${3/view.zoom} ${2/view.zoom}`} />
                  )
                })}
              </g>
            )
          })()}
          {/* R2718: 선택 노드 uuid 참조 화살표 오버레이 */}
          {showRefArrows && selectedUuid && refUuids.length > 0 && (() => {
            const selFn = nodeMap.get(selectedUuid)
            if (!selFn) return null
            const fromSvg = ccToSvg(selFn.worldX, selFn.worldY)
            const sw = 1.5 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {refUuids.map(refUuid => {
                  const toFn = nodeMap.get(refUuid)
                  if (!toFn) return null
                  const toSvg = ccToSvg(toFn.worldX, toFn.worldY)
                  return (
                    <line key={refUuid}
                      x1={fromSvg.x} y1={fromSvg.y}
                      x2={toSvg.x} y2={toSvg.y}
                      stroke="#f97316" strokeWidth={sw} opacity={0.8}
                      markerEnd="url(#ref-arrow)" />
                  )
                })}
              </g>
            )
          })()}
          {/* R2682: 선택 노드 간 거리 텍스트 */}
          {showPairDist && uuids.length >= 2 && (() => {
            const posMap = new Map<string, { x: number; y: number }>()
            flatNodes.forEach(fn => posMap.set(fn.node.uuid, { x: fn.worldX, y: fn.worldY }))
            const pairs: { a: string; b: string }[] = []
            for (let i = 0; i < uuids.length - 1; i++) pairs.push({ a: uuids[i], b: uuids[i + 1] })
            return (
              <g pointerEvents="none">
                {pairs.map(({ a, b }, i) => {
                  const pa = posMap.get(a), pb = posMap.get(b)
                  if (!pa || !pb) return null
                  const sa = ccToSvg(pa.x, pa.y), sb = ccToSvg(pb.x, pb.y)
                  const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2
                  const dx = pb.x - pa.x, dy = pb.y - pa.y
                  const dist = Math.round(Math.sqrt(dx * dx + dy * dy))
                  return (
                    <text key={i} x={mx} y={my - 3 / view.zoom} fontSize={8 / view.zoom} fill="#a78bfa" textAnchor="middle" style={{ userSelect: 'none' }}>{dist}</text>
                  )
                })}
              </g>
            )
          })()}
          {/* R2680: 선택 그룹 중심 마커 */}
          {showSelCenter && uuids.length >= 1 && (() => {
            const selFlat = flatNodes.filter(fn => uuids.includes(fn.node.uuid))
            if (selFlat.length === 0) return null
            const xs = selFlat.map(fn => fn.worldX)
            const ys = selFlat.map(fn => fn.worldY)
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2
            const sp = ccToSvg(cx, cy)
            const r = 6 / view.zoom
            const sw = 1.5 / view.zoom
            return (
              <g pointerEvents="none">
                <line x1={sp.x - r} y1={sp.y} x2={sp.x + r} y2={sp.y} stroke="rgba(52,211,153,0.9)" strokeWidth={sw} />
                <line x1={sp.x} y1={sp.y - r} x2={sp.x} y2={sp.y + r} stroke="rgba(52,211,153,0.9)" strokeWidth={sw} />
                <circle cx={sp.x} cy={sp.y} r={r * 0.4} fill="none" stroke="rgba(52,211,153,0.9)" strokeWidth={sw} />
              </g>
            )
          })()}
          {/* R2647: 선택 노드 그룹 바운딩박스 */}
          {showSelGroupBBox && uuids.length >= 1 && (() => {
            const selFlat = flatNodes.filter(fn => uuids.includes(fn.node.uuid))
            if (selFlat.length === 0) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            selFlat.forEach(({ node, worldX, worldY }) => {
              const w2 = (node.size?.x ?? 0) / 2, h2 = (node.size?.y ?? 0) / 2
              if (w2 === 0 && h2 === 0) { minX = Math.min(minX, worldX); maxX = Math.max(maxX, worldX); minY = Math.min(minY, worldY); maxY = Math.max(maxY, worldY); return }
              minX = Math.min(minX, worldX - w2); maxX = Math.max(maxX, worldX + w2)
              minY = Math.min(minY, worldY - h2); maxY = Math.max(maxY, worldY + h2)
            })
            if (!isFinite(minX)) return null
            const svgL = ccToSvg(minX, maxY).x, svgT = ccToSvg(minX, maxY).y
            const svgR = ccToSvg(maxX, minY).x, svgB = ccToSvg(maxX, minY).y
            const bw = svgR - svgL, bh = svgB - svgT
            const sw = 1.5 / view.zoom
            const fs = Math.max(6, 9 / view.zoom)
            const wCC = Math.round(maxX - minX), hCC = Math.round(maxY - minY)
            return (
              <>
                <rect x={svgL} y={svgT} width={bw} height={bh}
                  fill="none" stroke="rgba(96,165,250,0.7)" strokeWidth={sw}
                  strokeDasharray={`${4/view.zoom} ${2/view.zoom}`} style={{ pointerEvents: 'none' }} />
                <text x={svgL + 2/view.zoom} y={svgT - 2/view.zoom}
                  fontSize={fs} fill="rgba(96,165,250,0.9)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{wCC}×{hCC}</text>
              </>
            )
          })()}
          {/* R2629: 안전 영역 + 비율 가이드 오버레이 */}
          {showSafeZone && (() => {
            const cw = effectiveW, ch = effectiveH
            // SVG 내 캔버스 좌상단 좌표: cc(0,0) = SVG(cx,cy), cc(-cw/2, ch/2) = 좌상단
            const svgLeft = cx - cw / 2, svgTop = cy - ch / 2
            // 90% safe zone
            const safeMarginX = cw * 0.05, safeMarginY = ch * 0.05
            const safeX = svgLeft + safeMarginX, safeY = svgTop + safeMarginY
            const safeW = cw * 0.9, safeH = ch * 0.9
            const sw = 1 / view.zoom
            const fs = Math.max(5, 8 / view.zoom)
            return (
              <>
                {/* 90% 안전 영역 */}
                <rect x={safeX} y={safeY} width={safeW} height={safeH}
                  fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth={sw}
                  strokeDasharray={`${4/view.zoom} ${2/view.zoom}`} style={{ pointerEvents: 'none' }} />
                <text x={safeX + 2/view.zoom} y={safeY - 2/view.zoom}
                  fontSize={fs} fill="rgba(251,191,36,0.7)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>90%</text>
                {/* 16:9 가이드 (캔버스 높이 기준) */}
                {(() => {
                  const h169 = ch, w169 = Math.round(ch * 16 / 9)
                  if (w169 <= cw) {
                    const x169 = cx - w169 / 2
                    return <rect x={x169} y={svgTop} width={w169} height={h169}
                      fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth={sw}
                      strokeDasharray={`${6/view.zoom} ${3/view.zoom}`} style={{ pointerEvents: 'none' }} />
                  }
                  const w169b = cw, h169b = Math.round(cw * 9 / 16)
                  const y169b = cy - h169b / 2
                  return <rect x={svgLeft} y={y169b} width={w169b} height={h169b}
                    fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth={sw}
                    strokeDasharray={`${6/view.zoom} ${3/view.zoom}`} style={{ pointerEvents: 'none' }} />
                })()}
                <text x={svgLeft + 2/view.zoom} y={svgTop + fs * 1.4}
                  fontSize={fs} fill="rgba(96,165,250,0.6)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>16:9</text>
              </>
            )
          })()}
          {/* R2709: 커스텀 비율 가이드 오버레이 */}
          {showCustomRatio && customRatioW > 0 && customRatioH > 0 && (() => {
            const cw = effectiveW, ch = effectiveH
            const svgLeft = cx - cw / 2, svgTop = cy - ch / 2
            const scale = Math.min(cw / customRatioW, ch / customRatioH)
            const rw = customRatioW * scale
            const rh = customRatioH * scale
            const rx = cx - rw / 2
            const ry = cy - rh / 2
            const sw = 1.5 / view.zoom
            const dash = 6 / view.zoom
            const fs = Math.max(5, 8 / view.zoom)
            return (
              <g>
                <rect x={rx} y={ry} width={rw} height={rh}
                  fill="none"
                  stroke="rgba(234,179,8,0.7)"
                  strokeWidth={sw}
                  strokeDasharray={`${dash} ${dash}`}
                  style={{ pointerEvents: 'none' }} />
                <text x={rx + 2/view.zoom} y={ry - 3/view.zoom}
                  fill="rgba(234,179,8,0.8)"
                  fontSize={fs}
                  fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>{customRatioW}:{customRatioH}</text>
              </g>
            )
          })()}
          {/* R2637: 씬 전체 바운딩박스 */}
          {showSceneBBox && (() => {
            if (flatNodes.length === 0) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            flatNodes.forEach(({ node, worldX, worldY }) => {
              const w2 = (node.size?.x || 0) / 2, h2 = (node.size?.y || 0) / 2
              if (w2 === 0 && h2 === 0) return
              const ax = node.anchor?.x ?? 0.5, ay = node.anchor?.y ?? 0.5
              const left = worldX - w2, right = worldX + w2
              const top = worldY - h2, bottom = worldY + h2
              minX = Math.min(minX, left); maxX = Math.max(maxX, right)
              minY = Math.min(minY, bottom); maxY = Math.max(maxY, top)
              // Suppress unused lint warning for ax/ay
              void ax; void ay
            })
            if (!isFinite(minX)) return null
            const svgL = ccToSvg(minX, maxY).x, svgT = ccToSvg(minX, maxY).y
            const svgR = ccToSvg(maxX, minY).x, svgB = ccToSvg(maxX, minY).y
            const bw = svgR - svgL, bh = svgB - svgT
            const sw = 1.5 / view.zoom
            const fs = Math.max(6, 9 / view.zoom)
            const wCC = Math.round(maxX - minX), hCC = Math.round(maxY - minY)
            return (
              <>
                <rect x={svgL} y={svgT} width={bw} height={bh}
                  fill="none" stroke="rgba(248,113,113,0.6)" strokeWidth={sw}
                  strokeDasharray={`${5/view.zoom} ${2/view.zoom}`} style={{ pointerEvents: 'none' }} />
                <text x={svgL + 2/view.zoom} y={svgT - 2/view.zoom}
                  fontSize={fs} fill="rgba(248,113,113,0.8)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{wCC}×{hCC}</text>
              </>
            )
          })()}
          {/* R2630: 삼분법(Rule of Thirds) 가이드 */}
          {showRuleOfThirds && (() => {
            const cw = effectiveW, ch = effectiveH
            const svgLeft = cx - cw / 2, svgTop = cy - ch / 2
            const sw = 1 / view.zoom
            const lines = []
            for (let i = 1; i <= 2; i++) {
              const x = svgLeft + cw * i / 3
              const y = svgTop + ch * i / 3
              lines.push(
                <line key={`v${i}`} x1={x} y1={svgTop} x2={x} y2={svgTop + ch}
                  stroke="rgba(167,139,250,0.4)" strokeWidth={sw} style={{ pointerEvents: 'none' }} />,
                <line key={`h${i}`} x1={svgLeft} y1={y} x2={svgLeft + cw} y2={y}
                  stroke="rgba(167,139,250,0.4)" strokeWidth={sw} style={{ pointerEvents: 'none' }} />
              )
              // 교차점 원
              for (let j = 1; j <= 2; j++) {
                const ix = svgLeft + cw * i / 3, iy = svgTop + ch * j / 3
                lines.push(
                  <circle key={`c${i}${j}`} cx={ix} cy={iy} r={3/view.zoom}
                    fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth={sw} style={{ pointerEvents: 'none' }} />
                )
              }
            }
            return <>{lines}</>
          })()}
          {/* R2617: 원점(0,0) 십자선 */}
          {showOriginCross && (() => {
            const arm = Math.max(20, Math.min(effectiveW, effectiveH) * 0.1) / view.zoom
            const fs = Math.max(6, 9 / view.zoom)
            return (
              <>
                <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy}
                  stroke="rgba(74,222,128,0.7)" strokeWidth={1 / view.zoom} style={{ pointerEvents: 'none' }} />
                <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm}
                  stroke="rgba(74,222,128,0.7)" strokeWidth={1 / view.zoom} style={{ pointerEvents: 'none' }} />
                <circle cx={cx} cy={cy} r={3 / view.zoom}
                  fill="rgba(74,222,128,0.9)" style={{ pointerEvents: 'none' }} />
                <text x={cx + 4 / view.zoom} y={cy - 3 / view.zoom}
                  fontSize={fs} fill="rgba(74,222,128,0.9)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >(0,0)</text>
              </>
            )
          })()}
          {/* R2607: 중복 이름 노드 강조 */}
          {showDupNameOverlay && (() => {
            const nameCount = new Map<string, number>()
            flatNodes.forEach(fn => nameCount.set(fn.node.name, (nameCount.get(fn.node.name) ?? 0) + 1))
            const dupFns = flatNodes.filter(fn => (nameCount.get(fn.node.name) ?? 0) > 1 && (fn.node.size?.x || fn.node.size?.y))
            if (dupFns.length === 0) return null
            return dupFns.map(fn => {
              const svgX = cx + fn.worldX, svgY = cy - fn.worldY
              const w = fn.node.size?.x ?? 0, h = fn.node.size?.y ?? 0
              const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
              const rx = svgX - w * ax, ry = svgY - h * (1 - ay)
              return (
                <rect key={`dup_${fn.node.uuid}`} x={rx} y={ry} width={w} height={h}
                  fill="none" stroke="rgba(251,146,60,0.8)" strokeWidth={2/view.zoom}
                  strokeDasharray={`${5/view.zoom} ${2.5/view.zoom}`}
                  style={{ pointerEvents: 'none' }} />
              )
            })
          })()}
          {/* R2600: 다중 선택 bounding box */}
          {showSelBBox && multiSelected.size >= 2 && (() => {
            const selFns = flatNodes.filter(fn => multiSelected.has(fn.node.uuid) && (fn.node.size?.x || fn.node.size?.y))
            if (selFns.length < 2) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            selFns.forEach(fn => {
              const svgX = cx + fn.worldX, svgY = cy - fn.worldY
              const w = fn.node.size?.x ?? 0, h = fn.node.size?.y ?? 0
              const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
              const rx = svgX - w * ax, ry = svgY - h * (1 - ay)
              minX = Math.min(minX, rx); minY = Math.min(minY, ry)
              maxX = Math.max(maxX, rx + w); maxY = Math.max(maxY, ry + h)
            })
            const bw = maxX - minX, bh = maxY - minY
            const pad = 6 / view.zoom, fs = Math.max(6, 9 / view.zoom)
            return (
              <>
                <rect x={minX - pad} y={minY - pad} width={bw + pad*2} height={bh + pad*2}
                  fill="none" stroke="rgba(96,165,250,0.7)" strokeWidth={1.5 / view.zoom}
                  strokeDasharray={`${6/view.zoom} ${3/view.zoom}`}
                  style={{ pointerEvents: 'none' }} />
                <text x={minX - pad} y={minY - pad - 2/view.zoom}
                  textAnchor="start" fontSize={fs} fill="rgba(96,165,250,0.9)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{Math.round(bw)}×{Math.round(bh)} ({selFns.length})</text>
              </>
            )
          })()}
          {/* 크기 없는 노드 → 십자 표시 (비활성 포함, 반투명) */}
          {flatNodes.filter(fn => !(fn.node.size?.x) && !(fn.node.size?.y) && !(hideInactiveNodes && fn.node.active === false)).map(({ node, worldX, worldY }) => {
            const svgPos = ccToSvg(worldX, worldY)
            const isSelected = node.uuid === selectedUuid
            const r = 5 / view.zoom
            return (
              <g key={`dot_${node.uuid}`}
                opacity={node.active ? 1 : 0.2}
                onClick={e => { e.stopPropagation(); onSelect(node.uuid) }}
                style={{ cursor: 'pointer' }}
              >
                <line x1={svgPos.x - r} y1={svgPos.y} x2={svgPos.x + r} y2={svgPos.y}
                  stroke={isSelected ? '#58a6ff' : '#888'} strokeWidth={1 / view.zoom} />
                <line x1={svgPos.x} y1={svgPos.y - r} x2={svgPos.x} y2={svgPos.y + r}
                  stroke={isSelected ? '#58a6ff' : '#888'} strokeWidth={1 / view.zoom} />
              </g>
            )
          })}
          {/* R1703: 형제 그룹 하이라이트 */}
          {showSiblingGroup && selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const siblings = flatNodes.filter(f => f.parentUuid === selFn.parentUuid && f.node.uuid !== selectedUuid)
            return (
              <>
                {siblings.map(fn => {
                  if (!fn.node.size?.x || !fn.node.size?.y) return null
                  const sp = ccToSvg(fn.worldX, fn.worldY)
                  const w = fn.node.size.x, h = fn.node.size.y
                  const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
                  return (
                    <rect key={fn.node.uuid}
                      x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                      width={w} height={h}
                      fill="rgba(251,191,36,0.06)"
                      stroke="rgba(251,191,36,0.35)"
                      strokeWidth={1 / view.zoom}
                      strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
              </>
            )
          })()}
          {/* R1693: 좌표 핀 마커 */}
          {pinMarkers.map(pm => {
            const sp = ccToSvg(pm.ccX, pm.ccY)
            const r = 6 / view.zoom
            return (
              <g key={pm.id} style={{ cursor: 'pointer' }}
                onClick={() => setPinMarkers(prev => prev.filter(p => p.id !== pm.id))}
                onDoubleClick={e => {
                  e.stopPropagation()
                  // R2529: 더블클릭으로 레이블 편집
                  const input = window.prompt('핀 레이블 (비워두면 좌표 표시)', pm.label ?? '')
                  if (input !== null) setPinMarkers(prev => prev.map(p => p.id === pm.id ? { ...p, label: input || undefined } : p))
                }}
              >
                <line x1={sp.x} y1={sp.y - r} x2={sp.x} y2={sp.y + r} stroke="#f472b6" strokeWidth={1.5 / view.zoom} />
                <line x1={sp.x - r} y1={sp.y} x2={sp.x + r} y2={sp.y} stroke="#f472b6" strokeWidth={1.5 / view.zoom} />
                <circle cx={sp.x} cy={sp.y} r={2 / view.zoom} fill="#f472b6" />
                <text x={sp.x + 5 / view.zoom} y={sp.y - 4 / view.zoom} fontSize={8 / view.zoom} fill="#f472b6" fontFamily="monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {pm.label ?? `${pm.ccX},${pm.ccY}`}
                </text>
              </g>
            )
          })}
          {/* R1604: 선택 노드 부모 하이라이트 (연보라 점선) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const parentFn = flatNodes.find(f => f.node.uuid === selFn.parentUuid)
            if (!parentFn || !parentFn.node.size?.x || !parentFn.node.size?.y) return null
            const { node: pn, worldX: px, worldY: py } = parentFn
            const sp = ccToSvg(px, py)
            const w = pn.size?.x ?? 0, h = pn.size?.y ?? 0
            const ax = pn.anchor?.x ?? 0.5, ay = pn.anchor?.y ?? 0.5
            return (
              <rect
                x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                width={w} height={h}
                fill="none"
                stroke="rgba(180,120,255,0.45)"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}
          {/* R1636: 선택 노드 직계 자식 하이라이트 (연초록 점선) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn) return null
            const children = flatNodes.filter(f => f.parentUuid === selectedUuid && f.node.size?.x && f.node.size?.y)
            if (children.length === 0) return null
            return (
              <g>
                {children.map(cf => {
                  const { node: cn, worldX: cx2, worldY: cy2 } = cf
                  const sp = ccToSvg(cx2, cy2)
                  const w = cn.size?.x ?? 0, h = cn.size?.y ?? 0
                  const ax = cn.anchor?.x ?? 0.5, ay = cn.anchor?.y ?? 0.5
                  return (
                    <rect key={cf.node.uuid}
                      x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                      width={w} height={h}
                      fill="none"
                      stroke="rgba(60,220,100,0.25)"
                      strokeWidth={1 / view.zoom}
                      strokeDasharray={`${3 / view.zoom} ${3 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
              </g>
            )
          })()}
          {/* R1643: 선택 노드↔부모 연결선 (계층 시각화) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const parentFn = flatNodes.find(f => f.node.uuid === selFn.parentUuid)
            if (!parentFn) return null
            const childSvg = ccToSvg(selFn.worldX, selFn.worldY)
            const parentSvg = ccToSvg(parentFn.worldX, parentFn.worldY)
            return (
              <line
                x1={childSvg.x} y1={childSvg.y}
                x2={parentSvg.x} y2={parentSvg.y}
                stroke="rgba(220,100,200,0.35)"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}
          {/* R1613: 형제 노드 하이라이트 (연노랑 점선) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const parentFn = flatNodes.find(f => f.node.uuid === selFn.parentUuid)
            if (!parentFn) return null
            const siblings = flatNodes.filter(f => f.parentUuid === selFn.parentUuid && f.node.uuid !== selectedUuid && f.node.size?.x && f.node.size?.y)
            if (siblings.length === 0) return null
            return (
              <g>
                {siblings.map(sf => {
                  const { node: sn, worldX: sx, worldY: sy } = sf
                  const sp = ccToSvg(sx, sy)
                  const w = sn.size?.x ?? 0, h = sn.size?.y ?? 0
                  const ax = sn.anchor?.x ?? 0.5, ay = sn.anchor?.y ?? 0.5
                  return (
                    <rect key={sf.node.uuid}
                      x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                      width={w} height={h}
                      fill="none"
                      stroke="rgba(250,200,60,0.3)"
                      strokeWidth={1 / view.zoom}
                      strokeDasharray={`${4 / view.zoom} ${4 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
              </g>
            )
          })()}
          {/* rubber-band 선택 박스 */}
          {selectionBox && (
            <rect
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(88,166,255,0.08)"
              stroke={selectionColor}
              strokeWidth={1 / view.zoom}
              strokeDasharray={`${3 / view.zoom},${2 / view.zoom}`}
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* R1525: 다중 노드 경계 박스 (BBox) overlay — 주황 점선 */}
          {multiSelected.size > 1 && (() => {
            const selNodes = flatNodes.filter(fn => multiSelected.has(fn.node.uuid) && fn.node.size?.x && fn.node.size?.y)
            if (selNodes.length < 2) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            for (const { node, worldX, worldY } of selNodes) {
              const sp = ccToSvg(worldX, worldY)
              const w = node.size!.x, h = node.size!.y
              const ax = node.anchor?.x ?? 0.5, ay = node.anchor?.y ?? 0.5
              const left = sp.x - w * ax, right = sp.x + w * (1 - ax)
              const top = sp.y - h * (1 - ay), bot = sp.y + h * ay
              if (left < minX) minX = left
              if (right > maxX) maxX = right
              if (top < minY) minY = top
              if (bot > maxY) maxY = bot
            }
            const pad = 4 / view.zoom
            const bw = maxX - minX, bh = maxY - minY
            // R1624: bounding box 크기 레이블
            const sceneW = Math.round(bw / view.zoom * view.zoom), sceneH = Math.round(bh / view.zoom * view.zoom)
            return (
              <g>
                <rect
                  x={minX - pad} y={minY - pad}
                  width={bw + pad * 2} height={bh + pad * 2}
                  fill="none"
                  stroke="#ff9944"
                  strokeWidth={1.5 / view.zoom}
                  strokeDasharray={`${5 / view.zoom} ${3 / view.zoom}`}
                  style={{ pointerEvents: 'none' }}
                />
                {/* R1624: BBox 크기 레이블 */}
                <text
                  x={minX - pad + (bw + pad * 2) / 2}
                  y={minY - pad - 3 / view.zoom}
                  fontSize={9 / view.zoom}
                  fill="#ff9944"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{Math.round(sceneW)}×{Math.round(sceneH)}</text>
              </g>
            )
          })()}
        {/* R2318/R2319: cc.Camera 뷰 프레임 오버레이 (토글 가능) */}
        {showCameraFrames && cameraFrames.map((cam, i) => {
          const sp = ccToSvg(cam.worldX, cam.worldY)
          return (
            <g key={i} pointerEvents="none">
              <rect
                x={sp.x - cam.w / 2} y={sp.y - cam.h / 2}
                width={cam.w} height={cam.h}
                fill="none" stroke="rgba(255,200,60,0.6)" strokeWidth={1.5 / view.zoom}
                strokeDasharray={`${6 / view.zoom},${3 / view.zoom}`}
              />
              <text x={sp.x - cam.w / 2 + 3 / view.zoom} y={sp.y - cam.h / 2 - 2 / view.zoom}
                fontSize={8 / view.zoom} fill="rgba(255,200,60,0.8)" style={{ pointerEvents: 'none', userSelect: 'none' }}>📷</text>
            </g>
          )
        })}
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
      {/* R1614: 화면 밖 선택 노드 방향 화살표 */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const svgEl = svgRef.current
        if (!svgEl) return null
        const rect = svgEl.getBoundingClientRect()
        const svgCX = rect.width / 2
        const svgCY = rect.height / 2
        // 노드 SVG 좌표
        const nSvgX = fn.worldX * view.zoom + view.offsetX
        const nSvgY = (-fn.worldY) * view.zoom + view.zoom * (designH / 2) + view.offsetY
        const padding = 20
        const inView = nSvgX >= -padding && nSvgX <= rect.width + padding && nSvgY >= -padding && nSvgY <= rect.height + padding
        if (inView) return null
        // 방향 계산
        const dx = nSvgX - svgCX
        const dy = nSvgY - svgCY
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)
        const angleRad = angleDeg * (Math.PI / 180)
        const edge = 36
        const arrowX = svgCX + Math.cos(angleRad) * (Math.min(rect.width, rect.height) / 2 - edge)
        const arrowY = svgCY + Math.sin(angleRad) * (Math.min(rect.width, rect.height) / 2 - edge)
        return (
          <div style={{
            position: 'absolute',
            left: arrowX - 10, top: arrowY - 10,
            width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#58a6ff', fontSize: 14,
            transform: `rotate(${angleDeg}deg)`,
            pointerEvents: 'none', userSelect: 'none', zIndex: 8,
          }}>→</div>
        )
      })()}
      {/* R1699: 선택 노드 세부 정보 오버레이 (우상단) */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const pos = fn.node.position as { x: number; y: number }
        const sz = fn.node.size
        const rot = typeof fn.node.rotation === 'number' ? fn.node.rotation : (fn.node.rotation as { z?: number })?.z ?? 0
        return (
          <div style={{
            position: 'absolute', top: 6, right: 6, zIndex: 10,
            background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4, padding: '3px 7px',
            fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace',
            lineHeight: 1.6, pointerEvents: 'none', userSelect: 'none',
          }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 1, fontSize: 8, letterSpacing: '0.3px' }}>
              {fn.node.name}
            </div>
            <div>X <span style={{ color: '#e05555' }}>{Math.round(pos.x)}</span>  Y <span style={{ color: '#55b055' }}>{Math.round(pos.y)}</span></div>
            {sz && <div>W <span style={{ color: '#58a6ff' }}>{Math.round(sz.x)}</span>  H <span style={{ color: '#a78bfa' }}>{Math.round(sz.y)}</span></div>}
            {Math.abs(rot) > 0.01 && <div>R <span style={{ color: '#f472b6' }}>{rot.toFixed(1)}°</span></div>}
          </div>
        )
      })()}
      </div>
      {/* R1522: 노드 호버 정보 패널 */}
      {hoverUuid && hoverClientPos && (() => {
        const fn = flatNodes.find(f => f.node.uuid === hoverUuid)
        if (!fn) return null
        const n = fn.node
        const svgEl = svgRef.current
        const rect = svgEl?.getBoundingClientRect()
        const relX = rect ? hoverClientPos.x - rect.left + 14 : 14
        const relY = rect ? hoverClientPos.y - rect.top + 14 : 14
        const pos = n.position as { x: number; y: number }
        const COMP_ICONS: Record<string, string> = {
          'cc.Label': 'T', 'cc.Sprite': '🖼', 'cc.Button': '⬜', 'cc.Toggle': '☑', 'cc.Slider': '⊟',
          'cc.ScrollView': '⊠', 'cc.RichText': 'T', 'cc.AudioSource': '♪', 'cc.Widget': '⚓',
          'cc.Layout': '▤', 'cc.Animation': '▶', 'cc.ProgressBar': '▰', 'cc.VideoPlayer': '▷',
          // R1557: 추가 컴포넌트 아이콘
          'cc.SafeArea': '📱', 'cc.BlockInputEvents': '🚫', 'cc.TiledMap': '🗺', 'sp.Skeleton': '🦴',
          'dragonBones.ArmatureDisplay': '🐉', 'cc.RigidBody': '⚙', 'cc.BoxCollider': '⬡', 'cc.CircleCollider': '○',
        }
        return (
          <div
            pointerEvents="none"
            style={{
              position: 'absolute', left: relX, top: relY, zIndex: 50, pointerEvents: 'none',
              background: 'rgba(10,14,28,0.92)', border: '1px solid rgba(88,166,255,0.3)',
              borderRadius: 5, padding: '5px 8px', fontSize: 9, color: 'var(--text-primary)',
              maxWidth: 180, boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontWeight: 700, color: '#c9d1d9', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.active ? '' : '◌ '}{n.name}
            </div>
            <div style={{ color: '#58a6ff', marginBottom: 3 }}>
              ({Math.round(pos.x)}, {Math.round(pos.y)}) {n.size ? `${Math.round(n.size.x)}×${Math.round(n.size.y)}` : ''}
              {/* R1555: layer 표시 */}
              {n.layer != null && n.layer !== 1048576 && <span style={{ marginLeft: 4, color: 'rgba(251,191,36,0.8)', fontSize: 8 }}>L{n.layer}</span>}
            </div>
            {n.components.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {n.components.map((c, i) => {
                  const shortType = c.type.split('.').pop() ?? c.type
                  const icon = COMP_ICONS[c.type] ?? '⬡'
                  const hint = c.type === 'cc.Label' ? String(c.props.string ?? c.props.String ?? '').slice(0, 16)
                    : c.type === 'cc.ProgressBar' ? `${Math.round(Number(c.props.progress ?? 0) * 100)}%`
                    : c.type === 'cc.Toggle' ? (c.props.isChecked ? '✓' : '○')
                    : c.type === 'cc.AudioSource' ? `vol:${Math.round(Number(c.props.volume ?? 1) * 100)}%`
                    : ''
                  return (
                    <span key={i} style={{ background: 'rgba(88,166,255,0.12)', borderRadius: 3, padding: '1px 4px', color: '#8ab4f8' }}>
                      {icon} {shortType}{hint ? ` "${hint}"` : ''}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
      {/* 마우스 씬 좌표 HUD */}
      {mouseScenePos && !selectedUuid && (
        <div style={{
          position: 'absolute', bottom: 4, left: 4,
          background: 'rgba(0,0,0,0.5)', borderRadius: 3,
          padding: '1px 6px', fontSize: 9, color: '#888',
          pointerEvents: 'none',
        }}>
          {mouseScenePos.x}, {mouseScenePos.y}
        </div>
      )}
      {/* 선택 노드 HUD + 정렬 버튼 */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const { node } = fn
        // 드래그/회전 중 실시간 값 반영
        const rawPos = node.position as { x: number; y: number }
        const pos = dragOverride?.uuid === node.uuid
          ? { x: dragOverride.x, y: dragOverride.y }
          : rawPos
        const rotRaw = typeof node.rotation === 'number' ? node.rotation : (node.rotation as { z?: number }).z ?? 0
        const rotZ = rotateOverride?.uuid === node.uuid ? rotateOverride.angle : rotRaw
        const w = resizeOverride?.uuid === node.uuid ? resizeOverride.w : (node.size?.x ?? 0)
        const h = resizeOverride?.uuid === node.uuid ? resizeOverride.h : (node.size?.y ?? 0)
        const alignBtn = (label: string, title: string, nx: number, ny: number) => (
          <span
            key={label}
            title={title}
            onClick={() => onMove?.(selectedUuid, nx, ny)}
            style={{ cursor: 'pointer', padding: '0 3px', fontSize: 9, color: '#888' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}
          >{label}</span>
        )
        return (
          <div style={{
            position: 'absolute', bottom: 4, left: 4, right: 4,
            background: 'rgba(0,0,0,0.6)', borderRadius: 3,
            padding: '2px 8px', fontSize: 9, color: '#ccc',
            display: 'flex', gap: 8,
          }}>
            {/* R2521: Local/World 좌표 토글 */}
            <span
              onClick={() => setShowWorldPos(v => !v)}
              title={showWorldPos ? '세계 좌표 표시 중 — 클릭하여 로컬로 전환 (R2521)' : '로컬 좌표 표시 중 — 클릭하여 세계로 전환 (R2521)'}
              style={{ cursor: 'pointer', color: showWorldPos ? '#34d399' : '#888', fontSize: 8, flexShrink: 0, userSelect: 'none' }}
            >{showWorldPos ? 'W' : 'L'}</span>
            <span style={{ pointerEvents: 'none', color: dragOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>pos</span> {showWorldPos ? `${parseFloat(fn.worldX.toFixed(2))},${parseFloat(fn.worldY.toFixed(2))}` : `${parseFloat(pos.x.toFixed(2))},${parseFloat(pos.y.toFixed(2))}`}{/* R1611: 드래그 delta */}{dragOverride?.uuid === node.uuid && dragRef.current && ` (Δ${(dragOverride.x - dragRef.current.startNodeX).toFixed(0)},${(dragOverride.y - dragRef.current.startNodeY).toFixed(0)})`}</span>
            <span style={{ pointerEvents: 'none', color: resizeOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>size</span> {parseFloat(w.toFixed(2))}×{parseFloat(h.toFixed(2))}</span>
            {(rotZ !== 0 || rotateOverride?.uuid === node.uuid) && <span style={{ pointerEvents: 'none', color: rotateOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>rot</span> {rotZ.toFixed(1)}°</span>}
            {/* 정렬 버튼 */}
            {alignBtn('⊙', '중앙 정렬', 0, 0)}
            {alignBtn('◁', '좌측 정렬', -(effectiveW / 2 - w / 2), pos.y)}
            {alignBtn('▷', '우측 정렬', effectiveW / 2 - w / 2, pos.y)}
            {alignBtn('△', '상단 정렬', pos.x, effectiveH / 2 - h / 2)}
            {alignBtn('▽', '하단 정렬', pos.x, -(effectiveH / 2 - h / 2))}
            {/* R2476: opacity 인라인 슬라이더 */}
            {onOpacity && node.opacity != null && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }} title={`opacity: ${node.opacity} (R2476)`}>
                <span style={{ color: '#666', fontSize: 8 }}>α</span>
                <input
                  type="range" min={0} max={255} step={1}
                  defaultValue={node.opacity}
                  onChange={e => onOpacity(node.uuid, parseInt(e.target.value))}
                  style={{ width: 50, height: 6, accentColor: '#58a6ff', cursor: 'pointer' }}
                />
                <span style={{ color: '#555', fontSize: 8, minWidth: 20 }}>{node.opacity}</span>
              </label>
            )}
            {multiSelected.size > 1 && (
              <span style={{ color: '#ff9944', flexShrink: 0, pointerEvents: 'none' }}>
                ⊕{multiSelected.size}개
              </span>
            )}
            {/* R1616: 자식/컴포넌트 수 표시 */}
            {node.children.length > 0 && (
              <span style={{ color: '#555', flexShrink: 0, pointerEvents: 'none' }} title={`자식 ${node.children.length}개`}>▸{node.children.length}</span>
            )}
            {/* R2490: 컴포넌트 타입 아이콘 목록 */}
            {node.components && node.components.length > 0 && (() => {
              const ICONS_HUD: Record<string, string> = {
                'cc.Label': 'T', 'cc.RichText': 'T', 'cc.Sprite': '🖼', 'cc.Button': '⬜',
                'cc.Toggle': '☑', 'cc.Slider': '⊟', 'cc.Widget': '⚓', 'cc.Layout': '▤',
                'cc.ScrollView': '⊠', 'cc.EditBox': '✏', 'cc.ProgressBar': '▰',
                'cc.Animation': '▶', 'sp.Skeleton': '🦴', 'cc.AudioSource': '♪',
                'cc.RigidBody': '⚙', 'cc.BoxCollider': '⬡', 'cc.CircleCollider': '○',
                'cc.Camera': '📷', 'cc.Canvas': '🎨', 'cc.ParticleSystem': '✦',
                'cc.Mask': '◰', 'cc.BlockInputEvents': '🚫',
              }
              const icons = node.components.map(c => ICONS_HUD[c.type] || '·')
              return (
                <span style={{ color: '#556', flexShrink: 0, pointerEvents: 'none', letterSpacing: 1 }}
                  title={`컴포넌트: ${node.components.map(c => c.type).join(', ')} (R2490)`}
                >{icons.join('')}</span>
              )
            })()}
            {/* R1618: depth 레벨 표시 */}
            <span style={{ color: '#444', flexShrink: 0, pointerEvents: 'none' }} title={`계층 깊이 D${fn.depth}`}>D{fn.depth}</span>
            <span style={{ color: '#58a6ff', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {node.name}
            </span>
            {mouseScenePos && (
              <span style={{ color: '#555', flexShrink: 0, pointerEvents: 'none' }}>
                ✦ {mouseScenePos.x},{mouseScenePos.y}
              </span>
            )}
          </div>
        )
      })()}
      {/* 단축키 도움말 오버레이 */}
      {showHelp && (
        <div
          style={{
            position: 'absolute', top: 32, right: 4,
            background: 'rgba(0,0,0,0.85)', border: '1px solid #444',
            borderRadius: 5, padding: '8px 10px', fontSize: 9, color: '#aaa',
            lineHeight: 1.8, pointerEvents: 'none', zIndex: 10,
          }}
        >
          {[
            ['휠', '줌 인/아웃'],
            ['중간 버튼 드래그', '패닝'],
            ['Space + 좌클릭 드래그', '패닝'],
            ['더블클릭', 'Fit to view (전체)'],
            ['F', '선택 노드 중앙 포커스'],
            ['좌클릭 드래그', '노드 이동'],
            ['Ctrl+드래그', `${snapSize}px 그리드 스냅`],
            ['# 버튼', `그리드 오버레이 표시/숨기기 (R2456)`],
            ['SE 핸들 드래그', '노드 리사이즈'],
            ['↻ 핸들 드래그', '노드 회전 (Shift: 15°)'],
            ['Escape', '부모 노드 선택 (없으면 해제) (R2477)'],
            ['←↑→↓', '선택 노드 1px 이동'],
            ['Shift+←↑→↓', '10px 이동'],
            ['Ctrl+↑↓', '형제 순서 변경'],
            ['⊙◁▷△▽', '정렬 버튼'],
            ['↑↓ (Inspector)', 'Z-order 변경'],
            ['Ctrl+A', '전체 노드 다중 선택'],
            ['Ctrl+D', '선택 노드 복제'],
            ['Ctrl+N', '새 노드 추가'],
            ['H', '선택 노드 숨기기/보이기'],
            ['O', '선택 노드 중앙(0,0) 이동'],
            ['P', '부모 노드 선택'],
            ['Enter', '첫 번째 자식 선택'],
            ['Tab', '다음 형제 선택'],
            ['Shift+Tab', '이전 형제 선택'],
            // R2334: 최근 추가 단축키
            ['Alt+←/→', '선택 이력 이전/다음 (R1705)'],
            ['G', '형제 그룹 하이라이트 토글'],
            ['M', '거리 측정 도구 토글 (R2465)'],
            ['Ctrl+P', '핀 마커 추가'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#58a6ff', minWidth: 100 }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 6, borderTop: '1px solid #333', paddingTop: 4, fontSize: 8 }}>
            {[
              ['#58a6ff', '선택됨'],
              ['#ff8c3c', 'Button'],
              ['#3ccccc', 'ScrollView'],
              ['#cc64b4', 'EditBox'],
              ['#a064ff', 'Slider/Toggle'],
              ['#4466aa', 'Canvas/Layout'],
              ['#ccaa44', 'Label'],
              ['#44aa66', 'Sprite'],
            ].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1.6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 1, background: color, flexShrink: 0 }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* R1489: 미니맵 오버레이 — 우하단 */}
      {showMinimap && flatNodes.length > 0 && (() => {
        const MM_W = 100, MM_H = 72
        const svgEl = svgRef.current
        const svgW = svgEl?.clientWidth ?? effectiveW
        const svgH = svgEl?.clientHeight ?? effectiveH
        // 뷰포트 영역 (씬 좌표계)
        const vpX = -view.offsetX / view.zoom
        const vpY = -view.offsetY / view.zoom
        const vpW = svgW / view.zoom
        const vpH = svgH / view.zoom
        // R1554: effectiveW/H 기준 (resOverride 반영)
        const sceneX = -effectiveW / 2, sceneY = -effectiveH / 2
        const sceneW = effectiveW, sceneH = effectiveH
        const scaleX = MM_W / sceneW
        const scaleY = MM_H / sceneH
        const s = Math.min(scaleX, scaleY)
        const mmOffX = (MM_W - sceneW * s) / 2
        const mmOffY = (MM_H - sceneH * s) / 2
        const toMM = (x: number, y: number) => ({
          x: (x - sceneX) * s + mmOffX,
          y: (sceneH - (y - sceneY)) * s + mmOffY,  // Y 반전 (CC Y축 위=+)
        })
        const vpMM = toMM(vpX, vpY + vpH)
        const vpW2 = vpW * s, vpH2 = vpH * s
        return (
          <div style={{
            position: 'absolute',
            ...(mmPos ? { left: mmPos.x, top: mmPos.y } : { bottom: 8, right: 8 }),
            zIndex: 5,
            width: MM_W,
            background: 'rgba(10,10,20,0.85)', border: '1px solid #333',
            borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
            display: 'flex', flexDirection: 'column' as const,
          }}
            onClick={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const mmX = e.clientX - rect.left
              const mmY = e.clientY - rect.top
              // R2470: 노드 히트 테스트 — 역순(나중에 렌더된 노드 우선)
              let hitUuid: string | null = null
              for (let i = flatNodes.length - 1; i >= 0; i--) {
                const fn2 = flatNodes[i]
                const p2 = toMM(fn2.worldX, fn2.worldY)
                const nw2 = fn2.node.size?.x ?? 0, nh2 = fn2.node.size?.y ?? 0
                const mw2 = nw2 * s, mh2 = nh2 * s
                if (mw2 > 2 && mh2 > 2) {
                  const ax2 = fn2.node.anchor?.x ?? 0.5, ay2 = fn2.node.anchor?.y ?? 0.5
                  const rx = p2.x - mw2 * ax2, ry = p2.y - mh2 * (1 - ay2)
                  if (mmX >= rx && mmX <= rx + mw2 && mmY >= ry && mmY <= ry + mh2) { hitUuid = fn2.node.uuid; break }
                } else {
                  if ((mmX - p2.x) ** 2 + (mmY - p2.y) ** 2 <= 16) { hitUuid = fn2.node.uuid; break }
                }
              }
              if (hitUuid) { onSelect(hitUuid); return }
              // R1498: 빈 공간 클릭 → 씬 좌표 역변환 → pan
              const scX = (mmX - mmOffX) / s + sceneX
              const scY = sceneH - (mmY - mmOffY) / s + sceneY
              const svgEl = svgRef.current
              if (!svgEl) return
              const svgRect = svgEl.getBoundingClientRect()
              const z = viewRef.current.zoom
              // R2560: 미니맵 클릭 팬 — 씬 좌표 역변환
              const svgClickX = svgRect.width / 2 - scX * z
              const svgClickY = svgRect.height / 2 + scY * z
              setView(v => ({ ...v, offsetX: svgClickX, offsetY: svgClickY }))
            }}
            title="미니맵 — 노드 클릭으로 선택 / 빈 공간 클릭으로 이동 (R2470)"
          >
            {/* drag handle */}
            <div
              style={{ height: 8, cursor: 'grab', background: 'rgba(255,255,255,0.08)', borderRadius: '3px 3px 0 0', flexShrink: 0 }}
              onMouseDown={e => {
                e.stopPropagation()
                const parent = (e.currentTarget.parentElement?.parentElement) as HTMLElement | null
                const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                if (!rect) return
                mmDragRef.current = {
                  startMouseX: e.clientX,
                  startMouseY: e.clientY,
                  startX: rect.left - (parent?.getBoundingClientRect().left ?? 0),
                  startY: rect.top - (parent?.getBoundingClientRect().top ?? 0),
                }
                const onMove = (me: MouseEvent) => {
                  if (!mmDragRef.current) return
                  const dx = me.clientX - mmDragRef.current.startMouseX
                  const dy = me.clientY - mmDragRef.current.startMouseY
                  setMmPos({ x: mmDragRef.current.startX + dx, y: mmDragRef.current.startY + dy })
                }
                const onUp = () => {
                  mmDragRef.current = null
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />
            <svg width={MM_W} height={MM_H}>
              {/* 씬 경계 */}
              <rect x={mmOffX} y={mmOffY} width={sceneW * s} height={sceneH * s} fill="none" stroke="#333" strokeWidth={0.5} />
              {/* R1554: 노드 rect/점 (크기 반영) */}
              {flatNodes.map(fn => {
                const p = toMM(fn.worldX, fn.worldY)
                const isSelected = fn.node.uuid === selectedUuid || multiSelected.has(fn.node.uuid)
                const isMatch = svSearch.trim() ? svSearchMatches.has(fn.node.uuid) : false
                const nw = fn.node.size?.x ?? 0
                const nh = fn.node.size?.y ?? 0
                const mw = nw * s, mh = nh * s
                if (mw > 2 && mh > 2) {
                  const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
                  return <rect key={fn.node.uuid}
                    x={p.x - mw * ax} y={p.y - mh * (1 - ay)}
                    width={mw} height={mh}
                    fill={isSelected ? 'rgba(88,166,255,0.2)' : isMatch ? 'rgba(255,68,255,0.2)' : 'rgba(255,255,255,0.05)'}
                    stroke={isSelected ? '#58a6ff' : isMatch ? '#ff44ff' : 'rgba(255,255,255,0.25)'}
                    strokeWidth={isSelected ? 0.8 : 0.4}
                  />
                }
                return <circle key={fn.node.uuid} cx={p.x} cy={p.y} r={isSelected ? 2 : 1.5}
                  fill={isSelected ? '#58a6ff' : isMatch ? '#ff44ff' : 'rgba(255,255,255,0.3)'} />
              })}
              {/* 뷰포트 사각형 */}
              <rect x={vpMM.x} y={vpMM.y} width={vpW2} height={vpH2}
                fill="rgba(88,166,255,0.06)" stroke="#58a6ff" strokeWidth={0.75} />
            </svg>
          </div>
        )
      })()}
      {/* R1496: 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 100,
            background: '#0d0d1a', border: '1px solid #2a2a3a', borderRadius: 5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)', minWidth: 140, padding: '3px 0',
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          {[
            ctxMenu.uuid && { label: '복사 (Ctrl+C)', action: () => { /* CocosPanel handles via keyboard */ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })) } },
            ctxMenu.uuid && { label: '붙여넣기 (Ctrl+V)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })) },
            ctxMenu.uuid && { label: '복제 (Ctrl+D)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true })) },
            ctxMenu.uuid && { label: '삭제 (Del)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })) },
            ctxMenu.uuid && { label: lockedUuids.has(ctxMenu.uuid) ? '🔓 잠금 해제' : '🔒 잠금', action: () => { toggleLock(ctxMenu.uuid!); setCtxMenu(null) } },
            { label: '전체 보기 (F)', action: () => handleFit() },
            ctxMenu.uuid && { label: '포커스 (F)', action: () => handleFitToSelected() },
            ctxMenu.uuid && { label: 'AI 분석 ✦', action: () => {
              const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
              if (!fn) return
              const info = `노드 "${fn.node.name}" 분석 요청:\n- 위치: (${fn.worldX.toFixed(1)}, ${fn.worldY.toFixed(1)})\n- 크기: ${fn.node.size ? `${fn.node.size.x}×${fn.node.size.y}` : '없음'}\n- 컴포넌트: ${fn.node.components.map(c => c.type.replace('cc.','')).join(', ') || '없음'}`
              window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { text: info } }))
            }},
            // R1621: 같은 컴포넌트 타입 노드 모두 선택
            ctxMenu.uuid && (() => {
              const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
              const firstType = fn?.node.components?.[0]?.type
              if (!firstType) return false
              return { label: `같은 "${firstType.replace('cc.', '')}" 모두 선택`, action: () => {
                const matched = flatNodes.filter(f => f.node.components?.[0]?.type === firstType).map(f => f.node.uuid)
                setMultiSelected(new Set(matched))
                if (matched.length > 0) onSelect(matched[0])
              }}
            })(),
            // R2590: 동일 이름 노드 모두 선택
            ctxMenu.uuid && (() => {
              const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
              if (!fn) return false
              const count = flatNodes.filter(f => f.node.name === fn.node.name).length
              if (count < 2) return false
              return { label: `"${fn.node.name}" 동일 이름 모두 선택 (${count}개)`, action: () => {
                const matched = flatNodes.filter(f => f.node.name === fn.node.name).map(f => f.node.uuid)
                setMultiSelected(new Set(matched))
                if (matched.length > 0) onSelect(matched[0])
                setCtxMenu(null)
              }}
            })(),
            // R1717: 활성/비활성 토글 + 새 노드 추가
            ctxMenu.uuid && (() => {
              const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
              if (!fn) return false
              return { label: fn.node.active ? '◌ 비활성화 (H키)' : '● 활성화 (H키)', action: () => { onToggleActive?.(fn.node.uuid); setCtxMenu(null) } }
            })(),
            { label: '＋ 새 노드 추가 (Ctrl+N)', action: () => { onAddNode?.(ctxMenu.uuid ?? selectedUuid, undefined); setCtxMenu(null) } },
          ].filter(Boolean).map((item, i) => (
            item ? (
              <div
                key={i}
                onClick={() => { item.action(); setCtxMenu(null) }}
                style={{ padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: item.label.includes('AI') ? '#a78bfa' : 'var(--text-primary, #ccc)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </div>
            ) : null
          ))}
        </div>
      )}
      {/* R1630: 회전 중 각도 레이블 */}
      {rotateOverride && hoverClientPos && (() => {
        const svgEl = svgRef.current
        const rect = svgEl?.getBoundingClientRect()
        const relX = rect ? hoverClientPos.x - rect.left + 14 : 14
        const relY = rect ? hoverClientPos.y - rect.top - 26 : 0
        const angle = ((rotateOverride.angle % 360) + 360) % 360
        return (
          <div style={{
            position: 'absolute', left: relX, top: relY,
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(167,139,250,0.4)',
            borderRadius: 3, padding: '1px 5px', fontSize: 9,
            color: '#a78bfa', pointerEvents: 'none', userSelect: 'none',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', zIndex: 100,
          }}>
            {angle.toFixed(1)}°
          </div>
        )
      })()}
      {/* R1629: 리사이즈 중 현재 크기 레이블 */}
      {resizeOverride && hoverClientPos && (() => {
        const svgEl = svgRef.current
        const rect = svgEl?.getBoundingClientRect()
        const relX = rect ? hoverClientPos.x - rect.left + 14 : 14
        const relY = rect ? hoverClientPos.y - rect.top - 26 : 0
        return (
          <div style={{
            position: 'absolute', left: relX, top: relY,
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,153,68,0.4)',
            borderRadius: 3, padding: '1px 5px', fontSize: 9,
            color: '#ff9944', pointerEvents: 'none', userSelect: 'none',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', zIndex: 100,
          }}>
            {Math.round(resizeOverride.w)}×{Math.round(resizeOverride.h)}
          </div>
        )
      })()}
      {/* R1628: 드래그 중 좌표 변화 레이블 */}
      {dragOverride && hoverClientPos && (() => {
        const dr = dragRef.current
        if (!dr) return null
        const dx = Math.round(dragOverride.x - dr.startNodeX)
        const dy = Math.round(dragOverride.y - dr.startNodeY)
        const svgEl = svgRef.current
        const rect = svgEl?.getBoundingClientRect()
        const relX = rect ? hoverClientPos.x - rect.left + 14 : 14
        const relY = rect ? hoverClientPos.y - rect.top - 26 : 0
        return (
          <div style={{
            position: 'absolute', left: relX, top: relY,
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(88,166,255,0.4)',
            borderRadius: 3, padding: '1px 5px', fontSize: 9,
            color: '#58a6ff', pointerEvents: 'none', userSelect: 'none',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', zIndex: 100,
          }}>
            {dx >= 0 ? '+' : ''}{dx}, {dy >= 0 ? '+' : ''}{dy}
          </div>
        )
      })()}
      {/* R1598: 마우스 위치 좌표 오버레이 (R1649: 선택 노드 크기 추가) */}
      {mouseScenePos && (
        <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 9, color: '#556', background: 'rgba(0,0,0,0.4)', padding: '1px 5px', borderRadius: 3, pointerEvents: 'none', userSelect: 'none', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 8 }}>
          {selectedUuid && (() => {
            const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!fn?.node.size?.x) return null
            const w = resizeOverride?.uuid === selectedUuid ? resizeOverride.w : fn.node.size.x
            const h = resizeOverride?.uuid === selectedUuid ? resizeOverride.h : fn.node.size.y
            return <span style={{ color: '#445' }}>{Math.round(w)}×{Math.round(h)}</span>
          })()}
          <span>{mouseScenePos.x}, {mouseScenePos.y}</span>
        </div>
      )}
      {/* Right-click node context menu (overlapping nodes) */}
      {nodePickMenu && (
        <div ref={nodePickMenuRef} style={{
          position: 'fixed', left: nodePickMenu.x, top: nodePickMenu.y, zIndex: 1000,
          background: 'rgba(10,14,28,0.97)', border: '1px solid rgba(88,166,255,0.3)',
          borderRadius: 5, padding: '4px 0', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          fontSize: 10,
        }}>
          <div style={{ padding: '2px 10px 4px', fontSize: 9, color: '#556', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 2 }}>
            노드 선택 ({nodePickMenu.nodes.length})
          </div>
          {nodePickMenu.nodes.map(n => (
            <div
              key={n.uuid}
              onClick={() => { onSelect?.(n.uuid); setNodePickMenu(null) }}
              style={{ padding: '3px 10px', cursor: 'pointer', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >{n.name}</div>
          ))}
        </div>
      )}
    </div>
  )
}
