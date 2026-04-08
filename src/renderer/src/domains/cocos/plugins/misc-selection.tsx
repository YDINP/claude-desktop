import React from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'

interface MiscSelectionProps {
  uuids: string[]
  uuidSet: Set<string>
  sceneFile: { root: CCSceneNode | null }
  setBatchMsg: (msg: string | null) => void
  onMultiSelectChange?: (uuids: string[]) => void
  lockedUuids?: Set<string>
  onSetLockedUuids?: (updater: (prev: Set<string>) => Set<string>) => void
  mkBtnS: (color: string, extra?: React.CSSProperties) => React.CSSProperties
}

export function MiscSelectionTools({ uuids, uuidSet, sceneFile, setBatchMsg, onMultiSelectChange, lockedUuids, onSetLockedUuids, mkBtnS }: MiscSelectionProps) {
  return (
    <>
      {/* R2500: 선택 반전 — onMultiSelectChange */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyInvertSelect = () => {
          if (!sceneFile.root) return
          const allUuids: string[] = []
          function collectAll(n: CCSceneNode) { allUuids.push(n.uuid); n.children.forEach(collectAll) }
          sceneFile.root.children.forEach(collectAll)
          const inverted = allUuids.filter(u => !uuidSet.has(u))
          onMultiSelectChange?.(inverted)
          setBatchMsg(`✓ 선택 반전: ${inverted.length}개 (R2500)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>선택 반전 (R2500)</span>
            <span onClick={applyInvertSelect} style={mkBtnS('#818cf8')} title="선택 반전 onMultiSelectChange R2500">⊘ 반전</span>
          </div>
        )
      })()}

      {/* R2507: 하위 노드 포함 선택 확장 collectDesc */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyExpandDesc = () => {
          if (!sceneFile.root) return
          const expanded = new Set<string>(uuids)
          function collectDesc(n: CCSceneNode) {
            if (expanded.has(n.uuid)) {
              n.children.forEach(function addAll(c: CCSceneNode) { expanded.add(c.uuid); c.children.forEach(addAll) })
            }
            n.children.forEach(collectDesc)
          }
          collectDesc(sceneFile.root)
          onMultiSelectChange?.(Array.from(expanded))
          setBatchMsg(`✓ 하위 노드 포함: ${expanded.size}개 (R2507)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>하위 노드 포함 (R2507)</span>
            <span onClick={applyExpandDesc} style={mkBtnS('#34d399')} title="collectDesc 하위 노드 포함 선택 확장">⬇+자식</span>
          </div>
        )
      })()}

      {/* R2509: 선택 필터 — 활성 노드만 선택 / 비활성 노드만 선택 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyFilter = (active: boolean) => {
          if (!sceneFile.root) return
          const filtered: string[] = []
          function walk(n: CCSceneNode) {
            if (uuidSet.has(n.uuid)) {
              const isActive = n.active !== false
              if (active ? isActive : !isActive) filtered.push(n.uuid)
            }
            n.children.forEach(walk)
          }
          walk(sceneFile.root)
          onMultiSelectChange?.(filtered)
          setBatchMsg(`✓ ${active ? '활성' : '비활성'} 필터: ${filtered.length}개 (R2509)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>필터 (R2509)</span>
            <span onClick={() => applyFilter(true)} style={mkBtnS('#34d399')} title="활성 노드만 선택">활성 노드만 선택</span>
            <span onClick={() => applyFilter(false)} style={mkBtnS('#f472b6')} title="비활성 노드만 선택">비활성 노드만 선택</span>
          </div>
        )
      })()}

      {/* R2510: 같은 이름 노드 일괄 선택 sameNameUuids */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applySameNameSelect = () => {
          if (!sceneFile.root) return
          const selectedNames = new Set<string>()
          function collectNames(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selectedNames.add(n.name); n.children.forEach(collectNames) }
          collectNames(sceneFile.root)
          const sameNameUuids: string[] = []
          function findSame(n: CCSceneNode) { if (selectedNames.has(n.name)) sameNameUuids.push(n.uuid); n.children.forEach(findSame) }
          findSame(sceneFile.root)
          onMultiSelectChange?.(sameNameUuids)
          setBatchMsg(`✓ 같은 이름 노드 일괄 선택: ${sameNameUuids.length}개 (R2510)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>같은이름 (R2510)</span>
            <span onClick={applySameNameSelect} style={mkBtnS('#fbbf24')} title="같은 이름 노드 일괄 선택 sameNameUuids R2510">≡이름</span>
          </div>
        )
      })()}

      {/* R2512: JSON 복사 ⎘ JSON */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyJsonCopy = () => {
          if (!sceneFile.root) return
          const selected: CCSceneNode[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selected.push(n); n.children.forEach(collect) }
          collect(sceneFile.root)
          const json = JSON.stringify(selected, null, 2)
          navigator.clipboard.writeText(json).catch(() => {})
          setBatchMsg(`✓ JSON 복사 ${selected.length}개 (R2512)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>JSON (R2512)</span>
            <span onClick={applyJsonCopy} style={mkBtnS('#34d399')} title="JSON 복사 R2512">⎘ JSON</span>
          </div>
        )
      })()}

      {/* R2515: 부모 노드 선택 parentOfMap ⬆ 부모 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyParentSelect = () => {
          if (!sceneFile.root) return
          const parentOfMap = new Map<string, string>()
          function buildParentMap(n: CCSceneNode) {
            n.children.forEach(c => { parentOfMap.set(c.uuid, n.uuid); buildParentMap(c) })
          }
          buildParentMap(sceneFile.root)
          const parentUuids = new Set<string>()
          uuids.forEach(u => { const p = parentOfMap.get(u); if (p) parentUuids.add(p) })
          onMultiSelectChange?.(Array.from(parentUuids))
          setBatchMsg(`✓ ⬆ 부모 선택: ${parentUuids.size}개 (R2515)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>부모선택 (R2515)</span>
            <span onClick={applyParentSelect} style={mkBtnS('#818cf8')} title="parentOfMap ⬆ 부모 노드 선택 R2515">⬆ 부모</span>
          </div>
        )
      })()}

      {/* R2522: 직접 자식 선택 collectChildren ⬇ 자식 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyChildSelect = () => {
          if (!sceneFile.root) return
          const childUuids: string[] = []
          function collectChildren(n: CCSceneNode) {
            if (uuidSet.has(n.uuid)) n.children.forEach(c => childUuids.push(c.uuid))
            n.children.forEach(collectChildren)
          }
          collectChildren(sceneFile.root)
          if (childUuids.length > 0) onMultiSelectChange?.(childUuids)
          setBatchMsg(`✓ ⬇ 자식 선택: ${childUuids.length}개 (R2522)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>자식선택 (R2522)</span>
            <span onClick={applyChildSelect} style={mkBtnS('#34d399')} title="collectChildren ⬇ 자식 직접 자식 선택 R2522">⬇ 자식</span>
          </div>
        )
      })()}

      {/* R2545: 컴포넌트 타입 필터 coll2545 commonTypes replace('cc.', '') */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const coll2545: CCSceneNode[] = []
        function collectComp(n: CCSceneNode) { if (uuidSet.has(n.uuid)) coll2545.push(n); n.children.forEach(collectComp) }
        collectComp(sceneFile.root)
        const typeCount = new Map<string, number>()
        coll2545.forEach(n => n.components.forEach(c => typeCount.set(c.type, (typeCount.get(c.type) || 0) + 1)))
        const commonTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
        if (commonTypes.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>컴프필터 (R2545)</span>
            {commonTypes.map(([type, cnt]) => (
              <span key={type} onClick={() => {
                if (!sceneFile.root) return
                const filtered: string[] = []
                function walk(n: CCSceneNode) {
                  if (n.components.some(c => c.type === type)) filtered.push(n.uuid)
                  n.children.forEach(walk)
                }
                walk(sceneFile.root)
                onMultiSelectChange?.(filtered)
                setBatchMsg(`✓ ${type.replace('cc.', '')} 노드 선택: ${filtered.length}개 (R2545)`)
                setTimeout(() => setBatchMsg(null), 2000)
              }} style={mkBtnS('#818cf8')} title={`${type} 컴포넌트 보유 노드 선택`}>
                {type.replace('cc.', '')}({cnt})
              </span>
            ))}
          </div>
        )
      })()}

      {/* R2556: 같은 Layer 노드 선택 targetLayer sameLayerUuids findSameLayer */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyLayerSelect = () => {
          if (!sceneFile.root) return
          const selectedNodes: CCSceneNode[] = []
          function collectSel(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selectedNodes.push(n); n.children.forEach(collectSel) }
          collectSel(sceneFile.root)
          const targetLayer = selectedNodes[0]?.layer ?? selectedNodes[0]?.group
          if (targetLayer == null) return
          const sameLayerUuids: string[] = []
          function findSameLayer(n: CCSceneNode) {
            if ((n.layer ?? n.group) === targetLayer) sameLayerUuids.push(n.uuid)
            n.children.forEach(findSameLayer)
          }
          findSameLayer(sceneFile.root)
          onMultiSelectChange?.(sameLayerUuids)
          setBatchMsg(`✓ Layer=${targetLayer} 선택: ${sameLayerUuids.length}개 (R2556)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>같은Layer (R2556)</span>
            <span onClick={applyLayerSelect} style={mkBtnS('#fbbf24')} title="targetLayer sameLayerUuids findSameLayer 같은 Layer 노드 선택 R2556">≡Layer</span>
          </div>
        )
      })()}

      {/* R2635: 선택 홀수/짝수 필터 — 짝수 홀수 i % 2 === 0 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyOddEven = (even: boolean) => {
          if (!sceneFile.root) return
          const ordered: string[] = []
          function collectOrdered(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ordered.push(n.uuid); n.children.forEach(collectOrdered) }
          collectOrdered(sceneFile.root)
          const filtered = ordered.filter((_, i) => even ? i % 2 === 0 : i % 2 !== 0)
          onMultiSelectChange?.(filtered)
          setBatchMsg(`✓ ${even ? '짝수' : '홀수'} 필터: ${filtered.length}개 (R2635)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>홀짝 (R2635)</span>
            <span onClick={() => applyOddEven(true)} style={mkBtnS('#818cf8')} title="짝수 인덱스 필터 i % 2 === 0 R2635">짝수</span>
            <span onClick={() => applyOddEven(false)} style={mkBtnS('#a78bfa')} title="홀수 인덱스 필터 R2635">홀수</span>
          </div>
        )
      })()}

      {/* R2644: 선택 노드 통계 패널 selStats */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const statsNodes: CCSceneNode[] = []
        function collectStats(n: CCSceneNode) { if (uuidSet.has(n.uuid)) statsNodes.push(n); n.children.forEach(collectStats) }
        collectStats(sceneFile.root)
        if (statsNodes.length === 0) return null
        const xs = statsNodes.map(n => (n.position as { x: number }).x ?? 0)
        const ys = statsNodes.map(n => (n.position as { y: number }).y ?? 0)
        const ws = statsNodes.map(n => n.size?.x ?? n.size?.width ?? 0)
        const hs = statsNodes.map(n => n.size?.y ?? n.size?.height ?? 0)
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
        const selStats = {
          x: { min: Math.min(...xs), max: Math.max(...xs), avg: Math.round(avg(xs)) },
          y: { min: Math.min(...ys), max: Math.max(...ys), avg: Math.round(avg(ys)) },
          w: { min: Math.min(...ws), max: Math.max(...ws), avg: Math.round(avg(ws)) },
          h: { min: Math.min(...hs), max: Math.max(...hs), avg: Math.round(avg(hs)) },
        }
        const sS: React.CSSProperties = { fontSize: 8, color: '#94a3b8', fontFamily: 'monospace' }
        const lS: React.CSSProperties = { fontSize: 8, color: 'var(--text-muted)' }
        return (
          <div style={{ marginBottom: 5, padding: '3px 6px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#818cf8', fontWeight: 600, marginBottom: 2 }}>📊 통계 (R2644) — {statsNodes.length}개</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={lS}>X:</span><span style={sS}>{selStats.x.min}~{selStats.x.max} avg={selStats.x.avg}</span>
              <span style={lS}>Y:</span><span style={sS}>{selStats.y.min}~{selStats.y.max} avg={selStats.y.avg}</span>
              <span style={lS}>W:</span><span style={sS}>{selStats.w.min}~{selStats.w.max} avg={selStats.w.avg}</span>
              <span style={lS}>H:</span><span style={sS}>{selStats.h.min}~{selStats.h.max} avg={selStats.h.avg}</span>
            </div>
          </div>
        )
      })()}

      {/* R2725: BatchInspector 일괄 잠금 lockedUuids onSetLockedUuids */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyLock = () => {
          const newLocked = new Set(lockedUuids ?? [])
          uuids.forEach(u => newLocked.add(u))
          onSetLockedUuids?.(() => newLocked)
          setBatchMsg(`✓ 일괄 잠금 ${uuids.length}개 (R2725)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        const applyUnlock = () => {
          const newLocked = new Set(lockedUuids ?? [])
          uuids.forEach(u => newLocked.delete(u))
          onSetLockedUuids?.(() => newLocked)
          setBatchMsg(`✓ 일괄 잠금 해제 ${uuids.length}개 (R2725)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>일괄 잠금 (R2725)</span>
            <span onClick={applyLock} style={mkBtnS('#f472b6')} title="lockedUuids onSetLockedUuids 일괄 잠금 R2725">🔒 잠금</span>
            <span onClick={applyUnlock} style={mkBtnS('#34d399')} title="일괄 잠금 해제 R2725">🔓 해제</span>
          </div>
        )
      })()}
    </>
  )
}
