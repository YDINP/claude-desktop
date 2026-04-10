import { useCCSceneCtx } from './CCSceneContext'

/** CCFileSceneView 상단 툴바 + breadcrumb (context에서 모든 상태 참조) */
export function CCSceneToolbar() {
  const ctx = useCCSceneCtx()
  const {
    sceneFile, selectedUuid, onSelect, onMove, onResize, onRotate,
    onMultiMove, onMultiDelete, onAddNode, onReorderExtreme, onGroupNodes,
    view, setView, viewRef, svgRef,
    flatNodes,
    designW, designH, effectiveW, effectiveH, bgColor,
    cx, cy, ccToSvg,
    cameraFrames,
    multiSelected, setMultiSelected, uuids,
    dragOverride,
    resizeOverride,
    transformTool, setTransformTool,
    measureMode, setMeasureMode, measureLine, setMeasureLine, measureStartRef,
    lockedUuids, toggleLock,
    hiddenUuids, setHiddenUuids,
    svSearch, setSvSearch, svSearchMatches, svSearchMatchIdxRef,
    ov,
    pinMarkers, setPinMarkers, showPinPanel, setShowPinPanel,
    viewBookmarks, setViewBookmarks,
    screenshotSending, handleScreenshotAI, handleSvgExport,
    handleFit, handleFitToSelected, panToCenter,
    refImgSrc, setRefImgSrc, refImgOpacity, setRefImgOpacity, refImgInputRef,
    editingZoom, setEditingZoom,
    selHistoryRef, selHistoryIdxRef,
    histPopupOpen, setHistPopupOpen, histPopupBtnRef,
    navSkipRef,
    showShortcutOverlay, setShowShortcutOverlay,
    overlayPanelRef, toolPanelRef,
    addUserGuide, clearUserGuides,
    resCustomWRef, resCustomHRef,
  } = ctx

  const {
    gridStyle, setGridStyle, showNodeNames, setShowNodeNames, showZOrder, setShowZOrder,
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

  return (
    <>
      {/* 툴바 */}
      <div style={{
        display: 'flex', gap: 4, padding: '3px 8px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, alignItems: 'center', fontSize: 11,
      }}>
        {/* W/E/R 도구 토글 버튼 */}
        {(['move', 'rotate', 'scale'] as const).map(tool => (
          <button key={tool} onClick={() => setTransformTool(tool)}
            title={tool === 'move' ? 'W: 이동 도구' : tool === 'rotate' ? 'E: 회전 도구' : 'R: 스케일 도구'}
            style={{
              padding: '1px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer', flexShrink: 0,
              background: transformTool === tool ? 'rgba(88,166,255,0.2)' : 'transparent',
              color: transformTool === tool ? '#58a6ff' : 'var(--text-muted)',
              border: `1px solid ${transformTool === tool ? '#58a6ff' : 'var(--border)'}`,
            }}
          >{tool === 'move' ? '↔ W' : tool === 'rotate' ? '↻ E' : '⤡ R'}</button>
        ))}
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
                <button onClick={() => setDepthColorMode(d => !d)} title="깊이 색조 모드" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${depthColorMode ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`, background: depthColorMode ? 'rgba(167,139,250,0.12)' : 'none', color: depthColorMode ? '#a78bfa' : 'var(--text-muted)' }}>🌈 깊이색</button>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>최대깊이</span>
                  <input type="number" min={0} max={20} value={depthFilterMax ?? ''} placeholder="∞"
                    onChange={e => { const v = parseInt(e.target.value); setDepthFilterMax(v > 0 ? v : null) }}
                    title="깊이 필터: 이 깊이 초과 노드 dim (비우면 제한 없음)"
                    style={{ width: 28, fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', color: depthFilterMax ? '#a78bfa' : 'var(--text-muted)', padding: '1px 3px', textAlign: 'center' }} />
                </span>
              </div>
              {/* 노드 레이블 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>노드 레이블</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setShowNodeNames(n => !n)} title="노드 이름" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showNodeNames ? '#58a6ff' : 'var(--border)'}`, background: showNodeNames ? 'rgba(88,166,255,0.12)' : 'none', color: showNodeNames ? '#58a6ff' : 'var(--text-muted)' }}>Abc 이름</button>
                <button onClick={() => setShowZOrder(z => !z)} title="Z-order 배지" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showZOrder ? '#fbbf24' : 'var(--border)'}`, background: showZOrder ? 'rgba(251,191,36,0.12)' : 'none', color: showZOrder ? '#fbbf24' : 'var(--text-muted)' }}>z 순서</button>
                <button onClick={() => setShowHelp(h => !h)} title="단축키 도움말" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showHelp ? '#58a6ff' : 'var(--border)'}`, background: showHelp ? 'rgba(88,166,255,0.12)' : 'none', color: showHelp ? '#58a6ff' : 'var(--text-muted)' }}>? 도움말</button>
                <button onClick={() => setShowLabelText(v => !v)} title="Label 텍스트 표시" style={{ padding: '1px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: `1px solid ${showLabelText ? 'rgba(255,220,80,0.5)' : 'var(--border)'}`, background: showLabelText ? 'rgba(255,220,80,0.12)' : 'none', color: showLabelText ? 'rgba(255,220,80,0.9)' : 'var(--text-muted)' }}>T Label</button>
                {/* R1697: 레이블 폰트 사이즈 A- A+ */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button onClick={() => setLabelFontSize(s => Math.max(6, s - 1))} title="라벨 폰트 줄이기" style={{ padding: '0 3px', fontSize: 9, borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>A-</button>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', minWidth: 12, textAlign: 'center' }}>{labelFontSize}</span>
                  <button onClick={() => setLabelFontSize(s => Math.min(24, s + 1))} title="라벨 폰트 키우기" style={{ padding: '0 3px', fontSize: 9, borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}>A+</button>
                </span>
              </div>
              {/* 오버레이 배지 */}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>오버레이 배지</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {([
                  ['W×H', showSizeLabels, setShowSizeLabels, '노드 크기 표시'],
                  ['α%', showOpacityLabels, setShowOpacityLabels, '불투명도 표시'],
                  ['∠°', showRotLabels, setShowRotLabels, '회전값 표시'],
                  ['Abc', showNameLabels, setShowNameLabels, '노드명 전체 표시'],
                  ['⚓', showAnchorOverlay, setShowAnchorOverlay, '앵커 포인트 전체 표시'],
                  ['■', showColorSwatch, setShowColorSwatch, '색상 스와치'],
                  ['#N', showChildCountBadge, setShowChildCountBadge, '자식 수 배지'],
                  ['D:', showDepthLabel, setShowDepthLabel, '깊이 레이블'],
                  ['↔', showFlipOverlay, setShowFlipOverlay, 'flip 표시'],
                  ['⊞', showCompBadges, setShowCompBadges, '컴포넌트 아이콘 배지'],
                  ['⬜', showSelBBox, setShowSelBBox, '다중 선택 bounding box'],
                  ['C', showCompBadge, setShowCompBadge, '주요 컴포넌트 배지'],
                  ['#', showTagBadge, setShowTagBadge, 'tag 배지'],
                  ['≡', showDupNameOverlay, setShowDupNameOverlay, '중복 이름 강조'],
                  ['→', showRotArrow, setShowRotArrow, '회전 방향 화살표'],
                  ['WH', showSizeOverlay, setShowSizeOverlay, '크기 표시'],
                  ['⊕', showOriginCross, setShowOriginCross, '원점 십자선'],
                  ['×', showScaleLabel, setShowScaleLabel, '스케일 배수'],
                  ['L', showLayerBadge, setShowLayerBadge, '레이어 배지'],
                  ['⚡', showEventBadge, setShowEventBadge, '이벤트 배지'],
                  ['▣', showSafeZone, setShowSafeZone, '안전 영역'],
                  ['⅓', showRuleOfThirds, setShowRuleOfThirds, '삼분법'],
                  ['R:W', showCustomRatio, setShowCustomRatio, '커스텀 비율 가이드'],
                  ['OOB', showOOBHighlight, setShowOOBHighlight, '캔버스 밖 강조'],
                  ['BBox', showSceneBBox, setShowSceneBBox, '씬 전체 BBox'],
                  ['#sel', showSelOrder, setShowSelOrder, '선택 순서'],
                  ['⚓·', showAnchorDot, setShowAnchorDot, '앵커 점'],
                  ['―', showSelPolyline, setShowSelPolyline, '선택 연결선'],
                  ['┃', showHierarchyLines, setShowHierarchyLines, '계층 연결선'],
                  ['⊡', showSelGroupBBox, setShowSelGroupBBox, '선택 그룹 BBox'],
                  ['P↑', showParentHighlight, setShowParentHighlight, '부모 강조'],
                  ['◌', showInactiveDim, setShowInactiveDim, '비활성 dim'],
                  ['🎨', showColorViz, setShowColorViz, '색상 시각화'],
                  ['✛', showCrosshair, setShowCrosshair, '크로스헤어'],
                  ['🌡', showDepthHeat, setShowDepthHeat, '깊이 히트맵'],
                  ['α', showOpacityOverlay, setShowOpacityOverlay, 'opacity 오버레이'],
                  ['°', showRotOverlay, setShowRotOverlay, '회전 오버레이'],
                  ['xy', showPosText, setShowPosText, '위치 텍스트'],
                  ['sx', showScaleText, setShowScaleText, '스케일 텍스트'],
                  ['Cn', showCompCountBadge, setShowCompCountBadge, '컴포넌트 수'],
                  ['🔥', showSizeHeat, setShowSizeHeat, '크기 히트맵'],
                  ['⊕', showSelCenter, setShowSelCenter, '선택 중심'],
                  ['↔d', showPairDist, setShowPairDist, '노드간 거리'],
                  ['Sp', showSpriteName, setShowSpriteName, '스프라이트명'],
                  ['id', showUuidBadge, setShowUuidBadge, 'UUID 배지'],
                  ['·', showCenterDot, setShowCenterDot, '중심 점'],
                  ['⚓≠', showNonDefaultAnchor, setShowNonDefaultAnchor, '비기본 앵커'],
                  ['0sz', showZeroSizeWarn, setShowZeroSizeWarn, '크기0 경고'],
                  ['+', showSelAxisLine, setShowSelAxisLine, '선택 축선'],
                  ['~', showSiblingHighlight, setShowSiblingHighlight, '형제 강조'],
                  ['op', showOpacityHud, setShowOpacityHud, 'opacity HUD'],
                  ['⇌', showRefArrows, setShowRefArrows, 'UUID 참조 화살표'],
                ] as [string, boolean, (fn: (v: boolean) => boolean) => void, string][]).map(([label, val, setter, title]) => (
                  <button key={label}
                    onClick={() => setter(v => !v)}
                    title={title}
                    style={{ padding: '1px 4px', fontSize: 8, borderRadius: 3, cursor: 'pointer', border: `1px solid ${val ? 'rgba(88,166,255,0.5)' : 'var(--border)'}`, background: val ? 'rgba(88,166,255,0.15)' : 'none', color: val ? '#58a6ff' : 'var(--text-muted)' }}
                  >{label}</button>
                ))}
              </div>
              {/* R2709: 커스텀 비율 입력 */}
              {showCustomRatio && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 }}>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>비율</span>
                  <input type="number" min={1} value={customRatioW} onChange={e => setCustomRatioW(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 32, fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', padding: '1px 3px', textAlign: 'center' }} />
                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>:</span>
                  <input type="number" min={1} value={customRatioH} onChange={e => setCustomRatioH(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 32, fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', padding: '1px 3px', textAlign: 'center' }} />
                </div>
              )}
              {/* 컴포넌트 타입 필터 */}
              {(() => {
                const typeCounts = new Map<string, number>()
                flatNodes.forEach(fn => fn.node.components.forEach(c => {
                  if (c.type !== 'cc.Node' && c.type !== 'cc.UITransform' && c.type !== 'cc.UIOpacity')
                    typeCounts.set(c.type, (typeCounts.get(c.type) ?? 0) + 1)
                }))
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
          const rot = fn.node.rotation.z ?? 0
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
                  localStorage.setItem('cd-sv-locked-nodes', JSON.stringify([...next]))
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
                    ['Ctrl+C/V', '노드 복사/붙여넣기'],
                    ['H', 'active 토글'],
                    ['L', '잠금 토글'],
                    ['Ctrl+↑/↓', '형제 순서 이동'],
                    ['Ctrl+[/]', 'z-순서 변경'],
                    ['Ctrl+G', '다중 노드 그룹화'],
                    ['Home/End', '맨 앞/뒤 이동'],
                    ['Alt+←/→', '선택 히스토리'],
                    ['Ctrl+P', '핀 마커 토글'],
                    ['G', '형제 그룹 토글'],
                    ['M', '거리 측정 도구'],
                    ['R', '스케일 도구'],
                    ['V', '선택(이동) 도구'],
                    ['+/-', '줌 인/아웃'],
                    ['0', '줌 리셋 (1:1)'],
                    ['Shift+F', '전체 맞춤'],
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
    </>
  )
}
