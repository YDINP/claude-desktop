import { useState, useEffect, useCallback, memo, useRef } from 'react'
import type { CCNode } from '../../../../shared/ipc-schema'

interface SceneTreePanelProps {
  port: number
  onSelectNode: (node: CCNode | null) => void
}

const NodeRow = memo(function NodeRow({
  node, depth, selectedUuid, onSelect, forceExpand, port, onRename
}: {
  node: CCNode; depth: number; selectedUuid: string | null; onSelect: (n: CCNode) => void; forceExpand?: boolean
  port: number; onRename?: (uuid: string, newName: string) => void
}) {
  const [expanded, setExpanded] = useState(forceExpand !== undefined ? forceExpand : depth < 2)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const hasChildren = (node.children?.length ?? 0) > 0

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(node.name)
    setEditing(true)
  }

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== node.name) {
      onRename?.(node.uuid, editName.trim())
    }
    setEditing(false)
  }

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
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setEditing(false)
              }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-primary)', border: '1px solid var(--accent)',
                borderRadius: 3, padding: '1px 4px', fontSize: 11,
                color: 'var(--text-primary)', outline: 'none', width: 120,
              }}
            />
          ) : (
            <span onDoubleClick={handleDoubleClick} style={{ cursor: 'pointer' }}>
              {node.name}
            </span>
          )}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
          {node.components.map(c => c.type.replace('cc.', '')).slice(0, 2).join(' ')}
        </span>
      </div>
      {expanded && hasChildren && (node.children ?? []).map(child => (
        <NodeRow key={child.uuid} node={child} depth={depth + 1} selectedUuid={selectedUuid} onSelect={onSelect} forceExpand={forceExpand} port={port} onRename={onRename} />
      ))}
    </>
  )
})

export function SceneTreePanel({ port, onSelectNode }: SceneTreePanelProps) {
  const [tree, setTree] = useState<CCNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [nodeSearch, setNodeSearch] = useState('')
  const [hideInactive, setHideInactive] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.ccGetTree?.(port)
      setTree(result ?? null)
    } catch (e) {
      console.error('[SceneTree] getTree failed:', e)
    } finally {
      setLoading(false)
    }
  }, [port])

  useEffect(() => {
    refresh()
    const unsub = window.api.onCCEvent?.((event) => {
      if ((event as any)._ccPort !== undefined && (event as any)._ccPort !== port) return
      if (event.type === 'scene:ready' || event.type === 'scene:saved') {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { debounceRef.current = null; refresh() }, 500)
      }
      if (event.type === 'node:select' && event.uuids?.[0]) setSelectedUuid(event.uuids[0])
      if (event.type === 'node:deselect') setSelectedUuid(null)
    })
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      unsub?.()
    }
  }, [refresh, port])

  const handleSelect = (node: CCNode) => {
    setSelectedUuid(node.uuid)
    onSelectNode(node)
  }

  const handleRename = useCallback(async (uuid: string, newName: string) => {
    try {
      await window.api.ccSetProperty?.(port, uuid, 'name', newName)
      setTree(prev => {
        if (!prev) return prev
        const updateName = (node: CCNode): CCNode => ({
          ...node,
          name: node.uuid === uuid ? newName : node.name,
          children: node.children?.map(updateName) ?? [],
        })
        return updateName(prev)
      })
    } catch (e) {
      console.error('[SceneTree] rename failed:', e)
    }
  }, [port])

  const countNodes = (node: CCNode): number => 1 + (node.children ?? []).reduce((s, c) => s + countNodes(c), 0)
  const countInactive = (node: CCNode): number => (node.active ? 0 : 1) + (node.children ?? []).reduce((s, c) => s + countInactive(c), 0)
  const totalNodes = tree ? countNodes(tree) : 0
  const inactiveNodes = tree ? countInactive(tree) : 0

  // 노드 이름 검색: 검색어 있으면 매칭 노드만 표시
  const searchLower = nodeSearch.toLowerCase()
  const matchesSearch = (node: CCNode): boolean => {
    if (!searchLower) return true
    if (node.name.toLowerCase().includes(searchLower)) return true
    return (node.children ?? []).some(matchesSearch)
  }
  const filterTree = (node: CCNode): CCNode | null => {
    if (hideInactive && !node.active) return null
    const filteredChildren = (node.children ?? []).map(filterTree).filter((c): c is CCNode => c !== null)
    return { ...node, children: filteredChildren }
  }
  const filteredTree = tree && hideInactive ? filterTree(tree) : tree
  const visibleRoots = filteredTree ? [filteredTree].filter(matchesSearch) : []

  return (
    <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          씬 트리{totalNodes > 0 ? ` (${totalNodes})` : ''}
          {inactiveNodes > 0 && (
            <button
              onClick={() => setHideInactive(v => !v)}
              title={hideInactive ? '비활성 노드 표시' : '비활성 노드 숨기기'}
              style={{ background: hideInactive ? '#f87171' : 'none', color: hideInactive ? '#fff' : '#f87171', border: `1px solid #f87171`, borderRadius: 3, cursor: 'pointer', fontSize: 9, padding: '0 4px', lineHeight: '14px' }}
            >
              {hideInactive ? '숨김' : `비활성 ${inactiveNodes}`}
            </button>
          )}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
          title="새로고침"
        >
          {loading ? '⟳' : '↺'}
        </button>
      </div>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={nodeSearch}
          onChange={e => setNodeSearch(e.target.value)}
          placeholder="노드 검색..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '4px 8px', color: 'var(--text-primary)',
            fontSize: 11, outline: 'none',
          }}
        />
      </div>
      <div style={{ maxHeight: 300, overflow: 'auto', flex: 1 }}>
        {loading && !tree && (
          <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>로딩 중...</div>
        )}
        {!loading && !tree && (
          <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>씬 없음</div>
        )}
        {tree && visibleRoots.map(root => (
          <NodeRow key={root.uuid} node={root} depth={0} selectedUuid={selectedUuid} onSelect={handleSelect} forceExpand={nodeSearch !== ''} port={port} onRename={handleRename} />
        ))}
      </div>
    </div>
  )
}
