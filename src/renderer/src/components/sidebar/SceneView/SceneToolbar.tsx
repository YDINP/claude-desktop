import React, { useState } from 'react'

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
  bgLight?: boolean
  onBgToggle?: () => void
  showMinimap?: boolean
  onMinimapToggle?: () => void
  canvasSize?: { w: number; h: number }
  onCanvasSizeChange?: (w: number, h: number) => void
  onExportSvg?: () => void
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
  bgLight,
  onBgToggle,
  showMinimap,
  onMinimapToggle,
  canvasSize,
  onCanvasSizeChange,
  onExportSvg,
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
}: SceneToolbarProps) {
  const [zoomEditing, setZoomEditing] = useState(false)
  const [zoomDraft, setZoomDraft] = useState('')

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

      {/* 참조 이미지 */}
      {onRefImageToggle && (
        <button
          style={hasRefImage ? btnActive : btnBase}
          onClick={onRefImageToggle}
          title="참조 이미지 오버레이"
        >📷</button>
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

      <div style={{ flex: 1 }} />

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

      <div style={divider} />

      {/* 노드 라벨 토글 */}
      <button
        style={showLabels !== false ? btnActive : btnBase}
        onClick={onLabelsToggle}
        title="노드 이름 라벨 표시"
      >
        Aa
      </button>

      {/* 배경 밝기 토글 */}
      <button
        style={bgLight ? btnActive : btnBase}
        onClick={onBgToggle}
        title="배경 밝기 전환 (밝은/어두운)"
      >
        ◑
      </button>

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

      {/* SVG 내보내기 */}
      {onExportSvg && (
        <button style={btnBase} onClick={onExportSvg} title="씬 SVG 내보내기">⬇</button>
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
