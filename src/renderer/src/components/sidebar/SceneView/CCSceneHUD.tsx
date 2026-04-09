import { useCCSceneCtx } from './CCSceneContext'
import { CCSceneContextMenu, CCSceneNodePickMenu } from './CCSceneContextMenu'
import { CCSceneMinimap } from './CCSceneMinimap'

function useHudCtx() {
  const ctx = useCCSceneCtx()
  const {
    selectedUuid, onSelect, onMove, onOpacity,
    view, viewRef, svgRef,
    flatNodes,
    designW, designH, effectiveW, effectiveH,
    multiSelected,
    dragOverride, resizeOverride, rotateOverride,
    lockedUuids, toggleLock,
    mouseScenePos, hoverUuid, hoverClientPos,
    svSearch, svSearchMatches,
    ov,
    ctxMenu, setCtxMenu, nodePickMenu, setNodePickMenu, nodePickMenuRef,
    handleFit, handleFitToSelected,
    dragRef,
    onToggleActive, onAddNode,
    setMultiSelected,
    mmPos, setMmPos,
  } = ctx
  const {
    showHelp, showMinimap, showWorldPos, setShowWorldPos,
    selectionColor, snapSize,
    resOverride,
  } = ov
  return {
    selectedUuid, onSelect, onMove, onOpacity,
    view, viewRef, svgRef, flatNodes,
    designW, designH, effectiveW, effectiveH,
    multiSelected, dragOverride, resizeOverride, rotateOverride,
    lockedUuids, toggleLock, mouseScenePos, hoverUuid, hoverClientPos,
    svSearch, svSearchMatches, ov,
    ctxMenu, setCtxMenu, nodePickMenu, setNodePickMenu, nodePickMenuRef,
    handleFit, handleFitToSelected, dragRef,
    onToggleActive, onAddNode, setMultiSelected,
    mmPos, setMmPos,
    showHelp, showMinimap, showWorldPos, setShowWorldPos,
    selectionColor, snapSize, resOverride,
  }
}

/** svg-container 내부 오버레이: 화면 밖 선택 노드 화살표 + 선택 노드 상세 */
export function CCSceneInnerHUD() {
  const { selectedUuid, view, svgRef, flatNodes, designH } = useCCSceneCtx()

  return (
    <>
      {/* R1614: 화면 밖 선택 노드 방향 화살표 */}
      {selectedUuid && (() => {
        const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
        if (!fn) return null
        const svgEl = svgRef.current
        if (!svgEl) return null
        const rect = svgEl.getBoundingClientRect()
        const svgCX = rect.width / 2
        const svgCY = rect.height / 2
        const nSvgX = fn.worldX * view.zoom + view.offsetX
        const nSvgY = (-fn.worldY) * view.zoom + view.zoom * (designH / 2) + view.offsetY
        const padding = 20
        const inView = nSvgX >= -padding && nSvgX <= rect.width + padding && nSvgY >= -padding && nSvgY <= rect.height + padding
        if (inView) return null
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
    </>
  )
}

/** svg-container 외부 오버레이: 호버 패널, HUD, 컨텍스트 메뉴, 미니맵 등 */
export function CCSceneOuterHUD() {
  const h = useHudCtx()
  const {
    selectedUuid, onSelect, onMove, onOpacity,
    view, viewRef, svgRef, flatNodes,
    designW, designH, effectiveW, effectiveH,
    multiSelected, dragOverride, resizeOverride, rotateOverride,
    lockedUuids, toggleLock, mouseScenePos, hoverUuid, hoverClientPos,
    svSearch, svSearchMatches, ov,
    ctxMenu, setCtxMenu, nodePickMenu, setNodePickMenu, nodePickMenuRef,
    handleFit, handleFitToSelected, dragRef,
    onToggleActive, onAddNode, setMultiSelected,
    mmPos, setMmPos,
    showHelp, showMinimap, showWorldPos, setShowWorldPos,
    selectionColor, snapSize, resOverride,
  } = h

  return (
    <>
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
      {/* R1489: 미니맵 오버레이 (extracted to CCSceneMinimap) */}
      {showMinimap && flatNodes.length > 0 && (
        <CCSceneMinimap
          flatNodes={flatNodes}
          selectedUuid={selectedUuid}
          multiSelected={multiSelected}
          svSearch={svSearch}
          svSearchMatches={svSearchMatches}
          effectiveW={effectiveW}
          effectiveH={effectiveH}
          view={view}
          svgRef={svgRef}
          viewRef={viewRef}
          mmPos={mmPos}
          setMmPos={setMmPos}
          setView={setView}
          onSelect={onSelect}
        />
      )}
      {/* R1496: 컨텍스트 메뉴 (extracted to CCSceneContextMenu) */}
      {ctxMenu && (
        <CCSceneContextMenu
          ctxMenu={ctxMenu}
          flatNodes={flatNodes}
          lockedUuids={lockedUuids}
          selectedUuid={selectedUuid}
          onClose={() => setCtxMenu(null)}
          toggleLock={toggleLock}
          handleFit={handleFit}
          handleFitToSelected={handleFitToSelected}
          onSelect={onSelect}
          setMultiSelected={setMultiSelected}
          onToggleActive={onToggleActive}
          onAddNode={onAddNode}
        />
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
      {/* Right-click node context menu (overlapping nodes, extracted to CCSceneNodePickMenu) */}
      {nodePickMenu && (
        <CCSceneNodePickMenu
          nodePickMenu={nodePickMenu}
          nodePickMenuRef={nodePickMenuRef}
          onSelect={onSelect}
          onClose={() => setNodePickMenu(null)}
        />
      )}
    </>
  )
}
