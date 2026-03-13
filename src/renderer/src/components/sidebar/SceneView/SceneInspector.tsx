import { useState, useEffect, useRef } from 'react'
import type { SceneNode } from './types'
import { getComponentIcon } from './utils'

interface SceneInspectorProps {
  node: SceneNode | null
  onUpdate: (uuid: string, prop: string, value: number | boolean) => void
  onColorUpdate?: (uuid: string, color: Partial<{ r: number; g: number; b: number; a: number }>) => void
  onClose: () => void
  selectionCount?: number
  onRename?: (uuid: string, name: string) => void
  onMemo?: (uuid: string, memo: string) => void
  onTagsUpdate?: (uuid: string, tags: string[]) => void
  onLabelColorUpdate?: (uuid: string, color: string | undefined) => void
  onApplyToCocos?: (node: SceneNode) => void
  onComponentClick?: (uuid: string) => void
  connected?: boolean
  nodeMap?: Map<string, SceneNode>
  onSelectParent?: (uuid: string) => void
  focusNameTrigger?: number
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

// 헥스 변환 헬퍼
const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

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

function ChildList({ childUuids, nodeMap, onSelect }: { childUuids: string[]; nodeMap?: Map<string, SceneNode>; onSelect?: (uuid: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <span>
      <span
        title={`자식 노드 ${childUuids.length}개 — 클릭으로 목록 펼치기`}
        style={{ cursor: 'pointer', color: expanded ? 'var(--accent)' : undefined }}
        onClick={() => setExpanded(v => !v)}
      >
        ↳{childUuids.length}
      </span>
      {expanded && (
        <div style={{ marginTop: 2, paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
          {childUuids.map(cid => {
            const child = nodeMap?.get(cid)
            return child ? (
              <div
                key={cid}
                style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', padding: '1px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onClick={() => onSelect?.(cid)}
                title={child.name}
              >
                {child.name}
              </div>
            ) : null
          })}
        </div>
      )}
    </span>
  )
}

export function SceneInspector({ node, onUpdate, onColorUpdate, onClose, selectionCount, onRename, onMemo, onTagsUpdate, onLabelColorUpdate, onApplyToCocos, onComponentClick, connected, nodeMap, onSelectParent, focusNameTrigger }: SceneInspectorProps) {
  const [isActive, setIsActive] = useState<boolean>(node?.active ?? true)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [uuidCopied, setUuidCopied] = useState(false)
  const [scaleLocked, setScaleLocked] = useState(false)
  const [sizeLocked, setSizeLocked] = useState(false)
  const [memoDraft, setMemoDraft] = useState(node?.memo ?? '')
  const [tagDraft, setTagDraft] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<Array<{ key: string; val: unknown; time: number }>>([])

  useEffect(() => { setHistory([]) }, [node?.uuid])

  const trackUpdate = (uuid: string, key: string, value: number | boolean) => {
    setHistory(prev => [{ key, val: value, time: Date.now() }, ...prev].slice(0, 20))
    onUpdate(uuid, key, value)
  }

  useEffect(() => { setMemoDraft(node?.memo ?? '') }, [node?.uuid])

  useEffect(() => {
    if (!focusNameTrigger || !node) return
    setNameDraft(node.name)
    setNameEditing(true)
    // 렌더 후 포커스
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [focusNameTrigger])

  const handleScaleUpdate = (uuid: string, prop: string, value: number) => {
    trackUpdate(uuid, prop, value)
    if (scaleLocked && node) {
      if (prop === 'scaleX' && node.scaleX !== 0) {
        trackUpdate(uuid, 'scaleY', parseFloat((value * node.scaleY / node.scaleX).toFixed(4)))
      } else if (prop === 'scaleY' && node.scaleY !== 0) {
        trackUpdate(uuid, 'scaleX', parseFloat((value * node.scaleX / node.scaleY).toFixed(4)))
      }
    }
  }

  const handleSizeUpdate = (uuid: string, prop: string, value: number) => {
    trackUpdate(uuid, prop, value)
    if (sizeLocked && node) {
      if (prop === 'width' && node.width !== 0) {
        trackUpdate(uuid, 'height', parseFloat((value * node.height / node.width).toFixed(0)))
      } else if (prop === 'height' && node.height !== 0) {
        trackUpdate(uuid, 'width', parseFloat((value * node.width / node.height).toFixed(0)))
      }
    }
  }

  const handleCopyUuid = () => {
    if (!node) return
    navigator.clipboard.writeText(node.uuid).then(() => {
      setUuidCopied(true)
      setTimeout(() => setUuidCopied(false), 1200)
    })
  }

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
    trackUpdate(node.uuid, 'active', next)
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
            ref={nameInputRef}
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

          {/* UUID 복사 */}
          <button
            onClick={handleCopyUuid}
            title={`UUID 복사: ${node.uuid}`}
            style={{
              background: 'none',
              border: 'none',
              color: uuidCopied ? 'var(--success)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 9,
              padding: '0 2px',
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
          >
            {uuidCopied ? '✓' : '#'}
          </button>

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

      {/* 조상 경로 (Breadcrumb) + 자식/depth 정보 */}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {node.parentUuid && nodeMap && (() => {
          // 조상 체인 수집 (루트 → 부모 순)
          const ancestors: Array<{ uuid: string; name: string }> = []
          let cur = nodeMap.get(node.parentUuid!)
          while (cur) {
            ancestors.unshift({ uuid: cur.uuid, name: cur.name })
            cur = cur.parentUuid ? nodeMap.get(cur.parentUuid) : undefined
          }
          if (ancestors.length === 0) return null
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {ancestors.map((anc, i) => (
                <span key={anc.uuid} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
                  <span
                    style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                    onClick={() => onSelectParent?.(anc.uuid)}
                    title={`선택: ${anc.name}`}
                  >
                    {anc.name}
                  </span>
                </span>
              ))}
            </span>
          )
        })()}
        {node.childUuids.length > 0 && (
          <ChildList childUuids={node.childUuids} nodeMap={nodeMap} onSelect={onSelectParent} />
        )}
      </div>

      {/* Position */}
      <SectionHeader label="Position" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <NumInput label="X" value={node.x} uuid={node.uuid} prop="x" onSave={trackUpdate} />
          <NumInput label="Y" value={node.y} uuid={node.uuid} prop="y" onSave={trackUpdate} />
        </div>
        <button
          onClick={() => { trackUpdate(node.uuid, 'x', 0); trackUpdate(node.uuid, 'y', 0) }}
          title="X, Y 위치를 (0, 0)으로 초기화"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: (node.x !== 0 || node.y !== 0) ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >⊙</button>
      </div>

      {/* Size */}
      <SectionHeader label="Size" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <NumInput label="W" value={node.width} uuid={node.uuid} prop="width" onSave={handleSizeUpdate} />
          <NumInput label="H" value={node.height} uuid={node.uuid} prop="height" onSave={handleSizeUpdate} />
        </div>
        <button
          onClick={() => setSizeLocked(v => !v)}
          title={sizeLocked ? '비율 잠금 해제' : '비율 유지 잠금'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: sizeLocked ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >∝</button>
      </div>

      {/* Scale */}
      <SectionHeader label="Scale" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <NumInput label="Sx" value={node.scaleX} decimals={2} uuid={node.uuid} prop="scaleX" onSave={handleScaleUpdate} />
          <NumInput label="Sy" value={node.scaleY} decimals={2} uuid={node.uuid} prop="scaleY" onSave={handleScaleUpdate} />
        </div>
        <button
          onClick={() => setScaleLocked(v => !v)}
          title={scaleLocked ? '비율 잠금 해제' : '비율 유지 잠금'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: scaleLocked ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >∝</button>
        <button
          onClick={() => { trackUpdate(node.uuid, 'scaleX', 1); trackUpdate(node.uuid, 'scaleY', 1) }}
          title="스케일을 (1, 1)로 초기화"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: (node.scaleX !== 1 || node.scaleY !== 1) ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >⊙</button>
      </div>

      {/* Rotation */}
      <SectionHeader label="Rotation" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1 }}>
          <NumInput label="Rot" value={node.rotation} decimals={2} uuid={node.uuid} prop="rotation" onSave={trackUpdate} />
        </div>
        <button
          onClick={() => trackUpdate(node.uuid, 'rotation', 0)}
          title="회전을 0으로 초기화"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: node.rotation !== 0 ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >⊙</button>
      </div>

      {/* Anchor */}
      <SectionHeader label="Anchor" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <NumInput label="Ax" value={node.anchorX} decimals={2} uuid={node.uuid} prop="anchorX" onSave={trackUpdate} />
          <NumInput label="Ay" value={node.anchorY} decimals={2} uuid={node.uuid} prop="anchorY" onSave={trackUpdate} />
        </div>
        <button
          onClick={() => { trackUpdate(node.uuid, 'anchorX', 0.5); trackUpdate(node.uuid, 'anchorY', 0.5) }}
          title="앵커를 (0.5, 0.5) 중심으로 초기화"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: (node.anchorX !== 0.5 || node.anchorY !== 0.5) ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >⊙</button>
      </div>

      {/* Color */}
      <SectionHeader label="Color" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
        <label style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', lineHeight: 0 }} title="클릭하여 색상 변경">
          <div
            style={{
              width: 20,
              height: 14,
              borderRadius: 2,
              background: `rgba(${node.color.r},${node.color.g},${node.color.b},${node.color.a / 255})`,
              border: '1px solid var(--border)',
            }}
          />
          <input
            type="color"
            value={`#${toHex(node.color.r)}${toHex(node.color.g)}${toHex(node.color.b)}`}
            onChange={e => {
              if (!onColorUpdate) return
              const hex = e.target.value.slice(1)
              const r = parseInt(hex.slice(0, 2), 16)
              const g = parseInt(hex.slice(2, 4), 16)
              const b = parseInt(hex.slice(4, 6), 16)
              onColorUpdate(node.uuid, { r, g, b })
            }}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', padding: 0, border: 'none' }}
          />
        </label>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.3px' }}>
          #{toHex(node.color.r)}{toHex(node.color.g)}{toHex(node.color.b)}
        </span>
        <input
          type="range"
          min={0}
          max={255}
          value={node.color.a}
          onChange={e => onColorUpdate?.(node.uuid, { a: parseInt(e.target.value) })}
          title={`알파: ${Math.round(node.color.a / 255 * 100)}%`}
          style={{ flex: 1, height: 4, cursor: 'pointer', accentColor: 'var(--accent)', minWidth: 0 }}
        />
        <span style={{ fontSize: 9, color: node.color.a < 255 ? 'var(--accent)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 26, textAlign: 'right' }}>
          {Math.round(node.color.a / 255 * 100)}%
        </span>
      </div>

      {/* Opacity (UIOpacity 컴포넌트 있을 때) */}
      {node.components.some(c => c.type === 'cc.UIOpacity') && (
        <>
          <SectionHeader label="Opacity" />
          <NumInput label="α" value={node.opacity} uuid={node.uuid} prop="opacity" onSave={trackUpdate} />
        </>
      )}

      {/* 컴포넌트 목록 */}
      {node.components.length > 0 && (
        <>
          <SectionHeader label="Components" />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.9 }}>
            {node.components.map((c, i) => {
              const icon = getComponentIcon([c])
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    cursor: onComponentClick ? 'pointer' : undefined,
                    borderRadius: 3,
                    padding: '1px 3px',
                  }}
                  onClick={() => onComponentClick?.(node.uuid)}
                  title={onComponentClick ? '씬뷰에서 하이라이트' : undefined}
                  onMouseEnter={e => { if (onComponentClick) (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.1)' }}
                  onMouseLeave={e => { if (onComponentClick) (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  {icon && (
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 8, width: 10, flexShrink: 0 }}>
                      {icon}
                    </span>
                  )}
                  <span>{c.type}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* R1368: cc.Widget 속성 편집 */}
      {(() => {
        const widgetComp = node.components.find(c => c.type === 'cc.Widget')
        if (!widgetComp?.props) return null
        const wp = widgetComp.props as Record<string, unknown>
        const alignMode = (wp.alignMode as number) ?? 0
        const alignModeLabels = ['ONCE', 'ON_WINDOW_RESIZE', 'ALWAYS']
        return (
          <>
            <SectionHeader label="Widget" />
            <div style={{ fontSize: 9, padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>alignMode</span>
                <select
                  value={alignMode}
                  onChange={e => {
                    const val = parseInt(e.target.value)
                    const newComps = node.components.map(c =>
                      c.type === 'cc.Widget' ? { ...c, props: { ...c.props, alignMode: val } } : c
                    )
                    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                  }}
                  style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
                >
                  {alignModeLabels.map((label, i) => (
                    <option key={i} value={i}>{i} — {label}</option>
                  ))}
                </select>
              </div>
              {(['top', 'bottom', 'left', 'right'] as const).map(side => {
                const boolKey = `isAbsolute${side.charAt(0).toUpperCase()}${side.slice(1)}` as string
                const isAbs = (wp[boolKey] as boolean) ?? false
                const val = (wp[side] as number) ?? 0
                return (
                  <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 2, width: 48, flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={isAbs}
                        onChange={e => {
                          const newComps = node.components.map(c =>
                            c.type === 'cc.Widget' ? { ...c, props: { ...c.props, [boolKey]: e.target.checked } } : c
                          )
                          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                        }}
                        style={{ width: 10, height: 10, accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{side}</span>
                    </label>
                    <NumInput label="" value={val} decimals={1} uuid={node.uuid} prop={`widget.${side}`}
                      onSave={(_uuid, _prop, v) => {
                        const newComps = node.components.map(c =>
                          c.type === 'cc.Widget' ? { ...c, props: { ...c.props, [side]: v } } : c
                        )
                        onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {/* R1374: cc.Sprite 에셋 피커 */}
      {(() => {
        const spriteComp = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D')
        if (!spriteComp) return null
        const sfUuid = (spriteComp.props?.spriteFrame as { __uuid__?: string })?.__uuid__ ?? '(없음)'
        const sfDisplay = sfUuid.length > 16 ? sfUuid.slice(0, 8) + '...' + sfUuid.slice(-6) : sfUuid
        return (
          <>
            <SectionHeader label="Sprite" />
            <div style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>SF</span>
              <span
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 8, color: 'var(--text-primary)' }}
                title={sfUuid}
              >{sfDisplay}</span>
              <button
                onClick={async () => {
                  const paths = await window.api.openFileDialog?.({
                    title: '스프라이트 이미지 선택',
                    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
                  })
                  if (paths && paths.length > 0) {
                    const fileName = paths[0].replace(/\\/g, '/').split('/').pop() ?? paths[0]
                    const newComps = node.components.map(c =>
                      (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D')
                        ? { ...c, props: { ...c.props, _selectedFile: paths[0], spriteFrame: { __uuid__: `placeholder:${fileName}` } } }
                        : c
                    )
                    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                  }
                }}
                title="이미지 파일 선택 (에셋 피커)"
                style={{
                  background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 3,
                  color: 'var(--accent)', cursor: 'pointer', fontSize: 9, padding: '1px 5px', flexShrink: 0,
                }}
              >📁</button>
            </div>
            {(spriteComp.props as Record<string, unknown>)?._selectedFile && (
              <div style={{ fontSize: 8, color: 'var(--success)', padding: '1px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={String((spriteComp.props as Record<string, unknown>)._selectedFile)}>
                → {String((spriteComp.props as Record<string, unknown>)._selectedFile).replace(/\\/g, '/').split('/').pop()}
              </div>
            )}
          </>
        )
      })()}

      {/* R1375: cc.Layout 컴포넌트 속성 편집 */}
      {(() => {
        const layoutComp = node.components.find(c => c.type === 'cc.Layout')
        if (!layoutComp?.props) return null
        const lp = layoutComp.props as Record<string, unknown>
        const layoutType = (lp.type as number) ?? 0
        const resizeMode = (lp.resizeMode as number) ?? 0
        const layoutTypeLabels = ['NONE', 'HORIZONTAL', 'VERTICAL', 'GRID']
        const resizeModeLabels = ['NONE', 'CHILDREN', 'CONTAINER']
        const onLayoutPropChange = (key: string, value: number) => {
          const newComps = node.components.map(c =>
            c.type === 'cc.Layout' ? { ...c, props: { ...c.props, [key]: value } } : c
          )
          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
        }
        return (
          <>
            <SectionHeader label="Layout" />
            <div style={{ fontSize: 9, padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>type</span>
                <select
                  value={layoutType}
                  onChange={e => onLayoutPropChange('type', parseInt(e.target.value))}
                  style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
                >
                  {layoutTypeLabels.map((label, i) => (
                    <option key={i} value={i}>{i} — {label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
                <NumInput label="padT" value={(lp.paddingTop as number) ?? 0} uuid={node.uuid} prop="layout.paddingTop"
                  onSave={(_u, _p, v) => onLayoutPropChange('paddingTop', v)} />
                <NumInput label="padB" value={(lp.paddingBottom as number) ?? 0} uuid={node.uuid} prop="layout.paddingBottom"
                  onSave={(_u, _p, v) => onLayoutPropChange('paddingBottom', v)} />
                <NumInput label="padL" value={(lp.paddingLeft as number) ?? 0} uuid={node.uuid} prop="layout.paddingLeft"
                  onSave={(_u, _p, v) => onLayoutPropChange('paddingLeft', v)} />
                <NumInput label="padR" value={(lp.paddingRight as number) ?? 0} uuid={node.uuid} prop="layout.paddingRight"
                  onSave={(_u, _p, v) => onLayoutPropChange('paddingRight', v)} />
              </div>
              {(layoutType === 1 || layoutType === 2 || layoutType === 3) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px', marginTop: 2 }}>
                  <NumInput label="spX" value={(lp.spacingX as number) ?? 0} uuid={node.uuid} prop="layout.spacingX"
                    onSave={(_u, _p, v) => onLayoutPropChange('spacingX', v)} />
                  <NumInput label="spY" value={(lp.spacingY as number) ?? 0} uuid={node.uuid} prop="layout.spacingY"
                    onSave={(_u, _p, v) => onLayoutPropChange('spacingY', v)} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>resize</span>
                <select
                  value={resizeMode}
                  onChange={e => onLayoutPropChange('resizeMode', parseInt(e.target.value))}
                  style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
                >
                  {resizeModeLabels.map((label, i) => (
                    <option key={i} value={i}>{i} — {label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )
      })()}

      {/* R1384: cc.Animation 클립 목록 뷰어 */}
      {(() => {
        const animComp = node.components.find(c => c.type === 'cc.Animation')
        if (!animComp?.props) return null
        const ap = animComp.props as Record<string, unknown>
        const defaultClip = ap.defaultClip as { __uuid__?: string } | undefined
        const defaultClipUuid = defaultClip?.__uuid__ ?? ''
        const clipsRaw = (ap.clips ?? ap._clips ?? []) as Array<{ __uuid__?: string } | null>
        const clips = clipsRaw.filter((c): c is { __uuid__: string } => !!c && !!c.__uuid__)
        const clipCount = clips.length
        return (
          <>
            <SectionHeader label="Animation" />
            <div style={{ fontSize: 9, padding: '2px 0' }}>
              {defaultClipUuid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>default</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent)' }}
                    title={defaultClipUuid}>
                    {defaultClipUuid.length > 16 ? defaultClipUuid.slice(0, 8) + '...' + defaultClipUuid.slice(-6) : defaultClipUuid}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)' }}>clips</span>
                <span style={{
                  fontSize: 8, padding: '0 5px', borderRadius: 8,
                  background: 'rgba(96,165,250,0.15)', color: 'var(--accent)',
                }}>{clipCount} clips</span>
              </div>
              {clips.map((clip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', paddingLeft: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 8, flexShrink: 0 }}>#{i}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}
                    title={clip.__uuid__}>
                    {clip.__uuid__.length > 16 ? clip.__uuid__.slice(0, 8) + '...' + clip.__uuid__.slice(-6) : clip.__uuid__}
                  </span>
                </div>
              ))}
              {/* 재생 placeholder */}
              <button
                disabled
                style={{
                  marginTop: 4, width: '100%', padding: '2px 0', fontSize: 9,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  borderRadius: 3, color: 'var(--text-muted)', cursor: 'default', opacity: 0.5,
                }}
                title="재생 기능은 추후 구현 예정"
              >
                ▶ 재생 (미구현)
              </button>
            </div>
          </>
        )
      })()}

      {/* R1387: cc.AudioSource 속성 편집 */}
      {(() => {
        const audioComp = node.components.find(c => c.type === 'cc.AudioSource')
        if (!audioComp?.props) return null
        const ap = audioComp.props as Record<string, unknown>
        const clipUuid = (ap.clip as { __uuid__?: string })?.__uuid__ ?? (ap._clip as { __uuid__?: string })?.__uuid__ ?? ''
        const clipDisplay = clipUuid.length > 16 ? clipUuid.slice(0, 8) + '...' + clipUuid.slice(-6) : clipUuid || '(없음)'
        const volume = (ap.volume as number) ?? (ap._volume as number) ?? 1
        const loop = (ap.loop as boolean) ?? (ap._loop as boolean) ?? false
        const playOnLoad = (ap.playOnLoad as boolean) ?? (ap._playOnAwake as boolean) ?? false
        const preload = (ap.preload as number) ?? 0
        const preloadLabels = ['NONE', 'METADATA', 'AUTO']
        const onAudioPropChange = (key: string, value: number | boolean) => {
          const newComps = node.components.map(c =>
            c.type === 'cc.AudioSource' ? { ...c, props: { ...c.props, [key]: value } } : c
          )
          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
        }
        return (
          <>
            <SectionHeader label="AudioSource" />
            <div style={{ fontSize: 9, padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48 }}>clip</span>
                <span style={{ fontFamily: 'monospace', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}
                  title={clipUuid}>{clipDisplay}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>volume</span>
                <input
                  type="range" min={0} max={1} step={0.01} value={volume}
                  onChange={e => onAudioPropChange('volume', parseFloat(e.target.value))}
                  style={{ flex: 1, height: 4, accentColor: 'var(--accent)', cursor: 'pointer', minWidth: 0 }}
                />
                <span style={{ fontSize: 8, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>
                  {volume.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>loop</span>
                <input
                  type="checkbox" checked={loop}
                  onChange={e => onAudioPropChange('loop', e.target.checked)}
                  style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 8, color: loop ? 'var(--success)' : 'var(--text-muted)' }}>{loop ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>playOnLoad</span>
                <input
                  type="checkbox" checked={playOnLoad}
                  onChange={e => onAudioPropChange('playOnLoad', e.target.checked)}
                  style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 8, color: playOnLoad ? 'var(--success)' : 'var(--text-muted)' }}>{playOnLoad ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>preload</span>
                <select
                  value={preload}
                  onChange={e => onAudioPropChange('preload', parseInt(e.target.value))}
                  style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
                >
                  {preloadLabels.map((label, i) => (
                    <option key={i} value={i}>{i} — {label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )
      })()}

      {/* R1372: 컴포넌트 추가 드롭다운 */}
      {(() => {
        const ADDABLE_COMPONENTS = ['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource']
        const existingTypes = new Set(node.components.map(c => c.type))
        return (
          <div style={{ marginTop: 4, paddingTop: 3, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              id="add-comp-select"
              style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px' }}
            >
              {ADDABLE_COMPONENTS.map(ct => (
                <option key={ct} value={ct} disabled={existingTypes.has(ct)}>
                  {ct.split('.').pop()}{existingTypes.has(ct) ? ' (있음)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const sel = (document.getElementById('add-comp-select') as HTMLSelectElement)?.value
                if (!sel || existingTypes.has(sel)) return
                const newComps = [...node.components, { type: sel, props: {} }]
                onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
              }}
              disabled={ADDABLE_COMPONENTS.every(ct => existingTypes.has(ct))}
              style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                border: '1px solid var(--accent)', opacity: ADDABLE_COMPONENTS.every(ct => existingTypes.has(ct)) ? 0.4 : 1,
              }}
            >
              + 추가
            </button>
          </div>
        )
      })()}

      {/* 노드 메모 */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>메모</div>
        <textarea
          value={memoDraft}
          onChange={e => setMemoDraft(e.target.value)}
          onBlur={() => { if (node) onMemo?.(node.uuid, memoDraft) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && node) { e.preventDefault(); onMemo?.(node.uuid, memoDraft) } }}
          placeholder="노드에 메모 추가..."
          rows={2}
          style={{
            width: '100%', resize: 'vertical', fontSize: 10, padding: '3px 5px',
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>

      {/* 라벨 색상 */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>라벨 색상</div>
        <input
          type="color"
          value={node.labelColor ?? '#60a5fa'}
          onChange={e => onLabelColorUpdate?.(node.uuid, e.target.value)}
          style={{ width: 24, height: 16, padding: 0, border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', background: 'none' }}
          title="노드 표시 색상"
        />
        {node.labelColor && (
          <button
            onClick={() => onLabelColorUpdate?.(node.uuid, undefined)}
            style={{ fontSize: 9, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
            title="색상 초기화"
          >×</button>
        )}
      </div>

      {/* 노드 태그 */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>태그</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
          {(node.tags ?? []).map(tag => (
            <span key={tag} style={{ fontSize: 9, background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 10, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 2 }}>
              {tag}
              <span
                style={{ cursor: 'pointer', opacity: 0.7, fontSize: 9 }}
                onClick={() => onTagsUpdate?.(node.uuid, (node.tags ?? []).filter(t => t !== tag))}
              >×</span>
            </span>
          ))}
        </div>
        <input
          value={tagDraft}
          onChange={e => setTagDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && tagDraft.trim()) {
              e.preventDefault()
              const trimmed = tagDraft.trim()
              if (!(node.tags ?? []).includes(trimmed)) {
                onTagsUpdate?.(node.uuid, [...(node.tags ?? []), trimmed])
              }
              setTagDraft('')
            }
          }}
          placeholder="태그 입력 후 Enter..."
          style={{
            width: '100%', fontSize: 10, padding: '2px 5px',
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Cocos에 적용 */}
      {onApplyToCocos && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => onApplyToCocos(node)}
            disabled={!connected}
            style={{
              width: '100%',
              background: connected ? 'var(--accent-dim)' : 'none',
              border: `1px solid ${connected ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 3,
              color: connected ? 'var(--accent)' : 'var(--text-muted)',
              cursor: connected ? 'pointer' : 'default',
              fontSize: 9,
              padding: '3px 0',
              opacity: connected ? 1 : 0.5,
            }}
            title={connected ? 'Cocos Creator에 위치/크기 전송' : 'Cocos 미연결'}
          >
            {connected ? '▶ Cocos에 적용' : '⚠ Cocos 미연결'}
          </button>
        </div>
      )}

      {/* 변경 이력 */}
      {history.length > 0 && (
        <>
          <SectionHeader label="변경 이력" />
          <div style={{ fontSize: 8, color: 'var(--text-muted)', padding: '2px 0' }}>
            {history.slice(0, 5).map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '1px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{h.key}</span>
                <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {JSON.stringify(h.val)}</span>
                <span style={{ flexShrink: 0, marginLeft: 'auto', opacity: 0.5 }}>{new Date(h.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* JSON 내보내기 */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => {
            const json = JSON.stringify({
              uuid: node.uuid, name: node.name, active: node.active,
              position: { x: node.x, y: node.y },
              size: { width: node.width, height: node.height },
              anchor: { x: node.anchorX, y: node.anchorY },
              scale: { x: node.scaleX, y: node.scaleY },
              rotation: node.rotation,
              color: node.color,
              components: node.components.map(c => c.type),
            }, null, 2)
            navigator.clipboard.writeText(json)
          }}
          style={{
            width: '100%',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 9,
            padding: '2px 0',
            textAlign: 'center',
          }}
          title="노드 정보를 JSON으로 복사"
        >
          {'{ } JSON 복사'}
        </button>
      </div>
    </div>
  )
}
