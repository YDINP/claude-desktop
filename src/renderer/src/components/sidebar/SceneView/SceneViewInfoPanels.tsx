// QA anchors: 총 노드 수 표시, 드래그/리사이즈 중 선택 노드 정보, 회전 각도 오버레이, 카메라 포커스: 북마크 클릭, 노드 정보 오버레이, 드래그 델타 오버레이, Δx, selectedNode.rotation.toFixed(1)}°
import React from 'react'
import type { SceneNode } from './types'
import { cocosToSvg, getComponentIcon } from './utils'
import { getRulerTicks } from './sceneViewConstants'
import { useSceneViewCtx } from './SceneViewContext'

/**
 * SceneViewPanel SVG 뷰포트 컨테이너 내 position:absolute 오버레이 패널 모음.
 * Before/After, Compare, JSON Viewer, Measure, Ruler, Stats, Node info,
 * PNG export, Canvas search, Bookmark list, Ref image 등.
 *
 * SceneViewPanel에서 추출 (Context + props로 상태 공유)
 */
export interface SceneViewInfoPanelsProps {
  // Compare mode
  compareMode: boolean
  setCompareMode: (v: boolean) => void
  // Measure
  measureMode: boolean
  measureLine: { x1: number; y1: number; x2: number; y2: number } | null
  // Ruler
  showRuler: boolean
  // Loading
  loading: boolean
  // Zoom
  handleFit: () => void
  handleZoomTo: (zoom: number) => void
  // Group
  showGroupBtn: boolean
  multiSelectedSize: number
  // Drag/Resize
  isDragging: boolean
  isResizing: boolean
  isRotating: boolean
  dragDelta: { dx: number; dy: number } | null
  hoverTooltipPos: { x: number; y: number } | null
  tooltipVisibleUuid: string | null
  // Stats
  showStats: boolean
  showNodeInfo: boolean
  showStatsOverlay: boolean
  // PNG export
  showPngExportPanel: boolean
  setShowPngExportPanel: (v: boolean) => void
  pngExportBg: 'dark' | 'light' | 'transparent'
  setPngExportBg: (v: 'dark' | 'light' | 'transparent') => void
  pngExportScale: 1 | 2 | 4
  setPngExportScale: (v: 1 | 2 | 4) => void
  handleExportPng: () => void
  // Canvas search
  showCanvasSearch: boolean
  setShowCanvasSearch: (v: boolean) => void
  canvasSearch: string
  setCanvasSearch: (v: string) => void
  canvasSearchRef: React.RefObject<HTMLInputElement>
  searchMatches: SceneNode[]
  searchMatchIndex: number
  handleSearchNav: (dir: 1 | -1) => void
  // Bookmark list
  showBookmarkList: boolean
  setShowBookmarkList: (v: boolean) => void
  // Ref image
  showRefImagePanel: boolean
  setShowRefImagePanel: (v: boolean) => void
  refImageUrl: string
  setRefImageUrl: (v: string) => void
  refImageOpacity: number
  setRefImageOpacity: (v: number) => void
  // Status bar
  spaceDown: boolean
  activeTool: 'select' | 'move'
  snapEnabled: boolean
  snapGrid: number
  gridVisible: boolean
  isDirty: boolean
  copiedNode: SceneNode | null
  isPanningActive: boolean
  // Node path breadcrumb
  nodePath: Array<{ uuid: string; name: string }>
  // Overlay image
  overlayImageSrc: string | null
  setOverlayImageSrc: (v: string | null) => void
  overlayOpacity: number
}

