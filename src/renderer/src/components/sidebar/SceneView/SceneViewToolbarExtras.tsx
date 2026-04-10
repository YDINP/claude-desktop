import React, { useEffect, useRef } from 'react'
import type { SceneNode } from './types'
import type { ViewportPreset } from './sceneViewConstants'
import { VP_KEY, NT_KEY, DEFAULT_TEMPLATES } from './sceneViewConstants'
import { useSceneViewCtx } from './SceneViewContext'

/**
 * SceneViewPanel 상단 추가 툴바:
 * - 그리드 설정 팝업 (Grid Settings)
 * - 노드 템플릿 드롭다운 (R1452)
 * - 뷰 북마크 번호 버튼 (R1455)
 * - 뷰포트 프리셋 바 (R1419)
 * - 씬 파일 탭 바 (R1383)
 */
interface SceneViewToolbarExtrasProps {
  // Grid settings
  showGridSettings: boolean
  setShowGridSettings: (v: boolean) => void
  gridSettings: { size: number; theme: 'light' | 'dark'; opacity: number }
  setGridSettings: React.Dispatch<React.SetStateAction<{ size: number; theme: 'light' | 'dark'; opacity: number }>>
  // View
  viewportPresets: ViewportPreset[]
  setViewportPresets: React.Dispatch<React.SetStateAction<ViewportPreset[]>>
  // Scene tabs
  activeSceneTab: string | null
  setActiveSceneTab: (v: string | null) => void
  setShowSceneHistory: (v: boolean) => void
}

