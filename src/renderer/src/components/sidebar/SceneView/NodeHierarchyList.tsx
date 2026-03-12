import { useState } from 'react'
import type { SceneNode } from './types'

interface NodeHierarchyListProps {
  rootUuid: string
  nodeMap: Map<string, SceneNode>
  selectedUuids: Set<string>
  onSelect: (uuid: string, multi: boolean) => void
}

function NodeRow({
  uuid,
  depth,
  nodeMap,
  selectedUuids,
  onSelect,
}: {
  uuid: string
  depth: number
  nodeMap: Map<string, SceneNode>
  selectedUuids: Set<string>
  onSelect: (uuid: string, multi: boolean) => void
}) {
  const node = nodeMap.get(uuid)
  if (!node) return null

  const isSelected = selectedUuids.has(uuid)

  return (
    <>
      <div
        onClick={e => onSelect(uuid, e.metaKey || e.ctrlKey)}
        style={{
          paddingLeft: depth * 12 + 6,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: 11,
          cursor: 'pointer',
          background: isSelected ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderLeft: isSelected ? '2px solid #60a5fa' : '2px solid transparent',
          userSelect: 'none',
        }}
        title={node.name}
      >
        {node.childUuids.length > 0 ? '▸ ' : '  '}
        {node.name}
      </div>
      {node.childUuids.map(childUuid => (
        <NodeRow
          key={childUuid}
          uuid={childUuid}
          depth={depth + 1}
          nodeMap={nodeMap}
          selectedUuids={selectedUuids}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export function NodeHierarchyList({ rootUuid, nodeMap, selectedUuids, onSelect }: NodeHierarchyListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNodes = searchQuery.trim()
    ? [...nodeMap.values()].filter(n =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  return (
    <div
      style={{
        height: 150,
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      {/* 검색창 */}
      <div style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="노드 검색..."
          style={{
            width: '100%',
            fontSize: 10,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            color: 'var(--text-primary)',
            padding: '2px 5px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 트리 / 검색 결과 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredNodes ? (
          filteredNodes.length === 0 ? (
            <div style={{ padding: '6px', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              검색 결과 없음
            </div>
          ) : (
            filteredNodes.map(node => {
              const isSelected = selectedUuids.has(node.uuid)
              return (
                <div
                  key={node.uuid}
                  onClick={e => onSelect(node.uuid, e.metaKey || e.ctrlKey)}
                  style={{
                    padding: '2px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
                    color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    borderLeft: isSelected ? '2px solid #60a5fa' : '2px solid transparent',
                    userSelect: 'none',
                  }}
                  title={node.name}
                >
                  {node.name}
                </div>
              )
            })
          )
        ) : (
          <NodeRow
            uuid={rootUuid}
            depth={0}
            nodeMap={nodeMap}
            selectedUuids={selectedUuids}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  )
}
