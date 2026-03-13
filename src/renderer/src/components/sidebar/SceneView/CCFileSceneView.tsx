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
}

/**
 * CC 파일 기반 씬뷰 (Phase A)
 * SVG 렌더링, 팬/줌, 노드 선택
 * WS Extension 없이 파싱된 CCSceneNode 트리를 직접 표시
 */
export function CCFileSceneView({ sceneFile, selectedUuid, onSelect, onMove, onResize, onRename, onRotate, onMultiMove, onMultiDelete, onLabelEdit, onAddNode, onAnchorMove, onMultiSelectChange, onDuplicate, onToggleActive, onReorder }: CCFileSceneViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 0.5 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ mouseX: number; mouseY: number; offX: number; offY: number } | null>(null)
  const dragRef = useRef<{ uuid: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number } | null>(null)
  const [dragOverride, setDragOverride] = useState<{ uuid: string; x: number; y: number } | null>(null)
  const resizeRef = useRef<{ uuid: string; startMouseX: number; startMouseY: number; startW: number; startH: number } | null>(null)
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
  const [snapSize, setSnapSize] = useState(10)
  const [bgColorOverride, setBgColorOverride] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  // R1489: 미니맵
  const [showMinimap, setShowMinimap] = useState(true)
  // R1496: 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; uuid: string | null } | null>(null)
  // R1500: 스냅 포인트 시각적 피드백
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number } | null>(null)
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
      if (n.name.toLowerCase().includes(q) || n.uuid.toLowerCase().includes(q)) matches.add(n.uuid)
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

  // R1516: 다중 선택 변경 → 부모에 알림
  useEffect(() => {
    onMultiSelectChange?.(Array.from(multiSelected))
  }, [multiSelected, onMultiSelectChange])

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
    function walk(node: CCSceneNode, worldX: number, worldY: number, depth: number, parentUuid: string | null) {
      const x = worldX + (typeof node.position === 'object' ? (node.position as { x: number }).x : 0)
      const y = worldY + (typeof node.position === 'object' ? (node.position as { y: number }).y : 0)
      result.push({ node, worldX: x, worldY: y, depth, parentUuid })
      for (const child of node.children) {
        walk(child, x, y, depth + 1, node.uuid)
      }
    }
    // Scene 루트 자체는 건너뜀 (이름 없는 컨테이너)
    for (const child of sceneFile.root.children) {
      walk(child, 0, 0, 0, null)
    }
    return result
  }, [sceneFile])

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
      // 빈 공간 드래그: rubber-band 선택 시작
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const svgX = (e.clientX - rect.left - v.offsetX) / v.zoom
      const svgY = (e.clientY - rect.top - v.offsetY) / v.zoom
      selBoxRef.current = { startSvgX: svgX, startSvgY: svgY }
    }
  }, [view])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
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
      setResizeOverride({
        uuid: resizeRef.current.uuid,
        w: Math.max(1, resizeRef.current.startW + dx / z),
        h: Math.max(1, resizeRef.current.startH + dy / z),
      })
      return
    }
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startMouseX
      const dy = e.clientY - dragRef.current.startMouseY
      const z = viewRef.current.zoom
      let nx = dragRef.current.startNodeX + dx / z
      let ny = dragRef.current.startNodeY - dy / z
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
        setAlignGuides(guides)
      }
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
  }, [isPanning, cx, cy, snapSize, flatNodes])

  const handleMouseUp = useCallback(() => {
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
      return
    }
    dragRef.current = null
    setDragOverride(null)
    setSnapIndicator(null)
    setAlignGuides([])
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
      // R1571: Enter — 선택 노드의 첫 번째 자식으로 포커스
      if (e.code === 'Enter' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (fn && fn.node.children.length > 0) {
          e.preventDefault()
          onSelect(fn.node.children[0].uuid)
          return
        }
      }
      // R1565: H — 선택 노드 active 토글 (숨기기/보이기)
      if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && selectedUuid) {
        e.preventDefault()
        onToggleActive?.(selectedUuid)
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

  // R1474: SVG 캡처 → base64 → Claude 비전 분석 prefill
  const handleScreenshotAI = useCallback(() => {
    if (!svgRef.current || screenshotSending) return
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
      const b64 = canvas.toDataURL('image/png')
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', {
        detail: {
          text: '이 Cocos Creator 씬 스크린샷을 분석해 주세요. UI 구조, 레이아웃, 개선 가능한 부분을 설명해 주세요.',
          imageBase64: b64,
        }
      }))
      setScreenshotSending(false)
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); setScreenshotSending(false) }
    img.src = svgUrl
  }, [svgRef, screenshotSending, designW, designH])

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
        <select
          value={snapSize}
          onChange={e => setSnapSize(Number(e.target.value))}
          title="Ctrl+드래그 스냅 크기"
          style={{ fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', padding: '1px 2px', cursor: 'pointer' }}
        >
          {[1, 5, 10, 25, 50].map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
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
        {/* R1474: 씬뷰 스크린샷 → Claude AI 분석 */}
        <button
          onClick={handleScreenshotAI}
          title="씬 스크린샷 → Claude 비전 분석"
          disabled={screenshotSending}
          style={{ padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: screenshotSending ? 'wait' : 'pointer', border: '1px solid var(--border)', background: screenshotSending ? 'rgba(255,200,50,0.12)' : 'none', color: screenshotSending ? '#fbbf24' : 'var(--text-muted)', opacity: screenshotSending ? 0.6 : 1 }}
        >{screenshotSending ? '⟳' : '📷'}</button>
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
        style={{ flex: 1, background: '#1a1a2e', cursor: isPanning ? 'grabbing' : dragOverride ? 'grabbing' : rotateOverride ? 'crosshair' : 'default', display: 'block' }}
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
          {/* 선택 노드 마칭 앤트 애니메이션 */}
          <style>{`
            @keyframes march { to { stroke-dashoffset: -20; } }
            .cc-selected-rect { stroke-dasharray: 6 3; animation: march 0.6s linear infinite; }
          `}</style>
        </defs>
        <g transform={transform}>
          {/* 게임 캔버스 배경 */}
          <rect x={0} y={0} width={effectiveW} height={effectiveH}
            fill={bgColorOverride ?? bgColor} stroke="#555" strokeWidth={1 / view.zoom} />
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
            const effX = isDragged ? dragOverride!.x : worldX
            const effY = isDragged ? dragOverride!.y : worldY
            const svgPos = ccToSvg(effX, effY)
            const w = isResized ? resizeOverride!.w : (node.size?.x || 0)
            const h = isResized ? resizeOverride!.h : (node.size?.y || 0)
            if (w === 0 && h === 0) return null  // 크기 없는 노드는 점으로 표시

            // 캔버스 범위 밖 노드 감지
            const isOutOfCanvas = effX + w / 2 < -designW / 2 || effX - w / 2 > designW / 2 || effY + h / 2 < -designH / 2 || effY - h / 2 > designH / 2
            const nodeOpacity = (node.active ? (node.opacity ?? 255) / 255 : 0.2) * (isOutOfCanvas ? 0.4 : 1)

            const anchorX = node.anchor?.x ?? 0.5
            const anchorY = node.anchor?.y ?? 0.5
            const rectX = svgPos.x - w * anchorX
            const rectY = svgPos.y - h * (1 - anchorY)
            const isSelected = node.uuid === selectedUuid || multiSelected.has(node.uuid)
            const isHovered = node.uuid === hoverUuid && !isSelected
            // R1550: 검색 매칭 하이라이트
            const isSearchMatch = svSearch.trim() ? svSearchMatches.has(node.uuid) : false
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

            const fillColor = isSearchMatch ? 'rgba(255,68,255,0.12)'
              : isHovered ? 'rgba(255,255,255,0.06)'
              : hasButton ? 'rgba(255,140,60,0.1)'
              : hasScroll ? 'rgba(60,220,220,0.08)'
              : hasEdit ? 'rgba(220,100,180,0.1)'
              : hasSlider ? 'rgba(160,100,255,0.1)'
              : hasBg ? 'rgba(80,120,255,0.08)'
              : hasLabel ? 'rgba(255,200,80,0.12)'
              : hasSprite ? 'rgba(80,220,120,0.12)'
              : 'rgba(150,150,255,0.08)'
            const strokeColor = isSelected ? '#58a6ff'
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
                  if (e.ctrlKey || e.metaKey) {
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
                onMouseEnter={e => { setHoverUuid(node.uuid); setHoverClientPos({ x: e.clientX, y: e.clientY }) }}
                onMouseMove={e => { if (hoverUuid === node.uuid) setHoverClientPos({ x: e.clientX, y: e.clientY }) }}
                onMouseLeave={() => { setHoverUuid(null); setHoverClientPos(null) }}
                onMouseDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  if (lockedUuids.has(node.uuid)) return  // R1543: 잠긴 노드는 드래그 방지
                  const pos = node.position as CCVec3
                  dragRef.current = {
                    uuid: node.uuid,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startNodeX: pos.x,
                    startNodeY: pos.y,
                  }
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
                    y={rectY + 12 / view.zoom}
                    fontSize={11 / view.zoom}
                    fill={isSelected ? '#58a6ff' : '#ccc'}
                    style={{ pointerEvents: isSelected ? 'auto' : 'none', userSelect: 'none', cursor: 'text' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingUuid(node.uuid); setTimeout(() => editInputRef.current?.focus(), 30) }}
                  >
                    {node.name}
                    {/* R1555: CC3.x layer 번호 표시 (기본 레이어=1048576 제외) */}
                    {node.layer != null && node.layer !== 1048576 && (
                      <tspan fontSize={8 / view.zoom} fill="rgba(251,191,36,0.7)" dx={3 / view.zoom}>[L{node.layer}]</tspan>
                    )}
                  </text>
                )}
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
                {/* SE 리사이즈 핸들 (선택된 노드만, 잠긴 노드 제외) */}
                {isSelected && !lockedUuids.has(node.uuid) && (
                  <rect
                    x={rectX + w - 5 / view.zoom} y={rectY + h - 5 / view.zoom}
                    width={10 / view.zoom} height={10 / view.zoom}
                    fill="#58a6ff" stroke="#fff" strokeWidth={1 / view.zoom}
                    style={{ cursor: 'se-resize' }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      resizeRef.current = {
                        uuid: node.uuid,
                        startMouseX: e.clientX,
                        startMouseY: e.clientY,
                        startW: resizeOverride?.uuid === node.uuid ? resizeOverride.w : w,
                        startH: resizeOverride?.uuid === node.uuid ? resizeOverride.h : h,
                      }
                    }}
                  />
                )}
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
                      stroke="#58a6ff" strokeWidth={1 / view.zoom}
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
                  </>
                )}
              </g>
            )
          })}

          {/* 크기 없는 노드 → 십자 표시 (비활성 포함, 반투명) */}
          {flatNodes.filter(fn => !(fn.node.size?.x) && !(fn.node.size?.y)).map(({ node, worldX, worldY }) => {
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
          {/* rubber-band 선택 박스 */}
          {selectionBox && (
            <rect
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(88,166,255,0.08)"
              stroke="#58a6ff"
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
            return (
              <rect
                x={minX - pad} y={minY - pad}
                width={maxX - minX + pad * 2} height={maxY - minY + pad * 2}
                fill="none"
                stroke="#ff9944"
                strokeWidth={1.5 / view.zoom}
                strokeDasharray={`${5 / view.zoom} ${3 / view.zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}
        </g>
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
            <span style={{ pointerEvents: 'none', color: dragOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>pos</span> {parseFloat(pos.x.toFixed(2))},{parseFloat(pos.y.toFixed(2))}</span>
            <span style={{ pointerEvents: 'none', color: resizeOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>size</span> {parseFloat(w.toFixed(2))}×{parseFloat(h.toFixed(2))}</span>
            {(rotZ !== 0 || rotateOverride?.uuid === node.uuid) && <span style={{ pointerEvents: 'none', color: rotateOverride?.uuid === node.uuid ? '#ff9944' : '#ccc' }}><span style={{ color: '#888' }}>rot</span> {rotZ.toFixed(1)}°</span>}
            {/* 정렬 버튼 */}
            {alignBtn('⊙', '중앙 정렬', 0, 0)}
            {alignBtn('◁', '좌측 정렬', -(effectiveW / 2 - w / 2), pos.y)}
            {alignBtn('▷', '우측 정렬', effectiveW / 2 - w / 2, pos.y)}
            {alignBtn('△', '상단 정렬', pos.x, effectiveH / 2 - h / 2)}
            {alignBtn('▽', '하단 정렬', pos.x, -(effectiveH / 2 - h / 2))}
            {multiSelected.size > 1 && (
              <span style={{ color: '#ff9944', flexShrink: 0, pointerEvents: 'none' }}>
                ⊕{multiSelected.size}개
              </span>
            )}
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
            ['SE 핸들 드래그', '노드 리사이즈'],
            ['↻ 핸들 드래그', '노드 회전 (Shift: 15°)'],
            ['Escape', '선택 해제'],
            ['←↑→↓', '선택 노드 1px 이동'],
            ['Shift+←↑→↓', '10px 이동'],
            ['Ctrl+↑↓', '형제 순서 변경'],
            ['⊙◁▷△▽', '정렬 버튼'],
            ['↑↓ (Inspector)', 'Z-order 변경'],
            ['Ctrl+D', '선택 노드 복제'],
            ['Ctrl+N', '새 노드 추가'],
            ['H', '선택 노드 숨기기/보이기'],
            ['P', '부모 노드 선택'],
            ['Enter', '첫 번째 자식 선택'],
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
              // R1498: 클릭한 미니맵 좌표 → 씬 좌표 → pan
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const mmX = e.clientX - rect.left
              const mmY = e.clientY - rect.top
              // 미니맵 → 씬 좌표 역변환
              const scX = (mmX - ofX) / s + sceneX
              const scY = sceneH - (mmY - ofY) / s + sceneY
              const svgEl = svgRef.current
              if (!svgEl) return
              const svgRect = svgEl.getBoundingClientRect()
              const z = viewRef.current.zoom
              // ccToSvg 역변환: svgX = scX * 1 (scale=1 assumed), svgY = -scY (Y 반전)
              setView(v => ({
                ...v,
                offsetX: svgRect.width / 2 - scX * z,
                offsetY: svgRect.height / 2 + scY * z,
              }))
            }}
            title="미니맵 — 클릭하여 해당 위치로 이동"
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
    </div>
  )
}
