import { useState, useEffect } from 'react'
import type { CCNode } from '../../../../shared/ipc-schema'

interface NodePropertyPanelProps {
  port: number
  node: CCNode
  onUpdate: () => void
}

function PropRow({ label, value, decimals = 0, sliderMin, sliderMax, onSave }: {
  label: string
  value: number
  decimals?: number
  sliderMin?: number
  sliderMax?: number
  onSave: (v: number) => void
}) {
  // trailing zero 제거: 1.00→"1", 0.50→"0.5", 0.12→"0.12"
  const fmt = (v: number) => decimals > 0 ? String(parseFloat(v.toFixed(decimals))) : String(Math.round(v))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(fmt(value))

  useEffect(() => {
    if (!editing) setDraft(fmt(value))
  }, [value, editing])

  const hasSlider = sliderMin !== undefined && sliderMax !== undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      <span style={{ width: 56, color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{label}</span>
      {hasSlider && (
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={decimals > 0 ? Math.pow(10, -decimals) : 1}
          value={isNaN(parseFloat(draft)) ? value : parseFloat(draft)}
          onChange={e => {
            const num = parseFloat(e.target.value)
            setDraft(fmt(num))
            onSave(num)
          }}
          style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: 4 }}
        />
      )}
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
          if (e.key === 'Escape') { setEditing(false); setDraft(fmt(value)) }
        }}
        style={{
          width: hasSlider ? 46 : undefined,
          flex: hasSlider ? undefined : 1,
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px', fontSize: 11,
        }}
      />
    </div>
  )
}

function formatPropValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'number') return parseFloat(value.toFixed(3)).toString()
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // Vec2 패턴: {x: N, y: N}
    if ('x' in obj && 'y' in obj && !('z' in obj) && !('r' in obj)) {
      return `(${parseFloat((obj.x as number).toFixed(2))}, ${parseFloat((obj.y as number).toFixed(2))})`
    }
    // Vec3 패턴: {x: N, y: N, z: N}
    if ('x' in obj && 'y' in obj && 'z' in obj && !('r' in obj)) {
      return `(${parseFloat((obj.x as number).toFixed(2))}, ${parseFloat((obj.y as number).toFixed(2))}, ${parseFloat((obj.z as number).toFixed(2))})`
    }
    // Color 패턴: {r: N, g: N, b: N, a: N}
    if ('r' in obj && 'g' in obj && 'b' in obj) {
      return `color:${Math.round(obj.r as number)},${Math.round(obj.g as number)},${Math.round(obj.b as number)}`
    }
    const entries = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${typeof v === 'number' ? parseFloat((v as number).toFixed(3)) : v}`)
    return `{${entries.join(', ')}}`
  }
  if (typeof value === 'string') {
    return value.length > 50 ? value.slice(0, 50) + '…' : value
  }
  return String(value)
}

function ComponentSection({ type, props, open, onToggle }: {
  type: string
  props?: Record<string, unknown>
  open: boolean
  onToggle: () => void
}) {
  const rows = props
    ? Object.entries(props).map(([k, v]) => ({ k, v: formatPropValue(v) })).filter(r => r.v !== null)
    : []

  return (
    <div style={{ marginTop: 2 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 0', cursor: 'pointer',
          borderTop: '1px solid var(--border)',
          fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.3px',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 9, width: 10 }}>{open ? '▾' : '▸'}</span>
        {type}
      </div>
      {open && rows.length > 0 && (
        <div style={{ paddingLeft: 14, paddingBottom: 2 }}>
          {rows.map(({ k, v }) => {
            const isColor = v?.startsWith('color:')
            const colorParts = isColor ? v!.slice(6).split(',').map(Number) : null
            return (
              <div key={k} style={{ display: 'flex', gap: 4, padding: '1px 0', fontSize: 10, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 72 }}>{k}</span>
                {isColor && colorParts ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                      background: `rgb(${colorParts[0]}, ${colorParts[1]}, ${colorParts[2]})`,
                      border: '1px solid var(--border)',
                    }} />
                    <span style={{ color: 'var(--text-primary)' }}>
                      #{colorParts.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{v}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {open && rows.length === 0 && (
        <div style={{ paddingLeft: 14, fontSize: 10, color: 'var(--text-muted)', paddingBottom: 2 }}>
          (no props)
        </div>
      )}
    </div>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
      padding: '6px 0 3px', borderTop: '1px solid var(--border)', marginTop: 4,
      letterSpacing: '0.3px',
    }}>
      {label}
    </div>
  )
}

export function NodePropertyPanel({ port, node, onUpdate }: NodePropertyPanelProps) {
  const save = async (key: string, value: unknown) => {
    try {
      await window.api.ccSetProperty?.(port, node.uuid, key, value)
      onUpdate()
    } catch (e) {
      console.error('[NodeProperty] setProperty failed:', e)
    }
  }

  const scale = node.scale ?? { x: 1, y: 1 }
  const hasUIOpacity = (node.components ?? []).some(c => c.type === 'cc.UIOpacity')
  const extraComponents = (node.components ?? []).filter(
    c => c.type !== 'cc.UITransform' && c.type !== 'cc.UIOpacity'
  )
  const [openState, setOpenState] = useState<Record<number, boolean>>({})
  const toggleOpen = (i: number) => setOpenState(prev => ({ ...prev, [i]: !prev[i] }))

  return (
    <div style={{ padding: '8px 10px', fontSize: 12, borderTop: '2px solid var(--border)' }}>
      {/* 노드 이름 */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
        {node.name}
      </div>

      {/* Node 그룹 */}
      <GroupHeader label="Node" />
      <PropRow label="Position X" value={node.position?.x ?? 0} onSave={v => save('x', v)} />
      <PropRow label="Position Y" value={node.position?.y ?? 0} onSave={v => save('y', v)} />
      <PropRow label="Rotation"   value={node.rotation ?? 0}    decimals={2} sliderMin={-180} sliderMax={180} onSave={v => save('rotation', v)} />
      <PropRow label="Scale X"    value={scale.x ?? 1}          decimals={2} onSave={v => save('scaleX', v)} />
      <PropRow label="Scale Y"    value={scale.y ?? 1}          decimals={2} onSave={v => save('scaleY', v)} />

      {/* cc.UITransform 그룹 */}
      <GroupHeader label="cc.UITransform" />
      <PropRow label="Width"    value={node.size?.width ?? 0}  onSave={v => save('width', v)} />
      <PropRow label="Height"   value={node.size?.height ?? 0} onSave={v => save('height', v)} />
      <PropRow label="Anchor X" value={node.anchor?.x ?? 0.5}  decimals={2} onSave={v => save('anchorX', v)} />
      <PropRow label="Anchor Y" value={node.anchor?.y ?? 0.5}  decimals={2} onSave={v => save('anchorY', v)} />

      {/* cc.UIOpacity — 컴포넌트가 있을 때만 표시 */}
      {hasUIOpacity && (
        <>
          <GroupHeader label="cc.UIOpacity" />
          <PropRow label="Opacity" value={node.opacity ?? 255} sliderMin={0} sliderMax={255} onSave={v => save('opacity', Math.min(255, Math.max(0, Math.round(v))))} />
        </>
      )}

      {/* 컴포넌트 목록 */}
      {extraComponents.length > 0 && (
        <>
          <GroupHeader label="Components" />
          {extraComponents.map((c, i) => (
            <ComponentSection
              key={i}
              type={c.type}
              props={c.props}
              open={!!openState[i]}
              onToggle={() => toggleOpen(i)}
            />
          ))}
        </>
      )}
    </div>
  )
}
