import React from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import type { useNodeInspector } from './useNodeInspector'

interface NodeInspectorHeaderProps {
  ctx: ReturnType<typeof useNodeInspector>
  node: CCSceneNode
  sceneFile: CCSceneFile
  onUpdate: (n: CCSceneNode | null) => void
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  onPulse?: (uuid: string) => void
  pinnedUuids?: Set<string>
  onTogglePin?: (uuid: string, name: string) => void
}

export function NodeInspectorHeader({ ctx, node, sceneFile, onUpdate, saveScene, lockedUuids, onToggleLocked, onPulse, pinnedUuids, onTogglePin }: NodeInspectorHeaderProps) {
  const {
    nodeMemo, saveNodeMemo, draft, msg, saving, isDirty, savedToast, undoStack, redoStack,
    nodePresets, nodePresetOpen, setNodePresetOpen,
    favoriteNodes, setFavoriteNodes, favoritesOpen, setFavoritesOpen,
    stylePresets, presetDropdownOpen, setPresetDropdownOpen,
    saveStylePreset, deleteStylePreset, applyStylePreset,
    saveNodePreset, applyNodePreset, deleteNodePreset, toggleFavoriteNode,
    propSearch, setPropSearch, showPropSearch, setShowPropSearch, dupeCount, setDupeCount,
    handleAddChild, handleDelete, handleDuplicate, handleUndo, handleRedo,
    copyDone, handleCopyTransform, handlePasteTransform, jsonCopyDone, handleCopyNodeJson,
    applyAndSave, nodePath, siblings, inactiveAncestors,
    zOrderInfo, totalDescendants, sameNameNodes, sameNameCount, showSameNameMenu, setShowSameNameMenu,
    handleZOrder, handleZOrderEdge, handleZOrderTo,
    zOrderEditing, setZOrderEditing, zOrderInputVal, setZOrderInputVal,
    secHeader, showHistory, setShowHistory,
  } = ctx
  return (
    <>
      {nodePath.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={nodePath.map(p => p.name).join(' / ')}>
            {/* R1648: breadcrumb 클릭으로 부모 노드 선택 */}
            {nodePath.slice(0, -1).map((p, i) => (
              <span key={i}><span style={{ cursor: 'pointer' }} onClick={() => { const n = sceneFile.root && (function find(r: CCSceneNode): CCSceneNode | null { if (r.uuid === p.uuid) return r; for (const c of r.children) { const f = find(c); if (f) return f } return null })(sceneFile.root); if (n) onUpdate(n) }} onMouseEnter={e => (e.currentTarget.style.color = '#88aacc')} onMouseLeave={e => (e.currentTarget.style.color = '')}>{p.name}</span><span style={{ margin: '0 3px' }}>/</span></span>
            ))}
            <span style={{ color: 'var(--accent)' }}>{nodePath[nodePath.length - 1]?.name}</span>
          </div>
          {/* R2471: cc.find() 경로 클립보드 복사 */}
          {nodePath.length > 1 && (
            <span
              title={`cc.find("${nodePath.slice(1).map(p => p.name).join('/')}") 복사 (R2471)`}
              onClick={() => {
                const path = nodePath.slice(1).map(p => p.name).join('/')
                navigator.clipboard.writeText(`cc.find("${path}")`).catch(() => {})
              }}
              style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid #334', color: '#556', flexShrink: 0, userSelect: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff'; (e.currentTarget as HTMLElement).style.color = '#58a6ff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334'; (e.currentTarget as HTMLElement).style.color = '#556' }}
            >📋</span>
          )}
          {/* R1488: 노드 통계 뱃지 — 깊이/자식/컴포넌트 수 */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0, alignItems: 'center' }}>
            {nodePath.length > 1 && <span style={{ fontSize: 8, color: '#556', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title="깊이 (루트=0)">d{nodePath.length - 1}</span>}
            {draft.children.length > 0 && <span style={{ fontSize: 8, color: '#565', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`자식 노드 ${draft.children.length}개`}>▸{draft.children.length}</span>}
            {/* R1661: 전체 하위 노드 수 */}
            {totalDescendants > draft.children.length && <span style={{ fontSize: 8, color: '#454', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`전체 하위 노드 ${totalDescendants}개`}>⊲{totalDescendants}</span>}
            {draft.components.length > 0 && <span style={{ fontSize: 8, color: '#556a', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`컴포넌트 ${draft.components.length}개`}>⊕{draft.components.length}</span>}
            {/* R2484/R2489: 씬 내 같은 이름 노드 수 + 클릭 목록 */}
            {sameNameCount > 1 && (
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <span
                  style={{ fontSize: 8, color: '#a87', padding: '1px 3px', background: 'rgba(180,120,80,0.12)', borderRadius: 2, cursor: 'pointer', userSelect: 'none' }}
                  title={`씬 내 "${node.name}" 이름 노드 ${sameNameCount}개 — 클릭으로 목록 (R2489)`}
                  onClick={() => setShowSameNameMenu(v => !v)}
                >=×{sameNameCount}</span>
                {showSameNameMenu && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', padding: '4px 0', marginTop: 2 }}
                    onMouseLeave={() => setShowSameNameMenu(false)}
                  >
                    <div style={{ fontSize: 8, color: '#a87', padding: '2px 8px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>"{node.name}" 동명 노드</div>
                    {sameNameNodes.map(n => (
                      <div key={n.uuid} onClick={() => { onUpdate(n); setShowSameNameMenu(false) }}
                        style={{ padding: '3px 8px', fontSize: 9, cursor: 'pointer', color: n.uuid === node.uuid ? '#58a6ff' : 'var(--text-primary)', background: n.uuid === node.uuid ? 'rgba(88,166,255,0.08)' : 'none' }}
                        onMouseEnter={e => { if (n.uuid !== node.uuid) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.uuid === node.uuid ? 'rgba(88,166,255,0.08)' : 'none' }}
                        title={n.uuid}
                      >{n.uuid === node.uuid ? '▸ ' : ''}{n.name} <span style={{ color: '#444', fontSize: 8 }}>{n.uuid.slice(0, 8)}</span></div>
                    ))}
                  </div>
                )}
              </span>
            )}
            {/* R1721: 형제 노드 탐색 버튼 ◀ ▶ */}
            {siblings.length > 1 && (() => {
              const idx = siblings.findIndex(s => s.uuid === node.uuid)
              const prevNode = idx > 0 ? siblings[idx - 1] : null
              const nextNode = idx < siblings.length - 1 ? siblings[idx + 1] : null
              return (
                <>
                  <span title={prevNode ? `이전 형제: ${prevNode.name}` : '이전 형제 없음'}
                    onClick={() => prevNode && onUpdate(prevNode)}
                    style={{ fontSize: 9, padding: '1px 3px', borderRadius: 2, lineHeight: 1, cursor: prevNode ? 'pointer' : 'default', color: prevNode ? '#88aacc' : '#333' }}
                  >◀</span>
                  <span style={{ fontSize: 8, color: '#333' }}>{idx + 1}/{siblings.length}</span>
                  <span title={nextNode ? `다음 형제: ${nextNode.name}` : '다음 형제 없음'}
                    onClick={() => nextNode && onUpdate(nextNode)}
                    style={{ fontSize: 9, padding: '1px 3px', borderRadius: 2, lineHeight: 1, cursor: nextNode ? 'pointer' : 'default', color: nextNode ? '#88aacc' : '#333' }}
                  >▶</span>
                </>
              )
            })()}
            {/* R1492: 경로 복사 버튼 */}
            <span
              title={`경로 복사: ${nodePath.map(p => p.name).join(' / ')}`}
              onClick={() => navigator.clipboard.writeText(nodePath.map(p => p.name).join(' / '))
                .then(() => { /* silent */ })
                .catch(() => { /* silent */ })}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#88aacc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >⎘</span>
            {/* R1663: 잠금 토글 버튼 */}
            {onToggleLocked && (
              <span
                title={lockedUuids?.has(node.uuid) ? '잠금 해제 (편집 가능)' : '잠금 (SceneView 이동/리사이즈 방지)'}
                onClick={() => onToggleLocked(node.uuid)}
                style={{ fontSize: 9, color: lockedUuids?.has(node.uuid) ? '#f97316' : '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = lockedUuids?.has(node.uuid) ? '#fbbf24' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockedUuids?.has(node.uuid) ? '#f97316' : '#445')}
              >{lockedUuids?.has(node.uuid) ? '🔒' : '🔓'}</span>
            )}
            {/* R1666: pulse 미리보기 버튼 */}
            {onPulse && (
              <span
                title="SceneView에서 노드 위치 강조 (pulse)"
                onClick={() => onPulse(node.uuid)}
                style={{ fontSize: 9, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.color = '#445')}
              >✨</span>
            )}
            {/* R2474: 핀 토글 버튼 */}
            {onTogglePin && (
              <span
                title={pinnedUuids?.has(node.uuid) ? '핀 해제 (R2474)' : '씬뷰 핀 바에 고정 (R2474)'}
                onClick={() => onTogglePin(node.uuid, node.name)}
                style={{ fontSize: 9, color: pinnedUuids?.has(node.uuid) ? '#fbbf24' : '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.color = pinnedUuids?.has(node.uuid) ? '#fbbf24' : '#445')}
              >📌</span>
            )}
            {/* R1726: 노드 JSON 복사 버튼 */}
            <span
              title="노드 JSON 클립보드 복사 (R1726)"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).catch(() => {})}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >{'{}'}</span>
            {/* R1607: UUID 복사 버튼 */}
            <span
              title={`UUID 복사: ${node.uuid}`}
              onClick={() => navigator.clipboard.writeText(node.uuid).then(() => { /* silent */ }).catch(() => { /* silent */ })}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1, fontFamily: 'monospace' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7ee787')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >#</span>
          </div>
        </div>
      )}
      {/* R1677: 비활성 조상 경고 배너 + R1742: 일괄 활성화 버튼 */}
      {inactiveAncestors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, padding: '2px 6px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 3 }}>
          <span style={{ fontSize: 9, color: '#fbbf24' }}>⚠</span>
          <span style={{ fontSize: 9, color: '#a8874a', flex: 1 }} title={`비활성 조상: ${inactiveAncestors.join(', ')}`}>
            비활성 조상: {inactiveAncestors.join(', ')}
          </span>
          {/* R1742: 비활성 조상 일괄 활성화 */}
          <span
            title="비활성 조상 모두 활성화"
            onClick={async () => {
              if (!sceneFile?.root) return
              function activatePath(n: CCSceneNode, targetUuid: string): { node: CCSceneNode; found: boolean } {
                if (n.uuid === targetUuid) return { node: n, found: true }
                for (let i = 0; i < n.children.length; i++) {
                  const r = activatePath(n.children[i], targetUuid)
                  if (r.found) {
                    const newChildren = [...n.children]
                    newChildren[i] = r.node
                    return { node: { ...n, active: true, children: newChildren }, found: true }
                  }
                }
                return { node: n, found: false }
              }
              const result = activatePath(sceneFile.root, node.uuid)
              if (result.found) await saveScene(result.node)
            }}
            style={{ fontSize: 8, cursor: 'pointer', color: '#fbbf24', padding: '0 4px', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 2, flexShrink: 0, userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >모두 활성화</span>
        </div>
      )}
      {/* R1637: 같은 이름 노드 자동 배지 (R1642: 클릭으로 순환 선택) */}
      {(() => {
        if (!sceneFile?.root) return null
        const dupes: CCSceneNode[] = []
        const walk = (n: CCSceneNode) => { if (n.name === draft.name) dupes.push(n); n.children.forEach(walk) }
        walk(sceneFile.root)
        if (dupes.length <= 1) return null
        const curIdx = dupes.findIndex(n => n.uuid === node.uuid)
        const nextNode = dupes[(curIdx + 1) % dupes.length]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span
              onClick={() => onUpdate(nextNode)}
              style={{ fontSize: 8, background: 'rgba(255,153,0,0.12)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: 3, padding: '0 4px', color: '#ff9900', cursor: 'pointer' }}
              title={`씬 내 "${draft.name}" 이름의 노드 ${dupes.length}개 — 클릭: 다음 노드 선택`}>⚠ 중복 이름 ×{dupes.length} ›</span>
          </div>
        )
      })()}
      {/* R1651: 씬 내 노드 이름 자동완성 datalist */}
      {(() => {
        const names = new Set<string>()
        const walkNames = (n: CCSceneNode) => { names.add(n.name); n.children.forEach(walkNames) }
        if (sceneFile?.root) walkNames(sceneFile.root)
        return (
          <datalist id={`cc-node-names-${node.uuid}`}>
            {[...names].map(n => <option key={n} value={n} />)}
          </datalist>
        )
      })()}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <input
          defaultValue={draft.name}
          list={`cc-node-names-${node.uuid}`}
          onBlur={e => applyAndSave({ name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyAndSave({ name: (e.target as HTMLInputElement).value }); (e.target as HTMLInputElement).blur() } }}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', flex: 1, minWidth: 0 }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* R683: 프로퍼티 검색 토글 */}
          <button
            onClick={() => { setShowPropSearch(o => !o); if (showPropSearch) setPropSearch('') }}
            title="프로퍼티 검색"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              background: showPropSearch ? 'rgba(88,166,255,0.15)' : 'transparent',
              color: showPropSearch ? '#58a6ff' : '#555',
              border: `1px solid ${showPropSearch ? '#58a6ff' : '#444'}`,
              lineHeight: 1.4,
            }}
          >
            🔍
          </button>
          {/* Round 643: 저장 상태 배지 */}
          {saving
            ? <span title="저장 중" style={{ fontSize: 10, color: '#94a3b8' }}>⏳</span>
            : isDirty
            ? <span title="미저장 변경" style={{ fontSize: 10, color: '#f97316' }}>●</span>
            : savedToast
            ? <span title="저장 완료" style={{ fontSize: 10, color: '#4ade80' }}>✓</span>
            : null}
          {msg && <span style={{ fontSize: 9, color: msg.ok ? '#4ade80' : '#f85149' }}>{msg.text}</span>}
          {/* Round 643: Undo/Redo 버튼 */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="실행 취소 (Undo)"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, lineHeight: 1.4,
              background: 'transparent', border: `1px solid ${undoStack.length === 0 ? '#333' : '#555'}`,
              color: undoStack.length === 0 ? '#333' : '#94a3b8', cursor: undoStack.length === 0 ? 'default' : 'pointer',
            }}
          >↩</button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="다시 실행 (Redo)"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, lineHeight: 1.4,
              background: 'transparent', border: `1px solid ${redoStack.length === 0 ? '#333' : '#555'}`,
              color: redoStack.length === 0 ? '#333' : '#94a3b8', cursor: redoStack.length === 0 ? 'default' : 'pointer',
            }}
          >↪</button>
          {/* R2332: active 토글 — H 키 단축키 힌트 */}
          <label title="노드 활성/비활성 토글 (단축키: H)" style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => applyAndSave({ active: e.target.checked })}
              style={{ margin: 0 }}
            />
            활성<span style={{ fontSize: 8, color: '#444', marginLeft: 1 }}>(H)</span>
          </label>
          {/* Round 635: Transform 복사/붙여넣기 */}
          <button
            onClick={handleCopyTransform}
            title="Transform 복사 (position/rotation/scale/size/anchor/opacity)"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: copyDone ? '#4ade80' : '#94a3b8', border: `1px solid ${copyDone ? '#4ade80' : '#94a3b8'}`,
              lineHeight: 1.4, transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {copyDone ? '✓' : '⎘'}
          </button>
          <button
            onClick={handlePasteTransform}
            title="Transform 붙여넣기"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#94a3b8', border: '1px solid #94a3b8',
              lineHeight: 1.4,
            }}
          >
            📋
          </button>
          {/* R1577: 노드 전체 JSON 복사 */}
          <button
            onClick={handleCopyNodeJson}
            title="노드 전체 JSON 복사 (components 포함)"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: jsonCopyDone ? '#4ade80' : '#94a3b8', border: `1px solid ${jsonCopyDone ? '#4ade80' : '#94a3b8'}`,
              lineHeight: 1.4,
            }}
          >
            {jsonCopyDone ? '✓' : '{}'}
          </button>
          {/* R1600: 같은 이름 노드 찾기 버튼 */}
          <button
            onClick={() => {
              if (!sceneFile?.root) return
              const names: string[] = []
              const walk = (n: CCSceneNode) => { names.push(n.name); n.children.forEach(walk) }
              walk(sceneFile.root)
              const count = names.filter(n => n === draft.name).length
              if (count > 1) alert(`"${draft.name}" 이름의 노드가 씬에 ${count}개 있습니다.`)
              else alert(`"${draft.name}" 이름의 노드는 이 씬에 1개뿐입니다.`)
            }}
            title={`씬 내 같은 이름 노드 찾기 (${draft.name})`}
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#94a3b8', border: '1px solid #94a3b8',
              lineHeight: 1.4,
            }}
          >🔍</button>
          {/* Round 631: 프리셋 저장 / 불러오기 */}
          <button
            onClick={saveStylePreset}
            title="현재 Transform을 프리셋으로 저장"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24',
              lineHeight: 1.4,
            }}
          >
            💾
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPresetDropdownOpen(o => !o)}
              title="저장된 프리셋 불러오기"
              style={{
                padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: presetDropdownOpen ? '#1e1e2e' : 'transparent',
                color: '#60a5fa', border: '1px solid #60a5fa',
                lineHeight: 1.4,
              }}
            >
              📂
            </button>
            {presetDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {stylePresets.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>저장된 프리셋 없음</div>
                ) : stylePresets.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => applyStylePreset(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preset.name}
                    </span>
                    <span
                      onClick={e => deleteStylePreset(preset.id, e)}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="프리셋 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* R673: 노드 프리셋 저장 / 불러오기 */}
          <button
            onClick={saveNodePreset}
            title="현재 노드 프로퍼티를 프리셋으로 저장"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#34d399', border: '1px solid #34d399',
              lineHeight: 1.4,
            }}
          >
            N+
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNodePresetOpen(o => !o)}
              title="저장된 노드 프리셋 불러오기"
              style={{
                padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: nodePresetOpen ? '#1e1e2e' : 'transparent',
                color: '#34d399', border: '1px solid #34d399',
                lineHeight: 1.4,
              }}
            >
              N▾
            </button>
            {nodePresetOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {nodePresets.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>저장된 프리셋 없음</div>
                ) : nodePresets.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => applyNodePreset(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preset.name}
                    </span>
                    <span
                      onClick={e => deleteNodePreset(idx, e)}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="프리셋 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => applyAndSave({
              position: { ...draft.position, x: 0, y: 0 },
              rotation: typeof draft.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: draft.scale.z ?? 1 },
            })}
            title="Transform 리셋 (position 0,0 / rotation 0 / scale 1,1)"
            style={{
              padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#a78bfa', border: '1px solid #a78bfa',
              lineHeight: 1.4,
            }}
          >
            ⟳ Reset
          </button>
          {/* R691: 즐겨찾기 토글 버튼 + 드롭다운 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={toggleFavoriteNode}
              title={favoriteNodes.some(f => f.uuid === node.uuid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              style={{
                padding: '1px 4px', fontSize: 12, borderRadius: 3, cursor: 'pointer',
                background: 'transparent',
                color: favoriteNodes.some(f => f.uuid === node.uuid) ? '#fbbf24' : '#555',
                border: `1px solid ${favoriteNodes.some(f => f.uuid === node.uuid) ? '#fbbf24' : '#444'}`,
                lineHeight: 1.4,
              }}
            >
              {favoriteNodes.some(f => f.uuid === node.uuid) ? '★' : '☆'}
            </button>
            <button
              onClick={() => setFavoritesOpen(o => !o)}
              title="즐겨찾기 목록"
              style={{
                padding: '1px 3px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
                background: favoritesOpen ? '#1e1e2e' : 'transparent',
                color: '#fbbf24', border: '1px solid #555',
                lineHeight: 1.4, marginLeft: 1,
              }}
            >
              ▾
            </button>
            {favoritesOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 180, maxHeight: 280, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {/* R1547: 헤더 */}
                <div style={{ padding: '4px 8px 2px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>즐겨찾기 노드 ({favoriteNodes.length})</span>
                  {favoriteNodes.length > 0 && (
                    <span style={{ cursor: 'pointer', color: '#f85149' }}
                      onClick={() => { setFavoriteNodes([]); localStorage.setItem('favorite-nodes', '[]') }}
                      title="전체 삭제"
                    >전체 삭제</span>
                  )}
                </div>
                {favoriteNodes.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>즐겨찾기 없음</div>
                ) : favoriteNodes.map(fav => {
                  // R1547: 컴포넌트 타입 배지 조회
                  const findNode = (n: CCSceneNode): CCSceneNode | null => {
                    if (n.uuid === fav.uuid) return n
                    for (const c of n.children) { const f = findNode(c); if (f) return f }
                    return null
                  }
                  const favNode = findNode(sceneFile.root)
                  const primaryComp = favNode?.components?.[0]?.type?.replace(/^cc\.|^sp\./, '') ?? null
                  return (
                    <div
                      key={fav.uuid}
                      onClick={() => {
                        if (favNode) onUpdate(favNode)
                        setFavoritesOpen(false)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', cursor: favNode ? 'pointer' : 'default', fontSize: 10,
                        color: fav.uuid === node.uuid ? '#fbbf24' : favNode ? 'var(--text-primary, #ccc)' : 'var(--text-muted)',
                        opacity: favNode ? 1 : 0.5,
                      }}
                      onMouseEnter={e => { if (favNode) e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)' }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title={favNode ? undefined : '노드를 찾을 수 없음 (삭제됨)'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {fav.uuid === node.uuid ? '★ ' : '☆ '}{fav.name}
                      </span>
                      {primaryComp && (
                        <span style={{ marginLeft: 4, fontSize: 8, color: '#58a6ff', background: 'rgba(88,166,255,0.12)', borderRadius: 2, padding: '0 3px', flexShrink: 0 }}>
                          {primaryComp}
                        </span>
                      )}
                      <span
                        onClick={e => {
                          e.stopPropagation()
                          setFavoriteNodes(prev => {
                            const next = prev.filter(f => f.uuid !== fav.uuid)
                            localStorage.setItem('favorite-nodes', JSON.stringify(next))
                            return next
                          })
                        }}
                        style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                        title="즐겨찾기 삭제"
                      >
                        ×
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleAddChild}
            title="자식 노드 추가"
            style={{
              padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#4ade80', border: '1px solid #4ade80',
              lineHeight: 1.4,
            }}
          >
            + 자식
          </button>
          {sceneFile.root?.uuid !== node.uuid && (
            <>
              {zOrderInfo && (
                /* R1738: Z-index 직접 입력 */
                zOrderEditing ? (
                  <input
                    autoFocus
                    type="number"
                    min={1}
                    max={zOrderInfo.total}
                    value={zOrderInputVal}
                    onChange={e => setZOrderInputVal(e.target.value)}
                    onBlur={() => { setZOrderEditing(false) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseInt(zOrderInputVal, 10)
                        if (!isNaN(v)) handleZOrderTo(v)
                        setZOrderEditing(false)
                      } else if (e.key === 'Escape') {
                        setZOrderEditing(false)
                      }
                    }}
                    style={{ width: 36, fontSize: 9, padding: '0 2px', background: 'var(--bg-primary, #0a0a14)', color: '#ccc', border: '1px solid #4a9eff', borderRadius: 2, textAlign: 'center' }}
                  />
                ) : (
                  <span
                    title="클릭하여 Z 위치 직접 입력"
                    onClick={() => { setZOrderInputVal(String(zOrderInfo.idx + 1)); setZOrderEditing(true) }}
                    style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap', cursor: 'text', userSelect: 'none' }}
                  >
                    Z: {zOrderInfo.idx + 1} / {zOrderInfo.total}
                  </span>
                )
              )}
              <button onClick={() => handleZOrderEdge('first')} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="맨 앞으로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤒</button>
              <button onClick={() => handleZOrder(-1)} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="앞으로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↑</button>
              <button onClick={() => handleZOrder(1)} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="뒤로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↓</button>
              <button onClick={() => handleZOrderEdge('last')} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="맨 뒤로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤓</button>
              {/* R2337: N-복제 — 복제 버튼 + 횟수 입력 */}
              <input
                type="number" min={1} max={20} value={dupeCount}
                onChange={e => setDupeCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                title="복제 횟수 (최대 20)"
                style={{ width: 32, fontSize: 10, textAlign: 'center', background: 'var(--bg-primary)', border: '1px solid #336', color: '#58a6ff', borderRadius: 3, padding: '1px 2px' }}
              />
              <button
                onClick={handleDuplicate}
                title={`노드 복제 ×${dupeCount}`}
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#58a6ff', border: '1px solid #58a6ff',
                  lineHeight: 1.4,
                }}
              >
                복제{dupeCount > 1 ? `×${dupeCount}` : ''}
              </button>
              <button
                onClick={handleDelete}
                title="노드 삭제"
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#f85149', border: '1px solid #f85149',
                  lineHeight: 1.4,
                }}
              >
                삭제
              </button>
            </>
          )}
          {/* R699: 변경 이력 토글 버튼 */}
          <button
            onClick={() => setShowHistory(o => !o)}
            title="변경 이력 보기"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              background: showHistory ? 'rgba(88,166,255,0.15)' : 'transparent',
              color: showHistory ? '#58a6ff' : '#555',
              border: `1px solid ${showHistory ? '#58a6ff' : '#444'}`,
              lineHeight: 1.4,
            }}
          >
            📜
          </button>
        </div>
      </div>
      {/* R1702: 노드 UUID 표시 + 복사 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 8, color: '#444', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={node.uuid}>{node.uuid}</span>
        <span
          title="노드 UUID 복사"
          onClick={() => navigator.clipboard.writeText(node.uuid).catch(() => {})}
          style={{ fontSize: 8, cursor: 'pointer', color: '#444', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >⎘</span>
        {/* R2567: 노드 JSON 복사 */}
        <span
          title="노드를 JSON으로 복사 (children 제외) — R2567"
          onClick={() => {
            const { children: _c, ...rest } = draft
            navigator.clipboard.writeText(JSON.stringify(rest, null, 2)).catch(() => {})
          }}
          style={{ fontSize: 8, cursor: 'pointer', color: '#444', flexShrink: 0, padding: '0 2px', border: '1px solid #333', borderRadius: 2 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >{'{}'}</span>
      </div>

      {/* R699: 변경 이력 패널 */}
      {showHistory && (
        <div style={{ marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>변경 이력 ({changeHistory.length})</span>
            {changeHistory.length > 0 && (
              <span
                onClick={() => setChangeHistory([])}
                style={{ fontSize: 9, color: '#f85149', cursor: 'pointer' }}
                title="이력 지우기"
              >
                지우기
              </span>
            )}
          </div>
          {changeHistory.length === 0 ? (
            <div style={{ fontSize: 9, color: '#555', padding: '3px 0' }}>변경 이력이 없습니다.</div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {changeHistory.map((entry, i) => (
                <div key={i} style={{ fontSize: 9, display: 'flex', gap: 4, alignItems: 'flex-start', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <span style={{ color: '#555', flexShrink: 0 }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: '#58a6ff', flexShrink: 0 }}>{entry.prop}</span>
                  <span style={{ color: '#f85149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }} title={JSON.stringify(entry.oldVal)}>
                    {JSON.stringify(entry.oldVal)}
                  </span>
                  <span style={{ color: '#555', flexShrink: 0 }}>→</span>
                  <span style={{ color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }} title={JSON.stringify(entry.newVal)}>
                    {JSON.stringify(entry.newVal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* R683: 프로퍼티 검색창 */}
      {showPropSearch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <input
            autoFocus
            placeholder="프로퍼티 이름 / 값 검색..."
            value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setPropSearch(''); setShowPropSearch(false) } }}
            style={{
              flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 3,
              background: 'var(--bg-input, #1a1a2e)', border: '1px solid var(--accent)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {propSearch && (
            <span
              onClick={() => setPropSearch('')}
              style={{ cursor: 'pointer', color: '#888', fontSize: 12, lineHeight: 1 }}
              title="검색 초기화"
            >
              ×
            </span>
          )}
        </div>
      )}
      {/* R1603: 이벤트 핸들러 표시 */}
      {node.eventHandlers && node.eventHandlers.length > 0 && (
        <div style={{ marginBottom: 4, padding: '3px 6px', background: 'rgba(88,166,255,0.06)', borderRadius: 3, border: '1px solid rgba(88,166,255,0.12)' }}>
          <div style={{ fontSize: 8, color: '#58a6ff', marginBottom: 3 }}>📎 이벤트 핸들러</div>
          {node.eventHandlers.map((eh, i) => (
            <div key={i} style={{ fontSize: 9, display: 'flex', gap: 4, marginBottom: 1, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{eh.component}:{eh.event}</span>
              <span style={{ color: '#555' }}>→</span>
              <span style={{ color: '#7ee787', wordBreak: 'break-all' }}>{eh.handler}</span>
              {eh.target && <span style={{ color: '#555', fontSize: 8 }}>({eh.target})</span>}
            </div>
          ))}
        </div>
      )}
      {/* R1597: 노드 커스텀 메모 */}
      <div style={{ marginBottom: 4 }}>
        <textarea
          placeholder="메모 (이 노드에 대한 개인 노트)"
          value={nodeMemo}
          rows={nodeMemo ? 2 : 1}
          onChange={ev => saveNodeMemo(ev.target.value)}
          style={{ width: '100%', fontSize: 10, resize: 'vertical', background: nodeMemo ? 'rgba(255,255,100,0.05)' : 'transparent', color: '#aaa', border: `1px solid ${nodeMemo ? '#554' : 'transparent'}`, borderRadius: 3, padding: '2px 4px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => (e.currentTarget.style.border = '1px solid #665')}
          onBlur={e => (e.currentTarget.style.border = `1px solid ${nodeMemo ? '#554' : 'transparent'}`)}
        />
      </div>
    </>
  )
}
