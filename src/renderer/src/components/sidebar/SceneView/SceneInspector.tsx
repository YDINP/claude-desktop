import { useState, useEffect, useRef } from 'react'
import type { SceneNode } from './types'
import { getComponentIcon } from './utils'
import { NumInput, SectionHeader, WidgetInspector, SpriteInspector, LabelInspector, ButtonInspector, ProgressBarInspector, LayoutInspector, AnimationInspector, TweenInspector, AudioSourceInspector, AddComponentDropdown } from './InspectorComponents'

interface SceneInspectorProps {
  node: SceneNode | null
  onUpdate: (uuid: string, prop: string, value: number | boolean) => void
  onColorUpdate?: (uuid: string, color: Partial<{ r: number; g: number; b: number; a: number }>) => void
  onClose: () => void
  selectionCount?: number
  // R1413: 다중 선택 UUID 목록 + 일괄 편집 콜백
  multiSelectedUuids?: Set<string>
  onBatchUpdate?: (uuids: string[], updates: Array<{ prop: string; value: number | boolean }>) => void
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
  // R1443: 북마크 패널
  bookmarkedUuids?: Set<string>
  onToggleBookmark?: (uuid: string) => void
  nodeColorTags?: Record<string, string>
  onSelectNode?: (uuid: string) => void
}

// 헥스 변환 헬퍼
const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

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

