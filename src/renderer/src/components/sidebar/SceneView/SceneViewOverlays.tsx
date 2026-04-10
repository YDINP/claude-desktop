import React from 'react'
import { useSceneViewCtx } from './SceneViewContext'
import { cocosToSvg } from './utils'
import { LAYER_COLOR_PALETTE } from './sceneViewConstants'
import { t } from '../../../utils/i18n'

/**
 * SceneViewPanel 내 SVG 뷰포트 위에 absolute position으로 렌더링되는 오버레이 패널들.
 * - 레이어 패널 (Layer Panel)
 * - 편집 이력 패널 (Edit History)
 * - 미니맵 (Minimap)
 * - 변경 히스토리 팝업
 *
 * SceneViewPanel에서 추출됨 (Context로 상태 공유)
 */
export function SceneViewOverlays() {
  const ctx = useSceneViewCtx()
  const {
    nodeMap, rootUuid, updateNode, view,
    DESIGN_W, DESIGN_H,
    selectedUuid, setSelectedUuid, selectedUuids, setSelectedUuids,
    topLevelNodes, collectDescendants, allLayers,
    hiddenLayers, setHiddenLayers, lockedLayers, setLockedLayers,
    layerColors, setLayerColors,
    showLayerPanel, showAllToggle, setShowAllToggle,
    layerDragIdx, setLayerDragIdx, layerDropIdx, setLayerDropIdx,
    editHistory, showEditHistory, setShowEditHistory,
    showMinimap, setShowMinimap, containerRef,
    changeHistory, showChangeHistory, setShowChangeHistory,
    svgRef,
  } = ctx

  return (
    <>
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
              title={showAllToggle ? t('overlay.hideAll') : t('overlay.showAll')}
              style={{
                fontSize: 12, padding: '1px 3px',
                background: 'none', border: 'none', cursor: 'pointer',
                opacity: showAllToggle ? 1 : 0.4,
                textDecoration: showAllToggle ? 'none' : 'line-through',
                lineHeight: 1,
              }}
            >
              {showAllToggle ? '\uD83D\uDC41' : '\uD83D\uDE48'}
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
                  title={t('overlay.layerReorder')}
                >{'\u22EE\u22EE'}</span>
                <button
                  onClick={() => setHiddenLayers(prev => { const s = new Set(prev); if (s.has(layer.uuid)) s.delete(layer.uuid); else s.add(layer.uuid); return s })}
                  title={isHidden ? t('overlay.layerShow') : t('overlay.layerHide')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, opacity: isHidden ? 0.4 : 1, lineHeight: 1 }}
                >
                  {isHidden ? '\uD83D\uDE48' : '\uD83D\uDC41'}
                </button>
                <button
                  onClick={() => setLockedLayers(prev => { const s = new Set(prev); if (s.has(layer.uuid)) s.delete(layer.uuid); else s.add(layer.uuid); return s })}
                  title={isLocked ? t('overlay.layerUnlock') : t('overlay.layerLock')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, opacity: isLocked ? 1 : 0.4, lineHeight: 1 }}
                >
                  {isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
                </button>
                {/* R1395: 색상 라벨 버튼 */}
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
                  title={lc ? t('overlay.layerColorChange').replace('{c}', lc) : t('overlay.layerColorAdd')}
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
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        nodeMap.forEach(n => {
          const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
          minX = Math.min(minX, sx - n.width / 2)
          minY = Math.min(minY, sy - n.height / 2)
          maxX = Math.max(maxX, sx + n.width / 2)
          maxY = Math.max(maxY, sy + n.height / 2)
        })
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
            title={t('overlay.minimapTitle')}
            onDoubleClick={e => { e.stopPropagation(); setShowMinimap(false) }}
            onClick={e => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const mmX = e.clientX - rect.left
              const mmY = e.clientY - rect.top
              const sceneX = mmX / sx + minX
              const sceneY = mmY / sy + minY
              if (containerRef.current) {
                const cw = containerRef.current.clientWidth
                const ch = containerRef.current.clientHeight
                ctx.setView(prev => ({
                  ...prev,
                  offsetX: cw / 2 - sceneX * prev.zoom,
                  offsetY: ch / 2 - sceneY * prev.zoom,
                }))
              }
            }}
          >
            <svg width={MM_W} height={MM_H} style={{ display: 'block' }}>
              <rect
                x={(0 - minX) * sx} y={(0 - minY) * sy}
                width={DESIGN_W * sx} height={DESIGN_H * sy}
                fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1}
              />
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
          title={t('overlay.minimapShow')}
          style={{
            position: 'absolute', bottom: 28, right: 6,
            fontSize: 9, padding: '1px 4px',
            background: 'rgba(15,15,20,0.8)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          {'\u229E'}
        </button>
      )}

      {/* 변경 히스토리 버튼 + 팝업 */}
      {changeHistory.length > 0 && (
        <div style={{ position: 'absolute', bottom: 52, right: 6 }}>
          <button
            onClick={() => setShowChangeHistory(v => !v)}
            title={t('overlay.changeHistory')}
            style={{
              fontSize: 9, padding: '1px 4px',
              background: showChangeHistory ? 'var(--accent-dim)' : 'rgba(15,15,20,0.8)',
              border: `1px solid ${showChangeHistory ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 3, color: showChangeHistory ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            {'\u2195'} {changeHistory.length}
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
    </>
  )
}
