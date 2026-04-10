import React, { useRef } from 'react'
import { t } from '../../../utils/i18n'
import type { CCSceneNode } from '@shared/ipc-schema'
import { VirtualSceneTree } from './SceneTree'
import { TreeSearch } from './TreeSearch'
import type { UseCCFileProjectUIReturn } from './useCCFileProjectUI'

interface HierarchyPanelProps {
  ctx: UseCCFileProjectUIReturn
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}

export function HierarchyPanel({ ctx, selectedNode, onSelectNode }: HierarchyPanelProps) {
  const treeScrollRef = useRef<HTMLDivElement>(null)
  const {
    sceneFile, projectInfo,
    prefabPickerOpen, setPrefabPickerOpen,
    insertingPrefab, handleInsertPrefab,
    expandAll, collapseAll, collapseToDepth,
    hideInactive, setHideInactive,
    nodeColors, colorTagFilter, setColorTagFilter,
    nodeFilters, setNodeFilters, showNodeFilters, setShowNodeFilters,
    showLabelReplace, setShowLabelReplace,
    labelFindText, setLabelFindText,
    labelReplaceText, setLabelReplaceText,
    labelReplaceMatches, handleLabelReplaceAll,
    treeHighlightQuery, setTreeHighlightQuery,
    recentNodes, nodeMap, nodeBookmarks, setNodeBookmarks,
    filteredRoot, favorites, toggleFavorite,
    lockedUuids, toggleLocked,
    collapsedUuids, setCollapsedUuids,
    multiSelectedUuids, setMultiSelectedUuids,
    outOfCanvasUuids, handleNodeColorChange,
    handleReparent, handleTreeAddChild, handleTreeDelete, handleTreeDuplicate,
    handleTreeToggleActive, handleReorder, handleSortChildren,
    handleRenameInView, handleSaveAsPrefab,
    showSceneStats, setShowSceneStats,
  } = ctx

  if (!sceneFile?.root) return null

  return (
    <>
            {/* 헤더 */}
            <div style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
              {/* R1472: 프리팹 편집 모드 배지 */}
              <span style={{ fontSize: 9, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sceneFile.scenePath.endsWith('.prefab') ? '#f0a' : 'var(--text-muted)' }}>
                {sceneFile.scenePath.endsWith('.prefab') ? t('hierarchy.header.prefab', '🧩 프리팹') : t('hierarchy.header.scene', '계층')}
              </span>
              {(() => {
                let nodes = 0; let inactive = 0; let comps = 0
                const typeMap: Record<string, number> = {}
                function count(n: CCSceneNode) { nodes++; if (!n.active) inactive++; comps += n.components.length; n.components.forEach(c => { typeMap[c.type] = (typeMap[c.type] ?? 0) + 1 }); n.children.forEach(count) }
                count(sceneFile.root)
                // R1625: Top 3 컴포넌트 타입 칩
                const topTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
                // R1627: 씬 성능 경고
                const warns: string[] = []
                if (nodes > 200) warns.push(`노드 수 과다 (${nodes})`)
                if (comps > 500) warns.push(`컴포넌트 수 과다 (${comps})`)
                if (inactive > nodes * 0.5 && nodes > 10) warns.push(`비활성 노드 과다 (${inactive}/${nodes})`)
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#555', flexShrink: 0 }} title={t('hierarchy.nodeStats', `노드 ${nodes}개 / 비활성 ${inactive}개 / 컴포넌트 ${comps}개`).replace('{n}', String(nodes)).replace('{i}', String(inactive)).replace('{c}', String(comps))}>
                    {nodes}N/{comps}C
                    {/* R1639: 컴포넌트 칩 클릭 → 첫 번째 해당 타입 노드 선택 */}
                    {topTypes.map(([type, cnt]) => (
                      <span key={type}
                        onClick={() => {
                          const walk = (n: CCSceneNode): CCSceneNode | null => {
                            if (n.components?.some(c => c.type === type)) return n
                            for (const child of n.children) { const found = walk(child); if (found) return found }
                            return null
                          }
                          const found = walk(sceneFile.root)
                          if (found) onSelectNode(found)
                        }}
                        style={{ background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 3, padding: '0 3px', color: '#58a6ff', fontSize: 8, cursor: 'pointer' }} title={t('hierarchy.nodeSelectTitle', `${type} — 클릭: 첫 번째 노드 선택`).replace('{t}', type)}>
                        {type.replace('cc.', '')}:{cnt}
                      </span>
                    ))}
                    {warns.length > 0 && (
                      <span style={{ background: 'rgba(255,153,0,0.12)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: 3, padding: '0 3px', color: '#ff9900', fontSize: 8, cursor: 'default' }} title={warns.join('\n')}>
                        ⚠{warns.length}
                      </span>
                    )}
                  </span>
                )
              })()}
              {/* R1514: 프리팹 삽입 버튼 */}
              {projectInfo.scenes.some(s => s.endsWith('.prefab')) && (
                <span
                  onClick={() => setPrefabPickerOpen(p => !p)}
                  title={t('hierarchy.prefabInsert', '프리팹 삽입 (🧩)')}
                  style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: prefabPickerOpen ? '#a78bfa' : '#666', position: 'relative' }}
                >
                  {insertingPrefab ? '⟳' : '🧩'}
                  {prefabPickerOpen && (
                    <div style={{
                      position: 'absolute', top: 18, right: 0, zIndex: 999,
                      background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)',
                      borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: 180, maxHeight: 200, overflowY: 'auto',
                    }}
                    onMouseLeave={() => setPrefabPickerOpen(false)}
                    >
                      <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{t('hierarchy.prefabPicker', '프리팹 선택')}</div>
                      {projectInfo.scenes.filter(s => s.endsWith('.prefab')).map(p => (
                        <div
                          key={p}
                          onClick={e => { e.stopPropagation(); handleInsertPrefab(p) }}
                          style={{ padding: '5px 10px', fontSize: 10, cursor: 'pointer', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          title={p}
                        >
                          🧩 {p.replace(/\\/g, '/').split('/').pop()}
                        </div>
                      ))}
                    </div>
                  )}
                </span>
              )}
              <span onClick={expandAll} title={t('hierarchy.expandAll', '전체 펼치기')} style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: '#666' }}>⊞</span>
              <span onClick={collapseAll} title={t('hierarchy.collapseAll', '전체 접기')} style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: '#666' }}>⊟</span>
              {/* R1710: 씬 트리 구조 텍스트 복사 */}
              <span
                title={t('hierarchy.copyTree', '씬 트리 구조 텍스트 복사 (R1710)')}
                onClick={() => {
                  if (!sceneFile?.root) return
                  const lines: string[] = []
                  function walk(n: CCSceneNode, depth: number) {
                    const indent = '  '.repeat(depth)
                    const compsStr = n.components.length > 0 ? ` (${n.components.map(c => c.type.includes('.') ? c.type.split('.').pop() : c.type).join(', ')})` : ''
                    lines.push(`${indent}${n.active ? '' : '◌ '}${n.name || '(unnamed)'}${compsStr}`)
                    n.children.forEach(c => walk(c, depth + 1))
                  }
                  walk(sceneFile.root, 0)
                  navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
                }}
                style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0, color: '#666' }}
              >⎘</span>
              {/* R1655: 깊이 N까지 펼치기 */}
              {([1, 2, 3] as const).map(d => (
                <span key={d} onClick={() => collapseToDepth(d)} title={t('hierarchy.depthExpand', `깊이 ${d}까지 펼치기`).replace('{d}', String(d))} style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0, color: '#666', fontWeight: 700 }}>D{d}</span>
              ))}
              <span
                onClick={() => setHideInactive(h => !h)}
                title={hideInactive ? t('hierarchy.showInactive', '비활성 노드 표시') : t('hierarchy.hideInactive', '비활성 노드 숨기기')}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: hideInactive ? '#58a6ff' : '#666' }}
              >{hideInactive ? '◑' : '●'}</span>
              {/* R1715: 색상 태그 필터 */}
              {Object.values(nodeColors).length > 0 && (() => {
                const usedColors = [...new Set(Object.values(nodeColors).filter(Boolean))]
                return usedColors.map(color => (
                  <span key={color}
                    title={color === colorTagFilter ? t('hierarchy.colorFilterClear', '색상 태그 필터 해제') : t('hierarchy.colorFilter', `색상 태그 필터: ${color}`).replace('{c}', color)}
                    onClick={() => setColorTagFilter(colorTagFilter === color ? null : color)}
                    style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', cursor: 'pointer', flexShrink: 0, border: colorTagFilter === color ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)', boxSizing: 'border-box' }}
                  />
                ))
              })()}
              {/* R1654: 컴포넌트 필터 토글 버튼 */}
              <span
                onClick={() => setShowNodeFilters(v => !v)}
                title={nodeFilters.length > 0 ? t('hierarchy.compFilterActive', `컴포넌트 필터 활성 (${nodeFilters.length})`).replace('{n}', String(nodeFilters.length)) : t('hierarchy.compFilter', '컴포넌트 타입 필터')}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: nodeFilters.length > 0 ? '#58a6ff' : showNodeFilters ? '#aaa' : '#666' }}
              >⊳</span>
              {/* R1729: cc.Label Find & Replace 토글 */}
              <span
                onClick={() => setShowLabelReplace(v => !v)}
                title={t('hierarchy.labelReplace', 'cc.Label 텍스트 찾기/바꾸기 (R1729)')}
                style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0, color: showLabelReplace ? '#58a6ff' : '#666', fontWeight: showLabelReplace ? 700 : 400, letterSpacing: -0.5 }}
              >ab</span>
            </div>
            {/* 검색 */}
            <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <TreeSearch root={sceneFile.root} onSelect={onSelectNode} onQueryChange={setTreeHighlightQuery} />
            </div>
            {/* R1678: 최근 선택 노드 히스토리 칩 */}
            {recentNodes.length > 1 && (
              <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: '#444', flexShrink: 0 }}>◷</span>
                {recentNodes.slice(1).map(r => {
                  const n = nodeMap.get(r.uuid)
                  if (!n) return null
                  return (
                    <span
                      key={r.uuid}
                      onClick={() => onSelectNode(n)}
                      title={r.name}
                      style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'none', userSelect: 'none', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                    >{r.name || '(unnamed)'}</span>
                  )
                })}
              </div>
            )}
            {/* R2345: 노드 북마크 퀵액세스 바 (Ctrl+1-9 설정, 1-9 이동) */}
            {Object.keys(nodeBookmarks).length > 0 && (
              <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: '#444', flexShrink: 0 }}>🔖</span>
                {Object.entries(nodeBookmarks).sort(([a], [b]) => a.localeCompare(b)).map(([key, uuid]) => {
                  const n = nodeMap.get(uuid)
                  if (!n) return null
                  const isSelected = selectedNode?.uuid === uuid
                  return (
                    <span
                      key={key}
                      onClick={() => { const found = nodeMap.get(uuid); if (found) onSelectNode(found) }}
                      onContextMenu={e => { e.preventDefault(); setNodeBookmarks(prev => { const next = { ...prev }; delete next[key]; return next }) }}
                      title={`[${key}] ${n.name} — 클릭: 이동, 우클릭: 북마크 제거`}
                      style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${isSelected ? '#f472b6' : 'rgba(244,114,182,0.3)'}`, color: isSelected ? '#f472b6' : 'rgba(244,114,182,0.7)', background: isSelected ? 'rgba(244,114,182,0.1)' : 'none', userSelect: 'none', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    ><span style={{ opacity: 0.6, fontWeight: 700 }}>{key}</span>{n.name || '(unnamed)'}</span>
                  )
                })}
              </div>
            )}
            {/* R1654: 컴포넌트 필터 패널 */}
            {showNodeFilters && (
              <div style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                  {(['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.Widget', 'cc.Layout', 'cc.Animation', 'cc.AudioSource', 'cc.ScrollView'] as const).map(ct => {
                    const active = nodeFilters.includes(ct)
                    return (
                      <span
                        key={ct}
                        onClick={() => setNodeFilters(prev => active ? prev.filter(f => f !== ct) : [...prev, ct])}
                        style={{
                          fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer',
                          border: `1px solid ${active ? '#58a6ff' : 'var(--border)'}`,
                          color: active ? '#58a6ff' : 'var(--text-muted)',
                          background: active ? 'rgba(88,166,255,0.1)' : 'none', userSelect: 'none',
                        }}
                      >{ct.split('.').pop()}</span>
                    )
                  })}
                  {nodeFilters.length > 0 && (
                    <span onClick={() => setNodeFilters([])} title={t('hierarchy.filterReset', '필터 초기화')} style={{ fontSize: 9, cursor: 'pointer', color: '#f85149', userSelect: 'none' }}>✕</span>
                  )}
                </div>
                {/* R1667: custom type 입력 */}
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  <input
                    placeholder={t('hierarchy.customTypePlaceholder', 'custom type (예: MyScript)')}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.currentTarget.value ?? '').trim()
                        if (val && !nodeFilters.includes(val)) setNodeFilters(prev => [...prev, val])
                        e.currentTarget.value = ''
                      }
                    }}
                    style={{ flex: 1, fontSize: 8, padding: '1px 4px', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                  />
                </div>
                {nodeFilters.filter(f => !['cc.Label','cc.Sprite','cc.Button','cc.Toggle','cc.Slider','cc.Widget','cc.Layout','cc.Animation','cc.AudioSource','cc.ScrollView'].includes(f)).map(ct => (
                  <span key={ct} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 8, marginTop: 2, padding: '1px 4px', border: '1px solid #a78bfa', borderRadius: 2, color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}>
                    {ct}
                    <span onClick={() => setNodeFilters(prev => prev.filter(f => f !== ct))} style={{ cursor: 'pointer', color: '#f85149' }}>✕</span>
                  </span>
                ))}
              </div>
            )}
            {/* R1729: cc.Label Find & Replace 패널 */}
            {showLabelReplace && (
              <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>{t('hierarchy.findLabel', '찾기')}</span>
                  <input
                    value={labelFindText}
                    onChange={e => setLabelFindText(e.target.value)}
                    placeholder={t('hierarchy.findPlaceholder', '찾을 텍스트...')}
                    style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>{t('hierarchy.replaceLabel', '바꿈')}</span>
                  <input
                    value={labelReplaceText}
                    onChange={e => setLabelReplaceText(e.target.value)}
                    placeholder={t('hierarchy.replacePlaceholder', '바꿀 텍스트...')}
                    style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flex: 1 }}>
                    {labelFindText.trim() ? `${labelReplaceMatches.length}${t('hierarchy.matchCount', '개 매칭')}` : t('hierarchy.labelBulkReplace', 'cc.Label 텍스트 일괄 치환')}
                  </span>
                  {labelReplaceMatches.length > 0 && (
                    <span
                      onClick={handleLabelReplaceAll}
                      title={`${labelReplaceMatches.length}개 cc.Label에서 "${labelFindText}" → "${labelReplaceText}" 교체`}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, cursor: 'pointer', background: 'rgba(88,166,255,0.15)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.3)', userSelect: 'none' }}
                    >{t('hierarchy.replaceBtn', `전체 교체 (${labelReplaceMatches.length})`).replace('{n}', String(labelReplaceMatches.length))}</span>
                  )}
                </div>
              </div>
            )}
            {/* R1559: 씬 파일명 + 통계 */}
            {/* R1684: 씬 통계 패널 — showSceneStats 토글로 표시/숨김 */}
            {(() => {
              const statsMap: Record<string, number> = {}
              // R1731: 컴포넌트별 노드 uuid 맵
              const compNodeUuids: Record<string, string[]> = {}
              let nodeCount = 0
              // R1718: 비활성 노드 카운트
              let inactiveCount = 0
              const inactiveUuids: string[] = []
              // R1684: 씬 통계 — walkStats로 컴포넌트 분포 계산
              const walkStats = (n: CCSceneNode) => {
                nodeCount++
                if (!n.active) { inactiveCount++; inactiveUuids.push(n.uuid) }
                n.components.forEach(c => {
                  statsMap[c.type] = (statsMap[c.type] ?? 0) + 1
                  // R1731: uuid 수집
                  if (!compNodeUuids[c.type]) compNodeUuids[c.type] = []
                  compNodeUuids[c.type].push(n.uuid)
                })
                n.children.forEach(walkStats)
              }
              walkStats(sceneFile.root)
              const topComps = Object.entries(statsMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
              return (
                <>
                <div style={{ padding: '2px 6px', fontSize: 9, color: '#555', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  {/* R2322: 클릭으로 파일 탐색기에서 열기 */}
                  <div
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    title={t('hierarchy.fileOpenTitle', `탐색기에서 열기: ${sceneFile.scenePath}`).replace('{p}', sceneFile.scenePath)}
                    onClick={() => {
                      const winPath = sceneFile.scenePath.replace(/\//g, '\\')
                      window.api.shellExec?.(`explorer /select,"${winPath}"`)
                    }}
                  >
                    {sceneFile.scenePath.split(/[\\/]/).pop()}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 1 }}>
                    <span style={{ color: '#58a6ff' }}>{nodeCount}nodes</span>
                    {/* R1718: 비활성 노드 배지 */}
                    {inactiveCount > 0 && (
                      <span
                        // R1731: 클릭으로 비활성 노드 모두 선택
                        onClick={() => {
                          const first = nodeMap.get(inactiveUuids[0])
                          if (first) { onSelectNode(first); setMultiSelectedUuids(inactiveUuids) }
                        }}
                        style={{ color: '#888', cursor: 'pointer' }} title={t('hierarchy.inactiveTitle', `비활성 노드 ${inactiveCount}개 — 클릭으로 모두 선택`).replace('{n}', String(inactiveCount))}
                      >{inactiveCount}◌</span>
                    )}
                    {topComps.map(([type, cnt]) => (
                      // R1731: 클릭으로 해당 컴포넌트 노드 모두 선택
                      <span
                        key={type}
                        onClick={() => {
                          const uuids = compNodeUuids[type] ?? []
                          const first = uuids.length > 0 ? nodeMap.get(uuids[0]) : null
                          if (first) { onSelectNode(first); setMultiSelectedUuids(uuids) }
                        }}
                        title={t('hierarchy.compSelectTitle', `${cnt}개 ${type} 노드 — 클릭으로 모두 선택 (R1731)`).replace('{n}', String(cnt)).replace('{t}', type)}
                        style={{ color: '#666', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >{type.split('.').pop()}×{cnt}</span>
                    ))}
                  </div>
                </div>
                {/* R2344: 씬 통계 컴포넌트 분포 인라인 바 시각화 */}
                {showSceneStats && (() => {
                  const compCounts = statsMap
                  const totalComps = Object.values(compCounts).reduce((s, n) => s + n, 0)
                  const maxCount = Math.max(...Object.values(compCounts), 1)
                  const COMP_BAR_COLORS: Record<string, string> = {
                    'cc.Label': '#58a6ff', 'cc.Sprite': '#4ade80',
                    'cc.Button': '#fb923c', 'cc.Layout': '#a78bfa',
                  }
                  const barColor = (type: string) => COMP_BAR_COLORS[type] ?? '#64748b'
                  return (
                    <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border)', fontSize: 8 }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{t('hierarchy.compDist', `컴포넌트 분포 (${totalComps}개)`).replace('{n}', String(totalComps))}</div>
                      {Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <span style={{ width: 48, fontSize: 8, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{type.replace('cc.', '')}</span>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: barColor(type), borderRadius: 3 }} />
                          </div>
                          <span style={{ width: 16, fontSize: 8, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                </>
              )
            })()}
            {/* 즐겨찾기 */}
            {favorites.size > 0 && (
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 2, flexShrink: 0 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', padding: '1px 6px' }}>{t('hierarchy.favorites', '★ 즐겨찾기')}</div>
                {[...favorites].map(uuid => {
                  const favNode = nodeMap.get(uuid)
                  if (!favNode) return null
                  return (
                    <div key={uuid} style={{ paddingLeft: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} onClick={() => onSelectNode(favNode)}>
                      <span style={{ color: '#fbbf24', fontSize: 9 }}>★</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{favNode.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {/* 씬 트리 */}
            <div ref={treeScrollRef} style={{ flex: 1, overflow: 'auto' }}>
              <VirtualSceneTree
                root={filteredRoot ?? sceneFile.root}
                scrollContainerRef={treeScrollRef}
                selected={selectedNode}
                onSelect={onSelectNode}
                onReparent={handleReparent}
                onAddChild={handleTreeAddChild}
                onDelete={handleTreeDelete}
                onDuplicate={handleTreeDuplicate}
                onToggleActive={handleTreeToggleActive}
                hideInactive={hideInactive}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                lockedUuids={lockedUuids}
                onToggleLocked={toggleLocked}
                nodeColors={nodeColors}
                onNodeColorChange={handleNodeColorChange}
                collapsedUuids={collapsedUuids}
                onToggleCollapse={(uuid) => setCollapsedUuids(prev => {
                  const next = new Set(prev)
                  if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
                  return next
                })}
                highlightQuery={treeHighlightQuery}
                nodeBookmarks={nodeBookmarks}
                onReorder={handleReorder}
                multiSelectedUuids={multiSelectedUuids}
                onCtrlSelect={uuid => setMultiSelectedUuids(prev =>
                  prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
                )}
                onSortChildren={handleSortChildren}
                onRename={handleRenameInView}
                onSaveAsPrefab={handleSaveAsPrefab}
                outOfCanvasUuids={outOfCanvasUuids}
              />
            </div>
    </>
  )
}
