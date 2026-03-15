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
}

/**
 * CC 파일 기반 씬뷰 (Phase A)
 * SVG 렌더링, 팬/줌, 노드 선택
 * WS Extension 없이 파싱된 CCSceneNode 트리를 직접 표시
 */
// R2486: 씬별 뷰 상태 영속화 — scenePath 기반 localStorage 키
function sceneViewKey(scenePath: string) {
  return 'sv-view2-' + scenePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-60)
}

export function CCFileSceneView({ sceneFile, selectedUuid, onSelect, onMove, onResize, onRename, onRotate, onMultiMove, onMultiDelete, onLabelEdit, onAddNode, onAnchorMove, onMultiSelectChange, onDuplicate, onToggleActive, onReorder, pulseUuid, onGroupNodes, onOpacity }: CCFileSceneViewProps) {
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
  const dragRef = useRef<{ uuid: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number } | null>(null)
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
  // R1605: 편집 잠금 (View-only lock)
  const [viewLock, setViewLock] = useState(false)
  // R1610: 비활성 노드 완전 숨기기
  const [hideInactiveNodes, setHideInactiveNodes] = useState(false)
  // R1692: 시각적 숨기기 (에디터 전용, active 불변)
  const [hiddenUuids, setHiddenUuids] = useState<Set<string>>(new Set())
  // R1693: 좌표 핀 마커 (Ctrl+P로 추가, 클릭으로 삭제)
  const [pinMarkers, setPinMarkers] = useState<{ id: number; ccX: number; ccY: number }[]>([])
  const pinIdRef = useRef(0)
  const hoverClientPosRef = useRef<{ x: number; y: number } | null>(null)
  // R1697: 노드 레이블 폰트 크기 (기본 11px)
  const [labelFontSize, setLabelFontSize] = useState(11)
  // R1703: 형제 그룹 하이라이트
  const [showSiblingGroup, setShowSiblingGroup] = useState(false)
  // R1705: 선택 이력 (Alt+← / Alt+→)
  const selHistoryRef = useRef<string[]>([])
  const selHistoryIdxRef = useRef(-1)
  // R1623: 와이어프레임 모드 (선만 표시)
  const [wireframeMode, setWireframeMode] = useState(false)
  // R1641: depth 색조 시각화
  const [depthColorMode, setDepthColorMode] = useState(false)
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
  const isSpaceDownRef = useRef(false)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const multiSelectedRef = useRef(multiSelected)
  multiSelectedRef.current = multiSelected
  const selBoxRef = useRef<{ startSvgX: number; startSvgY: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  // R2465: 거리 측정 도구
  const [measureMode, setMeasureMode] = useState(false)
  const [measureLine, setMeasureLine] = useState<{ svgX1: number; svgY1: number; svgX2: number; svgY2: number } | null>(null)
  const measureStartRef = useRef<{ svgX: number; svgY: number } | null>(null)

  // R1516: 다중 선택 변경 → 부모에 알림
  useEffect(() => {
    onMultiSelectChange?.(Array.from(multiSelected))
  }, [multiSelected, onMultiSelectChange])

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
    function walk(node: CCSceneNode, worldX: number, worldY: number, depth: number, parentUuid: string | null, siblingIdx: number, siblingTotal: number) {
      const x = worldX + (typeof node.position === 'object' ? (node.position as { x: number }).x : 0)
      const y = worldY + (typeof node.position === 'object' ? (node.position as { y: number }).y : 0)
      result.push({ node, worldX: x, worldY: y, depth, parentUuid, siblingIdx, siblingTotal })
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], x, y, depth + 1, node.uuid, i, node.children.length)
      }
    }
    // Scene 루트 자체는 건너뜀 (이름 없는 컨테이너)
    for (let i = 0; i < sceneFile.root.children.length; i++) {
      walk(sceneFile.root.children[i], 0, 0, 0, null, i, sceneFile.root.children.length)
    }
    return result
  }, [sceneFile])

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

  // Sprite UUID → local:// URL 비동기 해상
  useEffect(() => {
    const assetsDir = sceneFile.projectInfo.assetsDir
    if (!assetsDir) return
    const uuids = flatNodes
      .flatMap(fn => fn.node.components.filter(c => c.type === 'cc.Sprite' || c.type === 'Sprite'))
      .map(c => (c.props.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__)
      .filter((u): u is string => !!u && !spriteCacheRef.current.has(u))
    if (!uuids.length) return
    uuids.forEach(uuid => {
      spriteCacheRef.current.set(uuid, '') // pending sentinel
      window.api.ccFileResolveTexture?.(uuid, assetsDir).then(url => {
        if (url) spriteCacheRef.current.set(uuid, url)
        setSpriteCacheVer(v => v + 1)
      }).catch(() => {})
    })
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

  const handleMouseUp = useCallback(() => {
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
      onMove?.(dragOverride.uuid, dragOverride.x, dragOverride.y)
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
        setMultiSelected(picked)
        if (picked.size > 0) onSelect([...picked][0])
      }
    }
    selBoxRef.current = null
    setSelectionBox(null)
  }, [anchorOverride, rotateOverride, dragOverride, resizeOverride, selectionBox, flatNodes, ccToSvg, onAnchorMove, onRotate, onMove, onResize, onSelect])

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
      const ctx = canvas.getContext('2d')!
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
        display: 'flex', gap: 4, padding: '2px 8px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, alignItems: 'center', fontSize: 10,
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
                  id="res-custom-w"
                  style={{ width: 50, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>×</span>
                <input type="number" placeholder="H" defaultValue={effectiveH}
                  id="res-custom-h"
                  style={{ width: 50, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                />
                <button onClick={() => {
                  const w = parseInt((document.getElementById('res-custom-w') as HTMLInputElement)?.value)
                  const h = parseInt((document.getElementById('res-custom-h') as HTMLInputElement)?.value)
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
              width: 90, fontSize: 9, background: svSearchMatches.size > 0 ? 'rgba(88,166,255,0.08)' : 'var(--bg-primary)',
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
        <span style={{
          fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(88,166,255,0.15)',
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
        {/* R2326: 배경 패턴 토글 (체크무늬) */}
        <button
          onClick={() => setBgPattern(p => p === 'solid' ? 'checker' : 'solid')}
          title={`배경 패턴: ${bgPattern === 'solid' ? '단색' : '체크무늬'} (클릭 전환)`}
          style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: bgPattern === 'checker' ? 'rgba(88,166,255,0.12)' : 'none', color: bgPattern === 'checker' ? '#58a6ff' : 'var(--text-muted)', flexShrink: 0 }}
        >⊞</button>
        {/* R2456: 그리드 오버레이 토글 */}
        <button
          onClick={() => setShowGrid(g => !g)}
          title={`그리드 오버레이 (${snapSize}px 간격) — ${showGrid ? '숨기기' : '표시'}`}
          style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showGrid ? 'rgba(100,220,100,0.5)' : 'var(--border)'}`, background: showGrid ? 'rgba(100,220,100,0.1)' : 'none', color: showGrid ? 'rgba(100,220,100,0.9)' : 'var(--text-muted)', flexShrink: 0 }}
        >#</button>
        {/* R2501: 중심선 가이드 오버레이 토글 */}
        <button
          onClick={() => setShowCrossGuide(g => !g)}
          title={`중심선 가이드 — CC 좌표 원점(0,0) 기준 수직/수평선 (R2501)`}
          style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCrossGuide ? 'rgba(251,146,60,0.5)' : 'var(--border)'}`, background: showCrossGuide ? 'rgba(251,146,60,0.1)' : 'none', color: showCrossGuide ? 'rgba(251,146,60,0.9)' : 'var(--text-muted)', flexShrink: 0 }}
        >⊕</button>
        {/* R1681: 선택 노드 테두리 색상 */}
        <input
          type="color"
          value={selectionColor}
          title="선택 노드 테두리 색상 (더블클릭: 초기화)"
          onChange={e => setSelectionColor(e.target.value)}
          onDoubleClick={() => setSelectionColor('#58a6ff')}
          style={{ width: 18, height: 18, border: `2px solid ${selectionColor}`, borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0, background: 'transparent' }}
        />
        {/* R1674: snap size 사용자 설정 (custom 입력 + datalist 프리셋) */}
        <>
          <datalist id="snap-size-list">
            {[1, 5, 10, 25, 50, 100].map(s => <option key={s} value={s} />)}
          </datalist>
          <input
            type="number" min={1} max={500} value={snapSize} list="snap-size-list"
            onChange={e => { const v = parseInt(e.target.value); if (v > 0) setSnapSize(v) }}
            title={`Ctrl+드래그 스냅 크기: ${snapSize}px`}
            style={{ width: 36, fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', padding: '1px 3px', textAlign: 'center' }}
          />
        </>
        <button
          onClick={() => setGridStyle(s => s === 'none' ? 'line' : s === 'line' ? 'dot' : 'none')}
          title={`그리드: ${gridStyle === 'none' ? '없음' : gridStyle === 'line' ? '선' : '점'} (클릭으로 전환)`}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: gridStyle !== 'none' ? 'rgba(88,166,255,0.12)' : 'none', color: gridStyle !== 'none' ? '#58a6ff' : 'var(--text-muted)' }}
        >
          {gridStyle === 'dot' ? '·' : '⊹'}
        </button>
        <button
          onClick={() => setShowNodeNames(n => !n)}
          title="노드 이름 표시 토글"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showNodeNames ? 'rgba(88,166,255,0.12)' : 'none', color: showNodeNames ? '#58a6ff' : 'var(--text-muted)' }}
        >
          T
        </button>
        {/* R1703: 형제 그룹 하이라이트 버튼 */}
        <button
          onClick={() => setShowSiblingGroup(s => !s)}
          title="선택 노드 형제 그룹 하이라이트 (G) (R1703)"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showSiblingGroup ? '#fbbf24' : 'var(--border)'}`, background: showSiblingGroup ? 'rgba(251,191,36,0.12)' : 'none', color: showSiblingGroup ? '#fbbf24' : 'var(--text-muted)' }}
        >G</button>
        {/* R1697: 레이블 폰트 크기 조정 */}
        {showNodeNames && (
          <>
            <span
              onClick={() => setLabelFontSize(s => Math.max(6, s - 1))}
              title="레이블 폰트 크기 감소 (R1697)"
              style={{ fontSize: 9, cursor: 'pointer', color: 'var(--text-muted)', userSelect: 'none', padding: '0 2px' }}
            >A-</span>
            <span style={{ fontSize: 8, color: '#555', minWidth: 14, textAlign: 'center' }}>{labelFontSize}</span>
            <span
              onClick={() => setLabelFontSize(s => Math.min(20, s + 1))}
              title="레이블 폰트 크기 증가 (R1697)"
              style={{ fontSize: 9, cursor: 'pointer', color: 'var(--text-muted)', userSelect: 'none', padding: '0 2px' }}
            >A+</span>
          </>
        )}
        {/* R1687: z-order 표시 버튼 */}
        <button
          onClick={() => setShowZOrder(n => !n)}
          title="형제 순서(z-order) 인덱스 표시 토글"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showZOrder ? 'rgba(251,191,36,0.12)' : 'none', color: showZOrder ? '#fbbf24' : 'var(--text-muted)' }}
        >#</button>
        <button
          onClick={handleFit}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
        >
          ⊞ Fit
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
        {/* R1602: 눈금자 토글 */}
        <button
          onClick={() => setShowRuler(r => !r)}
          title="눈금자 표시 (R1602)"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showRuler ? 'rgba(88,166,255,0.12)' : 'none', color: showRuler ? '#58a6ff' : 'var(--text-muted)' }}
        >尺</button>
        {/* R1605: 편집 잠금 */}
        <button
          onClick={() => setViewLock(l => !l)}
          title={viewLock ? '편집 잠금 해제 (R1605)' : '편집 잠금 — 보기 전용 모드 (R1605)'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${viewLock ? '#f85149' : 'var(--border)'}`, background: viewLock ? 'rgba(248,81,73,0.12)' : 'none', color: viewLock ? '#f85149' : 'var(--text-muted)' }}
        >{viewLock ? '🔒' : '🔓'}</button>
        {/* R1610: 비활성 노드 숨기기 */}
        <button
          onClick={() => setHideInactiveNodes(h => !h)}
          title={hideInactiveNodes ? '비활성 노드 표시' : '비활성 노드 숨기기 (R1610)'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${hideInactiveNodes ? '#fbbf24' : 'var(--border)'}`, background: hideInactiveNodes ? 'rgba(251,191,36,0.12)' : 'none', color: hideInactiveNodes ? '#fbbf24' : 'var(--text-muted)' }}
        >👁</button>
        {/* R1692: 시각적 숨김 노드 카운트 + 초기화 */}
        {hiddenUuids.size > 0 && (
          <button
            onClick={() => setHiddenUuids(new Set())}
            title={`시각적으로 숨긴 노드 ${hiddenUuids.size}개 — 클릭하여 모두 표시 (R1692)`}
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,146,60,0.5)', background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}
          >👁‍🗨 {hiddenUuids.size}</button>
        )}
        {/* R1693: 핀 마커 카운트 + 초기화 */}
        {pinMarkers.length > 0 && (
          <button
            onClick={() => setPinMarkers([])}
            title={`핀 마커 ${pinMarkers.length}개 — 클릭하여 모두 삭제 (R1693)`}
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(244,114,182,0.5)', background: 'rgba(244,114,182,0.12)', color: '#f472b6' }}
          >📌 {pinMarkers.length}</button>
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
        </>)}
        {/* R1623: 와이어프레임 모드 */}
        <button
          onClick={() => setWireframeMode(w => !w)}
          title={wireframeMode ? '와이어프레임 모드 해제' : '와이어프레임 모드 — 선만 표시 (R1623)'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${wireframeMode ? '#58a6ff' : 'var(--border)'}`, background: wireframeMode ? 'rgba(88,166,255,0.12)' : 'none', color: wireframeMode ? '#58a6ff' : 'var(--text-muted)' }}
        >⬚</button>
        {/* R1659: 솔로 모드 */}
        <button
          onClick={() => setSoloMode(m => !m)}
          title={soloMode ? '솔로 모드 해제' : '솔로 모드 (선택 노드 외 흐리게)'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${soloMode ? '#f97316' : 'var(--border)'}`, background: soloMode ? 'rgba(249,115,22,0.12)' : 'none', color: soloMode ? '#f97316' : 'var(--text-muted)' }}
        >◎</button>
        {/* R1641: depth 색조 시각화 */}
        <button
          onClick={() => setDepthColorMode(d => !d)}
          title={depthColorMode ? 'Depth 색조 시각화 해제' : 'Depth별 색조 표시 (R1641)'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${depthColorMode ? '#a78bfa' : 'var(--border)'}`, background: depthColorMode ? 'rgba(167,139,250,0.12)' : 'none', color: depthColorMode ? '#a78bfa' : 'var(--text-muted)' }}
        >⧫</button>
        {/* R1474: 씬뷰 스크린샷 → Claude AI 분석 */}
        <button
          onClick={e => handleScreenshotAI(e)}
          title="씬 스크린샷 → Claude 비전 분석 / Shift+클릭: PNG 저장 (R1708)"
          disabled={screenshotSending}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: screenshotSending ? 'wait' : 'pointer', border: '1px solid var(--border)', background: screenshotSending ? 'rgba(255,200,50,0.12)' : 'none', color: screenshotSending ? '#fbbf24' : 'var(--text-muted)', opacity: screenshotSending ? 0.6 : 1 }}
        >{screenshotSending ? '⟳' : '📷'}</button>
        {/* R2315: SVG 직접 내보내기 */}
        <button
          onClick={handleSvgExport}
          title="씬 SVG 파일 내보내기 (R2315)"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
        >SVG</button>
        {/* R2319: 카메라 프레임 토글 */}
        {cameraFrames.length > 0 && (
          <button
            onClick={() => setShowCameraFrames(v => !v)}
            title={showCameraFrames ? '카메라 프레임 숨기기 (R2319)' : '카메라 프레임 표시 (R2319)'}
            style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showCameraFrames ? 'rgba(255,200,60,0.5)' : 'var(--border)'}`, background: showCameraFrames ? 'rgba(255,200,60,0.1)' : 'none', color: showCameraFrames ? 'rgba(255,200,60,0.9)' : 'var(--text-muted)' }}
          >📷</button>
        )}
        {/* R1530: 디자인 레퍼런스 이미지 overlay */}
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
        <button
          onClick={() => refImgSrc ? setRefImgSrc(null) : refImgInputRef.current?.click()}
          title={refImgSrc ? '레퍼런스 이미지 제거' : '디자인 레퍼런스 이미지 로드'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: refImgSrc ? 'rgba(100,200,100,0.12)' : 'none', color: refImgSrc ? '#4ade80' : 'var(--text-muted)' }}
        >📐</button>
        {refImgSrc && (
          <input type="range" min={0.05} max={1} step={0.05} value={refImgOpacity}
            onChange={e => setRefImgOpacity(parseFloat(e.target.value))}
            title={`레퍼런스 투명도 ${Math.round(refImgOpacity * 100)}%`}
            style={{ width: 50 }}
          />
        )}
        {/* R2465: 거리 측정 도구 */}
        <button
          onClick={() => { setMeasureMode(m => { if (m) setMeasureLine(null); return !m }); measureStartRef.current = null }}
          title={measureMode ? '측정 도구 종료 (M)' : '거리 측정 도구 (M) — 드래그로 두 점 거리 측정 (R2465)'}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${measureMode ? '#ff6b6b' : 'var(--border)'}`, background: measureMode ? 'rgba(255,107,107,0.12)' : 'none', color: measureMode ? '#ff6b6b' : 'var(--text-muted)', flexShrink: 0 }}
        >📏</button>
        {measureLine && measureMode && (
          <span style={{ fontSize: 9, color: '#ff6b6b', flexShrink: 0, fontFamily: 'monospace' }}>
            {Math.sqrt((measureLine.svgX2 - measureLine.svgX1) ** 2 + (measureLine.svgY2 - measureLine.svgY1) ** 2).toFixed(1)}px
          </span>
        )}
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
        {/* R1489: 미니맵 토글 */}
        <button
          onClick={() => setShowMinimap(m => !m)}
          title="미니맵 토글 (M)"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showMinimap ? 'rgba(88,166,255,0.12)' : 'none', color: showMinimap ? '#58a6ff' : 'var(--text-muted)' }}
        >⊟</button>
        <button
          onClick={() => setShowHelp(h => !h)}
          title="단축키 도움말"
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: showHelp ? 'rgba(88,166,255,0.12)' : 'none', color: showHelp ? '#58a6ff' : 'var(--text-muted)' }}
        >?</button>
      </div>

      {/* SVG 캔버스 */}
      <svg
        ref={svgRef}
        style={{ flex: 1, background: '#1a1a2e', cursor: isPanning ? 'grabbing' : dragOverride ? 'grabbing' : rotateOverride ? 'crosshair' : measureMode ? 'crosshair' : 'default', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setMouseScenePos(null) }}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, uuid: selectedUuid }) }}
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
          {/* 캔버스 외부 빗금 패턴 */}
          <pattern id="hatchOutside" width={8 / view.zoom} height={8 / view.zoom} patternUnits="userSpaceOnUse">
            <line x1={0} y1={8 / view.zoom} x2={8 / view.zoom} y2={0} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / view.zoom} />
          </pattern>
          <mask id="outsideMask">
            <rect x={-99999} y={-99999} width={199999} height={199999} fill="white" />
            <rect x={0} y={0} width={effectiveW} height={effectiveH} fill="black" />
          </mask>
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
            const effX = dragOverride?.uuid === selectedUuid ? dragOverride.x : fn.worldX
            const effY = dragOverride?.uuid === selectedUuid ? dragOverride.y : fn.worldY
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
          {/* 노드 렌더링 (비활성 노드는 반투명 표시) */}
          {flatNodes.map(({ node, worldX, worldY }) => {
            const isDragged = dragOverride?.uuid === node.uuid
            const isResized = resizeOverride?.uuid === node.uuid
            // R2472: 다중 선택 동시 드래그 오프셋
            const isMultiDragged = !isDragged && !!multiDragDelta && multiSelected.has(node.uuid)
            const effX = isDragged ? dragOverride!.x : isMultiDragged ? worldX + multiDragDelta!.dx : worldX
            const effY = isDragged ? dragOverride!.y : isMultiDragged ? worldY + multiDragDelta!.dy : worldY
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
            const nodeOpacity = (node.active ? (node.opacity ?? 255) / 255 : 0.2) * (isOutOfCanvas ? 0.4 : 1) * searchDim * soloDim

            const anchorX = node.anchor?.x ?? 0.5
            const anchorY = node.anchor?.y ?? 0.5
            const rectX = svgPos.x - w * anchorX
            const rectY = svgPos.y - h * (1 - anchorY)
            // CC rotation: Z-euler (반시계방향 양수). SVG: 시계방향 양수 → 부호 반전
            const rotZ = rotateOverride?.uuid === node.uuid
              ? rotateOverride.angle
              : (typeof node.rotation === 'number' ? node.rotation : (node.rotation as { z?: number }).z ?? 0)
            const rotTransform = rotZ !== 0 ? `rotate(${-rotZ}, ${svgPos.x}, ${svgPos.y})` : undefined

            const hasLabel = node.components.some(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
            const hasSprite = node.components.some(c => c.type === 'cc.Sprite' || c.type === 'Sprite')
            const hasBg = node.components.some(c => ['cc.Canvas', 'cc.Layout'].includes(c.type))
            const hasButton = node.components.some(c => c.type === 'cc.Button' || c.type === 'Button')
            const hasScroll = node.components.some(c => c.type === 'cc.ScrollView' || c.type === 'cc.ScrollBar')
            const hasEdit = node.components.some(c => c.type === 'cc.EditBox')
            const hasSlider = node.components.some(c => c.type === 'cc.Slider' || c.type === 'cc.Toggle' || c.type === 'cc.ToggleGroup')

            // R1623: 와이어프레임 모드시 fill 투명
            // R1641: depth 색조 — hue 순환 (30° 간격)
            const depthHue = depthColorMode ? (fn.depth * 47) % 360 : 0
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
                  className={isSelected ? 'cc-selected-rect' : undefined}
                />
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
                  const sc = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'Sprite')
                  const sfUuid = (sc?.props?.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__
                  const imgUrl = sfUuid ? spriteCacheRef.current.get(sfUuid) : undefined
                  if (!imgUrl) return null
                  const iw = Math.abs(w) || 1
                  const ih = Math.abs(h) || 1
                  return (
                    <image
                      href={imgUrl}
                      x={rectX} y={rectY}
                      width={iw} height={ih}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })()}
                {/* Label 텍스트 렌더링 + R1491 더블클릭 인라인 편집 */}
                {hasLabel && (() => {
                  const lc = node.components.find(c => c.type === 'cc.Label' || c.type === 'Label' || c.type === 'cc.RichText')
                  const str = (lc?.props?.string as string | undefined) ?? (lc?.props?._string as string | undefined) ?? ''
                  if (!str && editingLabelUuid !== node.uuid) return null
                  const fs = Math.min(Math.max((lc?.props?.fontSize as number | undefined) ?? 20, 8), 200)
                  const { r: cr = 255, g: cg = 255, b: cb = 255 } = node.color ?? {}
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
                  return (
                    <text
                      x={rectX + w / 2} y={rectY + h / 2}
                      fontSize={fs / view.zoom}
                      fill={`rgb(${cr},${cg},${cb})`}
                      textAnchor="middle" dominantBaseline="middle"
                      style={{ pointerEvents: isSelected ? 'auto' : 'none', userSelect: 'none', cursor: 'text' }}
                      onDoubleClick={e => {
                        e.stopPropagation()
                        setEditingLabelUuid(node.uuid)
                        setTimeout(() => editLabelRef.current?.focus(), 30)
                      }}
                    >
                      {str}
                    </text>
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
                    {/* R1510: cc.Widget 레이아웃 제약 시각화 */}
                    {(() => {
                      const widgetComp = node.components.find(c =>
                        c.type === 'cc.Widget' || c.type === 'Widget'
                      )
                      if (!widgetComp) return null
                      const flags = (widgetComp.props.alignFlags ?? widgetComp.props._alignFlags ?? 0) as number
                      const arrowLen = 10 / view.zoom
                      const arrowHead = 3 / view.zoom
                      const stroke = '#7c3aed'
                      const sw = 1.5 / view.zoom
                      const cx2 = rectX + w / 2
                      const cy2 = rectY + h / 2
                      const lines: React.ReactElement[] = []
                      // TOP=1: 상단 가장자리 → 위쪽 화살표
                      if (flags & 1) lines.push(
                        <g key="top" pointerEvents="none">
                          <line x1={cx2} y1={rectY} x2={cx2} y2={rectY - arrowLen} stroke={stroke} strokeWidth={sw} />
                          <polygon points={`${cx2},${rectY - arrowLen} ${cx2 - arrowHead},${rectY - arrowLen + arrowHead*1.5} ${cx2 + arrowHead},${rectY - arrowLen + arrowHead*1.5}`} fill={stroke} />
                        </g>
                      )
                      // BOT=4: 하단 가장자리 → 아래쪽 화살표
                      if (flags & 4) lines.push(
                        <g key="bot" pointerEvents="none">
                          <line x1={cx2} y1={rectY + h} x2={cx2} y2={rectY + h + arrowLen} stroke={stroke} strokeWidth={sw} />
                          <polygon points={`${cx2},${rectY + h + arrowLen} ${cx2 - arrowHead},${rectY + h + arrowLen - arrowHead*1.5} ${cx2 + arrowHead},${rectY + h + arrowLen - arrowHead*1.5}`} fill={stroke} />
                        </g>
                      )
                      // LEFT=8: 좌측 → 왼쪽 화살표
                      if (flags & 8) lines.push(
                        <g key="left" pointerEvents="none">
                          <line x1={rectX} y1={cy2} x2={rectX - arrowLen} y2={cy2} stroke={stroke} strokeWidth={sw} />
                          <polygon points={`${rectX - arrowLen},${cy2} ${rectX - arrowLen + arrowHead*1.5},${cy2 - arrowHead} ${rectX - arrowLen + arrowHead*1.5},${cy2 + arrowHead}`} fill={stroke} />
                        </g>
                      )
                      // RIGHT=32: 우측 → 오른쪽 화살표
                      if (flags & 32) lines.push(
                        <g key="right" pointerEvents="none">
                          <line x1={rectX + w} y1={cy2} x2={rectX + w + arrowLen} y2={cy2} stroke={stroke} strokeWidth={sw} />
                          <polygon points={`${rectX + w + arrowLen},${cy2} ${rectX + w + arrowLen - arrowHead*1.5},${cy2 - arrowHead} ${rectX + w + arrowLen - arrowHead*1.5},${cy2 + arrowHead}`} fill={stroke} />
                        </g>
                      )
                      return lines.length > 0 ? <>{lines}</> : null
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
              <g key={pm.id} style={{ cursor: 'pointer' }} onClick={() => setPinMarkers(prev => prev.filter(p => p.id !== pm.id))}>
                <line x1={sp.x} y1={sp.y - r} x2={sp.x} y2={sp.y + r} stroke="#f472b6" strokeWidth={1.5 / view.zoom} />
                <line x1={sp.x - r} y1={sp.y} x2={sp.x + r} y2={sp.y} stroke="#f472b6" strokeWidth={1.5 / view.zoom} />
                <circle cx={sp.x} cy={sp.y} r={2 / view.zoom} fill="#f472b6" />
                <text x={sp.x + 5 / view.zoom} y={sp.y - 4 / view.zoom} fontSize={8 / view.zoom} fill="#f472b6" fontFamily="monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {pm.ccX},{pm.ccY}
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
            const w = pn.size!.x, h = pn.size!.y
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
                  const w = cn.size!.x, h = cn.size!.y
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
                  const w = sn.size!.x, h = sn.size!.y
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
      {/* 미니맵 */}
      {view.zoom < 0.8 && (() => {
        const mmW = 80; const mmH = 60
        const mmScale = Math.min(mmW / designW, mmH / designH) * 0.95
        const mmOffX = (mmW - designW * mmScale) / 2
        const mmOffY = (mmH - designH * mmScale) / 2
        // 현재 뷰포트를 게임 좌표로 변환
        const svgEl = svgRef.current
        const svgW = svgEl?.clientWidth ?? 300
        const svgH = svgEl?.clientHeight ?? 200
        const vpX = -view.offsetX / view.zoom
        const vpY = -view.offsetY / view.zoom
        const vpW = svgW / view.zoom
        const vpH = svgH / view.zoom
        return (
          <div style={{
            position: 'absolute', top: 28, right: 4,
            width: mmW, height: mmH, background: 'rgba(0,0,0,0.7)',
            border: '1px solid #444', borderRadius: 3, overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            <svg width={mmW} height={mmH}>
              {/* 게임 캔버스 */}
              <rect x={mmOffX} y={mmOffY} width={designW * mmScale} height={designH * mmScale}
                fill={bgColorOverride ?? bgColor} stroke="#666" strokeWidth={0.5} />
              {/* 노드들 */}
              {flatNodes.filter(fn => fn.node.size?.x && fn.node.size?.y).map(({ node, worldX, worldY }) => {
                const sx = mmOffX + (ccToSvg(worldX, worldY).x - (node.anchor?.x ?? 0.5) * (node.size.x)) * mmScale
                const sy = mmOffY + (ccToSvg(worldX, worldY).y - (1 - (node.anchor?.y ?? 0.5)) * (node.size.y)) * mmScale
                const sw = Math.abs(node.size.x) * mmScale; const sh = Math.abs(node.size.y) * mmScale
                return <rect key={node.uuid} x={sx} y={sy} width={sw} height={sh}
                  fill={node.uuid === selectedUuid ? 'rgba(88,166,255,0.4)' : 'rgba(255,255,255,0.1)'}
                  stroke={node.uuid === selectedUuid ? '#58a6ff' : '#555'} strokeWidth={0.3} />
              })}
              {/* 뷰포트 박스 */}
              <rect
                x={mmOffX + vpX * mmScale} y={mmOffY + vpY * mmScale}
                width={vpW * mmScale} height={vpH * mmScale}
                fill="none" stroke="#58a6ff" strokeWidth={0.8} strokeDasharray="2,1"
              />
            </svg>
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
            <span style={{ pointerEvents: 'none', color: dragOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>pos</span> {parseFloat(pos.x.toFixed(2))},{parseFloat(pos.y.toFixed(2))}{/* R1611: 드래그 delta */}{dragOverride?.uuid === node.uuid && dragRef.current && ` (Δ${(dragOverride.x - dragRef.current.startNodeX).toFixed(0)},${(dragOverride.y - dragRef.current.startNodeY).toFixed(0)})`}</span>
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
        const ofX = (MM_W - sceneW * s) / 2
        const ofY = (MM_H - sceneH * s) / 2
        const toMM = (x: number, y: number) => ({
          x: (x - sceneX) * s + ofX,
          y: (sceneH - (y - sceneY)) * s + ofY,  // Y 반전 (CC Y축 위=+)
        })
        const vpMM = toMM(vpX, vpY + vpH)
        const vpW2 = vpW * s, vpH2 = vpH * s
        return (
          <div style={{
            position: 'absolute', bottom: 8, right: 8, zIndex: 5,
            width: MM_W, height: MM_H,
            background: 'rgba(10,10,20,0.85)', border: '1px solid #333',
            borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
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
              const scX = (mmX - ofX) / s + sceneX
              const scY = sceneH - (mmY - ofY) / s + sceneY
              const svgEl = svgRef.current
              if (!svgEl) return
              const svgRect = svgEl.getBoundingClientRect()
              const z = viewRef.current.zoom
              setView(v => ({
                ...v,
                offsetX: svgRect.width / 2 - scX * z,
                offsetY: svgRect.height / 2 + scY * z,
              }))
            }}
            title="미니맵 — 노드 클릭으로 선택 / 빈 공간 클릭으로 이동 (R2470)"
          >
            <svg width={MM_W} height={MM_H}>
              {/* 씬 경계 */}
              <rect x={ofX} y={ofY} width={sceneW * s} height={sceneH * s} fill="none" stroke="#333" strokeWidth={0.5} />
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
      {/* R1614: 화면 밖 선택 노드 방향 화살표 */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const svgEl = svgRef.current
        if (!svgEl) return null
        const svgW = svgEl.clientWidth, svgH = svgEl.clientHeight
        const sp = ccToSvg(fn.worldX, fn.worldY)
        const MARGIN = 18
        if (sp.x >= MARGIN && sp.x <= svgW - MARGIN && sp.y >= MARGIN && sp.y <= svgH - MARGIN) return null
        // 중앙→노드 방향 벡터로 엣지 교점 계산
        const cx = svgW / 2, cy = svgH / 2
        const dx = sp.x - cx, dy = sp.y - cy
        let t = Infinity
        if (dx < 0) t = Math.min(t, (MARGIN - cx) / dx)
        else if (dx > 0) t = Math.min(t, (svgW - MARGIN - cx) / dx)
        if (dy < 0) t = Math.min(t, (MARGIN - cy) / dy)
        else if (dy > 0) t = Math.min(t, (svgH - MARGIN - cy) / dy)
        if (!isFinite(t)) return null
        const tx = cx + dx * t, ty = cy + dy * t
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI + 90
        return (
          <div
            title="클릭: 선택 노드로 이동 (F)"
            onClick={handleFitToSelected}
            style={{ position: 'absolute', left: tx - 10, top: ty - 10, width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="20" height="20" style={{ transform: `rotate(${angleDeg}deg)`, filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }}>
              <polygon points="10,2 17,17 10,13 3,17" fill="rgba(88,166,255,0.9)" />
            </svg>
          </div>
        )
      })()}
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
      {/* R1699: 선택 노드 세부 정보 오버레이 (우상단) */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const { node } = fn
        const px = dragOverride?.uuid === node.uuid ? Math.round(dragOverride.x) : Math.round((node.position as { x: number; y: number }).x)
        const py = dragOverride?.uuid === node.uuid ? Math.round(dragOverride.y) : Math.round((node.position as { x: number; y: number }).y)
        const w = resizeOverride?.uuid === node.uuid ? Math.round(resizeOverride.w) : Math.round(node.size?.x ?? 0)
        const h = resizeOverride?.uuid === node.uuid ? Math.round(resizeOverride.h) : Math.round(node.size?.y ?? 0)
        const rot = rotateOverride?.uuid === node.uuid ? Math.round(rotateOverride.angle) : Math.round(node.rotation ?? 0)
        const ax = Math.round((node.anchor?.x ?? 0.5) * 100) / 100
        const ay = Math.round((node.anchor?.y ?? 0.5) * 100) / 100
        return (
          <div style={{
            position: 'absolute', top: 4, right: 4, zIndex: 10,
            background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(88,166,255,0.2)',
            borderRadius: 4, padding: '4px 7px', fontSize: 9,
            color: '#778', pointerEvents: 'none', userSelect: 'none',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.6,
          }}>
            <div><span style={{ color: '#556' }}>pos</span> <span style={{ color: '#aaa' }}>{px}, {py}</span></div>
            {(w > 0 || h > 0) && <div><span style={{ color: '#556' }}>size</span> <span style={{ color: '#aaa' }}>{w} × {h}</span></div>}
            {rot !== 0 && <div><span style={{ color: '#556' }}>rot</span> <span style={{ color: '#ff9944' }}>{rot}°</span></div>}
            {(ax !== 0.5 || ay !== 0.5) && <div><span style={{ color: '#556' }}>anch</span> <span style={{ color: '#aaa' }}>{ax}, {ay}</span></div>}
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
    </div>
  )
}
