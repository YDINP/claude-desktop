import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SceneNode, ViewTransform, DragState } from './types'
import { useSceneSync } from './useSceneSync'
import { NodeRenderer } from './NodeRenderer'
import { SceneToolbar } from './SceneToolbar'
import { SceneInspector } from './SceneInspector'
import { getRenderOrder } from './utils'

interface SceneViewPanelProps {
  connected: boolean
  wsKey: string
  port?: number
}

const DESIGN_W = 960
const DESIGN_H = 640
const SNAP_GRID = 4

export function SceneViewPanel({ connected, port = 9091 }: SceneViewPanelProps) {
  // ── 씬 데이터 ──────────────────────────────────────────────
  const { nodeMap, rootUuid, loading, refresh, updateNode } = useSceneSync(connected, port)

  // ── 뷰 상태 ────────────────────────────────────────────────
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 1 })
  const [activeTool, setActiveTool] = useState<'select' | 'move'>('select')
  const [gridVisible, setGridVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(false)

  // ── 선택 / 호버 상태 ───────────────────────────────────────
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [hoveredUuid, setHoveredUuid] = useState<string | null>(null)

  // ── 드래그 상태 ────────────────────────────────────────────
  const dragRef = useRef<DragState | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // ── SVG ref ────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Fit to view ────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFit = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const padding = 32
    const zoomX = (width - padding * 2) / DESIGN_W
    const zoomY = (height - padding * 2) / DESIGN_H
    const zoom = Math.min(zoomX, zoomY, 2)
    const offsetX = (width - DESIGN_W * zoom) / 2
    const offsetY = (height - DESIGN_H * zoom) / 2
    setView({ offsetX, offsetY, zoom })
  }, [])

  // 최초 마운트 시 Fit
  useEffect(() => {
    if (rootUuid) handleFit()
  }, [rootUuid])

  // ── 단축키 ────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'v' || e.key === 'V') setActiveTool('select')
      if (e.key === 'w' || e.key === 'W') setActiveTool('move')
      if (e.key === 'f' || e.key === 'F') handleFit()
      if (e.key === 'Escape') setSelectedUuid(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleFit])

  // ── CC 이벤트: 외부 선택 동기화 ───────────────────────────
  useEffect(() => {
    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'node:select' && event.uuids?.[0]) {
        setSelectedUuid(event.uuids[0])
      }
      if (event.type === 'node:deselect') {
        setSelectedUuid(null)
      }
    })
    return () => unsub?.()
  }, [])

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
  }, [view])

  // ── 마우스 이벤트 ─────────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    // 빈 영역 클릭 → 패닝 (middle btn 또는 space + left)
    if (e.button === 1 || (e.button === 0 && activeTool === 'move')) {
      isPanning.current = true
      panStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: view.offsetX,
        oy: view.offsetY,
      }
      e.preventDefault()
      return
    }
    // 빈 배경 클릭 → 선택 해제
    if (e.button === 0) {
      setSelectedUuid(null)
    }
  }, [activeTool, view])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    setSelectedUuid(uuid)
    const node = nodeMap.get(uuid)
    if (!node) return

    const svgCoords = getSvgCoords(e)
    dragRef.current = {
      uuid,
      startSvgX: svgCoords.x,
      startSvgY: svgCoords.y,
      startNodeX: node.x,
      startNodeY: node.y,
    }
  }, [nodeMap, getSvgCoords])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
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

      // 스냅
      if (snapEnabled) {
        newX = Math.round(newX / SNAP_GRID) * SNAP_GRID
        newY = Math.round(newY / SNAP_GRID) * SNAP_GRID
      }

      // 낙관적 업데이트 (즉시 반영)
      updateNode(drag.uuid, { x: newX, y: newY })
    }
  }, [view.zoom, snapEnabled, getSvgCoords, updateNode])

  const handleMouseUp = useCallback(async () => {
    // 패닝 종료
    if (isPanning.current) {
      isPanning.current = false
      panStart.current = null
      return
    }

    // 드래그 종료 → IPC 전송
    if (dragRef.current) {
      const drag = dragRef.current
      const node = nodeMap.get(drag.uuid)
      if (node) {
        try {
          await window.api.ccSetProperty?.(drag.uuid, 'x', node.x)
          await window.api.ccSetProperty?.(drag.uuid, 'y', node.y)
        } catch (e) {
          console.error('[SceneView] setProperty failed:', e)
        }
      }
      dragRef.current = null
    }
  }, [nodeMap])

  // ── 줌 (wheel) ─────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const svgCoords = getSvgCoords(e as unknown as React.MouseEvent)
    setView(prev => {
      const newZoom = Math.min(8, Math.max(0.1, prev.zoom * factor))
      // 마우스 위치 기준 줌
      const newOffsetX = svgCoords.x - (svgCoords.x - prev.offsetX) * (newZoom / prev.zoom)
      const newOffsetY = svgCoords.y - (svgCoords.y - prev.offsetY) * (newZoom / prev.zoom)
      return { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
    })
  }, [getSvgCoords])

  // ── Inspector 업데이트 ─────────────────────────────────────
  const handleInspectorUpdate = useCallback(async (uuid: string, prop: string, value: number | boolean) => {
    updateNode(uuid, { [prop]: value } as Partial<SceneNode>)
    try {
      await window.api.ccSetProperty?.(uuid, prop, value)
    } catch (e) {
      console.error('[SceneView] inspector update failed:', e)
    }
  }, [updateNode])

  // ── 렌더 순서 ────────────────────────────────────────────
  const renderOrder = useMemo(() => {
    if (!rootUuid) return []
    return getRenderOrder(rootUuid, nodeMap)
  }, [rootUuid, nodeMap])

  const selectedNode = selectedUuid ? nodeMap.get(selectedUuid) ?? null : null

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
      }}
    >
      {/* 툴바 */}
      <SceneToolbar
        activeTool={activeTool}
        zoom={view.zoom}
        gridVisible={gridVisible}
        snapEnabled={snapEnabled}
        onToolChange={setActiveTool}
        onZoomChange={zoom => setView(prev => ({ ...prev, zoom }))}
        onGridToggle={() => setGridVisible(v => !v)}
        onSnapToggle={() => setSnapEnabled(v => !v)}
        onFit={handleFit}
        onRefresh={refresh}
      />

      {/* SVG 뷰포트 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: activeTool === 'move' ? 'grab' : 'default',
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
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            {/* 체크패턴 배경 */}
            <pattern
              id="checker"
              x="0"
              y="0"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#242424" />
              <rect x="8" y="0" width="8" height="8" fill="#1e1e1e" />
              <rect x="0" y="8" width="8" height="8" fill="#1e1e1e" />
              <rect x="8" y="8" width="8" height="8" fill="#242424" />
            </pattern>

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

          {/* 배경 */}
          <rect width="100%" height="100%" fill="url(#checker)" />
          {gridVisible && <rect width="100%" height="100%" fill="url(#grid)" />}

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

            {/* 원점 십자 */}
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

            {/* 노드 렌더링 */}
            {renderOrder.map(uuid => {
              const node = nodeMap.get(uuid)
              if (!node) return null
              return (
                <NodeRenderer
                  key={uuid}
                  node={node}
                  nodeMap={nodeMap}
                  view={view}
                  selected={selectedUuid === uuid}
                  hovered={hoveredUuid === uuid}
                  onMouseDown={handleNodeMouseDown}
                  onMouseEnter={setHoveredUuid}
                  onMouseLeave={() => setHoveredUuid(null)}
                />
              )
            })}
          </g>
        </svg>

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

        {/* 줌 레벨 표시 */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            fontSize: 9,
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.5)',
            padding: '1px 5px',
            borderRadius: 3,
            pointerEvents: 'none',
          }}
        >
          {Math.round(view.zoom * 100)}%
        </div>
      </div>

      {/* Inspector */}
      <SceneInspector
        node={selectedNode}
        onUpdate={handleInspectorUpdate}
        onClose={() => setSelectedUuid(null)}
      />
    </div>
  )
}

export default SceneViewPanel
