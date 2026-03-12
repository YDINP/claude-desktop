import { useState, useEffect } from 'react'
import type { SceneNode } from './types'

interface SceneInspectorProps {
  node: SceneNode | null
  onUpdate: (uuid: string, prop: string, value: number | boolean) => void
  onClose: () => void
  selectionCount?: number
  onRename?: (uuid: string, name: string) => void
}

// 개별 수치 입력 필드
function NumInput({
  label,
  value,
  decimals = 0,
  prop,
  uuid,
  onSave,
}: {
  label: string
  value: number
  decimals?: number
  prop: string
  uuid: string
  onSave: (uuid: string, prop: string, value: number) => void
}) {
  const fmt = (v: number) =>
    decimals > 0 ? String(parseFloat(v.toFixed(decimals))) : String(Math.round(v))

  const [draft, setDraft] = useState(fmt(value))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(fmt(value))
  }, [value, dirty])

  const commit = () => {
    const num = parseFloat(draft)
    if (!isNaN(num) && num !== value) {
      onSave(uuid, prop, num)
    }
    setDirty(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 0',
      }}
    >
      <span
        style={{
          width: 48,
          fontSize: 9,
          color: 'var(--text-muted)',
          flexShrink: 0,
          letterSpacing: '0.2px',
        }}
      >
        {label}
      </span>
      <input
        value={draft}
        onChange={e => {
          setDraft(e.target.value)
          setDirty(true)
        }}
        onFocus={() => setDirty(true)}
        onBlur={() => { commit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setDraft(fmt(value))
            setDirty(false)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        style={{
          flex: 1,
          background: 'var(--bg-input)',
          color: dirty ? 'var(--warning)' : 'var(--text-primary)',
          border: dirty
            ? '1px solid var(--warning)'
            : '1px solid var(--border)',
          borderRadius: 3,
          padding: '2px 5px',
          fontSize: 10,
          outline: 'none',
          transition: 'border-color 0.1s',
        }}
      />
    </div>
  )
}

// 섹션 헤더
function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--text-muted)',
        padding: '5px 0 2px',
        borderTop: '1px solid var(--border)',
        marginTop: 3,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}

export function SceneInspector({ node, onUpdate, onClose, selectionCount, onRename }: SceneInspectorProps) {
  const [isActive, setIsActive] = useState<boolean>(node?.active ?? true)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    if (node) setIsActive(node.active)
  }, [node?.uuid, node?.active])

  useEffect(() => {
    if (nameEditing) setNameEditing(false)
  }, [node?.uuid])

  const commitRename = () => {
    const trimmed = nameDraft.trim()
    if (node && trimmed && trimmed !== node.name) {
      onRename?.(node.uuid, trimmed)
    }
    setNameEditing(false)
  }

  const handleActiveToggle = () => {
    if (!node) return
    const next = !isActive
    setIsActive(next)
    onUpdate(node.uuid, 'active', next)
  }

  // 다중 선택 시 집계 뷰
  if (selectionCount !== undefined && selectionCount > 1) {
    return (
      <div
        style={{
          flexShrink: 0,
          borderTop: '2px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: '6px 8px',
          fontSize: 11,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#60a5fa',
            }}
          >
            {selectionCount}개 노드 선택됨
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  if (!node) return null

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '2px solid var(--border)',
        background: 'var(--bg-secondary)',
        padding: '6px 8px',
        fontSize: 11,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        {nameEditing ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') setNameEditing(false)
              e.stopPropagation()
            }}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--accent)',
              borderRadius: 2,
              padding: '1px 4px',
              width: 130,
              outline: 'none',
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 140,
              cursor: 'text',
            }}
            title={`${node.name} (더블클릭하여 이름 변경)`}
            onDoubleClick={() => { setNameDraft(node.name); setNameEditing(true) }}
          >
            {node.name}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Active 토글 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              fontSize: 9,
              color: 'var(--text-muted)',
            }}
          >
            <div
              onClick={handleActiveToggle}
              style={{
                width: 24,
                height: 12,
                borderRadius: 6,
                background: isActive ? 'var(--success)' : 'var(--border)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: isActive ? 14 : 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                }}
              />
            </div>
            active
          </label>

          {/* 닫기 */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Position */}
      <SectionHeader label="Position" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="X" value={node.x} uuid={node.uuid} prop="x" onSave={onUpdate} />
        <NumInput label="Y" value={node.y} uuid={node.uuid} prop="y" onSave={onUpdate} />
      </div>

      {/* Size */}
      <SectionHeader label="Size" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="W" value={node.width} uuid={node.uuid} prop="width" onSave={onUpdate} />
        <NumInput label="H" value={node.height} uuid={node.uuid} prop="height" onSave={onUpdate} />
      </div>

      {/* Scale */}
      <SectionHeader label="Scale" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="Sx" value={node.scaleX} decimals={2} uuid={node.uuid} prop="scaleX" onSave={onUpdate} />
        <NumInput label="Sy" value={node.scaleY} decimals={2} uuid={node.uuid} prop="scaleY" onSave={onUpdate} />
      </div>

      {/* Rotation */}
      <SectionHeader label="Rotation" />
      <NumInput label="Rot" value={node.rotation} decimals={2} uuid={node.uuid} prop="rotation" onSave={onUpdate} />

      {/* Anchor */}
      <SectionHeader label="Anchor" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="Ax" value={node.anchorX} decimals={2} uuid={node.uuid} prop="anchorX" onSave={onUpdate} />
        <NumInput label="Ay" value={node.anchorY} decimals={2} uuid={node.uuid} prop="anchorY" onSave={onUpdate} />
      </div>

      {/* Opacity (UIOpacity 컴포넌트 있을 때) */}
      {node.components.some(c => c.type === 'cc.UIOpacity') && (
        <>
          <SectionHeader label="Opacity" />
          <NumInput label="α" value={node.opacity} uuid={node.uuid} prop="opacity" onSave={onUpdate} />
        </>
      )}

      {/* 컴포넌트 목록 */}
      {node.components.length > 0 && (
        <>
          <SectionHeader label="Components" />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.9 }}>
            {node.components.map((c, i) => (
              <div key={i}>{c.type}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