export function SceneViewInfoPanels(props: SceneViewInfoPanelsProps) {
  const ctx = useSceneViewCtx()
  const {
    nodeMap, rootUuid, view, setView, DESIGN_W, DESIGN_H,
    selectedUuid, setSelectedUuid, selectedUuids, setSelectedUuids,
    selectedNode, bookmarkedUuids, setBookmarkedUuids,
    containerRef, svgRef,
    savedSnapshot, beforeAfterMode, sliderX, setSliderX,
    beforeAfterDragRef,
    showJsonViewer, setShowJsonViewer, jsonViewScope, setJsonViewScope,
    compareScenePath, setCompareScenePath, sceneTabFiles,
  } = ctx

  const {
    compareMode, setCompareMode,
    measureMode, measureLine,
    showRuler, loading,
    handleFit, handleZoomTo,
    showGroupBtn, multiSelectedSize,
    isDragging, isResizing, isRotating,
    dragDelta, hoverTooltipPos, tooltipVisibleUuid,
    showStats, showNodeInfo, showStatsOverlay,
    showPngExportPanel, setShowPngExportPanel,
    pngExportBg, setPngExportBg, pngExportScale, setPngExportScale, handleExportPng,
    showCanvasSearch, setShowCanvasSearch, canvasSearch, setCanvasSearch,
    canvasSearchRef, searchMatches, searchMatchIndex, handleSearchNav,
    showBookmarkList, setShowBookmarkList,
    showRefImagePanel, setShowRefImagePanel,
    refImageUrl, setRefImageUrl, refImageOpacity, setRefImageOpacity,
    spaceDown, activeTool, snapEnabled, snapGrid, gridVisible, isDirty, copiedNode,
    isPanningActive,
    nodePath,
  } = props

  return (
    <>
      {/* R1431: Before/After slider comparison overlay */}
      {beforeAfterMode && savedSnapshot.size > 0 && (() => {
        const svgRect = svgRef.current?.getBoundingClientRect()
        const svgW = svgRect?.width ?? 400
        const svgH = svgRect?.height ?? 300
        const pixelX = sliderX * svgW
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}>
            <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 9, color: 'rgba(239,68,68,0.8)', pointerEvents: 'none', zIndex: 2 }}>BEFORE</div>
            <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, color: 'rgba(96,165,250,0.8)', pointerEvents: 'none', zIndex: 2 }}>AFTER</div>
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
              <div style={{
                position: 'absolute', top: '50%', left: -8, width: 19, height: 24, marginTop: -12,
                background: 'rgba(255,255,255,0.9)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#333', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}>{'\u27FA'}</div>
            </div>
          </div>
        )
      })()}

      {/* R1424: Compare view */}
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

      {/* R1435: JSON viewer panel */}
      {showJsonViewer && (() => {
        const selNode = selectedUuid ? nodeMap.get(selectedUuid) : null
        const jsonSource = jsonViewScope === 'selected' && selNode
          ? { name: selNode.name, uuid: selNode.uuid, x: selNode.x, y: selNode.y, width: selNode.width, height: selNode.height, rotation: selNode.rotation, anchorX: selNode.anchorX, anchorY: selNode.anchorY, opacity: selNode.opacity, active: selNode.active, components: selNode.components, childCount: selNode.children?.length ?? 0 }
          : { nodeCount: nodeMap.size, rootUuid, nodes: Array.from(nodeMap.values()).slice(0, 50).map(n => ({ name: n.name, uuid: n.uuid, x: Math.round(n.x), y: Math.round(n.y) })) }
        const jsonStr = JSON.stringify(jsonSource, null, 2)
        const escHtmlInner = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const highlighted = jsonStr.replace(
          /("(?:\\.|[^"\\])*")\s*:/g, (_, k: string) => `<span style="color:var(--accent,#60a5fa)">"${escHtmlInner(k.slice(1, -1))}"</span>:`
        ).replace(
          /:\s*("(?:\\.|[^"\\])*")/g, (_, v: string) => `: <span style="color:var(--success,#34d399)">"${escHtmlInner(v.slice(1, -1))}"</span>`
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

      {/* Measure tool result overlay */}
      {measureMode && measureLine && (() => {
        const dx = (measureLine.x2 - measureLine.x1) / view.zoom
        const dy = (measureLine.y2 - measureLine.y1) / view.zoom
        const dist = Math.sqrt(dx * dx + dy * dy)
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
        const mx = (measureLine.x1 + measureLine.x2) / 2
        const my = (measureLine.y1 + measureLine.y2) / 2
        const label = `${dist.toFixed(1)}px  ${angleDeg.toFixed(1)}\u00B0`
        return (
          <div
            title="클릭하여 복사"
            onClick={() => { navigator.clipboard.writeText(label) }}
            style={{
              position: 'absolute', left: mx, top: my, transform: 'translate(-50%, -110%)',
              background: 'rgba(0,0,0,0.82)', color: '#f97316', fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)', padding: '3px 8px', borderRadius: 4,
              whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', zIndex: 20,
              border: '1px solid rgba(249,115,22,0.4)', lineHeight: '1.4', pointerEvents: 'all',
            }}
          >
            {dist.toFixed(1)} px &nbsp; {angleDeg.toFixed(1)}{'\u00B0'}
          </div>
        )
      })()}

      {/* Ruler overlay */}
      {showRuler && containerRef.current && (() => {
        const cw = containerRef.current!.clientWidth
        const ch = containerRef.current!.clientHeight
        return (
          <>
            <svg
              style={{ position: 'absolute', top: 0, left: 16, width: cw - 16, height: 16, pointerEvents: 'none', zIndex: 10 }}
              width={cw - 16} height={16}
            >
              <rect width="100%" height="16" fill="var(--bg-secondary)" opacity={0.9} />
              {getRulerTicks('h', cw - 16, { zoom: view.zoom, offsetX: view.offsetX - 16, offsetY: view.offsetY }).map(({ pos, label, isMajor }) => (
                <g key={`h${pos.toFixed(1)}`}>
                  <line x1={pos} y1={isMajor ? 8 : 12} x2={pos} y2={16} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  {isMajor && label && <text x={pos + 2} y={11} fontSize={7} fill="rgba(255,255,255,0.5)" fontFamily="monospace">{label}</text>}
                </g>
              ))}
            </svg>
            <svg
              style={{ position: 'absolute', top: 16, left: 0, width: 16, height: ch - 16, pointerEvents: 'none', zIndex: 10 }}
              width={16} height={ch - 16}
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
            <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, background: 'var(--bg-secondary)', zIndex: 11, pointerEvents: 'none' }} />
          </>
        )
      })()}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)', color: 'var(--text-muted)', fontSize: 11, pointerEvents: 'none',
        }}>
          씬 로딩 중...
        </div>
      )}

      {/* Zoom level display */}
      <div
        title={`${Math.round(view.zoom * 100)}% \u2014 클릭: 1:1 (100%) / 더블클릭: Fit`}
        onClick={() => {
          if (!containerRef.current) return
          const { width, height } = containerRef.current.getBoundingClientRect()
          setView({ zoom: 1, offsetX: (width - DESIGN_W) / 2, offsetY: (height - DESIGN_H) / 2 })
        }}
        onDoubleClick={e => { e.stopPropagation(); handleFit() }}
        style={{
          position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: 'var(--text-muted)',
          background: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: 3, cursor: 'pointer', userSelect: 'none',
        }}
      >
        {Math.round(view.zoom * 100)}%
      </div>

      {/* Total node count */}
      {nodeMap.size > 0 && (
        <div style={{
          position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: 'var(--text-muted)',
          background: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: 3, pointerEvents: 'none', userSelect: 'none',
        }}>
          {nodeMap.size}개 노드
          {selectedUuids.size > 1 && ` \u00B7 ${selectedUuids.size} 선택`}
        </div>
      )}

      {/* R655: Multi-select group button */}
      {showGroupBtn && (
        <div style={{ position: 'absolute', bottom: 42, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <button
            disabled
            style={{
              fontSize: 10, padding: '3px 10px', background: 'rgba(96,165,250,0.18)',
              border: '1px solid rgba(96,165,250,0.5)', borderRadius: 4, color: '#60a5fa',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            그룹화 ({multiSelectedSize})
          </button>
        </div>
      )}

      {/* Drag/Resize selected node info */}
      {(isDragging || isResizing) && selectedNode && (
        <div style={{
          position: 'absolute', bottom: 6, right: 44, fontSize: 9, color: 'rgba(250,200,50,0.9)',
          background: 'rgba(0,0,0,0.6)', padding: '1px 6px', borderRadius: 3, pointerEvents: 'none',
          fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
        }}>
          x:{Math.round(selectedNode.x)} y:{Math.round(selectedNode.y)} w:{Math.round(selectedNode.width)} h:{Math.round(selectedNode.height)}
        </div>
      )}

      {/* Stats panel */}
      {showStats && (() => {
        const nodes = [...nodeMap.values()]
        const total = nodes.length
        const active = nodes.filter(n => n.active).length
        const inactive = total - active
        const locked = nodes.filter(n => n.locked).length
        const hidden = nodes.filter(n => n.visible === false).length
        const tagged = nodes.filter(n => (n.tags ?? []).length > 0).length
        const compCounts: Record<string, number> = {}
        nodes.forEach(n => n.components.forEach(c => { compCounts[c.type] = (compCounts[c.type] ?? 0) + 1 }))
        const topComps = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
        const totalComps = Object.values(compCounts).reduce((s, v) => s + v, 0)
        return (
          <div style={{
            position: 'absolute', bottom: 28, left: 6, fontSize: 9, color: 'var(--text-muted)',
            background: 'rgba(10,10,15,0.85)', padding: '5px 8px', borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none', lineHeight: 1.7, fontVariantNumeric: 'tabular-nums',
          }}>
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

      {/* Breadcrumb node path */}
      {nodePath.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 18, left: 0, right: 0, height: 16,
          display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px',
          background: 'rgba(10,10,15,0.7)', borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          {nodePath.map((item, idx) => (
            <span key={item.uuid} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {idx > 0 && <span style={{ opacity: 0.4 }}>/</span>}
              <span
                style={{
                  cursor: 'pointer',
                  color: idx === nodePath.length - 1 ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: idx === nodePath.length - 1 ? 600 : 400,
                  maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                onClick={() => { setSelectedUuid(item.uuid); setSelectedUuids(new Set([item.uuid])) }}
                title={item.name}
              >
                {item.name.length > 12 ? item.name.slice(0, 10) + '\u2026' : item.name}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 18,
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px',
        background: 'rgba(10,10,15,0.75)', borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 9, color: 'var(--text-muted)', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
      }}>
        {spaceDown ? (
          <span style={{ color: '#f59e0b' }}>Space: 드래그로 패닝</span>
        ) : (
          <>
            <span style={{ color: activeTool === 'select' ? 'var(--accent)' : undefined }}>
              {activeTool === 'select' ? '\u2196 선택' : '\u271D 이동'}
            </span>
            <span>|</span>
            <span>{Math.round(view.zoom * 100)}%</span>
            {snapEnabled && <><span>|</span><span style={{ color: 'var(--success)' }}>Snap {snapGrid}px</span></>}
            {gridVisible && <><span>|</span><span>Grid</span></>}
            {selectedUuids.size > 0 && <><span>|</span><span style={{ color: '#60a5fa' }}>{selectedUuids.size}개 선택</span></>}
            {isDragging && <><span>|</span><span style={{ color: '#f59e0b' }}>드래그 중</span></>}
            {isResizing && <><span>|</span><span style={{ color: '#f59e0b' }}>리사이즈 중</span></>}
            {isDirty && <><span>|</span><span style={{ color: '#f97316' }} title="저장되지 않은 변경 사항">{'\u25CF'} 저장 안됨</span></>}
            {copiedNode && <><span>|</span><span style={{ color: '#a78bfa' }} title={`클립보드: ${copiedNode.name}`}>{'\uD83D\uDCCB'} {copiedNode.name}</span></>}
          </>
        )}
      </div>

      {/* Node info overlay (I key) */}
      {showNodeInfo && selectedNode && (
        <div style={{
          position: 'absolute', bottom: 28, right: 6, zIndex: 90,
          background: 'rgba(10,10,15,0.92)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4, padding: '5px 8px', fontSize: 9, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)', lineHeight: 1.7, pointerEvents: 'none', minWidth: 140,
        }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{selectedNode.name}</div>
          <div>pos: {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}</div>
          <div>size: {Math.round(selectedNode.width)} {'\u00D7'} {Math.round(selectedNode.height)}</div>
          <div>rot: {selectedNode.rotation.toFixed(1)}{'\u00B0'}</div>
          <div>anchor: {selectedNode.anchorX.toFixed(2)}, {selectedNode.anchorY.toFixed(2)}</div>
          <div>opacity: {selectedNode.opacity ?? 255}</div>
          {selectedNode.components.length > 0 && (
            <div style={{ color: 'var(--text-secondary)' }}>comps: {selectedNode.components.map(c => c.type.replace('cc.', '')).join(', ')}</div>
          )}
          {selectedNode.visible === false && <div style={{ color: '#f87171' }}>hidden</div>}
          {selectedNode.locked && <div style={{ color: '#fbbf24' }}>locked</div>}
        </div>
      )}

      {/* R1401: Stats overlay */}
      {showStatsOverlay && (() => {
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
            fontFamily: 'var(--font-mono)', lineHeight: 1.7, pointerEvents: 'none', minWidth: 120,
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

      {/* R1404: PNG export panel */}
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

      {/* Canvas search overlay */}
      {showCanvasSearch && (
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(10,10,15,0.92)', border: '1px solid var(--accent)',
          borderRadius: 5, padding: '3px 8px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{'\uD83D\uDD0D'}</span>
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
            style={{ width: 140, fontSize: 10, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
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
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 1px' }}>{'\u2193'}</button>
          )}
          <button onClick={() => { setShowCanvasSearch(false); setCanvasSearch('') }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>{'\u00D7'}</button>
        </div>
      )}

      {/* Bookmark list */}
      {showBookmarkList && bookmarkedUuids.size > 0 && (
        <div style={{
          position: 'absolute', top: 6, left: 6, zIndex: 100,
          background: 'rgba(10,10,15,0.92)', border: '1px solid var(--accent)',
          borderRadius: 5, padding: '6px 8px', minWidth: 160, maxHeight: 200,
          overflowY: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', fontSize: 9,
        }}>
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>{'\u2605'} 즐겨찾기</div>
          {[...bookmarkedUuids].map(uuid => {
            const n = nodeMap.get(uuid)
            if (!n) return null
            return (
              <div key={uuid}
                onClick={() => {
                  setSelectedUuid(uuid); setSelectedUuids(new Set([uuid])); setShowBookmarkList(false)
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
                  style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>{'\u00D7'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Ref image panel */}
      {showRefImagePanel && (
        <div style={{
          position: 'absolute', top: 6, right: 6, zIndex: 100,
          background: 'rgba(10,10,15,0.92)', border: '1px solid var(--accent)',
          borderRadius: 5, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4,
          minWidth: 220, boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>{'\uD83D\uDCF7'} 참조 이미지</div>
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

      {/* Drag delta overlay */}
      {isDragging && dragDelta && hoverTooltipPos && (
        <div style={{
          position: 'absolute', left: hoverTooltipPos.x + 8, top: hoverTooltipPos.y - 30,
          background: 'rgba(10,10,20,0.9)', color: '#facc15', fontSize: 9, padding: '3px 7px',
          borderRadius: 3, pointerEvents: 'none', border: '1px solid rgba(250,200,50,0.4)',
          fontVariantNumeric: 'tabular-nums', zIndex: 20, lineHeight: 1.5,
        }}>
          <div>{'\u0394'}x: {dragDelta.dx > 0 ? '+' : ''}{dragDelta.dx}</div>
          <div>{'\u0394'}y: {dragDelta.dy > 0 ? '+' : ''}{dragDelta.dy}</div>
        </div>
      )}

      {/* Node hover tooltip (300ms delay) */}
      {tooltipVisibleUuid && hoverTooltipPos && !isDragging && !isResizing && (() => {
        const hn = nodeMap.get(tooltipVisibleUuid)
        if (!hn) return null
        const icon = getComponentIcon(hn.components)
        const firstComp = hn.components[0]?.type ?? null
        return (
          <div style={{
            position: 'absolute', left: hoverTooltipPos.x, top: hoverTooltipPos.y,
            background: 'rgba(10,10,20,0.92)', color: '#e5e5e5', fontSize: 9, padding: '5px 8px',
            borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.15)', zIndex: 10, lineHeight: 1.6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
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
              {Math.round(hn.width)} {'\u00D7'} {Math.round(hn.height)}
            </div>
            {hn.locked && <div style={{ color: '#f87171' }}>{'\uD83D\uDD12'} 잠금됨</div>}
            {hn.visible === false && <div style={{ color: '#9ca3af' }}>숨김</div>}
            {hn.memo && <div style={{ color: '#fbbf24', marginTop: 2, maxWidth: 180, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{'\uD83D\uDCDD'} {hn.memo}</div>}
          </div>
        )
      })()}

      {/* Rotate angle overlay */}
      {isRotating && selectedNode && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: 13, fontWeight: 700, color: '#fb923c', background: 'rgba(0,0,0,0.65)',
          padding: '3px 10px', borderRadius: 4, pointerEvents: 'none',
          fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', letterSpacing: 1,
        }}>
          {selectedNode.rotation.toFixed(1)}{'\u00B0'}
        </div>
      )}

      {/* Drag/Resize coord overlay */}
      {(isDragging || isResizing) && selectedNode && (
        <div style={{
          position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: '#60a5fa',
          background: 'rgba(0,0,0,0.65)', padding: '2px 6px', borderRadius: 3,
          pointerEvents: 'none', fontVariantNumeric: 'tabular-nums',
        }}>
          {isDragging
            ? `X: ${Math.round(selectedNode.x)}  Y: ${Math.round(selectedNode.y)}`
            : `W: ${Math.round(selectedNode.width)}  H: ${Math.round(selectedNode.height)}`}
        </div>
      )}
    </>
  )
}
