import { useState, useEffect, useCallback } from 'react'
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

// cc.Label: string 편집, cc.Button: interactable 토글 등 컴포넌트별 특수 props 편집 행
const COMP_EDITABLE_KEYS: Record<string, string[]> = {
  'cc.Label':      ['string', 'fontSize', 'lineHeight'],
  'cc.RichText':   ['string', 'fontSize'],
  'cc.Button':     ['interactable'],
  'cc.EditBox':    ['string', 'fontSize'],
  'cc.Sprite':     [],
  'cc.Slider':     ['progress', 'totalLength'],
  'cc.Toggle':     ['isChecked'],
  'cc.ProgressBar': ['progress', 'reverse'],
  'cc.ScrollView': ['horizontal', 'vertical', 'inertia'],
  'cc.Animation':  ['speed'],
}

function CompEditRow({ label, value, onSave }: {
  label: string
  value: unknown
  onSave: (v: unknown) => void
}) {
  const isBool = typeof value === 'boolean'
  const isNum  = typeof value === 'number'
  const [draft, setDraft] = useState(isBool ? String(value) : String(value ?? ''))

  useEffect(() => {
    setDraft(isBool ? String(value) : String(value ?? ''))
  }, [value, isBool])

  if (isBool) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 10 }}>
        <span style={{ color: 'var(--text-muted)', minWidth: 72, flexShrink: 0 }}>{label}</span>
        <input type="checkbox" checked={Boolean(value)} onChange={e => onSave(e.target.checked)}
          style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 10 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 72, flexShrink: 0 }}>{label}</span>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const v = isNum ? parseFloat(draft) : draft
          if (!isNum || !isNaN(v as number)) onSave(v)
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{
          flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--accent)', borderRadius: 3, padding: '2px 6px', fontSize: 10,
        }}
      />
    </div>
  )
}

function ComponentSection({ type, props, open, onToggle, onSaveProp, onSaveCompProp }: {
  type: string
  props?: Record<string, unknown>
  open: boolean
  onToggle: () => void
  onSaveProp?: (key: string, value: unknown) => void
  onSaveCompProp?: (compType: string, key: string, value: unknown) => void
}) {
  const editableKeys = COMP_EDITABLE_KEYS[type] ?? []
  const rows = props
    ? Object.entries(props).map(([k, v]) => ({ k, v: formatPropValue(v), raw: v })).filter(r => r.v !== null)
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
          {rows.map(({ k, v, raw }) => {
            const isColor = v?.startsWith('color:')
            const colorParts = isColor ? v!.slice(6).split(',').map(Number) : null
            const isEditable = editableKeys.includes(k) && onSaveCompProp
            if (isEditable) {
              return (
                <CompEditRow key={k} label={k} value={raw}
                  onSave={val => onSaveCompProp!(type, k, val)} />
              )
            }
            return (
              <div key={k} style={{ display: 'flex', gap: 4, padding: '1px 0', fontSize: 10, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 72 }}>{k}</span>
                {isColor && colorParts ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ position: 'relative', display: 'inline-block' }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: 2, flexShrink: 0, display: 'block',
                        background: `rgb(${colorParts[0]}, ${colorParts[1]}, ${colorParts[2]})`,
                        border: '1px solid var(--border)',
                        cursor: onSaveProp ? 'pointer' : 'default',
                      }} onClick={e => onSaveProp && (e.currentTarget.nextElementSibling as HTMLInputElement)?.click()} />
                      {onSaveProp && (
                        <input
                          type="color"
                          defaultValue={`#${colorParts.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`}
                          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, top: 0, left: 0, padding: 0, border: 'none' }}
                          onChange={e => {
                            const hex = e.target.value.slice(1)
                            const r = parseInt(hex.slice(0, 2), 16)
                            const g = parseInt(hex.slice(2, 4), 16)
                            const b = parseInt(hex.slice(4, 6), 16)
                            onSaveProp('color', { r, g, b, a: 255 })
                          }}
                        />
                      )}
                    </span>
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

  const saveComp = async (compType: string, key: string, value: unknown) => {
    try {
      await window.api.ccSetComponentProp?.(port, node.uuid, compType, key, value)
      onUpdate()
    } catch (e) {
      console.error('[NodeProperty] setComponentProp failed:', e)
    }
  }

  const scale = node.scale ?? { x: 1, y: 1 }
  const hasUIOpacity = (node.components ?? []).some(c => c.type === 'cc.UIOpacity')
  const extraComponents = (node.components ?? []).filter(
    c => c.type !== 'cc.UITransform' && c.type !== 'cc.UIOpacity'
  )
  const [openState, setOpenState] = useState<Record<number, boolean>>({})
  const [uuidCopied, setUuidCopied] = useState(false)
  const toggleOpen = (i: number) => setOpenState(prev => ({ ...prev, [i]: !prev[i] }))
  const copyUuid = useCallback(() => {
    navigator.clipboard.writeText(node.uuid).then(() => {
      setUuidCopied(true)
      setTimeout(() => setUuidCopied(false), 1500)
    })
  }, [node.uuid])

  return (
    <div style={{ padding: '8px 10px', fontSize: 12, borderTop: '2px solid var(--border)' }}>
      {/* 노드 이름 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <button
          onClick={copyUuid}
          title={`UUID 복사: ${node.uuid}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: uuidCopied ? '#4ade80' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0 }}
        >
          {uuidCopied ? '✓' : '📋'}
        </button>
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
      {extraComponents.length > 0 && (() => {
        const allOpen = extraComponents.every((_, i) => !!openState[i])
        return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 3px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>Components ({extraComponents.length})</span>
            {extraComponents.length > 1 && (
              <button
                onClick={() => {
                  const next: Record<number, boolean> = {}
                  extraComponents.forEach((_, i) => { next[i] = !allOpen })
                  setOpenState(next)
                }}
                title={allOpen ? '전체 접기' : '전체 펼치기'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: '0 2px' }}
              >
                {allOpen ? '⊖' : '⊕'}
              </button>
            )}
          </div>
          {extraComponents.map((c, i) => (
            <ComponentSection
              key={i}
              type={c.type}
              props={c.props}
              open={!!openState[i]}
              onToggle={() => toggleOpen(i)}
              onSaveProp={(k, v) => save(k, v)}
              onSaveCompProp={saveComp}
            />
          ))}
        </>
        )
      })()}
    </div>
  )
}
