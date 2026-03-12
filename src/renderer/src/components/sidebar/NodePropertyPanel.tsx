import { useState, useEffect } from 'react'
import type { CCNode } from '../../../../shared/ipc-schema'

interface NodePropertyPanelProps {
  node: CCNode
  onUpdate: () => void
}

function PropRow({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(Math.round(value)))

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value)))
  }, [value, editing])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      <span style={{ width: 60, color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{label}</span>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false)
          const num = parseFloat(draft)
          if (!isNaN(num) && num !== value) onSave(num)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setEditing(false); setDraft(String(Math.round(value))) }
        }}
        style={{
          flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px', fontSize: 11,
        }}
      />
    </div>
  )
}

export function NodePropertyPanel({ node, onUpdate }: NodePropertyPanelProps) {
  const save = async (key: string, value: unknown) => {
    try {
      await window.api.ccSetProperty?.(node.uuid, key, value)
      onUpdate()
    } catch (e) {
      console.error('[NodeProperty] setProperty failed:', e)
    }
  }

  return (
    <div style={{ padding: '8px 10px', fontSize: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        {node.name}
        <span style={{ marginLeft: 6, fontWeight: 400 }}>
          {node.components.map(c => c.type.replace('cc.', '')).join(' · ')}
        </span>
      </div>

      {/* 위치 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>위치</div>
        <PropRow label="X" value={node.position.x} onSave={v => save('x', v)} />
        <PropRow label="Y" value={node.position.y} onSave={v => save('y', v)} />
      </div>

      {/* 크기 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>크기</div>
        <PropRow label="W" value={node.size.width} onSave={v => save('width', v)} />
        <PropRow label="H" value={node.size.height} onSave={v => save('height', v)} />
      </div>

      {/* 앵커 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>앵커</div>
        <PropRow label="AX" value={node.anchor.x} onSave={v => save('anchorX', v)} />
        <PropRow label="AY" value={node.anchor.y} onSave={v => save('anchorY', v)} />
      </div>

      {/* 기타 */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>기타</div>
        <PropRow label="투명도" value={node.opacity} onSave={v => save('opacity', Math.min(255, Math.max(0, v)))} />
        <PropRow label="회전" value={node.rotation} onSave={v => save('rotation', v)} />
      </div>
    </div>
  )
}
