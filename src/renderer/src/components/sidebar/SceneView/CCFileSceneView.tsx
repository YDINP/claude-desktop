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
}

interface CCFileSceneViewProps {
  sceneFile: CCSceneFile
  selectedUuid: string | null
  onSelect: (uuid: string | null) => void
  onMove?: (uuid: string, x: number, y: number) => void
  onResize?: (uuid: string, w: number, h: number) => void
}

/**
 * CC 파일 기반 씬뷰 (Phase A)
 * SVG 렌더링, 팬/줌, 노드 선택
 * WS Extension 없이 파싱된 CCSceneNode 트리를 직접 표시
 */
export function CCFileSceneView({ sceneFile, selectedUuid, onSelect, onMove, onResize }: CCFileSceneViewProps) {
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

  // 씬 트리 → flat 목록 (world position 누적)
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = []
    function walk(node: CCSceneNode, worldX: number, worldY: number, depth: number) {
      const x = worldX + (typeof node.position === 'object' ? (node.position as { x: number }).x : 0)
      const y = worldY + (typeof node.position === 'object' ? (node.position as { y: number }).y : 0)
      result.push({ node, worldX: x, worldY: y, depth })
      for (const child of node.children) {
        walk(child, x, y, depth + 1)
      }
    }
    // Scene 루트 자체는 건너뜀 (이름 없는 컨테이너)
    for (const child of sceneFile.root.children) {
      walk(child, 0, 0, 0)
    }
    return result
  }, [sceneFile])

  // Sprite UUID → local:// URL 비동기 해상
  useEffect(() => {
    const assetsDir = sceneFile.projectInfo.assetsDir
    if (!assetsDir) return
    const uuids = flatNodes
      .flatMap(fn => fn.node.components.filter(c => c.type === 'cc.Sprite'))
      .map(c => (c.props.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__)
      .filter((u): u is string => !!u && !spriteCacheRef.current.has(u))
    if (!uuids.length) return
    uuids.forEach(uuid => {
      spriteCacheRef.current.set(uuid, '') // pending sentinel
      window.api.ccFileResolveTexture?.(uuid, assetsDir).then(url => {
        if (url) spriteCacheRef.current.set(uuid, url)
        setSpriteCacheVer(v => v + 1)
      })
    })
  }, [sceneFile, flatNodes])

  // CC 좌표 → SVG 좌표 변환
  // CC: Y-up, center origin. SVG: Y-down, top-left.
  const cx = designW / 2
  const cy = designH / 2
  const ccToSvg = useCallback((ccX: number, ccY: number) => ({
    x: cx + ccX,
    y: cy - ccY,
  }), [cx, cy])

  // 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
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
  }, [])

  // 패닝 (중간 버튼 또는 Space+드래그)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault()
      setIsPanning(true)
      panStart.current = { mouseX: e.clientX, mouseY: e.clientY, offX: view.offsetX, offY: view.offsetY }
    }
  }, [view])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
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
      // Ctrl 키: 10px 그리드 스냅
      if (e.ctrlKey || e.metaKey) {
        const snap = 10
        nx = Math.round(nx / snap) * snap
        ny = Math.round(ny / snap) * snap
      }
      setDragOverride({ uuid: dragRef.current.uuid, x: nx, y: ny })
      return
    }
    if (!isPanning || !panStart.current) return
    const dx = e.clientX - panStart.current.mouseX
    const dy = e.clientY - panStart.current.mouseY
    setView(v => ({ ...v, offsetX: panStart.current!.offX + dx, offsetY: panStart.current!.offY + dy }))
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
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
      return
    }
    dragRef.current = null
    setDragOverride(null)
    setIsPanning(false)
    panStart.current = null
  }, [dragOverride, resizeOverride, onMove, onResize])

  // Fit to view
  const handleFit = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const zoom = Math.min(rect.width / designW, rect.height / designH) * 0.9
    setView({
      zoom,
      offsetX: (rect.width - designW * zoom) / 2,
      offsetY: (rect.height - designH * zoom) / 2,
    })
  }, [designW, designH])

  const transform = `translate(${view.offsetX}, ${view.offsetY}) scale(${view.zoom})`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {/* 툴바 */}
      <div style={{
        display: 'flex', gap: 4, padding: '2px 8px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, alignItems: 'center', fontSize: 10,
      }}>
        <span style={{ color: 'var(--text-muted)', flex: 1 }}>
          {designW}×{designH} | {flatNodes.length}개 | <span style={{ fontSize: 8 }}>Ctrl드래그=10px스냅</span>
        </span>
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
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 30, textAlign: 'center' }}>
          {Math.round(view.zoom * 100)}%
        </span>
        <button
          onClick={() => setView(v => ({ ...v, zoom: Math.max(0.1, v.zoom / 1.25) }))}
          style={{ padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
        >−</button>
      </div>

      {/* SVG 캔버스 */}
      <svg
        ref={svgRef}
        style={{ flex: 1, background: '#1a1a2e', cursor: isPanning ? 'grabbing' : dragOverride ? 'grabbing' : 'default', display: 'block' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={e => e.preventDefault()}
        onClick={() => onSelect(null)}
      >
        <g transform={transform}>
          {/* 게임 캔버스 배경 */}
          <rect x={0} y={0} width={designW} height={designH}
            fill={bgColor} stroke="#555" strokeWidth={1 / view.zoom} />
          {/* 그리드 (100px 단위) */}
          {view.zoom > 0.2 && (() => {
            const step = 100
            const lines: React.ReactElement[] = []
            for (let x = step; x < designW; x += step) {
              lines.push(<line key={`gv${x}`} x1={x} y1={0} x2={x} y2={designH} stroke="rgba(255,255,255,0.05)" strokeWidth={1/view.zoom} />)
            }
            for (let y = step; y < designH; y += step) {
              lines.push(<line key={`gh${y}`} x1={0} y1={y} x2={designW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1/view.zoom} />)
            }
            // 중앙 십자선
            lines.push(<line key="cx" x1={designW/2} y1={0} x2={designW/2} y2={designH} stroke="rgba(88,166,255,0.15)" strokeWidth={1/view.zoom} />)
            lines.push(<line key="cy" x1={0} y1={designH/2} x2={designW} y2={designH/2} stroke="rgba(88,166,255,0.15)" strokeWidth={1/view.zoom} />)
            return lines
          })()}

          {/* 노드 렌더링 (비활성 노드는 반투명 표시) */}
          {flatNodes.map(({ node, worldX, worldY }) => {
            const nodeOpacity = node.active ? (node.opacity ?? 255) / 255 : 0.2
            const isDragged = dragOverride?.uuid === node.uuid
            const isResized = resizeOverride?.uuid === node.uuid
            const effX = isDragged ? dragOverride!.x : worldX
            const effY = isDragged ? dragOverride!.y : worldY
            const svgPos = ccToSvg(effX, effY)
            const w = isResized ? resizeOverride!.w : (node.size?.x || 0)
            const h = isResized ? resizeOverride!.h : (node.size?.y || 0)
            if (w === 0 && h === 0) return null  // 크기 없는 노드는 점으로 표시

            const anchorX = node.anchor?.x ?? 0.5
            const anchorY = node.anchor?.y ?? 0.5
            const rectX = svgPos.x - w * anchorX
            const rectY = svgPos.y - h * (1 - anchorY)
            const isSelected = node.uuid === selectedUuid
            // CC rotation: Z-euler (반시계방향 양수). SVG: 시계방향 양수 → 부호 반전
            const rotZ = typeof node.rotation === 'number' ? node.rotation : (node.rotation as { z?: number }).z ?? 0
            const rotTransform = rotZ !== 0 ? `rotate(${-rotZ}, ${svgPos.x}, ${svgPos.y})` : undefined

            const hasLabel = node.components.some(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
            const hasSprite = node.components.some(c => c.type === 'cc.Sprite')
            const hasBg = node.components.some(c => ['cc.Canvas', 'cc.Layout'].includes(c.type))

            const fillColor = hasBg ? 'rgba(80,120,255,0.08)'
              : hasLabel ? 'rgba(255,200,80,0.12)'
              : hasSprite ? 'rgba(80,220,120,0.12)'
              : 'rgba(150,150,255,0.08)'
            const strokeColor = isSelected ? '#58a6ff'
              : isDragged ? '#ff9944'
              : hasBg ? '#4466aa'
              : hasLabel ? '#ccaa44'
              : hasSprite ? '#44aa66'
              : '#666688'

            return (
              <g key={node.uuid}
                transform={rotTransform}
                opacity={nodeOpacity}
                onClick={e => { e.stopPropagation(); onSelect(node.uuid) }}
                onMouseDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  const pos = node.position as CCVec3
                  dragRef.current = {
                    uuid: node.uuid,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startNodeX: pos.x,
                    startNodeY: pos.y,
                  }
                }}
                style={{ cursor: isDragged ? 'grabbing' : 'grab' }}
              >
                <rect
                  x={rectX} y={rectY} width={w} height={h}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={(isSelected ? 2 : 1) / view.zoom}
                />
                {/* 앵커 포인트 */}
                <circle
                  cx={svgPos.x} cy={svgPos.y}
                  r={3 / view.zoom}
                  fill={isSelected ? '#58a6ff' : '#888'}
                />
                {/* 노드 이름 레이블 */}
                {view.zoom > 0.3 && (
                  <text
                    x={rectX + 3 / view.zoom}
                    y={rectY + 12 / view.zoom}
                    fontSize={11 / view.zoom}
                    fill={isSelected ? '#58a6ff' : '#ccc'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.name}
                  </text>
                )}
                {/* Sprite 이미지 렌더링 */}
                {hasSprite && (() => {
                  const sc = node.components.find(c => c.type === 'cc.Sprite')
                  const sfUuid = (sc?.props?.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__
                  const imgUrl = sfUuid ? spriteCacheRef.current.get(sfUuid) : undefined
                  if (!imgUrl) return null
                  return (
                    <image
                      href={imgUrl}
                      x={rectX} y={rectY}
                      width={w} height={h}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })()}
                {/* Label 텍스트 렌더링 */}
                {hasLabel && (() => {
                  const lc = node.components.find(c => c.type === 'cc.Label' || c.type === 'Label' || c.type === 'cc.RichText')
                  const str = lc?.props?.string as string | undefined
                  if (!str) return null
                  const fs = Math.min(Math.max((lc?.props?.fontSize as number | undefined) ?? 20, 8), 200)
                  const { r: cr = 255, g: cg = 255, b: cb = 255 } = node.color ?? {}
                  return (
                    <text
                      x={rectX + w / 2} y={rectY + h / 2}
                      fontSize={fs / view.zoom}
                      fill={`rgb(${cr},${cg},${cb})`}
                      textAnchor="middle" dominantBaseline="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {str}
                    </text>
                  )
                })()}
                {/* SE 리사이즈 핸들 (선택된 노드만) */}
                {isSelected && (
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
        </g>
      </svg>
      {/* 선택 노드 HUD */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const { node } = fn
        const pos = node.position as { x: number; y: number }
        const rotZ = typeof node.rotation === 'number' ? node.rotation : (node.rotation as { z?: number }).z ?? 0
        const w = node.size?.x ?? 0; const h = node.size?.y ?? 0
        return (
          <div style={{
            position: 'absolute', bottom: 4, left: 4, right: 4,
            background: 'rgba(0,0,0,0.6)', borderRadius: 3,
            padding: '2px 8px', fontSize: 9, color: '#ccc',
            display: 'flex', gap: 10, pointerEvents: 'none',
          }}>
            <span><span style={{ color: '#888' }}>pos</span> {Math.round(pos.x)},{Math.round(pos.y)}</span>
            <span><span style={{ color: '#888' }}>size</span> {Math.round(w)}×{Math.round(h)}</span>
            {rotZ !== 0 && <span><span style={{ color: '#888' }}>rot</span> {rotZ.toFixed(1)}°</span>}
            <span style={{ color: '#58a6ff', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name}
            </span>
          </div>
        )
      })()}
    </div>
  )
}
