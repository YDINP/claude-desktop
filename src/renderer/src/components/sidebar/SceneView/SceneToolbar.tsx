import React, { useState, useRef, useEffect } from 'react'

export type SceneBgValue = 'dark' | 'light' | 'checker' | string

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2]

interface SceneToolbarProps {
  activeTool: 'select' | 'move'
  zoom: number
  gridVisible: boolean
  snapEnabled: boolean
  selectionCount?: number
  canUndo?: boolean
  canRedo?: boolean
  canCopy?: boolean
  canPaste?: boolean
  canZOrder?: boolean
  canAlign?: boolean
  onAlignLeft?: () => void
  onAlignCenterH?: () => void
  onAlignRight?: () => void
  onAlignTop?: () => void
  onAlignCenterV?: () => void
  onAlignBottom?: () => void
  onDistributeH?: () => void
  onDistributeV?: () => void
  onMatchWidth?: () => void
  onMatchHeight?: () => void
  onMatchBoth?: () => void
  onGridLayout?: () => void
  selectedUuid?: string | null
  onCreateNode?: () => void
  onDeleteNode?: () => void
  onToolChange: (tool: 'select' | 'move') => void
  onZoomChange: (zoom: number) => void
  onGridToggle: () => void
  onSnapToggle: () => void
  onFit: () => void
  onRefresh: () => void
  onUndo?: () => void
  onRedo?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onZOrderFront?: () => void
  onZOrderBack?: () => void
  onZOrderUp?: () => void
  onZOrderDown?: () => void
  showHierarchy?: boolean
  onHierarchyToggle?: () => void
  showLabels?: boolean
  onLabelsToggle?: () => void
  sceneBg?: SceneBgValue
  onSceneBgChange?: (bg: SceneBgValue) => void
  showMinimap?: boolean
  onMinimapToggle?: () => void
  canvasSize?: { w: number; h: number }
  onCanvasSizeChange?: (w: number, h: number) => void
  onScreenshot?: () => void
  screenshotDone?: boolean
  onExportSvg?: () => void
  onExportPng?: () => void
  onSaveScene?: () => void
  onLoadScene?: () => void
  activeSlot?: number
  onSlotChange?: (slot: number) => void
  snapGrid?: number
  onSnapGridChange?: (size: number) => void
  showConnections?: boolean
  onConnectionsToggle?: () => void
  showStats?: boolean
  onStatsToggle?: () => void
  componentFilter?: string
  componentTypes?: string[]
  onComponentFilterChange?: (type: string) => void
  focusMode?: boolean
  onFocusModeToggle?: () => void
  measureMode?: boolean
  onMeasureModeToggle?: () => void
  hasRefImage?: boolean
  onRefImageToggle?: () => void
  bookmarkCount?: number
  showBookmarkList?: boolean
  onBookmarkListToggle?: () => void
  isSelectedLocked?: boolean
  onLockToggle?: () => void
  isPinned?: boolean
  onTogglePin?: () => void
  tagFilter?: string
  allTags?: string[]
  onTagFilterChange?: (tag: string) => void
  onAddAnnotation?: () => void
  nodeSearch?: string
  onNodeSearchChange?: (v: string) => void
  hasSnapshot?: boolean
  showDiff?: boolean
  onTakeSnapshot?: () => void
  onToggleDiff?: () => void
  showRuler?: boolean
  onToggleRuler?: () => void
  mousePos?: { x: number; y: number } | null
  showLayerPanel?: boolean
  onToggleLayerPanel?: () => void
  showHeatmap?: boolean
  onHeatmapToggle?: () => void
  showQuickActions?: boolean
  onQuickActionsToggle?: () => void
  onZoomTo?: (zoom: number) => void
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export function SceneToolbar({
  activeTool,
  zoom,
  gridVisible,
  snapEnabled,
  selectionCount,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canZOrder,
  canAlign,
  onAlignLeft,
  onAlignCenterH,
  onAlignRight,
  onAlignTop,
  onAlignCenterV,
  onAlignBottom,
  onDistributeH,
  onDistributeV,
  onMatchWidth,
  onMatchHeight,
  onMatchBoth,
  onGridLayout,
  selectedUuid,
  onCreateNode,
  onDeleteNode,
  onToolChange,
  onZoomChange,
  onGridToggle,
  onSnapToggle,
  onFit,
  onRefresh,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onZOrderFront,
  onZOrderBack,
  onZOrderUp,
  onZOrderDown,
  showHierarchy,
  onHierarchyToggle,
  showLabels,
  onLabelsToggle,
  sceneBg = 'dark',
  onSceneBgChange,
  showMinimap,
  onMinimapToggle,
  canvasSize,
  onCanvasSizeChange,
  onScreenshot,
  screenshotDone,
  onExportSvg,
  onExportPng,
  onSaveScene,
  onLoadScene,
  activeSlot,
  onSlotChange,
  snapGrid,
  onSnapGridChange,
  showConnections,
  onConnectionsToggle,
  showStats,
  onStatsToggle,
  componentFilter,
  componentTypes,
  onComponentFilterChange,
  focusMode,
  onFocusModeToggle,
  measureMode,
  onMeasureModeToggle,
  hasRefImage,
  onRefImageToggle,
  bookmarkCount,
  showBookmarkList,
  onBookmarkListToggle,
  isSelectedLocked,
  onLockToggle,
  isPinned,
  onTogglePin,
  tagFilter,
  allTags,
  onTagFilterChange,
  onAddAnnotation,
  nodeSearch = '',
  onNodeSearchChange,
  hasSnapshot,
  showDiff,
  onTakeSnapshot,
  onToggleDiff,
  showRuler,
  onToggleRuler,
  mousePos,
  showLayerPanel,
  onToggleLayerPanel,
  showHeatmap,
  onHeatmapToggle,
  showQuickActions,
  onQuickActionsToggle,
  onZoomTo,
}: SceneToolbarProps) {
  const [zoomEditing, setZoomEditing] = useState(false)
  const [zoomDraft, setZoomDraft] = useState('')
  const [zoomPresetOpen, setZoomPresetOpen] = useState(false)
  const [bgPaletteOpen, setBgPaletteOpen] = useState(false)
  const zoomPresetRef = useRef<HTMLDivElement>(null)
  const zoomPresetBtnRef = useRef<HTMLButtonElement>(null)
  const [customColor, setCustomColor] = useState(
    sceneBg !== 'dark' && sceneBg !== 'light' && sceneBg !== 'checker' ? sceneBg : '#1a1a2e'
  )
  const bgBtnRef = useRef<HTMLButtonElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bgPaletteOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        paletteRef.current && !paletteRef.current.contains(e.target as Node) &&
        bgBtnRef.current && !bgBtnRef.current.contains(e.target as Node)
      ) {
        setBgPaletteOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [bgPaletteOpen])

