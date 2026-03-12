import { useState, useEffect, useCallback } from 'react'
import type { CCNode } from '../../../../shared/ipc-schema'

interface SceneTreePanelProps {
  onSelectNode: (node: CCNode | null) => void
}

function NodeRow({
  node, depth, selectedUuid, onSelect
}: {
  node: CCNode; depth: number; selectedUuid: string | null; onSelect: (n: CCNode) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <>
      <div
        onClick={() => onSelect(node)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', paddingLeft: 8 + depth * 14,
          cursor: 'pointer', fontSize: 11,
          background: selectedUuid === node.uuid ? 'var(--bg-hover)' : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
        onMouseEnter={e => { if (selectedUuid !== node.uuid) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (selectedUuid !== node.uuid) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            style={{ fontSize: 9, width: 12, textAlign: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            {expanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 12 }} />
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
          {node.components.map(c => c.type.replace('cc.', '')).slice(0, 2).join(' ')}
        </span>
      </div>
      {expanded && hasChildren && (node.children ?? []).map(child => (
        <NodeRow key={child.uuid} node={child} depth={depth + 1} selectedUuid={selectedUuid} onSelect={onSelect} />
      ))}
    </>
  )
}

export function SceneTreePanel({ onSelectNode }: SceneTreePanelProps) {
  const [tree, setTree] = useState<CCNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.ccGetTree?.()
      setTree(result ?? null)
    } catch (e) {
      console.error('[SceneTree] getTree failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'scene:ready' || event.type === 'scene:saved') refresh()
      if (event.type === 'node:select' && event.uuids?.[0]) setSelectedUuid(event.uuids[0])
      if (event.type === 'node:deselect') setSelectedUuid(null)
    })
    return () => unsub?.()
  }, [refresh])

  const handleSelect = (node: CCNode) => {
    setSelectedUuid(node.uuid)
    onSelectNode(node)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
      }}>
        <span>씬 트리</span>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
          title="새로고침"
        >
          {loading ? '⟳' : '↺'}
        </button>
      </div>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {loading && !tree && (
          <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>로딩 중...</div>
        )}
        {!loading && !tree && (
          <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>씬 없음</div>
        )}
        {tree && (
          <NodeRow node={tree} depth={0} selectedUuid={selectedUuid} onSelect={handleSelect} />
        )}
      </div>
    </div>
  )
}