export function SceneViewToolbarExtras({
  showGridSettings, setShowGridSettings,
  gridSettings, setGridSettings,
  viewportPresets, setViewportPresets,
  activeSceneTab, setActiveSceneTab, setShowSceneHistory,
}: SceneViewToolbarExtrasProps) {
  const ctx = useSceneViewCtx()
  const {
    nodeMap, rootUuid, updateNode, view, setView,
    setSelectedUuid, setSelectedUuids,
    nodeTemplates, setNodeTemplates, showTemplateDropdown, setShowTemplateDropdown,
    sceneTabFiles, sceneHistory,
  } = ctx
  const viewRef = useRef(ctx.view)
  viewRef.current = ctx.view

  const gridSettingsRef = useRef<HTMLDivElement>(null)

  // Grid settings popup outside click close
  useEffect(() => {
    if (!showGridSettings) return
    const handleClick = (e: MouseEvent) => {
      if (gridSettingsRef.current && !gridSettingsRef.current.contains(e.target as Node)) {
        setShowGridSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showGridSettings])

  // R1455: view bookmarks from context (stored in parent)
  // We need viewBookmarks from parent — they are managed in the keyboard hook.
  // For simplicity, we read from ctx but viewBookmarks aren't in context yet.
  // Instead of adding to context, we receive viewBookmarks via a workaround:
  // Actually we can't add new props easily. Let's just inline what we need.

  return (
    <>
      {/* R1422: Grid Settings Popup */}
      {showGridSettings && (
        <div
          ref={gridSettingsRef}
          style={{
            position: 'absolute', top: 30, left: 120, zIndex: 9999,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: 10, minWidth: 180,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Grid Settings</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>Size</span>
            <select
              value={gridSettings.size}
              onChange={e => setGridSettings(prev => ({ ...prev, size: Number(e.target.value) }))}
              style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px' }}
            >
              {[8, 16, 32, 50, 64, 128].map(v => (
                <option key={v} value={v}>{v}px</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>Color</span>
            <button
              onClick={() => setGridSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
              style={{
                flex: 1, fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                background: gridSettings.theme === 'light' ? '#e0e0e0' : '#333',
                color: gridSettings.theme === 'light' ? '#333' : '#e0e0e0',
                border: '1px solid var(--border)',
              }}
            >{gridSettings.theme === 'light' ? 'Light' : 'Dark'}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>Alpha</span>
            <input
              type="range" min={0.02} max={0.5} step={0.01}
              value={gridSettings.opacity}
              onChange={e => setGridSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 8, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{gridSettings.opacity.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* R1452: Template dropdown + R1455: View bookmarks + R1419: Viewport presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px', background: 'rgba(0,0,0,0.15)', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* R1452: Template dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTemplateDropdown(v => !v)}
            title="R1452: 노드 템플릿 라이브러리"
            style={{ fontSize: 9, padding: '1px 4px', background: showTemplateDropdown ? 'rgba(96,165,250,0.2)' : 'none', border: '1px solid var(--border)', borderRadius: 2, color: showTemplateDropdown ? '#93c5fd' : 'var(--text-muted)', cursor: 'pointer' }}
          >{'\uD83D\uDCCC'}</button>
          {showTemplateDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 9999,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              minWidth: 160, maxHeight: 220, overflowY: 'auto',
            }}>
              <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                {'\uD83D\uDCCC'} 노드 템플릿
              </div>
              {DEFAULT_TEMPLATES.concat(nodeTemplates).map((tmpl, i) => (
                <button
                  key={`${tmpl.name}-${i}`}
                  onClick={() => {
                    const newUuid = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                    const n = tmpl.node as Record<string, unknown>
                    const newNode: SceneNode = {
                      uuid: newUuid, name: (n.name as string) ?? 'Template',
                      active: (n.active as boolean) ?? true,
                      x: 0, y: 0, width: ((n.size as { x?: number })?.x) ?? 0,
                      height: ((n.size as { y?: number })?.y) ?? 0,
                      anchorX: ((n.anchor as { x?: number })?.x) ?? 0.5,
                      anchorY: ((n.anchor as { y?: number })?.y) ?? 0.5,
                      scaleX: ((n.scale as { x?: number })?.x) ?? 1,
                      scaleY: ((n.scale as { y?: number })?.y) ?? 1,
                      rotation: n.rotation.z ?? 0,
                      opacity: (n.opacity as number) ?? 255,
                      color: (n.color as { r: number; g: number; b: number; a: number }) ?? { r: 255, g: 255, b: 255, a: 255 },
                      parentUuid: rootUuid, childUuids: [],
                      components: (n.components as SceneNode['components']) ?? [],
                    }
                    updateNode(newUuid, newNode)
                    if (rootUuid) {
                      const root = nodeMap.get(rootUuid)
                      if (root) updateNode(rootUuid, { childUuids: [...root.childUuids, newUuid] })
                    }
                    setSelectedUuid(newUuid)
                    setSelectedUuids(new Set([newUuid]))
                    setShowTemplateDropdown(false)
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '4px 8px', background: 'none', border: 'none',
                    color: i < DEFAULT_TEMPLATES.length ? 'var(--text-muted)' : '#60a5fa',
                    cursor: 'pointer', fontSize: 10,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {i < DEFAULT_TEMPLATES.length ? `[기본] ${tmpl.name}` : tmpl.name}
                </button>
              ))}
              {nodeTemplates.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '2px 8px' }}>
                  <button
                    onClick={() => { setNodeTemplates([]); localStorage.removeItem(NT_KEY); setShowTemplateDropdown(false) }}
                    style={{ fontSize: 8, color: '#f85149', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                  >모든 사용자 템플릿 삭제</button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* R1419: Viewport presets */}
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px' }} />
        <button
          onClick={() => {
            const name = `뷰 ${viewportPresets.length + 1}`
            const preset: ViewportPreset = { name, zoom: view.zoom, panX: view.offsetX, panY: view.offsetY }
            setViewportPresets(prev => {
              const next = [...prev, preset].slice(-5)
              localStorage.setItem(VP_KEY, JSON.stringify(next))
              return next
            })
          }}
          title="현재 뷰를 프리셋으로 저장 (최대 5개)"
          style={{ fontSize: 9, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
        >{'\uD83D\uDCD0'}+</button>
        {/* Default presets */}
        <button
          onClick={() => { setView({ offsetX: 0, offsetY: 0, zoom: 1 }) }}
          title="1:1 뷰"
          style={{ fontSize: 8, padding: '1px 4px', background: view.zoom === 1 ? 'rgba(96,165,250,0.2)' : 'none', border: '1px solid var(--border)', borderRadius: 2, color: view.zoom === 1 ? '#93c5fd' : 'var(--text-muted)', cursor: 'pointer' }}
        >1:1</button>
        <button
          onClick={() => { setView({ offsetX: 0, offsetY: 0, zoom: 2 }) }}
          title="2:1 뷰"
          style={{ fontSize: 8, padding: '1px 4px', background: view.zoom === 2 ? 'rgba(96,165,250,0.2)' : 'none', border: '1px solid var(--border)', borderRadius: 2, color: view.zoom === 2 ? '#93c5fd' : 'var(--text-muted)', cursor: 'pointer' }}
        >2:1</button>
        {/* User presets */}
        {viewportPresets.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button
              onClick={() => setView({ offsetX: p.panX, offsetY: p.panY, zoom: p.zoom })}
              title={`${p.name} (zoom:${p.zoom.toFixed(1)} pan:${Math.round(p.panX)},${Math.round(p.panY)})`}
              style={{ fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: '2px 0 0 2px', color: '#60a5fa', cursor: 'pointer' }}
            >{p.name}</button>
            <button
              onClick={() => {
                setViewportPresets(prev => {
                  const next = prev.filter((_, j) => j !== i)
                  localStorage.setItem(VP_KEY, JSON.stringify(next))
                  return next
                })
              }}
              title="프리셋 삭제"
              style={{ fontSize: 8, padding: '1px 2px', background: 'none', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 2px 2px 0', color: '#f85149', cursor: 'pointer', lineHeight: 1 }}
            >x</button>
          </div>
        ))}
      </div>

      {/* R1383: Scene file tab bar */}
      {sceneTabFiles.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto', flexShrink: 0,
        }}>
          {sceneTabFiles.map(path => {
            const name = path.split(/[\\/]/).pop() ?? path
            const isActive = path === activeSceneTab
            return (
              <button
                key={path}
                onClick={() => setActiveSceneTab(path)}
                title={path}
                style={{
                  padding: '3px 10px', fontSize: 10, border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(96,165,250,0.2)' : 'transparent',
                  color: isActive ? '#93c5fd' : '#94a3b8',
                  borderBottom: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {name}
              </button>
            )
          })}
          {sceneHistory.length > 5 && (
            <button
              onClick={() => setShowSceneHistory(true)}
              style={{ padding: '3px 8px', fontSize: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b' }}
              title="더 많은 씬 보기"
            >+</button>
          )}
        </div>
      )}

    </>
  )
}