  useEffect(() => {
    if (!zoomPresetOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        zoomPresetRef.current && !zoomPresetRef.current.contains(e.target as Node) &&
        zoomPresetBtnRef.current && !zoomPresetBtnRef.current.contains(e.target as Node)
      ) {
        setZoomPresetOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [zoomPresetOpen])

  const zoomIn = () => {
    const next = ZOOM_STEPS.find(z => z > zoom) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
    onZoomChange(next)
  }
  const zoomOut = () => {
    const next = [...ZOOM_STEPS].reverse().find(z => z < zoom) ?? ZOOM_STEPS[0]
    onZoomChange(next)
  }

  const commitZoomEdit = () => {
    const val = parseFloat(zoomDraft.replace('%', ''))
    if (!isNaN(val) && val > 0) onZoomChange(Math.min(800, Math.max(10, val)) / 100)
    setZoomEditing(false)
  }

  const btnBase: React.CSSProperties = {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-muted)',
    fontSize: 10,
    padding: '2px 5px',
    cursor: 'pointer',
    lineHeight: '16px',
    userSelect: 'none',
  }
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
  }
  const divider: React.CSSProperties = {
    width: 1,
    height: 14,
    background: 'var(--border)',
    flexShrink: 0,
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 6px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* 도구 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          style={activeTool === 'select' ? btnActive : btnBase}
          onClick={() => onToolChange('select')}
          title="선택 도구 (V)"
        >
          ↖ 선택
        </button>
        {selectionCount !== undefined && selectionCount > 1 && (
          <span
            style={{
              background: '#60a5fa',
              color: '#fff',
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 8,
              padding: '1px 5px',
              lineHeight: '14px',
              pointerEvents: 'none',
            }}
          >
            {selectionCount}
          </span>
        )}
      </div>
      <button
        style={activeTool === 'move' ? btnActive : btnBase}
        onClick={() => onToolChange('move')}
        title="이동 도구 (W)"
      >
        ✥ 이동
      </button>

      <div style={divider} />

      {/* 줌 */}
      <button style={btnBase} onClick={zoomOut} title="축소">−</button>
      {zoomEditing ? (
        <input
          autoFocus
          value={zoomDraft}
          onChange={e => setZoomDraft(e.target.value)}
          onBlur={commitZoomEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitZoomEdit(); else if (e.key === 'Escape') setZoomEditing(false); e.stopPropagation() }}
          style={{ width: 44, fontSize: 10, textAlign: 'center', background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 2, color: 'var(--text-primary)', padding: '1px 2px', outline: 'none' }}
        />
      ) : (
        <button
          style={{ ...btnBase, minWidth: 40, textAlign: 'center' }}
          onClick={() => onZoomChange(1)}
          onDoubleClick={() => { setZoomDraft(String(Math.round(zoom * 100))); setZoomEditing(true) }}
          title="클릭: 100% 리셋 / 더블클릭: 직접 입력"
        >
          {Math.round(zoom * 100)}%
        </button>
      )}
      <button style={btnBase} onClick={zoomIn} title="확대">+</button>

