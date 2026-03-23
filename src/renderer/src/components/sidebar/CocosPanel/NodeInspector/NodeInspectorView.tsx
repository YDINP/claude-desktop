import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { SpriteThumb, COMP_ICONS, COMP_DESCRIPTIONS, COLLAPSED_COMPS_KEY, PROP_HISTORY_KEY } from './constants'
import { ComponentQuickEdit } from './ComponentQuickEdit'
import { GenericPropertyEditor } from './GenericPropertyEditor'
import { useNodeInspector } from './useNodeInspector'
import { NodeInspectorHeader } from './NodeInspectorHeader'
import { NodeTransformSection } from './NodeTransformSection'

export { SpriteThumb, COMP_ICONS, COMP_DESCRIPTIONS }

/** CCSceneNode 프로퍼티 인스펙터 — 노드 선택 시 표시 */
export function CCFileNodeInspector({
  node, sceneFile, saveScene, onUpdate, lockedUuids, onToggleLocked, onPulse, pinnedUuids, onTogglePin,
}: {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  onPulse?: (uuid: string) => void
  /** R2474: 핀 노드 */
  pinnedUuids?: Set<string>
  onTogglePin?: (uuid: string, name: string) => void
}) {
  const ctx = useNodeInspector({ node, sceneFile, saveScene, onUpdate })
  const {
    recentAddedComps, trackAddComp, origSnapRef, draft,
    savedToast, collapsed, collapsedComps, setCollapsedComps,
    expandedArrayProps, setExpandedArrayProps,
    jsonEditMode, setJsonEditMode, jsonEditText, setJsonEditText, jsonEditErr, setJsonEditErr,
    cliVal, setCliVal, cliMsg, setCliMsg, secHeader,
    propSearch, setPropSearch, propHistory, setPropHistory, historyOpen, setHistoryOpen,
    favProps, toggleFavProp,
    copiedCompRef, compCopied, setCompCopied,
    draggingIdx, setDraggingIdx, dragOverIdx, setDragOverIdx,
    sameCompPopup, setSameCompPopup, rotation,
    applyAndSave, compTypeCountMap,
  } = ctx
  const is3x = sceneFile.projectInfo?.version === '3x'
  const [assetDragOver, setAssetDragOver] = React.useState(false)
  const similarNodes = React.useMemo(() => {
    if (!sceneFile?.root || draft.components.length === 0) return []
    const myTypes = new Set(draft.components.map(c => c.type))
    const similar: Array<{ node: CCSceneNode; overlap: number }> = []
    function walkSim(n: CCSceneNode) {
      if (n.uuid !== node.uuid) {
        const overlap = n.components.filter(c => myTypes.has(c.type)).length
        if (overlap > 0) similar.push({ node: n, overlap })
      }
      n.children.forEach(walkSim)
    }
    walkSim(sceneFile.root)
    similar.sort((a, b) => b.overlap - a.overlap)
    return similar.slice(0, 5)
  }, [sceneFile?.root, draft.components, node.uuid])
  return (
    <div
      onDragOver={e => {
        if (e.dataTransfer.types.includes('application/cc-asset')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setAssetDragOver(true)
        }
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setAssetDragOver(false)
        }
      }}
      onDrop={e => {
        e.preventDefault()
        setAssetDragOver(false)
        try {
          const raw = e.dataTransfer.getData('application/cc-asset')
          if (!raw) return
          const data: { uuid?: string; path?: string; relPath?: string; type?: string } = JSON.parse(raw)
          if (!data.uuid) return

          const relPath = data.relPath ?? ''
          const assetType = data.type ?? ''
          const ext = relPath.split('.').pop()?.toLowerCase() ?? ''

          if (assetType === 'script' || ext === 'ts' || ext === 'js') {
            const scriptName = relPath.split('/').pop()?.replace(/\.(ts|js)$/, '') ?? 'Script'
            const newComp: CCSceneComponent = { type: scriptName, props: { enabled: true } }
            applyAndSave({ components: [...draft.components, newComp] })
            return
          }

          if (assetType === 'texture' || assetType === 'sprite-atlas' || ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
            const spriteComp = draft.components.find(c => c.type.includes('Sprite'))
            if (spriteComp) {
              const spriteKey = '_spriteFrame' in spriteComp.props ? '_spriteFrame' : 'spriteFrame'
              applyAndSave({
                components: draft.components.map(c =>
                  c === spriteComp
                    ? { ...c, props: { ...c.props, [spriteKey]: { __uuid__: data.uuid } } }
                    : c
                )
              })
            } else {
              const spriteKey = is3x ? 'spriteFrame' : '_spriteFrame'
              applyAndSave({
                components: [...draft.components, {
                  type: 'cc.Sprite',
                  props: { enabled: true, [spriteKey]: { __uuid__: data.uuid } }
                }]
              })
            }
            return
          }

          if (assetType === 'font' || ['ttf', 'otf', 'fnt', 'ttc'].includes(ext)) {
            const labelComp = draft.components.find(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
            if (labelComp) {
              const fontKey = is3x ? 'font' : '_N$file'
              applyAndSave({
                components: draft.components.map(c =>
                  c === labelComp
                    ? { ...c, props: { ...c.props, [fontKey]: { __uuid__: data.uuid }, font: { __uuid__: data.uuid } } }
                    : c
                )
              })
            } else {
              applyAndSave({
                components: [...draft.components, {
                  type: 'cc.Label',
                  props: { enabled: true, font: { __uuid__: data.uuid }, _N$file: { __uuid__: data.uuid }, _string: 'Label' }
                }]
              })
            }
            return
          }
        } catch (err) {
          console.warn('Inspector asset drop error:', err)
        }
      }}
      style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 12px 12px',
        background: assetDragOver ? 'rgba(88,166,255,0.05)' : 'var(--bg-secondary, #0d0d1a)',
        minWidth: 0, width: '100%', boxSizing: 'border-box',
        outline: assetDragOver ? '2px dashed rgba(88,166,255,0.5)' : 'none',
        outlineOffset: -2,
        transition: 'background 0.1s, outline 0.1s',
      }}
    >
      <NodeInspectorHeader ctx={ctx} node={node} sceneFile={sceneFile} onUpdate={onUpdate} saveScene={saveScene} lockedUuids={lockedUuids} onToggleLocked={onToggleLocked} onPulse={onPulse} pinnedUuids={pinnedUuids} onTogglePin={onTogglePin} />
      <NodeTransformSection ctx={ctx} is3x={is3x} />

      {/* 컴포넌트 props */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>{secHeader('comps', `컴포넌트 (${draft.components.length})`)}</div>
        {/* R1689: 컴포넌트 일괄 접기/펴기 */}
        {!collapsed['comps'] && draft.components.length > 1 && (
          <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
            <span title="모두 접기" onClick={() => { const allTypes = draft.components.map(c => c.type); setCollapsedComps(prev => { const n = new Set(prev); allTypes.forEach(t => n.add(t)); localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n])); return n }) }} style={{ fontSize: 8, cursor: 'pointer', color: '#555', padding: '0 3px' }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>▸▸</span>
            <span title="모두 펴기" onClick={() => { const allTypes = draft.components.map(c => c.type); setCollapsedComps(prev => { const n = new Set(prev); allTypes.forEach(t => n.delete(t)); localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n])); return n }) }} style={{ fontSize: 8, cursor: 'pointer', color: '#555', padding: '0 3px' }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>▾▾</span>
            {/* R1704: 전체 컴포넌트 enabled 토글 */}
            {(() => {
              const allEnabled = draft.components.every(c => c.props.enabled !== false)
              return (
                <span
                  title={allEnabled ? '모든 컴포넌트 비활성화 (R1704)' : '모든 컴포넌트 활성화 (R1704)'}
                  onClick={() => {
                    const updated = draft.components.map(c => ({ ...c, props: { ...c.props, enabled: !allEnabled, _enabled: !allEnabled } }))
                    applyAndSave({ components: updated })
                  }}
                  style={{ fontSize: 8, cursor: 'pointer', color: allEnabled ? '#555' : '#fbbf24', padding: '0 3px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = allEnabled ? '#aaa' : '#f59e0b')}
                  onMouseLeave={e => (e.currentTarget.style.color = allEnabled ? '#555' : '#fbbf24')}
                >{allEnabled ? '⏸' : '▶'}</span>
              )
            })()}
          </div>
        )}
      </div>
      {/* R1536: PropSearch 키 하이라이트 헬퍼 */}
      {!collapsed['comps'] && (() => {
        const skipTypes = ['cc.UITransform', 'cc.PrefabInfo', 'cc.CompPrefabInfo', 'cc.SceneGlobals', 'cc.AmbientInfo', 'cc.ShadowsInfo', 'cc.FogInfo', 'cc.OctreeInfo', 'cc.SkyboxInfo']
        // R1473: 커스텀 스크립트 컴포넌트 (cc. 접두사 없는 타입) 항상 표시
        const isCustomScript = (type: string) => !type.startsWith('cc.') && !type.startsWith('cc-') && type !== ''
        // UUID를 스크립트 이름으로 변환
        // IS_UUID regex 제거: CC 2.x Base62 UUID(a2VdBXYC 등 비-hex 포함)는 hex regex로 매칭 불가
        // → dot 없는 타입은 scriptNames 맵에서 직접 조회, 없으면 그대로 표시
        const resolveScriptName = (type: string): string => {
          if (type.includes('.')) return type
          return sceneFile.scriptNames?.[type] ?? type
        }
        const visibleComps = draft.components.map((c, origIdx) => ({ comp: c, origIdx })).filter(({ comp: c }) => {
          if (skipTypes.includes(c.type)) return false
          if (isCustomScript(c.type)) return true // 커스텀 스크립트는 props 여부 무관 표시
          return Object.values(c.props).some(v => {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true
            if (v && typeof v === 'object') {
              if ('__uuid__' in (v as object)) return true
              const keys = Object.keys(v as object).filter(k => typeof (v as Record<string, unknown>)[k] === 'number')
              if (keys.length >= 2 && keys.length <= 3) return true
            }
            return false
          })
        })
        // propSearch로 컴포넌트 타입 매칭: 해당 타입은 전체 표시 (자동 펼침)
        const typeMatchedComps = propSearch
          ? visibleComps.filter(({ comp: c }) => c.type.toLowerCase().includes(propSearch.toLowerCase()))
          : null
        const showComps = typeMatchedComps ?? visibleComps
        return (
        <>
        {/* R1608: 컴포넌트 퀵점프 칩 바 */}
        {showComps.length > 3 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '2px 0 4px' }}>
            {showComps.map(({ comp, origIdx: oi }) => (
              <span key={oi}
                onClick={() => document.getElementById(`cc-comp-${node.uuid}-${oi}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                style={{ fontSize: 7, padding: '1px 4px', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 10, cursor: 'pointer', color: '#7aacff', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.08)')}
              >{comp.type.replace('cc.', '')}</span>
            ))}
          </div>
        )}
        {showComps.map(({ comp, origIdx }, ci) => (
        <div
          id={`cc-comp-${node.uuid}-${origIdx}`}
          key={`${node.uuid}-${origIdx}`}
          style={{
            border: dragOverIdx === ci ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)',
            borderRadius: 4,
            marginBottom: 6,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.015)',
            opacity: draggingIdx === ci ? 0.4 : 1,
          }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(ci) }}
          onDragLeave={() => setDragOverIdx(null)}
          onDrop={e => {
            e.preventDefault()
            setDragOverIdx(null)
            setDraggingIdx(null)
            const fromCi = parseInt(e.dataTransfer.getData('compCi'))
            if (isNaN(fromCi) || fromCi === ci) return
            const fromOrigIdx = visibleComps[fromCi]?.origIdx
            const toOrigIdx = origIdx
            if (fromOrigIdx == null || fromOrigIdx === toOrigIdx) return
            const newComps = [...draft.components]
            const [moved] = newComps.splice(fromOrigIdx, 1)
            // splice 후 toOrigIdx 보정: from이 to보다 앞에 있으면 한 칸 앞당겨짐
            const adjustedTo = fromOrigIdx < toOrigIdx ? toOrigIdx - 1 : toOrigIdx
            newComps.splice(adjustedTo, 0, moved)
            applyAndSave({ components: newComps })
          }}
        >
          {/* R1473: 커스텀 스크립트 구분선 */}
          {ci > 0 && isCustomScript(comp.type) && !isCustomScript(visibleComps[ci - 1].comp.type) && (
            <div style={{ fontSize: 8, color: '#7cf', opacity: 0.6, marginTop: 2, marginBottom: 2, letterSpacing: 1 }}>── 커스텀 스크립트 ──</div>
          )}
          <div
            style={{ display: 'flex', alignItems: 'center', height: 28, padding: '0 8px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setCollapsedComps(s => {
              const n = new Set(s)
              if (n.has(comp.type)) n.delete(comp.type); else n.add(comp.type)
              localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n]))
              return n
            })}
          >
            <span
              draggable
              onDragStart={e => { e.dataTransfer.setData('compCi', String(ci)); e.dataTransfer.effectAllowed = 'move'; setDraggingIdx(ci) }}
              onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null) }}
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'grab', padding: '0 4px', opacity: 0.5, fontSize: 10, lineHeight: 1 }}
              title="드래그하여 순서 변경"
            >⠿</span>
            {/* R1541: 컴포넌트 enabled 토글 */}
            <input
              type="checkbox"
              checked={!!(comp.props.enabled ?? true)}
              onChange={e => {
                e.stopPropagation()
                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked } } : c)
                applyAndSave({ components: updated })
              }}
              onClick={e => e.stopPropagation()}
              title={`컴포넌트 ${comp.props.enabled === false ? '활성화' : '비활성화'}`}
              style={{ margin: 0, marginRight: 3, flexShrink: 0, cursor: 'pointer', accentColor: '#4ade80' }}
            />
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginRight: 3 }}>{collapsedComps.has(comp.type) ? '▸' : '▾'}</span>
            {/* R2328: 컴포넌트 타입 설명 tooltip */}
            <span title={COMP_DESCRIPTIONS[comp.type] ?? resolveScriptName(comp.type)} style={{ flex: 1, opacity: comp.props.enabled === false ? 0.5 : 1, color: (() => {
              // R1680: 컴포넌트 타입별 색상 구분
              const typeColorMap: Record<string, string> = {
                'cc.Label': '#58a6ff', 'cc.RichText': '#58a6ff',
                'cc.Sprite': '#4ade80', 'cc.TiledMap': '#4ade80', 'cc.VideoPlayer': '#4ade80',
                'cc.Button': '#fb923c', 'cc.Toggle': '#fb923c', 'cc.Slider': '#fb923c',
                'cc.Widget': '#a78bfa', 'cc.Layout': '#a78bfa', 'cc.SafeArea': '#a78bfa',
                'cc.Animation': '#f472b6', 'sp.Skeleton': '#f472b6', 'dragonBones.ArmatureDisplay': '#f472b6',
                'cc.AudioSource': '#facc15',
                'cc.ScrollView': '#34d399', 'cc.PageView': '#34d399',
                'cc.RigidBody': '#f87171', 'cc.BoxCollider': '#f87171', 'cc.CircleCollider': '#f87171',
                'cc.BlockInputEvents': '#94a3b8', 'cc.ProgressBar': '#94a3b8',
              }
              return typeColorMap[comp.type] ?? (isCustomScript(comp.type) ? '#c084fc' : 'var(--text-primary)')
            })() }}>
              {/* R2330: 컴포넌트 타입 아이콘 */}
              {isCustomScript(comp.type) ? '📝 ' : COMP_ICONS[comp.type] ? <span style={{ fontSize: 9, marginRight: 3, opacity: 0.8 }}>{COMP_ICONS[comp.type]}</span> : null}{(() => { const resolved = resolveScriptName(comp.type); return resolved.includes('.') ? resolved.split('.').pop() : resolved })()}
            </span>
            {/* R1660/R1662: 씬 내 동일 타입 노드 수 배지 + 팝업 */}
            {(compTypeCountMap[comp.type] ?? 0) > 1 && (
              <span
                title={`씬 내 ${comp.type} 컴포넌트 보유 노드: ${compTypeCountMap[comp.type]}개 (클릭: 목록)`}
                onClick={e => { e.stopPropagation(); setSameCompPopup(sameCompPopup === comp.type ? null : comp.type) }}
                style={{ fontSize: 7, padding: '1px 3px', borderRadius: 8, background: sameCompPopup === comp.type ? 'rgba(88,166,255,0.15)' : 'rgba(255,255,255,0.06)', color: sameCompPopup === comp.type ? '#58a6ff' : '#666', marginRight: 3, flexShrink: 0, cursor: 'pointer', position: 'relative' }}
              >
                ×{compTypeCountMap[comp.type]}
                {/* R1662: 같은 타입 노드 목록 팝업 */}
                {sameCompPopup === comp.type && (() => {
                  const nodes: CCSceneNode[] = []
                  function findNodes(n: CCSceneNode) { if (n.components.some(c => c.type === comp.type)) nodes.push(n); n.children.forEach(findNodes) }
                  findNodes(sceneFile.root)
                  return (
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 140, maxHeight: 160, overflowY: 'auto', fontSize: 9 }}>
                      <div style={{ padding: '3px 6px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontSize: 8 }}>{comp.type.split('.').pop()} 보유 노드 ({nodes.length})</div>
                      {nodes.map(n => (
                        <div key={n.uuid} onClick={() => { onUpdate(n); setSameCompPopup(null) }} style={{ padding: '4px 8px', cursor: 'pointer', color: n.uuid === node.uuid ? '#58a6ff' : 'var(--text-primary)', background: 'transparent', fontWeight: n.uuid === node.uuid ? 700 : 400 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {n.active ? '' : '◌ '}{n.name || '(unnamed)'}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </span>
            )}
            {showComps.length > 1 && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', marginRight: 4 }}>#{ci + 1}</span>
            )}
            {compCopied && copiedCompRef.current && copiedCompRef.current.type !== comp.type && (
              <span
                title={`${copiedCompRef.current.type.split('.').pop()} 붙여넣기`}
                onClick={e => {
                  e.stopPropagation()
                  if (!copiedCompRef.current) return
                  applyAndSave({ components: [...draft.components, { ...copiedCompRef.current }] })
                  setCompCopied(null)
                }}
                style={{ cursor: 'pointer', color: '#58a6ff', fontSize: 9, padding: '0 3px', lineHeight: 1 }}
              >📋</span>
            )}
            {/* R2568: 개별 컴포넌트 enabled 토글 */}
            {(() => {
              const isEnabled = comp.props.enabled !== false && comp.props._enabled !== false
              return (
                <span
                  title={isEnabled ? `${comp.type.split('.').pop()} 비활성화 (R2568)` : `${comp.type.split('.').pop()} 활성화 (R2568)`}
                  onClick={e => {
                    e.stopPropagation()
                    const newEnabled = !isEnabled
                    applyAndSave({ components: draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: newEnabled, _enabled: newEnabled } } : c) })
                  }}
                  style={{ cursor: 'pointer', color: isEnabled ? '#666' : '#fbbf24', fontSize: 9, padding: '0 2px', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = isEnabled ? '#aaa' : '#f59e0b')}
                  onMouseLeave={e => (e.currentTarget.style.color = isEnabled ? '#666' : '#fbbf24')}
                >{isEnabled ? '⏸' : '▶'}</span>
              )
            })()}
            <span
              title="컴포넌트 복사"
              onClick={e => {
                e.stopPropagation()
                copiedCompRef.current = { type: comp.type, props: { ...comp.props } }
                setCompCopied(comp.type)
                setTimeout(() => setCompCopied(null), 3000)
              }}
              style={{ cursor: 'pointer', color: compCopied === comp.type ? '#58a6ff' : '#666', fontSize: 9, padding: '0 3px', lineHeight: 1 }}
            >{compCopied === comp.type ? '✓' : '⎘'}</span>
            {/* R1528: 컴포넌트 순서 변경 ▲▼ */}
            <span
              title="위로 이동"
              onClick={e => {
                e.stopPropagation()
                if (origIdx <= 0) return
                const comps = [...draft.components]
                const [moved] = comps.splice(origIdx, 1)
                comps.splice(origIdx - 1, 0, moved)
                applyAndSave({ components: comps })
              }}
              style={{ cursor: origIdx > 0 ? 'pointer' : 'default', color: origIdx > 0 ? '#666' : '#2a2a2a', fontSize: 9, padding: '0 2px', lineHeight: 1 }}
            >▲</span>
            <span
              title="아래로 이동"
              onClick={e => {
                e.stopPropagation()
                if (origIdx >= draft.components.length - 1) return
                const comps = [...draft.components]
                const [moved] = comps.splice(origIdx, 1)
                comps.splice(origIdx + 1, 0, moved)
                applyAndSave({ components: comps })
              }}
              style={{ cursor: origIdx < draft.components.length - 1 ? 'pointer' : 'default', color: origIdx < draft.components.length - 1 ? '#666' : '#2a2a2a', fontSize: 9, padding: '0 2px', lineHeight: 1 }}
            >▼</span>
            <span
              title="컴포넌트 삭제"
              onClick={e => { e.stopPropagation(); applyAndSave({ components: draft.components.filter((_, i) => i !== origIdx) }) }}
              style={{ cursor: 'pointer', color: '#666', fontSize: 10, padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff6666')}
              onMouseLeave={e => (e.currentTarget.style.color = '#666')}
            >✕</span>
          </div>
          {/* R1520: Component Quick Edit — extracted to ComponentQuickEdit.tsx */}
          <div style={{ padding: '4px 8px 6px' }}>
            {!collapsedComps.has(comp.type) && <ComponentQuickEdit comp={comp} draft={draft} applyAndSave={applyAndSave} sceneFile={sceneFile} origIdx={origIdx} ci={ci} is3x={sceneFile.projectInfo?.version === '3x'} />}
            <GenericPropertyEditor comp={comp} draft={draft} applyAndSave={applyAndSave} origIdx={origIdx} ci={ci} propSearch={propSearch} setPropSearch={setPropSearch} favProps={favProps} toggleFavProp={toggleFavProp} expandedArrayProps={expandedArrayProps} setExpandedArrayProps={setExpandedArrayProps} origSnapRef={origSnapRef} collapsedComps={collapsedComps} typeMatchedComps={typeMatchedComps} />
          </div>
        </div>
      ))}
      </>
      )
      })()}
      {!collapsed['comps'] && (() => {
        const compTypes = ['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource', 'cc.RichText', 'cc.EditBox', 'cc.UIOpacity', 'cc.Mask']
        const doAddComp = (ct: string) => { applyAndSave({ components: [...draft.components, { type: ct, props: {} }] }); trackAddComp(ct) }
        return (
          <details style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
            <summary style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', padding: '4px 0', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11 }}>⊕</span>
              컴포넌트 추가
            </summary>
            {/* R2502: 최근 추가 이력 */}
            {recentAddedComps.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 8, color: '#555', alignSelf: 'center', flexShrink: 0 }}>최근:</span>
                {recentAddedComps.map(ct => (
                  <span key={ct} title={`최근 추가: ${ct}`}
                    onClick={() => doAddComp(ct)}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.3)')}
                  >
                    {COMP_ICONS[ct] && <span style={{ opacity: 0.7 }}>{COMP_ICONS[ct]}</span>}
                    {ct.split('.').pop()}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {compTypes.map(ct => (
                <span
                  key={ct}
                  title={COMP_DESCRIPTIONS[ct] ?? ct}
                  onClick={() => doAddComp(ct)}
                  style={{
                    fontSize: 10, padding: '3px 8px', height: 24, borderRadius: 4, cursor: 'pointer',
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {/* R2331: 컴포넌트 추가 버튼에 아이콘 표시 */}
                  {COMP_ICONS[ct] && <span style={{ opacity: 0.7 }}>{COMP_ICONS[ct]}</span>}
                  {ct.split('.').pop()}
                </span>
              ))}
            </div>
            {/* R2331: 커스텀 컴포넌트 타입 직접 입력 */}
            <div style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="커스텀 타입 입력 (예: MyScript)"
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (!val) return
                  doAddComp(val);
                  (e.target as HTMLInputElement).value = ''
                }}
                style={{ flex: 1, fontSize: 11, padding: '3px 8px', height: 26, borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              />
              <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>↵</span>
            </div>
          </details>
        )
      })()}

      {/* R1612: 자식 노드 빠른 탐색 */}
      {node.children.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 3 }}>▸ 자식 ({node.children.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {node.children.map(child => (
              <span
                key={child.uuid}
                onClick={() => onUpdate(child)}
                style={{ fontSize: 8, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: child.active ? 'var(--text-muted)' : '#555', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                onMouseLeave={e => (e.currentTarget.style.color = child.active ? 'var(--text-muted)' : '#555')}
                title={`이동: ${child.name}${!child.active ? ' (비활성)' : ''}`}
              >{!child.active ? '◌' : ''}{child.name}</span>
            ))}
          </div>
        </div>
      )}
      {/* Round 611: 변경 이력 트레이 */}
      {(() => {
        const fmtVal = (v: unknown): string => {
          if (v === null || v === undefined) return 'null'
          if (typeof v === 'boolean') return v ? 'true' : 'false'
          if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
          if (typeof v === 'string') return v.length > 20 ? v.slice(0, 20) + '…' : v
          return JSON.stringify(v).slice(0, 30) + (JSON.stringify(v).length > 30 ? '…' : '')
        }
        const fmtTime = (ts: number): string => {
          const d = new Date(ts)
          return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
        }
        return (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)' }}>
            <div
              onClick={() => setHistoryOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {historyOpen ? '▾' : '▸'} 📋 변경 이력 ({propHistory.length})
              </span>
              {propHistory.length > 0 && (
                <span
                  onClick={e => {
                    e.stopPropagation()
                    setPropHistory([])
                    localStorage.removeItem(PROP_HISTORY_KEY)
                  }}
                  title="이력 지우기"
                  style={{ fontSize: 10, color: '#555', cursor: 'pointer', padding: '0 2px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f85149')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                  ×
                </span>
              )}
            </div>
            {historyOpen && (
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {propHistory.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#444', padding: '4px 0' }}>이력 없음</div>
                ) : propHistory.map(h => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <span
                      title="실행 취소 (undo)"
                      onClick={() => applyAndSave({ [h.propKey]: h.oldValue } as Partial<CCSceneNode>)}
                      style={{ fontSize: 10, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                    >
                      ↩
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-primary)' }}>[{h.nodeName}]</span>{' '}
                      <span style={{ fontFamily: 'monospace' }}>{h.propKey}</span>:{' '}
                      <span style={{ fontFamily: 'monospace', color: '#f85149' }}>{fmtVal(h.oldValue)}</span>
                      {' → '}
                      <span style={{ fontFamily: 'monospace', color: '#3fb950' }}>{fmtVal(h.newValue)}</span>
                    </span>
                    <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>{fmtTime(h.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {/* R1497: Raw JSON 뷰 / R2487: 인라인 편집 */}
      {secHeader('rawJson', 'Raw JSON')}
      {!collapsed['rawJson'] && (() => {
        const jsonObj = {
          uuid: draft.uuid, name: draft.name, active: draft.active,
          position: draft.position, rotation: draft.rotation, scale: draft.scale,
          size: draft.size, anchor: draft.anchor, opacity: draft.opacity,
          color: draft.color, components: draft.components.map(c => ({ type: c.type, props: c.props })),
        }
        const startEdit = () => { setJsonEditText(JSON.stringify(jsonObj, null, 2)); setJsonEditErr(''); setJsonEditMode(true) }
        const applyJson = () => {
          try {
            const parsed = JSON.parse(jsonEditText)
            const patch: Partial<CCSceneNode> = {}
            if (parsed.name !== undefined) patch.name = String(parsed.name)
            if (parsed.active !== undefined) patch.active = Boolean(parsed.active)
            if (parsed.position !== undefined) patch.position = parsed.position
            if (parsed.rotation !== undefined) patch.rotation = parsed.rotation
            if (parsed.scale !== undefined) patch.scale = parsed.scale
            if (parsed.size !== undefined) patch.size = parsed.size
            if (parsed.anchor !== undefined) patch.anchor = parsed.anchor
            if (parsed.opacity !== undefined) patch.opacity = Number(parsed.opacity)
            if (parsed.color !== undefined) patch.color = parsed.color
            if (Array.isArray(parsed.components)) {
              const validComponents = (parsed.components as unknown[]).every(
                (c) => c != null && typeof (c as Record<string, unknown>).type === 'string'
              )
              if (validComponents) patch.components = parsed.components as CCSceneNode['components']
            }
            applyAndSave(patch)
            setJsonEditMode(false); setJsonEditErr('')
          } catch (e) { setJsonEditErr(String(e)) }
        }
        return (
          <div style={{ marginTop: 4 }}>
            {jsonEditMode ? (
              <>
                <textarea
                  value={jsonEditText} onChange={e => { setJsonEditText(e.target.value); setJsonEditErr('') }}
                  style={{ width: '100%', minHeight: 160, fontSize: 8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', border: `1px solid ${jsonEditErr ? '#f85149' : '#334'}`, color: '#aac', borderRadius: 3, padding: '4px 6px', boxSizing: 'border-box', resize: 'vertical' }}
                />
                {jsonEditErr && <div style={{ fontSize: 8, color: '#f85149', marginTop: 2 }}>{jsonEditErr}</div>}
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  <button onClick={applyJson} style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, cursor: 'pointer', background: 'rgba(88,166,255,0.15)', border: '1px solid #334a6a', color: '#58a6ff' }}>적용 (R2487)</button>
                  <button onClick={() => { setJsonEditMode(false); setJsonEditErr('') }} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px solid #444', color: '#666' }}>취소</button>
                </div>
              </>
            ) : (
              <>
                <pre style={{ fontSize: 8, fontFamily: 'monospace', color: '#556', background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px', overflowX: 'auto', maxHeight: 160, overflowY: 'auto', userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(jsonObj, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  <button onClick={startEdit} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px solid #334a6a', color: '#58a6ff' }}>편집 (R2487)</button>
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).catch(() => {})} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px solid #444', color: '#666' }}>JSON 복사</button>
                </div>
              </>
            )}
          </div>
        )
      })()}
      {/* R1508: 빠른 편집 CLI 입력 바 */}
      {(() => {
        const runCmd = (cmd: string) => {
          const parts = cmd.trim().split(/\s+/)
          const op = parts[0]?.toLowerCase()
          const nums = parts.slice(1).map(Number)
          let patch: Partial<CCSceneNode> | null = null
          if ((op === 'pos' || op === 'position') && nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
            patch = { position: { ...draft.position, x: nums[0], y: nums[1] } }
          } else if ((op === 'size' || op === 'sz') && nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
            patch = { size: { x: nums[0], y: nums[1] } }
          } else if ((op === 'rot' || op === 'rotation') && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { rotation: typeof draft.rotation === 'number' ? nums[0] : { ...(draft.rotation as object), z: nums[0] } }
          } else if ((op === 'scale' || op === 'sc') && nums.length >= 1 && !isNaN(nums[0])) {
            const sy = !isNaN(nums[1]) ? nums[1] : nums[0]
            patch = { scale: { ...draft.scale, x: nums[0], y: sy } }
          } else if ((op === 'alpha' || op === 'opacity') && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { opacity: Math.max(0, Math.min(255, Math.round(nums[0]))) }
          } else if ((op === 'color' || op === 'col') && parts[1]) {
            const hex = parts[1].replace('#', '')
            if (/^[0-9a-fA-F]{6}$/.test(hex)) {
              patch = { color: { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16), a: draft.color.a } }
            }
          } else if (op === 'name' && parts.slice(1).join(' ').trim()) {
            patch = { name: parts.slice(1).join(' ').trim() }
          } else if (op === 'active' || op === 'on') {
            patch = { active: true }
          } else if (op === 'inactive' || op === 'off') {
            patch = { active: false }
          } else if (op === 'toggle') {
            patch = { active: !draft.active }
          } else if ((op === 'anchor' || op === 'ax') && nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
            patch = { anchor: { x: Math.max(0,Math.min(1,nums[0])), y: Math.max(0,Math.min(1,nums[1])) } }
          // R1560: 추가 명령어
          } else if (op === 'layer' && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { layer: Math.round(nums[0]) }
          } else if (op === 'tag' && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { tag: Math.round(nums[0]) }
          } else if (op === 'z' && nums.length >= 1 && !isNaN(nums[0])) {
            const pos = draft.position as { x: number; y: number; z?: number }
            patch = { position: { ...pos, z: nums[0] } }
          } else if (op === 'flip' && parts[1]) {
            const axis = parts[1].toLowerCase()
            const sc = draft.scale as { x: number; y: number; z?: number }
            if (axis === 'x') patch = { scale: { ...sc, x: -sc.x } }
            else if (axis === 'y') patch = { scale: { ...sc, y: -sc.y } }
          } else if (op === 'reset') {
            patch = { position: { x: 0, y: 0, z: 0 }, rotation: 0, scale: { x: 1, y: 1, z: 1 }, opacity: 255 }
          } else if (op === 'help' || op === '?') {
            setCliMsg('pos|size|rot|scale|alpha|color|name|active|anchor|layer|tag|z|flip x/y|reset')
            setTimeout(() => setCliMsg(null), 4000)
            setCliVal('')
            return
          }
          if (patch) {
            applyAndSave(patch)
            setCliMsg(`✓ ${op}`)
            setTimeout(() => setCliMsg(null), 1500)
            setCliVal('')
          } else {
            setCliMsg('? 알 수 없는 명령 (help/?로 목록)')
            setTimeout(() => setCliMsg(null), 2000)
          }
        }
        return (
          <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>›_</span>
              <input
                value={cliVal}
                onChange={e => setCliVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { runCmd(cliVal); e.preventDefault() } }}
                placeholder="pos X Y · size W H · rot Z · help/?로 목록"
                style={{
                  flex: 1, fontSize: 9, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 3, padding: '2px 5px', fontFamily: 'monospace',
                }}
                title="R1508/R1560 Quick Edit: pos|size|rot|scale|alpha|color|name|active/inactive/toggle|anchor|layer|tag|z|flip x/y|reset|help"
              />
              {cliMsg && <span style={{ fontSize: 9, color: cliMsg.startsWith('✓') ? '#4ade80' : '#f85149', flexShrink: 0 }}>{cliMsg}</span>}
            </div>
          </div>
        )
      })()}
      {/* R1668: 유사 노드 (공통 컴포넌트 타입 기반) */}
      {similarNodes.length > 0 && (
        <div style={{ marginBottom: 4, padding: '3px 6px', background: 'rgba(88,166,255,0.04)', borderRadius: 3, border: '1px solid rgba(88,166,255,0.08)' }}>
          <div style={{ fontSize: 8, color: '#445', marginBottom: 3 }}>⊞ 유사 노드 (공통 컴포넌트) — {similarNodes.length}개</div>
          {similarNodes.map(({ node: sn, overlap }) => (
            <div
              key={sn.uuid}
              onClick={() => onUpdate(sn)}
              style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between', padding: '1px 0', cursor: 'pointer', color: 'var(--text-secondary)', gap: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sn.name}</span>
              <span style={{ fontSize: 7, color: '#556', flexShrink: 0 }}>⊕×{overlap}</span>
            </div>
          ))}
        </div>
      )}
      {/* 씬 파일 정보 */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: '#333', lineHeight: 1.6 }}>
        <div title={sceneFile.scenePath} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {sceneFile.scenePath.split(/[\\/]/).pop()}</div>
        <div>CC {sceneFile.projectInfo.version === '3x' ? '3.x' : '2.x'} | {sceneFile.projectInfo.creatorVersion ?? ''}</div>
      </div>
      {/* Round 643: 저장 완료 토스트 */}
      {savedToast && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: '#166534', color: '#4ade80', fontSize: 11,
          padding: '4px 10px', textAlign: 'center', borderRadius: 4,
          marginTop: 6, userSelect: 'none',
        }}>
          저장됨 ✓
        </div>
      )}
    </div>
  )
}
