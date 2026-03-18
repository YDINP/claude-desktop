import React from 'react'
import { CCFileSceneView } from '../SceneView/CCFileSceneView'
import type { CCSceneNode } from '@shared/ipc-schema'
import { CCFileBatchInspector } from './BatchInspector'
import { CCFileNodeInspector } from './NodeInspector'
import { HierarchyPanel } from './HierarchyPanel'
import type { UseCCFileProjectUIReturn } from './useCCFileProjectUI'

class InspectorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 8, fontSize: 9, color: '#f87171', background: 'var(--bg-secondary)' }}>
          ⚠ Inspector 오류: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

interface SceneTabProps {
  ctx: UseCCFileProjectUIReturn
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}

export function SceneTabContent({ ctx, selectedNode, onSelectNode }: SceneTabProps) {
  const {
    sceneFile, saveScene,
    hDividerDragRef, dividerDragRef,
    hierarchyWidth, setHierarchyWidth,
    sceneViewHeight, setSceneViewHeight,
    multiSelectedUuids, setMultiSelectedUuids,
    lockedUuids, setLockedUuids,
    lastDiffDisplay, pinnedNodes, togglePinNode,
    dupeOffsetX, dupeOffsetY, saveDupeOffset,
    pulseUuid, setPulseUuid, inspectorScrollRef,
    toggleLocked,
    handleRenameInView, handleReorder, handleReorderExtreme,
    handleNodeMove, handleNodeResize, handleNodeRotate,
    handleNodeOpacity, handleAnchorMove,
    handleMultiMove, handleMultiDelete,
    handleLabelEdit, handleAddNode, handleDuplicate, handleToggleActive,
    handleGroupNodes, handleAltDrag,
    nodeHistory,
    collapsedUuids,
  } = ctx

  if (!sceneFile?.root) return null

  return (
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, userSelect: hDividerDragRef.current || dividerDragRef.current ? 'none' : undefined }}
          onMouseMove={e => {
            if (hDividerDragRef.current) {
              const dx = e.clientX - hDividerDragRef.current.startX
              const newW = Math.max(100, Math.min(400, hDividerDragRef.current.startW + dx))
              setHierarchyWidth(newW)
              localStorage.setItem('cc-hierarchy-width', String(newW))
            }
            if (dividerDragRef.current) {
              const dx = e.clientX - dividerDragRef.current.startX
              const newW = Math.max(260, Math.min(700, dividerDragRef.current.startH - dx))
              setSceneViewHeight(newW)
              localStorage.setItem('cc-inspector-width', String(newW))
            }
          }}
          onMouseUp={() => { hDividerDragRef.current = null; dividerDragRef.current = null }}
          onMouseLeave={() => { hDividerDragRef.current = null; dividerDragRef.current = null }}
        >
          {/* ── 좌: 계층(Hierarchy) 패널 ── */}
          <div style={{ width: hierarchyWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <HierarchyPanel ctx={ctx} selectedNode={selectedNode} onSelectNode={onSelectNode} />
          </div>

          {/* 수평 리사이즈 핸들 */}
          <div
            style={{ width: 4, cursor: 'ew-resize', background: 'var(--border)', flexShrink: 0, opacity: 0.4, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
            onMouseLeave={e => { if (!hDividerDragRef.current) { (e.currentTarget as HTMLElement).style.opacity = '0.4'; (e.currentTarget as HTMLElement).style.background = 'var(--border)' } }}
            onMouseDown={e => { e.preventDefault(); hDividerDragRef.current = { startX: e.clientX, startW: hierarchyWidth } }}
          />

          {/* ── 중: SceneView 컬럼 (툴바 + 씬뷰) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* R1501: 마지막 저장 diff 알림 배너 */}
            {lastDiffDisplay && (
              <div style={{
                fontSize: 9, padding: '2px 8px', background: 'rgba(74,222,128,0.08)', borderBottom: '1px solid rgba(74,222,128,0.2)',
                color: '#4ade80', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                ✓ {lastDiffDisplay}
              </div>
            )}
            {/* R2474: 핀 노드 빠른 선택 바 */}
            {pinnedNodes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid rgba(251,191,36,0.2)', flexShrink: 0, flexWrap: 'wrap', maxHeight: 36, overflow: 'hidden' }}>
                <span style={{ fontSize: 8, color: '#fbbf24', flexShrink: 0 }}>📌</span>
                {pinnedNodes.map(p => (
                  <span
                    key={p.uuid}
                    onClick={() => {
                      const fn = sceneFile?.root && (function find(n: CCSceneNode): CCSceneNode | null { if (n.uuid === p.uuid) return n; for (const c of n.children) { const f = find(c); if (f) return f } return null })(sceneFile.root)
                      if (fn) onSelectNode(fn)
                    }}
                    onContextMenu={e => { e.preventDefault(); togglePinNode(p.uuid, p.name) }}
                    title={`${p.name} 선택 / 우클릭: 핀 해제 (R2474)`}
                    style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.4)', background: selectedNode?.uuid === p.uuid ? 'rgba(251,191,36,0.2)' : 'none', color: selectedNode?.uuid === p.uuid ? '#fbbf24' : '#a88a44', flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >{p.name}</span>
                ))}
              </div>
            )}
            {/* R2488: 복제 오프셋 설정 바 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)', flexShrink: 0, fontSize: 9, color: 'var(--text-muted)' }}>
              <span title="복제(Ctrl+D) 위치 오프셋 (R2488)" style={{ flexShrink: 0 }}>Δ복제</span>
              <span>X</span>
              <input type="number" value={dupeOffsetX} onChange={e => saveDupeOffset(parseInt(e.target.value) || 0, dupeOffsetY)}
                style={{ width: 38, fontSize: 9, padding: '0 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                title="복제 X 오프셋 (R2488)" />
              <span>Y</span>
              <input type="number" value={dupeOffsetY} onChange={e => saveDupeOffset(dupeOffsetX, parseInt(e.target.value) || 0)}
                style={{ width: 38, fontSize: 9, padding: '0 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                title="복제 Y 오프셋 (R2488)" />
              <span style={{ color: 'var(--border)', fontSize: 10 }}>|</span>
              {([0, 10, 20, 50] as const).map(v => (
                <span key={v} onClick={() => saveDupeOffset(v, v)} title={`Δ${v}px`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '0 3px', borderRadius: 2, border: '1px solid var(--border)', color: dupeOffsetX === v && dupeOffsetY === v ? '#58a6ff' : 'var(--text-muted)' }}
                >{v}</span>
              ))}
            </div>
            {/* SceneView — 남은 높이 채움 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <CCFileSceneView
                sceneFile={sceneFile}
                selectedUuid={selectedNode?.uuid ?? null}
                onMove={handleNodeMove}
                onResize={handleNodeResize}
                onRename={handleRenameInView}
                onRotate={handleNodeRotate}
                onMultiMove={handleMultiMove}
                onMultiDelete={handleMultiDelete}
                onLabelEdit={handleLabelEdit}
                onAddNode={handleAddNode}
                onDuplicate={handleDuplicate}
                onToggleActive={handleToggleActive}
                onReorder={handleReorder}
                onAnchorMove={handleAnchorMove}
                onMultiSelectChange={setMultiSelectedUuids}
                onGroupNodes={handleGroupNodes}
                onOpacity={handleNodeOpacity}
                onReorderExtreme={handleReorderExtreme}
                onAltDrag={handleAltDrag}
                pulseUuid={pulseUuid}
                collapsedUuids={collapsedUuids}
                onSelect={uuid => {
                  if (!uuid) { onSelectNode(null); return }
                  const findNode = (n: CCSceneNode): CCSceneNode | null => {
                    if (n.uuid === uuid) return n
                    for (const c of n.children) { const f = findNode(c); if (f) return f }
                    return null
                  }
                  onSelectNode(findNode(sceneFile.root))
                }}
              />
            </div>
          </div>

          {/* Inspector 리사이즈 핸들 */}
          {(selectedNode || multiSelectedUuids.length > 1) && (
            <div
              style={{ width: 4, cursor: 'ew-resize', background: 'var(--border)', flexShrink: 0, opacity: 0.4, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
              onMouseLeave={e => { if (!dividerDragRef.current) { (e.currentTarget as HTMLElement).style.opacity = '0.4'; (e.currentTarget as HTMLElement).style.background = 'var(--border)' } }}
              onMouseDown={e => { e.preventDefault(); dividerDragRef.current = { startX: e.clientX, startH: sceneViewHeight } }}
            />
          )}

          {/* ── 우: Inspector 패널 (전체 세로 높이) ── */}
          {/* R1516: 다중 선택 배치 편집 패널 */}
          {multiSelectedUuids.length > 1 && sceneFile?.root && (
            <div style={{ width: Math.round(sceneViewHeight / 1.12), zoom: 1.12, flexShrink: 0, overflow: 'auto', borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <InspectorErrorBoundary>
                <CCFileBatchInspector
                  uuids={multiSelectedUuids}
                  sceneFile={sceneFile}
                  saveScene={saveScene}
                  onSelectNode={onSelectNode}
                  onMultiSelectChange={setMultiSelectedUuids}
                  lockedUuids={lockedUuids}
                  onSetLockedUuids={setLockedUuids}
                />
              </InspectorErrorBoundary>
            </div>
          )}
          {/* R1595: 최근 선택 노드 히스토리 */}
          {nodeHistory.length > 1 && !selectedNode && multiSelectedUuids.length <= 1 && (
            <div style={{ width: Math.round(sceneViewHeight / 1.12), zoom: 1.12, flexShrink: 0, padding: '4px 8px', borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'auto' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>최근 선택</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {nodeHistory.slice(0, 8).map(uuid => {
                  const fn = sceneFile?.root ? (() => {
                    const walk = (n: CCSceneNode): CCSceneNode | null => {
                      if (n.uuid === uuid) return n
                      for (const c of n.children) { const f = walk(c); if (f) return f }
                      return null
                    }
                    return walk(sceneFile.root)
                  })() : null
                  if (!fn) return null
                  return (
                    <span key={uuid}
                      onClick={() => onSelectNode(fn)}
                      style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                      title={fn.name}
                    >{fn.name}</span>
                  )
                })}
              </div>
            </div>
          )}
          {multiSelectedUuids.length <= 1 && selectedNode && (
            <div ref={inspectorScrollRef} style={{ width: Math.round(sceneViewHeight / 1.12), zoom: 1.12, flexShrink: 0, overflow: 'auto', borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <InspectorErrorBoundary>
                <CCFileNodeInspector
                  node={selectedNode}
                  sceneFile={sceneFile}
                  saveScene={saveScene}
                  onUpdate={onSelectNode}
                  lockedUuids={lockedUuids}
                  onToggleLocked={toggleLocked}
                  onPulse={uuid => { setPulseUuid(uuid); setTimeout(() => setPulseUuid(null), 1400) }}
                  pinnedUuids={new Set(pinnedNodes.map(p => p.uuid))}
                  onTogglePin={togglePinNode}
                />
              </InspectorErrorBoundary>
            </div>
          )}
        </div>
  )
}
