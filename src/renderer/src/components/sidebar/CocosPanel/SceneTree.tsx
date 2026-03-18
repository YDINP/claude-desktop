import React, { useState, useEffect, useRef } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'

const NODE_COLOR_PALETTE: { color: string; label: string }[] = [
  { color: '#f87171', label: '빨강' },
  { color: '#fb923c', label: '주황' },
  { color: '#facc15', label: '노랑' },
  { color: '#4ade80', label: '초록' },
  { color: '#60a5fa', label: '파랑' },
  { color: '#a78bfa', label: '보라' },
]

/** 파싱된 CCSceneNode 트리 렌더링 */
export function CCFileSceneTree({
  node, depth, selected, onSelect, onReparent, onAddChild, onDelete, onDuplicate, onToggleActive, hideInactive, favorites, onToggleFavorite, lockedUuids, onToggleLocked, nodeColors, onNodeColorChange, collapsedUuids, onToggleCollapse, highlightQuery, nodeBookmarks, onReorder, multiSelectedUuids, onCtrlSelect, onSortChildren, onRename, onSaveAsPrefab, ancestors, outOfCanvasUuids,
}: {
  node: CCSceneNode
  depth: number
  selected: CCSceneNode | null
  onSelect: (n: CCSceneNode | null) => void
  onReparent?: (dragUuid: string, dropUuid: string) => void
  onAddChild?: (uuid: string) => void
  onDelete?: (uuid: string) => void
  onDuplicate?: (uuid: string) => void
  onToggleActive?: (uuid: string) => void
  hideInactive?: boolean
  favorites?: Set<string>
  onToggleFavorite?: (uuid: string) => void
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  nodeColors?: Record<string, string>
  onNodeColorChange?: (uuid: string, color: string | null) => void
  collapsedUuids?: Set<string>
  onToggleCollapse?: (uuid: string) => void
  highlightQuery?: string
  nodeBookmarks?: Record<string, string>
  /** R1724: 형제 순서 이동 */
  onReorder?: (uuid: string, direction: 1 | -1) => void
  /** R1728: Ctrl+클릭 다중 선택 */
  multiSelectedUuids?: string[]
  onCtrlSelect?: (uuid: string) => void
  /** R1736: 자식 알파벳순 정렬 */
  onSortChildren?: (uuid: string) => void
  /** R2453: 인라인 이름 편집 */
  onRename?: (uuid: string, newName: string) => void
  /** R2463: 노드를 프리팹으로 저장 */
  onSaveAsPrefab?: (uuid: string) => void
  /** R2492: cc.find() 경로 계산용 조상 이름 스택 */
  ancestors?: string[]
  /** R2493: 캔버스 범위 초과 UUID Set — 계층 트리 ⚠️ 뱃지 표시용 */
  outOfCanvasUuids?: Set<string>
}) {
  const [localCollapsed, setLocalCollapsed] = useState(depth > 2)
  const collapsed = collapsedUuids ? collapsedUuids.has(node.uuid) : localCollapsed
  const setCollapsed = onToggleCollapse
    ? (_updater: boolean | ((prev: boolean) => boolean)) => onToggleCollapse(node.uuid)
    : setLocalCollapsed
  const [isDragOver, setIsDragOver] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; showColorPicker?: boolean } | null>(null)
  // R2453: 인라인 이름 편집 상태
  const [editingName, setEditingName] = useState(false)
  const [editNameVal, setEditNameVal] = useState('')
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (editingName && nameInputRef.current) { nameInputRef.current.focus(); nameInputRef.current.select() } }, [editingName])
  const commitNameEdit = () => {
    if (onRename && editNameVal.trim()) onRename(node.uuid, editNameVal.trim())
    setEditingName(false)
  }
  const hasChildren = node.children.length > 0
  const isSelected = selected?.uuid === node.uuid
  const isRoot = depth === 0

  // 비활성 숨기기 (루트 제외)
  if (hideInactive && !node.active && !isRoot && !isSelected) return null

  return (
    <div>
      {ctxMenu && (
        <div
          style={{
            position: 'fixed', zIndex: 9999, left: ctxMenu.x, top: ctxMenu.y,
            background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)',
            borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 120,
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          {[
            { label: '자식 추가', action: () => { setCtxMenu(null); onAddChild?.(node.uuid) } },
            // R1712: 즐겨찾기 토글
            onToggleFavorite ? { label: favorites?.has(node.uuid) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가', action: () => { setCtxMenu(null); onToggleFavorite(node.uuid) } } : null,
            ...(!isRoot ? [
              // R2453: 이름 변경 (더블클릭 또는 컨텍스트 메뉴)
              ...(onRename ? [{ label: '✏️ 이름 변경', action: () => { setCtxMenu(null); setEditNameVal(node.name); setEditingName(true) } }] : []),
              // R2463: 프리팹으로 저장
              ...(onSaveAsPrefab ? [{ label: '🧩 프리팹으로 저장', action: () => { setCtxMenu(null); onSaveAsPrefab(node.uuid) } }] : []),
              { label: node.active ? '비활성화' : '활성화', action: () => { setCtxMenu(null); onToggleActive?.(node.uuid) } },
              // R1712: 자식 일괄 활성/비활성
              ...(hasChildren ? [
                { label: '자식 모두 활성화', action: () => { setCtxMenu(null); node.children.forEach(c => onToggleActive && !c.active && onToggleActive(c.uuid)) } },
                { label: '자식 모두 비활성화', action: () => { setCtxMenu(null); node.children.forEach(c => onToggleActive && c.active && onToggleActive(c.uuid)) } },
                // R1736: 자식 알파벳순 정렬
                ...(onSortChildren ? [{ label: '자식 알파벳순 정렬', action: () => { setCtxMenu(null); onSortChildren(node.uuid) } }] : []),
              ] : []),
              // R1724: 형제 순서 이동
              ...(onReorder ? [
                { label: '▲ 위로 이동', action: () => { setCtxMenu(null); onReorder(node.uuid, -1) } },
                { label: '▼ 아래로 이동', action: () => { setCtxMenu(null); onReorder(node.uuid, 1) } },
              ] : []),
              { label: '복제', action: () => { setCtxMenu(null); onDuplicate?.(node.uuid) } },
              { label: '삭제', action: () => { setCtxMenu(null); onDelete?.(node.uuid) } },
              // R2338: 노드 JSON 복사
              { label: '⎘ JSON 복사', action: () => { setCtxMenu(null); try { navigator.clipboard.writeText(JSON.stringify({ name: node.name, uuid: node.uuid, position: node.position, size: node.size, scale: node.scale, rotation: node.rotation, anchor: node.anchor, opacity: node.opacity, active: node.active, components: node.components.map(c => c.type) }, null, 2)) } catch { /* ignore */ } } },
              // R2492: cc.find() 경로 복사
              ...(ancestors && ancestors.length > 0 ? [{ label: '📋 cc.find() 복사', action: () => { setCtxMenu(null); const path = [...ancestors, node.name].slice(1).join('/'); navigator.clipboard.writeText(`cc.find("${path}")`).catch(() => {}) } }] : []),
            ] : []),
          ].filter(Boolean).map(item => (
            <div key={item.label}
              onClick={item.action}
              style={{
                padding: '6px 12px', fontSize: 11, cursor: 'pointer',
                color: item.label === '삭제' ? '#ff6b6b' : 'var(--text-primary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </div>
          ))}
          {/* 색상 태그 팔레트 */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '5px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>색상 태그</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {NODE_COLOR_PALETTE.map(({ color, label }) => (
                <div
                  key={color}
                  title={label}
                  onClick={() => { onNodeColorChange?.(node.uuid, color); setCtxMenu(null) }}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: color, cursor: 'pointer',
                    border: nodeColors?.[node.uuid] === color ? '2px solid #fff' : '2px solid transparent',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
              <div
                title="초기화"
                onClick={() => { onNodeColorChange?.(node.uuid, null); setCtxMenu(null) }}
                style={{
                  width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'var(--text-muted)', boxSizing: 'border-box',
                }}
              >✕</div>
              {/* R2339: 커스텀 색상 입력 */}
              <input
                type="color"
                value={nodeColors?.[node.uuid] ?? '#ffffff'}
                title="커스텀 색상 선택"
                onChange={e => { onNodeColorChange?.(node.uuid, e.target.value); }}
                onClick={e => e.stopPropagation()}
                style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border)', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              />
            </div>
          </div>
        </div>
      )}
      <div
        id={`tree-node-${node.uuid}`}
        className="tree-node-row"
        draggable={!isRoot}
        onClick={e => {
          setCtxMenu(null)
          // R1728: Ctrl+클릭으로 다중 선택 토글
          if ((e.ctrlKey || e.metaKey) && onCtrlSelect) {
            e.stopPropagation()
            onCtrlSelect(node.uuid)
          } else {
            onSelect(isSelected ? null : node)
          }
        }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onSelect(node); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', node.uuid) }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setIsDragOver(false)
          const dragUuid = e.dataTransfer.getData('text/plain')
          if (dragUuid) onReparent?.(dragUuid, node.uuid)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: `2px 6px 2px ${8 + depth * 14}px`,
          cursor: isRoot ? 'default' : 'grab', fontSize: 11,
          background: isDragOver ? 'rgba(88,166,255,0.18)' : isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : multiSelectedUuids?.includes(node.uuid) ? 'rgba(167,139,250,0.15)' : nodeColors?.[node.uuid] ? `${nodeColors[node.uuid]}26` : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          userSelect: 'none',
          outline: isDragOver ? '1px dashed #58a6ff' : 'none',
          borderLeft: depth > 0 ? `1px solid ${nodeColors?.[node.uuid] ?? 'rgba(255,255,255,0.05)'}` : 'none',
        }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
            style={{ fontSize: 9, width: 12, textAlign: 'center', flexShrink: 0 }}
          >
            {collapsed ? '▸' : '▾'}
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        {nodeColors?.[node.uuid] && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: nodeColors[node.uuid], flexShrink: 0, display: 'inline-block' }} />
        )}
        {/* R2453: 더블클릭/F2 인라인 이름 편집 */}
        {editingName && onRename ? (
          <input
            ref={nameInputRef}
            value={editNameVal}
            onChange={e => setEditNameVal(e.target.value)}
            onBlur={commitNameEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitNameEdit() }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditingName(false) }
            }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 11, background: 'var(--bg-input, #1a1a2e)', border: '1px solid var(--accent)', borderRadius: 2, padding: '0 3px', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
          />
        ) : (
          <span
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            onDoubleClick={e => { if (!isRoot && onRename) { e.preventDefault(); e.stopPropagation(); setEditNameVal(node.name); setEditingName(true) } }}
          >
            {(() => {
              const name = node.name || '(unnamed)'
              const q = highlightQuery?.trim()
              if (!q) return name
              // R2498: /regex/ 구문 하이라이트
              if (q.startsWith('/') && q.length > 1) {
                try {
                  const re = new RegExp(q.slice(1), 'i')
                  const m = re.exec(name)
                  if (!m) return name
                  return <>{name.slice(0, m.index)}<span style={{ background: '#fbbf24', color: '#1a1a2e', borderRadius: 2 }}>{m[0]}</span>{name.slice(m.index + m[0].length)}</>
                } catch { return name }
              }
              const ql = q.toLowerCase()
              const idx = name.toLowerCase().indexOf(ql)
              if (idx < 0) return name
              return <>{name.slice(0, idx)}<span style={{ background: '#fbbf24', color: '#1a1a2e', borderRadius: 2 }}>{name.slice(idx, idx + ql.length)}</span>{name.slice(idx + ql.length)}</>
            })()}
          </span>
        )}
        {/* R1672: 북마크 배지 */}
        {nodeBookmarks && (() => {
          const key = Object.entries(nodeBookmarks).find(([, uuid]) => uuid === node.uuid)?.[0]
          if (!key) return null
          return <span style={{ fontSize: 8, color: '#a78bfa', flexShrink: 0, padding: '0 2px', background: 'rgba(167,139,250,0.15)', borderRadius: 2 }} title={`북마크 키: ${key}`}>{key}</span>
        })()}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleActive?.(node.uuid) }}
            title={node.active ? '비활성화' : '활성화'}
            style={{ fontSize: 9, color: node.active ? 'var(--text-muted)' : '#555', cursor: 'pointer', flexShrink: 0, paddingLeft: 2 }}
          >
            {node.active ? '●' : '○'}
          </span>
        )}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleFavorite?.(node.uuid) }}
            title={favorites?.has(node.uuid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            style={{
              fontSize: 10, cursor: 'pointer', flexShrink: 0,
              color: '#fbbf24',
              opacity: favorites?.has(node.uuid) ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            className={favorites?.has(node.uuid) ? 'fav-star is-fav' : 'fav-star'}
          >★</span>
        )}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleLocked?.(node.uuid) }}
            title={lockedUuids?.has(node.uuid) ? '잠금 해제' : '잠금'}
            style={{
              fontSize: 9, cursor: 'pointer', flexShrink: 0,
              color: '#f87171',
              opacity: lockedUuids?.has(node.uuid) ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            className={lockedUuids?.has(node.uuid) ? 'lock-icon is-locked' : 'lock-icon'}
          >🔒</span>
        )}
        {/* R1747: 자식 노드 수 배지 (collapsed 상태에서만 표시) */}
        {collapsed && hasChildren && (
          <span style={{ fontSize: 8, color: '#555', flexShrink: 0, padding: '0 2px', background: 'rgba(255,255,255,0.05)', borderRadius: 2 }} title={`자식 노드 ${node.children.length}개`}>
            {node.children.length}
          </span>
        )}
        {/* R2493: 캔버스 범위 초과 경고 뱃지 */}
        {outOfCanvasUuids?.has(node.uuid) && (
          <span title="캔버스 범위 초과 노드" style={{ fontSize: 9, flexShrink: 0, color: '#f59e0b', lineHeight: 1 }}>⚠</span>
        )}
        {node.components.length > 0 && (() => {
          const typeIconMap: Record<string, string> = {
            'cc.Sprite': '🖼', 'cc.Label': 'T', 'cc.RichText': 'T',
            'cc.Button': '⊕', 'cc.Canvas': '⊞', 'cc.Layout': '⊟',
            'cc.ScrollView': '⊠', 'cc.Camera': '📷', 'cc.Animation': '▶',
            'cc.AudioSource': '♪', 'cc.ParticleSystem': '✦',
          }
          const icons = node.components
            .map(c => typeIconMap[c.type])
            .filter(Boolean)
          const label = icons.length > 0
            ? icons.join('')
            : node.components[0].type.replace('cc.', '').slice(0, 6)
          return (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }} title={node.components.map(c => c.type).join(', ')}>
              {label}
            </span>
          )
        })()}
      </div>
      {!collapsed && hasChildren && node.children.map(child => (
        <CCFileSceneTree
          key={child.uuid}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
          onReparent={onReparent}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onToggleActive={onToggleActive}
          hideInactive={hideInactive}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          lockedUuids={lockedUuids}
          onToggleLocked={onToggleLocked}
          nodeColors={nodeColors}
          onNodeColorChange={onNodeColorChange}
          collapsedUuids={collapsedUuids}
          onToggleCollapse={onToggleCollapse}
          highlightQuery={highlightQuery}
          nodeBookmarks={nodeBookmarks}
          onReorder={onReorder}
          multiSelectedUuids={multiSelectedUuids}
          onCtrlSelect={onCtrlSelect}
          onSortChildren={onSortChildren}
          onRename={onRename}
          onSaveAsPrefab={onSaveAsPrefab}
          ancestors={[...(ancestors ?? []), node.name]}
          outOfCanvasUuids={outOfCanvasUuids}
        />
      ))}
    </div>
  )
}