export function SceneInspector({ node, onUpdate, onColorUpdate, onClose, selectionCount, multiSelectedUuids, onBatchUpdate, onRename, onMemo, onTagsUpdate, onLabelColorUpdate, onApplyToCocos, onComponentClick, connected, nodeMap, onSelectParent, focusNameTrigger, bookmarkedUuids, onToggleBookmark, nodeColorTags, onSelectNode }: SceneInspectorProps) {
  const [isActive, setIsActive] = useState<boolean>(node?.active ?? true)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [uuidCopied, setUuidCopied] = useState(false)
  const [scaleLocked, setScaleLocked] = useState(false)
  const [sizeLocked, setSizeLocked] = useState(false)
  const [memoDraft, setMemoDraft] = useState(node?.memo ?? '')
  const [tagDraft, setTagDraft] = useState('')
  // R1393: 로컬/월드 좌표 토글
  const [coordMode, setCoordMode] = useState<'local' | 'world'>('local')
  // R1411: Inspector 속성 검색 필터
  const [propFilter, setPropFilter] = useState('')
  const propFilterRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<Array<{ key: string; val: unknown; time: number }>>([])

  // R1426: 선택 노드의 전체 경로 (Canvas > Panel > Button)
  const nodePath = (() => {
    if (!node || !nodeMap) return ''
    const parts: string[] = []
    let current: SceneNode | undefined = node
    while (current) {
      parts.unshift(current.name || '(unnamed)')
      // 부모 찾기: nodeMap의 모든 노드에서 childUuids에 current.uuid를 포함하는 노드
      const parentEntry = Array.from(nodeMap.values()).find(n => n.childUuids.includes(current!.uuid))
      current = parentEntry
    }
    return parts.join(' > ')
  })()

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

  // R1413: 다중 선택 시 일괄 편집 UI
  const [batchActive, setBatchActive] = useState<boolean | null>(null)
  const [batchOffsetX, setBatchOffsetX] = useState('0')
  const [batchOffsetY, setBatchOffsetY] = useState('0')
  if (selectionCount !== undefined && selectionCount > 1) {
    const uuids = multiSelectedUuids ? [...multiSelectedUuids] : []
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa' }}>
            {selectionCount}개 노드 선택됨
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>×</button>
        </div>
        {/* Active 일괄 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>active</span>
          <button
            onClick={() => { setBatchActive(true); uuids.forEach(u => onUpdate(u, 'active', true)) }}
            style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', background: batchActive === true ? 'var(--success)' : 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: batchActive === true ? '#fff' : 'var(--text-muted)' }}
          >ON</button>
          <button
            onClick={() => { setBatchActive(false); uuids.forEach(u => onUpdate(u, 'active', false)) }}
            style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', background: batchActive === false ? 'var(--error)' : 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: batchActive === false ? '#fff' : 'var(--text-muted)' }}
          >OFF</button>
        </div>
        {/* Position 오프셋 편집 */}
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>Position 오프셋 (상대 이동)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 16 }}>dX</span>
            <input value={batchOffsetX} onChange={e => setBatchOffsetX(e.target.value)}
              style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 16 }}>dY</span>
            <input value={batchOffsetY} onChange={e => setBatchOffsetY(e.target.value)}
              style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, outline: 'none' }}
            />
          </div>
        </div>
        {/* 일괄 적용 버튼 */}
        <button
          onClick={() => {
            const dx = parseFloat(batchOffsetX) || 0
            const dy = parseFloat(batchOffsetY) || 0
            if (dx === 0 && dy === 0) return
            if (onBatchUpdate && nodeMap) {
              const updates: Array<{ prop: string; value: number | boolean }> = []
              for (const u of uuids) {
                const n = nodeMap.get(u)
                if (!n) continue
                onUpdate(u, 'x', n.x + dx)
                onUpdate(u, 'y', n.y + dy)
              }
            } else {
              for (const u of uuids) {
                const n = nodeMap?.get(u)
                if (!n) continue
                onUpdate(u, 'x', n.x + dx)
                onUpdate(u, 'y', n.y + dy)
              }
            }
            setBatchOffsetX('0')
            setBatchOffsetY('0')
          }}
          style={{
            width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3, cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', border: 'none',
          }}
        >
          일괄 적용
        </button>
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

      {/* R1426: 노드 전체 경로 표시 */}
      {nodePath && (
        <div
          title={nodePath}
          onClick={() => navigator.clipboard.writeText(nodePath)}
          style={{
            fontSize: 8, color: 'var(--text-muted)', padding: '1px 4px', marginBottom: 3,
            background: 'rgba(0,0,0,0.15)', borderRadius: 3, cursor: 'pointer',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {nodePath}
        </div>
      )}

      {/* R1467: 프리팹 인스턴스 뱃지 */}
      {(() => {
        // 노드 raw 데이터에서 __prefab 또는 _prefab 필드 확인
        const hasPrefab = node.components.some(c => {
          if (!c.props) return false
          const p = c.props as Record<string, unknown>
          return p.__prefab != null || p._prefab != null
        }) || (() => {
          // 컴포넌트 props 전체에서 prefab 참조 확인
          for (const c of node.components) {
            if (c.type === 'cc.PrefabInfo' || c.type === 'cc.CompPrefabInfo') return true
          }
          return false
        })()
        if (!hasPrefab) return null
        const prefabUuid = (() => {
          for (const c of node.components) {
            if (!c.props) continue
            const p = c.props as Record<string, unknown>
            const pref = (p.__prefab ?? p._prefab ?? p.fileId ?? p.asset) as { __uuid__?: string } | string | undefined
            if (typeof pref === 'string') return pref.slice(0, 8)
            if (pref && typeof pref === 'object' && pref.__uuid__) return pref.__uuid__.slice(0, 8)
          }
          return '?'
        })()
        return (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
              padding: '2px 6px', background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)', borderRadius: 3,
              cursor: 'pointer', fontSize: 9,
            }}
            title={`프리팹 인스턴스 — 클릭하여 소스 .prefab 하이라이트`}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('cc:open-file', { detail: { uuid: prefabUuid, type: 'prefab' } }))
            }}
          >
            <span>{'\uD83D\uDCE6'}</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>프리팹: {prefabUuid}</span>
            {/* R1467: 오버라이드 표시 placeholder */}
            <span style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--text-muted)', opacity: 0.6 }}>override</span>
          </div>
        )
      })()}

      {/* R1411: 속성 검색 필터 */}
      <div style={{ marginBottom: 4 }}>
        <input
          ref={propFilterRef}
          value={propFilter}
          onChange={e => setPropFilter(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setPropFilter(''); propFilterRef.current?.blur() }; e.stopPropagation() }}
          placeholder="속성 검색..."
          style={{
            width: '100%', fontSize: 9, padding: '2px 5px',
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
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

      {/* R1449: Transform 전체 리셋 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <SectionHeader label="Transform" />
        <button
          onClick={() => {
            trackUpdate(node.uuid, 'x', 0); trackUpdate(node.uuid, 'y', 0)
            trackUpdate(node.uuid, 'rotation', 0)
            trackUpdate(node.uuid, 'scaleX', 1); trackUpdate(node.uuid, 'scaleY', 1)
          }}
          title="R1449: 전체 Transform 리셋 (위치 0,0 / 회전 0 / 스케일 1,1)"
          style={{
            padding: '1px 5px', fontSize: 9, cursor: 'pointer', borderRadius: 3, lineHeight: '14px',
            background: 'none', border: '1px solid var(--border)',
            color: (node.x !== 0 || node.y !== 0 || node.rotation !== 0 || node.scaleX !== 1 || node.scaleY !== 1)
              ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >↺ 전체</button>
      </div>

      {/* R1393: Position — 로컬/월드 좌표 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader label="Position" />
        <div style={{ display: 'flex', gap: 2, marginRight: 2 }}>
          <button
            onClick={() => setCoordMode('local')}
            title="로컬 좌표"
            style={{
              padding: '1px 5px', fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: coordMode === 'local' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: coordMode === 'local' ? '#fff' : 'var(--text-muted)',
              border: '1px solid ' + (coordMode === 'local' ? 'var(--accent)' : 'var(--border)'),
              borderRadius: '3px 0 0 3px', lineHeight: '14px',
            }}
          >L</button>
          <button
            onClick={() => setCoordMode('world')}
            title="월드 좌표 (읽기 전용)"
            style={{
              padding: '1px 5px', fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: coordMode === 'world' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: coordMode === 'world' ? '#fff' : 'var(--text-muted)',
              border: '1px solid ' + (coordMode === 'world' ? 'var(--accent)' : 'var(--border)'),
              borderRadius: '0 3px 3px 0', lineHeight: '14px',
            }}
          >W</button>
        </div>
      </div>
      {coordMode === 'local' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
            <NumInput label="X" value={node.x} uuid={node.uuid} prop="x" onSave={trackUpdate} />
            <NumInput label="Y" value={node.y} uuid={node.uuid} prop="y" onSave={trackUpdate} />
          </div>
          {/* Round179: X, Y 위치를 (0,0)으로 리셋 */}
          <button
            onClick={() => { trackUpdate(node.uuid, 'x', 0); trackUpdate(node.uuid, 'y', 0) }}
            title="R1449: 위치를 (0, 0)으로 리셋"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: (node.x !== 0 || node.y !== 0) ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
          >↺</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>WX</span>
              <span style={{
                flex: 1, padding: '2px 4px', fontSize: 11, fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 3, color: 'var(--text-muted)', cursor: 'default', opacity: 0.8,
              }}>{node.worldX != null ? Math.round(node.worldX * 100) / 100 : '(계산 필요)'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>WY</span>
              <span style={{
                flex: 1, padding: '2px 4px', fontSize: 11, fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 3, color: 'var(--text-muted)', cursor: 'default', opacity: 0.8,
              }}>{node.worldY != null ? Math.round(node.worldY * 100) / 100 : '(계산 필요)'}</span>
            </div>
          </div>
        </div>
      )}

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
        {/* Round181: scale.*1.*1 → 스케일을 (1, 1)로 리셋 */}
        <button
          onClick={() => { trackUpdate(node.uuid, 'scaleX', 1); trackUpdate(node.uuid, 'scaleY', 1) }}
          title="R1449: 스케일을 (1, 1)로 리셋"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: (node.scaleX !== 1 || node.scaleY !== 1) ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >↺</button>
      </div>

      {/* Rotation */}
      <SectionHeader label="Rotation" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1 }}>
          <NumInput label="Rot" value={node.rotation} decimals={2} uuid={node.uuid} prop="rotation" onSave={trackUpdate} />
        </div>
        {/* Round180: rotation.*0 → 회전을 0으로 리셋 */}
        <button
          onClick={() => trackUpdate(node.uuid, 'rotation', 0)}
          title="R1449: 회전을 0으로 리셋"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: node.rotation !== 0 ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
        >↺</button>
      </div>

      {/* R1456: cc.UIOpacity 분리 표시 (CC 3.x UIOpacity / CC 2.x 노드 opacity) */}
      {(() => {
        const uiOpacityComp = node.components.find(c => c.type === 'cc.UIOpacity')
        const opVal = uiOpacityComp
          ? ((uiOpacityComp.props as Record<string, unknown>)?.opacity as number) ?? node.opacity ?? 255
          : node.opacity ?? 255
        const hasUIOpacity = !!uiOpacityComp
        return (
          <>
            <SectionHeader label={hasUIOpacity ? 'UIOpacity' : 'Opacity'} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>alpha</span>
              <input
                type="range" min={0} max={255} step={1}
                value={opVal}
                onChange={e => {
                  const v = parseInt(e.target.value)
                  if (hasUIOpacity) {
                    const newComps = node.components.map(c =>
                      c.type === 'cc.UIOpacity' ? { ...c, props: { ...c.props, opacity: v } } : c
                    )
                    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                  }
                  trackUpdate(node.uuid, 'opacity', v)
                }}
                style={{ flex: 1, height: 4, accentColor: 'var(--accent)', cursor: 'pointer', minWidth: 0 }}
              />
              <span style={{ fontSize: 9, color: opVal < 255 ? 'var(--accent)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 26, textAlign: 'right' }}>
                {opVal}
              </span>
            </div>
          </>
        )
      })()}

      {/* R1456: cc.UITransform 분리 표시 (CC 3.x contentSize + anchorPoint) */}
      {(() => {
        const uiTransComp = node.components.find(c => c.type === 'cc.UITransform')
        if (!uiTransComp?.props) return null
        const tp = uiTransComp.props as Record<string, unknown>
        const cs = tp.contentSize as { width?: number; height?: number } | undefined
        const ap = tp.anchorPoint as { x?: number; y?: number } | undefined
        const csW = cs?.width ?? (tp._contentSize as { width?: number })?.width ?? node.width ?? 0
        const csH = cs?.height ?? (tp._contentSize as { height?: number })?.height ?? node.height ?? 0
        const apX = ap?.x ?? (tp._anchorPoint as { x?: number })?.x ?? node.anchorX ?? 0.5
        const apY = ap?.y ?? (tp._anchorPoint as { y?: number })?.y ?? node.anchorY ?? 0.5
        const onUiTransPropChange = (key: string, value: number) => {
          const newComps = node.components.map(c => {
            if (c.type !== 'cc.UITransform') return c
            const p = { ...c.props } as Record<string, unknown>
            if (key === 'csW' || key === 'csH') {
              const curCs = (p.contentSize ?? p._contentSize ?? { width: csW, height: csH }) as { width: number; height: number }
              const newCs = { ...curCs, [key === 'csW' ? 'width' : 'height']: value }
              p.contentSize = newCs; p._contentSize = newCs
            } else if (key === 'apX' || key === 'apY') {
              const curAp = (p.anchorPoint ?? p._anchorPoint ?? { x: apX, y: apY }) as { x: number; y: number }
              const newAp = { ...curAp, [key === 'apX' ? 'x' : 'y']: value }
              p.anchorPoint = newAp; p._anchorPoint = newAp
            }
            return { ...c, props: p }
          })
          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
          // 노드 자체 속성도 동기화
          if (key === 'csW') trackUpdate(node.uuid, 'width', value)
          if (key === 'csH') trackUpdate(node.uuid, 'height', value)
          if (key === 'apX') trackUpdate(node.uuid, 'anchorX', value)
          if (key === 'apY') trackUpdate(node.uuid, 'anchorY', value)
        }
        return (
          <>
            <SectionHeader label="UITransform" />
            <div style={{ fontSize: 9, padding: '2px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
                <NumInput label="W" value={csW} uuid={node.uuid} prop="uitrans.csW"
                  onSave={(_u, _p, v) => onUiTransPropChange('csW', v)} />
                <NumInput label="H" value={csH} uuid={node.uuid} prop="uitrans.csH"
                  onSave={(_u, _p, v) => onUiTransPropChange('csH', v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px', marginTop: 2 }}>
                <NumInput label="aX" value={apX} decimals={2} uuid={node.uuid} prop="uitrans.apX"
                  onSave={(_u, _p, v) => onUiTransPropChange('apX', v)} />
                <NumInput label="aY" value={apY} decimals={2} uuid={node.uuid} prop="uitrans.apY"
                  onSave={(_u, _p, v) => onUiTransPropChange('apY', v)} />
              </div>
            </div>
          </>
        )
      })()}

      {/* R1453: 이벤트 핸들러 목록 (읽기전용) */}
      {node.eventHandlers && node.eventHandlers.length > 0 && (
        <>
          <SectionHeader label="Events" />
          <div style={{ fontSize: 9, padding: '2px 0' }}>
            {node.eventHandlers.map((eh, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 3px', borderRadius: 3 }}>
                <span style={{ color: 'var(--accent)', fontSize: 8, flexShrink: 0 }}>{'\uD83D\uDD14'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 8, flexShrink: 0 }}>{eh.component.replace('cc.', '')}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: 9 }}>{eh.handler}</span>
                {eh.target && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    → {eh.target}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Anchor */}
      <SectionHeader label="Anchor" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <NumInput label="Ax" value={node.anchorX} decimals={2} uuid={node.uuid} prop="anchorX" onSave={trackUpdate} />
          <NumInput label="Ay" value={node.anchorY} decimals={2} uuid={node.uuid} prop="anchorY" onSave={trackUpdate} />
        </div>
        {/* Round182: onUpdate(node.uuid, 'anchorX', 0.5) → 앵커를 0.5로 초기화 */}
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

      {/* R1405: 컴포넌트 목록 (순서 변경 ↑↓ 버튼) — R1411: propFilter 적용 */}
      {node.components.length > 0 && (() => {
        const pf = propFilter.toLowerCase().trim()
        const filteredComps = pf
          ? node.components.filter(c => {
              if (c.type.toLowerCase().includes(pf)) return true
              if (c.props) {
                for (const [k, v] of Object.entries(c.props as Record<string, unknown>)) {
                  if (k.toLowerCase().includes(pf)) return true
                  if (v != null && String(v).toLowerCase().includes(pf)) return true
                }
              }
              return false
            })
          : node.components
        if (filteredComps.length === 0 && pf) return null
        return (
        <>
          <SectionHeader label="Components" />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.9 }}>
            {filteredComps.map((c, _fi) => {
              const i = node.components.indexOf(c)
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
                  onMouseEnter={e => { if (onComponentClick) (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.1)' }}
                  onMouseLeave={e => { if (onComponentClick) (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  {icon && (
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 8, width: 10, flexShrink: 0 }}>
                      {icon}
                    </span>
                  )}
                  <span
                    style={{ flex: 1, cursor: onComponentClick ? 'pointer' : undefined }}
                    onClick={() => onComponentClick?.(node.uuid)}
                    title={onComponentClick ? '씬뷰에서 하이라이트' : undefined}
                  >{c.type}</span>
                  {/* R1436: 컴포넌트 복사 버튼 */}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(JSON.stringify({ type: c.type, props: c.props ?? {} }))
                    }}
                    title="컴포넌트 JSON 복사"
                    style={{
                      fontSize: 8, padding: '0 2px', background: 'none', border: '1px solid var(--border)',
                      borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: '12px', flexShrink: 0,
                    }}
                  >{'\u{1F4CB}'}</button>
                  {/* R1436: 컴포넌트 붙여넣기 버튼 */}
                  <button
                    onClick={async e => {
                      e.stopPropagation()
                      try {
                        const text = await navigator.clipboard.readText()
                        const data = JSON.parse(text) as { type?: string; props?: Record<string, unknown> }
                        if (!data.type) return
                        const exists = node.components.some(ec => ec.type === data.type)
                        if (exists && !confirm(`"${data.type}" 컴포넌트가 이미 존재합니다. 중복 추가하시겠습니까?`)) return
                        const newComps = [...node.components, { type: data.type, props: data.props ?? {} }]
                        onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                      } catch { /* invalid clipboard */ }
                    }}
                    title="클립보드에서 컴포넌트 붙여넣기"
                    style={{
                      fontSize: 8, padding: '0 2px', background: 'none', border: '1px solid var(--border)',
                      borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: '12px', flexShrink: 0,
                    }}
                  >{'\u{1F4E5}'}</button>
                  {/* R1405: 순서 변경 버튼 */}
                  {node.components.length > 1 && (
                    <span style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                      <button
                        disabled={i === 0}
                        onClick={e => {
                          e.stopPropagation()
                          const newComps = [...node.components]
                          ;[newComps[i - 1], newComps[i]] = [newComps[i], newComps[i - 1]]
                          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                        }}
                        title="위로 이동"
                        style={{
                          fontSize: 8, padding: '0 2px', background: 'none', border: '1px solid var(--border)',
                          borderRadius: 2, color: i === 0 ? 'var(--border)' : 'var(--text-muted)',
                          cursor: i === 0 ? 'default' : 'pointer', lineHeight: '12px',
                        }}
                      >{'\u2191'}</button>
                      <button
                        disabled={i === node.components.length - 1}
                        onClick={e => {
                          e.stopPropagation()
                          const newComps = [...node.components]
                          ;[newComps[i], newComps[i + 1]] = [newComps[i + 1], newComps[i]]
                          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                        }}
                        title="아래로 이동"
                        style={{
                          fontSize: 8, padding: '0 2px', background: 'none', border: '1px solid var(--border)',
                          borderRadius: 2, color: i === node.components.length - 1 ? 'var(--border)' : 'var(--text-muted)',
                          cursor: i === node.components.length - 1 ? 'default' : 'pointer', lineHeight: '12px',
                        }}
                      >{'\u2193'}</button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
        )
      })()}

      {/* R1402: 컴포넌트 props 내 노드 참조 필드 표시 */}
      {node.components.length > 0 && (() => {
        const refs: { comp: string; key: string; display: string }[] = []
        for (const c of node.components) {
          if (!c.props) continue
          for (const [k, v] of Object.entries(c.props as Record<string, unknown>)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              const obj = v as Record<string, unknown>
              if (typeof obj.__id__ === 'number') {
                refs.push({ comp: c.type.replace('cc.', ''), key: k, display: `#${obj.__id__}` })
              } else if (typeof obj.__uuid__ === 'string') {
                const uuid = obj.__uuid__ as string
                refs.push({ comp: c.type.replace('cc.', ''), key: k, display: uuid.length > 8 ? uuid.slice(0, 8) + '...' : uuid })
              }
            }
          }
        }
        if (refs.length === 0) return null
        return (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, padding: '2px 3px' }}>
            {refs.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <span style={{ color: 'var(--accent)', fontSize: 8 }}>{'\uD83D\uDD17'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{r.comp}.{r.key}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'var(--text-muted)' }}>{r.display}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* R1368: cc.Widget alignMode 속성 편집 */}
      <WidgetInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1374: cc.Sprite openFileDialog 에셋 피커 */}
      <SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1417: cc.Label — Label (Font) sysFont spacingX spacingY overflow */}
      <LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1420: cc.Button interactable transition enableAutoGrayEffect duration normalColor */}
      <ButtonInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1425: cc.ProgressBar cc.Slider progress totalLength reverse */}
      <ProgressBarInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1375: cc.Layout paddingTop spacingX resizeMode 속성 편집 */}
      <LayoutInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1384: cc.Animation defaultClip clips 타임라인 미리보기 */}
      {/* R1429: 타임라인 barW maxDuration cc.Tween easing */}
      <AnimationInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
      <TweenInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1387: cc.AudioSource volume loop playOnLoad preload */}
      <AudioSourceInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

      {/* R1372: ADDABLE_COMPONENTS 컴포넌트 추가 드롭다운 */}
      <AddComponentDropdown node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />

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

      {/* R1468: AI 분석 요청 버튼 */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => {
            const comps = node.components.map(c => c.type).join(', ')
            const msg = `이 Cocos Creator 노드를 분석해줘:\n노드: ${node.name}\n컴포넌트: ${comps}\n주요 속성: position=(${node.x},${node.y}), size=(${node.width},${node.height}), active=${node.active}, opacity=${node.opacity}`
            window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { message: msg } }))
          }}
          style={{
            width: '100%',
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 3,
            color: '#a78bfa',
            cursor: 'pointer',
            fontSize: 9,
            padding: '3px 0',
          }}
          title="선택 노드 정보를 Claude 채팅창에 프리필"
        >
          {'\uD83E\uDD16'} AI 분석
        </button>
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

      {/* R1443: 북마크 패널 */}
      {bookmarkedUuids && onToggleBookmark && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <SectionHeader label="북마크" />
            <button
              onClick={() => onToggleBookmark(node.uuid)}
              title={bookmarkedUuids.has(node.uuid) ? '북마크 해제' : '북마크 추가'}
              style={{
                fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: bookmarkedUuids.has(node.uuid) ? '#fbbf24' : 'var(--text-muted)',
              }}
            >
              {bookmarkedUuids.has(node.uuid) ? '\u2605' : '\u2606'}
            </button>
          </div>
          {bookmarkedUuids.size > 0 && (
            <div style={{ maxHeight: 100, overflowY: 'auto' }}>
              {[...bookmarkedUuids].map(uuid => {
                const bmNode = nodeMap?.get(uuid)
                if (!bmNode) return null
                const tagColor = nodeColorTags?.[uuid]
                return (
                  <div
                    key={uuid}
                    onClick={() => onSelectNode?.(uuid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px',
                      fontSize: 9, cursor: 'pointer', borderRadius: 3,
                      background: uuid === node.uuid ? 'rgba(88,166,255,0.12)' : undefined,
                    }}
                    onMouseEnter={e => { if (uuid !== node.uuid) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (uuid !== node.uuid) (e.currentTarget as HTMLElement).style.background = '' }}
                  >
                    {tagColor && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tagColor, flexShrink: 0 }} />
                    )}
                    <span style={{ color: '#fbbf24', flexShrink: 0, fontSize: 8 }}>{'\u2605'}</span>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--text-primary)',
                    }}>
                      {bmNode.name || '(unnamed)'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {bookmarkedUuids.size === 0 && (
            <div style={{ fontSize: 8, color: 'var(--text-muted)', padding: '2px 4px' }}>
              {'\u2606'} 버튼으로 노드를 북마크하세요
            </div>
          )}
        </div>
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
