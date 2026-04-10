import React from 'react'
import type { SceneNode } from './types'

/**
 * 선택 노드 인라인 편집바 (X/Y/W/H/R)
 * SceneViewPanel에서 추출
 */
interface SceneViewEditBarProps {
  selectedNode: SceneNode
  nodeEditDraft: { x: string; y: string; w: string; h: string; r: string }
  setNodeEditDraft: React.Dispatch<React.SetStateAction<{ x: string; y: string; w: string; h: string; r: string } | null>>
  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
}

export function SceneViewEditBar({ selectedNode, nodeEditDraft, setNodeEditDraft, updateNode }: SceneViewEditBarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 18,
        left: 0,
        right: 0,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px',
        background: 'rgba(10,10,15,0.88)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 9,
        color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums',
        zIndex: 5,
      }}
    >
      <span style={{ color: 'var(--accent)', marginRight: 2 }}>{'\u2B21'}</span>
      <span style={{ color: 'var(--text-secondary)', marginRight: 4, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedNode.name}</span>
      {(['x', 'y', 'w', 'h', 'r'] as const).map(field => (
        <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 8 }}>{field.toUpperCase()}:</span>
          <input
            value={nodeEditDraft[field]}
            onChange={e => setNodeEditDraft(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = parseFloat(nodeEditDraft[field])
                if (!isNaN(v)) {
                  const prop = field === 'w' ? 'width' : field === 'h' ? 'height' : field === 'r' ? 'rotation' : field
                  updateNode(selectedNode.uuid, { [prop]: v })
                }
                e.currentTarget.blur()
              }
              if (e.key === 'Escape') {
                setNodeEditDraft({ x: String(selectedNode.x), y: String(selectedNode.y), w: String(selectedNode.width), h: String(selectedNode.height), r: String(Math.round(selectedNode.rotation)) })
                e.currentTarget.blur()
              }
              e.stopPropagation()
            }}
            onBlur={e => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) {
                const prop = field === 'w' ? 'width' : field === 'h' ? 'height' : field
                updateNode(selectedNode.uuid, { [prop]: v })
              }
            }}
            style={{
              width: 38, fontSize: 9, padding: '1px 3px',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2, color: 'var(--text-primary)', outline: 'none', textAlign: 'right',
            }}
          />
        </label>
      ))}
    </div>
  )
}