      {/* 줌 프리셋 드롭다운 */}
      {onZoomTo && (
        <div style={{ position: 'relative' }}>
          <button
            ref={zoomPresetBtnRef}
            style={zoomPresetOpen ? btnActive : btnBase}
            onClick={() => setZoomPresetOpen(v => !v)}
            title="줌 프리셋 선택"
          >
            ▾
          </button>
          {zoomPresetOpen && (
            <div
              ref={zoomPresetRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 2,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 70,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}
            >
              {ZOOM_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => { onZoomTo(p); setZoomPresetOpen(false) }}
                  style={{
                    background: Math.abs(zoom - p) < 0.005 ? 'var(--accent-dim)' : 'transparent',
                    border: 'none',
                    color: Math.abs(zoom - p) < 0.005 ? 'var(--accent)' : 'var(--text-primary)',
                    fontSize: 10,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {Math.round(p * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={divider} />

      {/* Fit */}
      <button
        style={btnBase}
        onClick={onFit}
        title="화면에 맞추기 (F)"
      >
        ⊡ Fit
      </button>

      <div style={divider} />

      {/* 레이어 패널 */}
      {onToggleLayerPanel && (
        <button
          style={showLayerPanel ? btnActive : btnBase}
          onClick={onToggleLayerPanel}
          title="레이어 패널 표시/숨기기"
        >
          📋 Layers
        </button>
      )}

      {/* 룰러 */}
      {onToggleRuler && (
        <button
          style={showRuler ? btnActive : btnBase}
          onClick={onToggleRuler}
          title="눈금자 표시/숨기기 (R)"
        >
          ⊢ Ruler
        </button>
      )}

      {/* 그리드 */}
      <button
        style={gridVisible ? btnActive : btnBase}
        onClick={onGridToggle}
        title="그리드 표시"
      >
        ⊞ Grid
      </button>

      {/* 스냅 */}
      <button
        style={snapEnabled ? btnActive : btnBase}
        onClick={onSnapToggle}
        title="스냅 활성화"
      >
        ⊕ Snap
      </button>

      {/* 스냅 그리드 크기 */}
      {onSnapGridChange && (
        <select
          value={snapGrid ?? 4}
          onChange={e => onSnapGridChange(Number(e.target.value))}
          title="스냅 그리드 크기 (px)"
          style={{ fontSize: 9, padding: '1px 2px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          {[1, 2, 4, 5, 8, 10, 16, 20, 50].map(v => (
            <option key={v} value={v}>{v}px</option>
          ))}
        </select>
      )}

      {/* 컴포넌트 타입 필터 */}
      {onComponentFilterChange && componentTypes && componentTypes.length > 0 && (
        <select
          value={componentFilter ?? 'all'}
          onChange={e => onComponentFilterChange(e.target.value)}
          title="컴포넌트 타입 필터"
          style={{ fontSize: 9, padding: '1px 2px', background: componentFilter !== 'all' ? 'var(--accent-dim)' : 'var(--bg-secondary)', border: `1px solid ${componentFilter !== 'all' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 2, color: componentFilter !== 'all' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <option value="all">전체</option>
          {componentTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}

      {/* 태그 필터 */}
      {onTagFilterChange && allTags && allTags.length > 0 && (
        <select
          value={tagFilter ?? 'all'}
          onChange={e => onTagFilterChange(e.target.value)}
          title="태그 필터 — 선택한 태그가 없는 노드 dimmed 처리"
          style={{ fontSize: 9, padding: '1px 2px', background: tagFilter !== 'all' ? 'var(--accent-dim)' : 'var(--bg-secondary)', border: `1px solid ${tagFilter !== 'all' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 2, color: tagFilter !== 'all' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <option value="all">#태그</option>
          {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
      )}

      {/* 포커스 모드 */}
      {onFocusModeToggle && (
        <button
          style={focusMode ? btnActive : btnBase}
          onClick={onFocusModeToggle}
          title="포커스 모드 — 선택 노드만 강조 (Alt+Z)"
        >◎ Focus</button>
      )}

      {/* 측정 도구 */}
      {onMeasureModeToggle && (
        <button
          style={measureMode ? btnActive : btnBase}
          onClick={onMeasureModeToggle}
          title="측정 도구 — 드래그로 거리 측정 (Alt+M)"
        >📏 Ruler</button>
      )}

      {/* 히트맵 */}
      {onHeatmapToggle && (
        <button
          style={showHeatmap ? btnActive : btnBase}
          onClick={onHeatmapToggle}
          title="노드 분포 히트맵 오버레이"
        >🌡</button>
      )}

      {/* 퀵 액션 패널 토글 */}
      {onQuickActionsToggle && (
        <button
          style={showQuickActions ? btnActive : btnBase}
          onClick={onQuickActionsToggle}
          title="퀵 액션 패널 표시/숨기기 — 선택 노드 근처에 빠른 조작 버튼 표시"
        >⚡</button>
      )}

      {/* 주석 추가 */}
      {onAddAnnotation && (
        <button
          style={btnBase}
          onClick={onAddAnnotation}
          title="씬에 스티커 메모 추가"
        >📝</button>
      )}

      {/* 참조 이미지 */}
      {onRefImageToggle && (
        <button
          style={hasRefImage ? btnActive : btnBase}
          onClick={onRefImageToggle}
          title="참조 이미지 오버레이"
        >📷</button>
      )}

      {/* 스냅샷 */}
      {onTakeSnapshot && (
        <button
          style={btnBase}
          onClick={onTakeSnapshot}
          title="현재 상태 스냅샷"
        >📷 Snap</button>
      )}
      {hasSnapshot && onToggleDiff && (
        <button
          style={showDiff ? { ...btnBase, color: 'var(--accent)', borderColor: 'var(--accent)' } : btnBase}
          onClick={onToggleDiff}
          title="스냅샷 비교 — 이동된 노드의 이전 위치 표시"
        >👁 Diff</button>
      )}

      {/* 즐겨찾기 목록 */}
      {onBookmarkListToggle && (
        <button
          style={showBookmarkList ? btnActive : btnBase}
          onClick={onBookmarkListToggle}
          title="즐겨찾기 목록 (Ctrl+B 현재 노드 토글)"
        >★{bookmarkCount ? ` ${bookmarkCount}` : ''}</button>
      )}

      {/* 캔버스 크기 프리셋 */}
      {onCanvasSizeChange && (
        <select
          value={`${canvasSize?.w ?? 960}x${canvasSize?.h ?? 640}`}
          onChange={e => {
            const [w, h] = e.target.value.split('x').map(Number)
            onCanvasSizeChange(w, h)
          }}
          title="캔버스 크기 프리셋"
          style={{ fontSize: 9, padding: '1px 2px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          {[
            { label: '960×640', w: 960, h: 640 },
            { label: '1280×720', w: 1280, h: 720 },
            { label: '1920×1080', w: 1920, h: 1080 },
            { label: '750×1334', w: 750, h: 1334 },
            { label: '1334×750', w: 1334, h: 750 },
            { label: '480×320', w: 480, h: 320 },
          ].map(p => (
            <option key={p.label} value={`${p.w}x${p.h}`}>{p.label}</option>
          ))}
        </select>
      )}

      {/* 노드 검색 */}
      {onNodeSearchChange && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            value={nodeSearch}
            onChange={e => onNodeSearchChange(e.target.value)}
            placeholder="노드 검색..."
            style={{
              width: 120,
              fontSize: 10,
              padding: '2px 18px 2px 5px',
              background: 'var(--bg-secondary)',
              border: `1px solid ${nodeSearch ? '#fbbf24' : 'var(--border)'}`,
              borderRadius: 3,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {nodeSearch && (
            <span
              onClick={() => onNodeSearchChange('')}
              style={{ position: 'absolute', right: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1 }}
            >✕</span>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* 마우스 Cocos 좌표 */}
      {mousePos != null && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '1px 5px',
            lineHeight: '16px',
            userSelect: 'none',
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          X: {mousePos.x}, Y: {mousePos.y}
        </span>
      )}

      {/* 실행 취소 / 다시 실행 */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="실행 취소 (Ctrl+Z)"
        style={{ ...btnBase, opacity: canUndo ? 1 : 0.3 }}
      >↩</button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="다시 실행 (Ctrl+Y)"
        style={{ ...btnBase, opacity: canRedo ? 1 : 0.3 }}
      >↪</button>

      <button
        onClick={onCopy}
        disabled={!canCopy}
        title="복사 (Ctrl+C)"
        style={{ ...btnBase, opacity: canCopy ? 1 : 0.3 }}
      >C</button>
      <button
        onClick={onPaste}
        disabled={!canPaste}
        title="붙여넣기 (Ctrl+V)"
        style={{ ...btnBase, opacity: canPaste ? 1 : 0.3 }}
      >V</button>

      <div style={divider} />

      {/* Z-order 버튼 — 단일 노드 선택 시에만 활성 */}
      <button
        onClick={onZOrderFront}
        disabled={!canZOrder}
        title="맨 앞으로 (Z-order)"
        style={{ ...btnBase, opacity: canZOrder ? 1 : 0.3 }}
      >⬆⬆</button>
      <button
        onClick={onZOrderUp}
        disabled={!canZOrder}
        title="앞으로"
        style={{ ...btnBase, opacity: canZOrder ? 1 : 0.3 }}
      >⬆</button>
      <button
        onClick={onZOrderDown}
        disabled={!canZOrder}
        title="뒤로"
        style={{ ...btnBase, opacity: canZOrder ? 1 : 0.3 }}
      >⬇</button>
      <button
        onClick={onZOrderBack}
        disabled={!canZOrder}
        title="맨 뒤로"
        style={{ ...btnBase, opacity: canZOrder ? 1 : 0.3 }}
      >⬇⬇</button>

      <div style={divider} />

      {/* 정렬 도구 — 멀티셀렉트 시 표시 */}
      {canAlign && (
        <>
          <div style={divider} />
          <button onClick={onAlignLeft}  title="왼쪽 정렬" style={btnBase}>←L</button>
          <button onClick={onAlignCenterH} title="수평 중앙 정렬" style={btnBase}>↔</button>
          <button onClick={onAlignRight} title="오른쪽 정렬" style={btnBase}>R→</button>
          <div style={divider} />
          <button onClick={onAlignTop}   title="위쪽 정렬" style={btnBase}>↑T</button>
          <button onClick={onAlignCenterV} title="수직 중앙 정렬" style={btnBase}>↕</button>
          <button onClick={onAlignBottom} title="아래쪽 정렬" style={btnBase}>B↓</button>
          <div style={divider} />
          <button onClick={onDistributeH} title="수평 균등 배치 (3개 이상)" style={btnBase}>⊢⊣</button>
          <button onClick={onDistributeV} title="수직 균등 배치 (3개 이상)" style={btnBase}>⊤⊥</button>
          {onMatchWidth && <button onClick={onMatchWidth} title="같은 너비로 맞추기" style={btnBase}>↔W</button>}
          {onMatchHeight && <button onClick={onMatchHeight} title="같은 높이로 맞추기" style={btnBase}>↕H</button>}
          {onMatchBoth && <button onClick={onMatchBoth} title="같은 크기로 맞추기" style={btnBase}>⊞</button>}
          {onGridLayout && <button onClick={onGridLayout} title="그리드 자동 배치 (N×M)" style={btnBase}>⊟</button>}
        </>
      )}

      {/* 노드 추가 / 삭제 */}
      <button
        onClick={onCreateNode}
        title="새 노드 추가"
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}
      >+</button>
      <button
        onClick={onDeleteNode}
        disabled={!selectedUuid}
        title="선택 노드 삭제"
        style={{ opacity: selectedUuid ? 1 : 0.3, background: 'none', border: 'none', color: 'var(--error)', cursor: selectedUuid ? 'pointer' : 'default', fontSize: 14, padding: '2px 6px' }}
      >×</button>
      {onLockToggle && (
        <button
          style={isSelectedLocked ? btnActive : btnBase}
          onClick={onLockToggle}
          title="노드 잠금/해제 (Alt+L) — 잠긴 노드는 드래그/리사이즈 불가"
        >🔒</button>
      )}
      {onTogglePin && selectedUuid && (
        <button
          style={{ ...btnBase, color: isPinned ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}
          onClick={onTogglePin}
          title={isPinned ? '핀 해제' : '핀 고정 — 핀된 노드는 드래그/선택 불가'}
        >📌</button>
      )}

      <div style={divider} />

      {/* 노드 라벨 토글 */}
      <button
        style={showLabels !== false ? btnActive : btnBase}
        onClick={onLabelsToggle}
        title="노드 이름 라벨 표시"
      >
        Aa
      </button>

      {/* 배경색 팔레트 */}
      <div style={{ position: 'relative' }}>
        <button
          ref={bgBtnRef}
          style={bgPaletteOpen || (sceneBg !== 'dark') ? btnActive : btnBase}
          onClick={() => setBgPaletteOpen(v => !v)}
          title="씬 배경색 변경"
        >
          🎨
        </button>
        {bgPaletteOpen && onSceneBgChange && (
          <div
            ref={paletteRef}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 8,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 140,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {([
              { label: '다크 (기본)', value: 'dark', swatch: '#1e1e1e' },
              { label: '라이트', value: 'light', swatch: '#e0e0e0' },
              { label: '체커보드 (투명)', value: 'checker', swatch: null },
            ] as const).map(item => (
              <button
                key={item.value}
                onClick={() => { onSceneBgChange(item.value); setBgPaletteOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: sceneBg === item.value ? 'var(--accent-dim)' : 'transparent',
                  border: `1px solid ${sceneBg === item.value ? 'var(--accent)' : 'transparent'}`,
                  borderRadius: 3, padding: '3px 6px', cursor: 'pointer',
                  color: 'var(--text-primary)', fontSize: 10, textAlign: 'left',
                }}
              >
                {item.swatch ? (
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: item.swatch, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                ) : (
                  <span style={{
                    width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                    backgroundImage: 'repeating-conic-gradient(#888 0% 25%, #555 0% 50%)',
                    backgroundSize: '6px 6px',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }} />
                )}
                {item.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>커스텀 컬러</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="color"
                  value={customColor}
                  onChange={e => setCustomColor(e.target.value)}
                  style={{ width: 24, height: 20, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <button
                  onClick={() => { onSceneBgChange(customColor); setBgPaletteOpen(false) }}
                  style={{
                    ...btnBase,
                    background: sceneBg === customColor ? 'var(--accent-dim)' : undefined,
                    border: `1px solid ${sceneBg === customColor ? 'var(--accent)' : 'var(--border)'}`,
                    fontSize: 9,
                  }}
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 미니맵 토글 */}
      <button
        style={showMinimap ? btnActive : btnBase}
        onClick={onMinimapToggle}
        title="미니맵 표시/숨기기"
      >
        ⊡
      </button>

      {/* 계층 트리 토글 */}
      <button
        style={showHierarchy ? btnActive : btnBase}
        onClick={onHierarchyToggle}
        title="노드 계층 트리 표시"
      >
        ≡
      </button>

      {/* 연결선 토글 */}
      <button
        style={showConnections ? btnActive : btnBase}
        onClick={onConnectionsToggle}
        title="부모-자식 연결선 표시"
      >
        ⤻
      </button>

      {/* 통계 토글 */}
      <button
        style={showStats ? btnActive : btnBase}
        onClick={onStatsToggle}
        title="씬 통계 표시"
      >
        #
      </button>

      {/* 씬뷰 스크린샷 */}
      {onScreenshot && (
        <button
          style={screenshotDone ? { ...btnActive, color: '#4ade80', borderColor: '#4ade80' } : btnBase}
          onClick={onScreenshot}
          title="씬뷰 스크린샷 — PNG 다운로드 + 클립보드 복사"
        >{screenshotDone ? '✓' : '📷'}</button>
      )}

      {/* SVG/PNG 내보내기 */}
      {onExportSvg && (
        <button style={btnBase} onClick={onExportSvg} title="씬 SVG 내보내기">⬇ SVG</button>
      )}
      {onExportPng && (
        <button style={btnBase} onClick={onExportPng} title="씬 PNG 내보내기">⬇ PNG</button>
      )}

      {/* 씬 슬롯 저장 / 로드 */}
      {onSlotChange !== undefined && (
        <select
          value={activeSlot ?? 0}
          onChange={e => onSlotChange(Number(e.target.value))}
          title="씬 저장 슬롯 선택"
          style={{ fontSize: 9, padding: '1px 2px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          {[0, 1, 2].map(i => <option key={i} value={i}>슬롯 {i + 1}</option>)}
        </select>
      )}
      {onSaveScene && (
        <button style={btnBase} onClick={onSaveScene} title="씬 레이아웃 저장 (localStorage)">💾</button>
      )}
      {onLoadScene && (
        <button style={btnBase} onClick={onLoadScene} title="씬 레이아웃 로드 (localStorage)">📂</button>
      )}

      {/* 새로고침 */}
      <button
        style={btnBase}
        onClick={onRefresh}
        title="씬 새로고침"
      >
        ↺
      </button>
    </div>
  )
}
