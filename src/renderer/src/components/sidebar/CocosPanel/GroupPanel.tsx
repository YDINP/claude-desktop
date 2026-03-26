import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useFeatureFlags } from '../../../hooks/useFeatureFlags'

const NODE_COLOR_PALETTE: { color: string; label: string }[] = [
  { color: '#f87171', label: '빨강' },
  { color: '#fb923c', label: '주황' },
  { color: '#facc15', label: '노랑' },
  { color: '#4ade80', label: '초록' },
  { color: '#60a5fa', label: '파랑' },
  { color: '#a78bfa', label: '보라' },
]

/** 그룹 패널 — 자식이 있는 노드를 그룹으로 표시 */
export function GroupPanel({
  root,
  selectedNode,
  onSelectNode,
  onRenameGroup,
  onToggleGroupActive,
}: {
  root: CCSceneNode
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
  onRenameGroup: (uuid: string, name: string) => Promise<void>
  onToggleGroupActive: (uuid: string) => Promise<void>
}) {
  const { features } = useFeatureFlags()

  if (!features['cc.groupPanel']) return null

  // 자식이 있는 노드를 재귀적으로 수집 (루트 제외)
  const groups = useMemo(() => {
    const result: CCSceneNode[] = []
    function collect(n: CCSceneNode, depth: number) {
      if (depth > 0 && n.children.length > 0) result.push(n)
      n.children.forEach(c => collect(c, depth + 1))
    }
    collect(root, 0)
    return result
  }, [root])

  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement | null>(null)

  // F2로 인라인 편집 시작
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selectedNode && selectedNode.children.length > 0) {
        e.preventDefault()
        setEditingUuid(selectedNode.uuid)
        setEditValue(selectedNode.name)
      }
      if (e.key === 'Escape' && editingUuid) {
        setEditingUuid(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNode, editingUuid])

  useEffect(() => {
    if (editingUuid && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingUuid])

  const commitRename = async (uuid: string) => {
    if (editValue.trim()) await onRenameGroup(uuid, editValue.trim())
    setEditingUuid(null)
  }

  const [hiddenUuids, setHiddenUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('group-panel-hidden') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleHidden = (uuid: string) => {
    setHiddenUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('group-panel-hidden', JSON.stringify([...next]))
      return next
    })
    onToggleGroupActive(uuid)
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>
        자식 노드가 있는 그룹 노드가 없습니다.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>그룹 노드 (자식 포함)</span>
        <span style={{ fontSize: 9, color: '#555', marginLeft: 'auto' }}>{groups.length}개</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {groups.map(g => {
          const isSelected = selectedNode?.uuid === g.uuid
          return (
            <div
              key={g.uuid}
              onClick={() => onSelectNode(isSelected ? null : g)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : 'transparent',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: g.active ? 1 : 0.45,
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              {/* 가시성 토글 (눈 아이콘) */}
              <span
                onClick={e => { e.stopPropagation(); toggleHidden(g.uuid) }}
                title={g.active ? '숨기기' : '표시'}
                style={{
                  fontSize: 11, cursor: 'pointer', flexShrink: 0, userSelect: 'none',
                  color: g.active ? 'var(--text-muted)' : '#555',
                }}
              >
                {g.active ? '👁' : '🙈'}
              </span>

              {/* 인라인 이름 편집 */}
              {editingUuid === g.uuid ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitRename(g.uuid)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(g.uuid) }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingUuid(null) }
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, fontSize: 11, background: 'var(--bg-input, #1a1a2e)',
                    border: '1px solid var(--accent)', borderRadius: 3,
                    color: 'var(--text-primary)', padding: '1px 4px',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={e => {
                    e.stopPropagation()
                    setEditingUuid(g.uuid)
                    setEditValue(g.name)
                  }}
                  style={{
                    flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', color: 'var(--text-primary)', userSelect: 'none',
                  }}
                  title={`${g.name} — 자식 ${g.children.length}개 (더블클릭 또는 F2로 이름 편집)`}
                >
                  {g.name}
                </span>
              )}

              {/* 자식 수 배지 */}
              <span style={{
                fontSize: 9, color: 'var(--text-muted)', flexShrink: 0,
                background: 'rgba(255,255,255,0.07)', borderRadius: 8,
                padding: '1px 5px',
              }}>
                {g.children.length}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: '#444', flexShrink: 0 }}>
        클릭: 선택 | 더블클릭/F2: 이름 편집 | 눈 아이콘: 가시성 토글
      </div>
    </div>
  )
}
