import type { FlatNode } from './ccSceneTypes'

export interface CCSceneContextMenuProps {
  ctxMenu: { x: number; y: number; uuid: string | null }
  flatNodes: FlatNode[]
  lockedUuids: Set<string>
  selectedUuid: string | null
  onClose: () => void
  toggleLock: (uuid: string) => void
  handleFit: () => void
  handleFitToSelected: () => void
  onSelect: (uuid: string | null) => void
  setMultiSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  onToggleActive?: (uuid: string) => void
  onAddNode?: (parentUuid: string | null, pos?: { x: number; y: number }) => void
}

export function CCSceneContextMenu({
  ctxMenu, flatNodes, lockedUuids, selectedUuid,
  onClose, toggleLock, handleFit, handleFitToSelected,
  onSelect, setMultiSelected, onToggleActive, onAddNode,
}: CCSceneContextMenuProps) {
  return (
    <div
      style={{
        position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 100,
        background: '#0d0d1a', border: '1px solid #2a2a3a', borderRadius: 5,
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)', minWidth: 140, padding: '3px 0',
      }}
      onMouseLeave={onClose}
    >
      {[
        ctxMenu.uuid && { label: '복사 (Ctrl+C)', action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })) } },
        ctxMenu.uuid && { label: '붙여넣기 (Ctrl+V)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })) },
        ctxMenu.uuid && { label: '복제 (Ctrl+D)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true })) },
        ctxMenu.uuid && { label: '삭제 (Del)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })) },
        ctxMenu.uuid && { label: lockedUuids.has(ctxMenu.uuid) ? '🔓 잠금 해제' : '🔒 잠금', action: () => { toggleLock(ctxMenu.uuid!); onClose() } },
        { label: '전체 보기 (F)', action: () => handleFit() },
        ctxMenu.uuid && { label: '포커스 (F)', action: () => handleFitToSelected() },
        ctxMenu.uuid && { label: 'AI 분석 ✦', action: () => {
          const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
          if (!fn) return
          const info = `노드 "${fn.node.name}" 분석 요청:\n- 위치: (${fn.worldX.toFixed(1)}, ${fn.worldY.toFixed(1)})\n- 크기: ${fn.node.size ? `${fn.node.size.x}×${fn.node.size.y}` : '없음'}\n- 컴포넌트: ${fn.node.components.map(c => c.type.replace('cc.','')).join(', ') || '없음'}`
          window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { text: info } }))
        }},
        // R1621: 같은 컴포넌트 타입 노드 모두 선택
        ctxMenu.uuid && (() => {
          const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
          const firstType = fn?.node.components?.[0]?.type
          if (!firstType) return false
          return { label: `같은 "${firstType.replace('cc.', '')}" 모두 선택`, action: () => {
            const matched = flatNodes.filter(f => f.node.components?.[0]?.type === firstType).map(f => f.node.uuid)
            setMultiSelected(new Set(matched))
            if (matched.length > 0) onSelect(matched[0])
          }}
        })(),
        // R2590: 동일 이름 노드 모두 선택
        ctxMenu.uuid && (() => {
          const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
          if (!fn) return false
          const count = flatNodes.filter(f => f.node.name === fn.node.name).length
          if (count < 2) return false
          return { label: `"${fn.node.name}" 동일 이름 모두 선택 (${count}개)`, action: () => {
            const matched = flatNodes.filter(f => f.node.name === fn.node.name).map(f => f.node.uuid)
            setMultiSelected(new Set(matched))
            if (matched.length > 0) onSelect(matched[0])
            onClose()
          }}
        })(),
        // R1717: 활성/비활성 토글 + 새 노드 추가
        ctxMenu.uuid && (() => {
          const fn = flatNodes.find(f => f.node.uuid === ctxMenu.uuid)
          if (!fn) return false
          return { label: fn.node.active ? '◌ 비활성화 (H키)' : '● 활성화 (H키)', action: () => { onToggleActive?.(fn.node.uuid); onClose() } }
        })(),
        { label: '＋ 새 노드 추가 (Ctrl+N)', action: () => { onAddNode?.(ctxMenu.uuid ?? selectedUuid, undefined); onClose() } },
      ].filter(Boolean).map((item, i) => (
        item ? (
          <div
            key={i}
            onClick={() => { item.action(); onClose() }}
            style={{ padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: item.label.includes('AI') ? '#a78bfa' : 'var(--text-primary, #ccc)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {item.label}
          </div>
        ) : null
      ))}
    </div>
  )
}

export interface CCSceneNodePickMenuProps {
  nodePickMenu: { x: number; y: number; nodes: Array<{ uuid: string; name: string }> }
  nodePickMenuRef: React.RefObject<HTMLDivElement | null>
  onSelect: (uuid: string | null) => void
  onClose: () => void
}

export function CCSceneNodePickMenu({ nodePickMenu, nodePickMenuRef, onSelect, onClose }: CCSceneNodePickMenuProps) {
  return (
    <div ref={nodePickMenuRef} style={{
      position: 'fixed', left: nodePickMenu.x, top: nodePickMenu.y, zIndex: 1000,
      background: 'rgba(10,14,28,0.97)', border: '1px solid rgba(88,166,255,0.3)',
      borderRadius: 5, padding: '4px 0', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      fontSize: 10,
    }}>
      <div style={{ padding: '2px 10px 4px', fontSize: 9, color: '#556', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 2 }}>
        노드 선택 ({nodePickMenu.nodes.length})
      </div>
      {nodePickMenu.nodes.map(n => (
        <div
          key={n.uuid}
          onClick={() => { onSelect?.(n.uuid); onClose() }}
          style={{ padding: '3px 10px', cursor: 'pointer', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >{n.name}</div>
      ))}
    </div>
  )
}
