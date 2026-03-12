import React from 'react'

interface SceneToolbarProps {
  activeTool: 'select' | 'move'
  zoom: number
  gridVisible: boolean
  snapEnabled: boolean
  onToolChange: (tool: 'select' | 'move') => void
  onZoomChange: (zoom: number) => void
  onGridToggle: () => void
  onSnapToggle: () => void
  onFit: () => void
  onRefresh: () => void
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export function SceneToolbar({
  activeTool,
  zoom,
  gridVisible,
  snapEnabled,
  onToolChange,
  onZoomChange,
  onGridToggle,
  onSnapToggle,
  onFit,
  onRefresh,
}: SceneToolbarProps) {
  const zoomIn = () => {
    const next = ZOOM_STEPS.find(z => z > zoom) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
    onZoomChange(next)
  }
  const zoomOut = () => {
    const next = [...ZOOM_STEPS].reverse().find(z => z < zoom) ?? ZOOM_STEPS[0]
    onZoomChange(next)
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
      <button
        style={activeTool === 'select' ? btnActive : btnBase}
        onClick={() => onToolChange('select')}
        title="선택 도구 (V)"
      >
        ↖ 선택
      </button>
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
      <button
        style={{ ...btnBase, minWidth: 40, textAlign: 'center' }}
        onClick={() => onZoomChange(1)}
        title="100% 리셋"
      >
        {Math.round(zoom * 100)}%
      </button>
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

      <div style={{ flex: 1 }} />

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
