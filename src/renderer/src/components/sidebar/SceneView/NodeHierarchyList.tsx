import { useState, useEffect, useRef } from 'react'
import type { SceneNode } from './types'
import { getComponentIcon } from './utils'

interface NodeHierarchyListProps {
  rootUuid: string
  nodeMap: Map<string, SceneNode>
  selectedUuids: Set<string>
  onSelect: (uuid: string, multi: boolean) => void
  focusUuid?: string | null
  onToggleActive?: (uuid: string, active: boolean) => void
}

function NodeRow({
  uuid,
  depth,
  nodeMap,
  selectedUuids,
  collapsed,
  onSelect,
  onToggleCollapse,
  onToggleActive,
}: {
  uuid: string
  depth: number
  nodeMap: Map<string, SceneNode>
  selectedUuids: Set<string>
  collapsed: Set<string>
  onSelect: (uuid: string, multi: boolean) => void
  onToggleCollapse: (uuid: string) => void
  onToggleActive?: (uuid: string, active: boolean) => void
}) {
  const node = nodeMap.get(uuid)
  if (!node) return null

  const isSelected = selectedUuids.has(uuid)
  const hasChildren = node.childUuids.length > 0
  const isCollapsed = collapsed.has(uuid)

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: depth * 12 + 2,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: 11,
          background: isSelected ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          borderLeft: isSelected ? '2px solid #60a5fa' : '2px solid transparent',
          userSelect: 'none',
        }}
        title={node.name}
        data-uuid={uuid}
      >
        {/* 활성 인디케이터 */}
        <span
          onClick={e => { e.stopPropagation(); onToggleActive?.(uuid, !node.active) }}
          title={node.active ? '비활성화' : '활성화'}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: node.active ? 'var(--success)' : 'var(--border)',
            flexShrink: 0,
            marginRight: 2,
            cursor: 'pointer',
            display: 'inline-block',
          }}
        />
        {/* 펼치기/접기 버튼 */}
        <span
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggleCollapse(uuid) }}
          style={{
            width: 14,
            flexShrink: 0,
            cursor: hasChildren ? 'pointer' : 'default',
            color: hasChildren ? 'var(--text-muted)' : 'transparent',
            fontSize: 9,
            textAlign: 'center',
          }}
        >
          {hasChildren ? (isCollapsed ? '▸' : '▾') : ''}
        </span>
        {/* 컴포넌트 아이콘 */}
        {getComponentIcon(node.components) && (
          <span style={{
            fontSize: 9,
            color: 'var(--accent)',
            fontWeight: 700,
            flexShrink: 0,
            marginRight: 2,
            opacity: 0.8,
          }}>
            {getComponentIcon(node.components)}
          </span>
        )}
        {/* 노드 이름 */}
        <span
          onClick={e => onSelect(uuid, e.metaKey || e.ctrlKey)}
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            paddingLeft: 2,
          }}
        >
          {node.name}
        </span>
      </div>
      {hasChildren && !isCollapsed && node.childUuids.map(childUuid => (
        <NodeRow
          key={childUuid}
          uuid={childUuid}
          depth={depth + 1}
          nodeMap={nodeMap}
          selectedUuids={selectedUuids}
          collapsed={collapsed}
          onSelect={onSelect}
          onToggleCollapse={onToggleCollapse}
          onToggleActive={onToggleActive}
        />
      ))}
    </>
  )
}

export function NodeHierarchyList({ rootUuid, nodeMap, selectedUuids, onSelect, focusUuid, onToggleActive }: NodeHierarchyListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // focusUuid 변경 시 해당 노드로 자동 스크롤
  useEffect(() => {
    if (!focusUuid || !scrollContainerRef.current) return
    const el = scrollContainerRef.current.querySelector(`[data-uuid="${focusUuid}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusUuid])

  const toggleCollapse = (uuid: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

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
      {/* 검색창 + 전체 펼치기/접기 */}
      <div style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="노드 검색..."
          style={{
            flex: 1,
            fontSize: 10,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            color: 'var(--text-primary)',
            padding: '2px 5px',
            outline: 'none',
            minWidth: 0,
          }}
        />
        {filteredNodes && (
          <span style={{
            fontSize: 9,
            color: filteredNodes.length === 0 ? 'var(--warning)' : 'var(--text-muted)',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}>
            {filteredNodes.length}/{nodeMap.size}
          </span>
        )}
        <button
          onClick={() => setCollapsed(new Set())}
          title="전체 펼치기"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '1px 3px', lineHeight: 1, flexShrink: 0 }}
        >▾▾</button>
        <button
          onClick={() => {
            const allWithChildren = new Set<string>()
            nodeMap.forEach((n) => { if (n.childUuids.length > 0) allWithChildren.add(n.uuid) })
            setCollapsed(allWithChildren)
          }}
          title="전체 접기"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '1px 3px', lineHeight: 1, flexShrink: 0 }}
        >▸▸</button>
      </div>

      {/* 트리 / 검색 결과 */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
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
                  {getComponentIcon(node.components) && (
                    <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, marginRight: 3, opacity: 0.8 }}>
                      {getComponentIcon(node.components)}
                    </span>
                  )}
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
            collapsed={collapsed}
            onSelect={onSelect}
            onToggleCollapse={toggleCollapse}
            onToggleActive={onToggleActive}
          />
        )}
      </div>
    </div>
  )
}
