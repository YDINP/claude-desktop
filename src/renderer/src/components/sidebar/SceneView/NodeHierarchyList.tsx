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
  return (
    <div
      style={{
        height: 120,
        overflowY: 'auto',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      <NodeRow
        uuid={rootUuid}
        depth={0}
        nodeMap={nodeMap}
        selectedUuids={selectedUuids}
        onSelect={onSelect}
      />
    </div>
  )
}
