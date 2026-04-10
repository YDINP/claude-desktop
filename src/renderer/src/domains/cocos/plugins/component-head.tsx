import React, { useState } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import type { ComponentSectionProps } from './component-shared'
import { t } from '../../../utils/i18n'

export function ComponentHeadSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg, onMultiSelectChange }: ComponentSectionProps) {
  const [batchAddComp, setBatchAddComp] = useState<string>('')
  const [batchRemComp, setBatchRemComp] = useState<string>('')
  return (
    <>
      {/* R2517: 컴포넌트 타입으로 씬 전체 선택 — 선택 노드의 공통 comp 타입 표시 + ⊞전체 클릭 */}
      {onMultiSelectChange && sceneFile.root && uuids.length > 0 && (() => {
        const selectedNodes: CCSceneNode[] = []
        function collectSel(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selectedNodes.push(n); n.children.forEach(collectSel) }
        collectSel(sceneFile.root!)
        // 선택 노드 중 공통 comp 타입 (중복 없이 up to 6개)
        const compTypeSet = new Set<string>()
        selectedNodes.forEach(n => n.components.forEach(c => compTypeSet.add(c.type)))
        const compTypes = [...compTypeSet].slice(0, 6)
        if (compTypes.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{t('batch.c_head.j_all2_r2517', '⊞전체 (R2517)')}</span>
            {compTypes.map(ct => {
              // 씬 내 해당 타입 노드 모두 찾기
              const all: string[] = []
              function walkType(n: CCSceneNode) { if (n.components.some(c => c.type === ct)) all.push(n.uuid); n.children.forEach(walkType) }
              walkType(sceneFile.root!)
              const shortName = ct.includes('.') ? ct.split('.').pop()! : ct
              return (
                <span key={ct} onClick={() => onMultiSelectChange(all)}
                  title={`씬 내 ${ct} 컴포넌트를 가진 ${all.length}개 노드 전체 선택 (R2517)`}
                  style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >{shortName}×{all.length}</span>
              )
            })}
          </div>
        )
      })()}
      {/* R2523: 공통 컴포넌트 enabled 일괄 토글 */}
      {sceneFile.root && uuids.length > 0 && (() => {
        const selNodes: CCSceneNode[] = []
        function collectSel2523(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selNodes.push(n); n.children.forEach(collectSel2523) }
        collectSel2523(sceneFile.root!)
        const typeSet = new Set<string>()
        selNodes.forEach(n => n.components.forEach(c => typeSet.add(c.type)))
        const types = [...typeSet].filter(t => t !== 'cc.Node').slice(0, 5)
        if (types.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{t('batch.c_head.j_on_off_r2523', '컴프 ON/OFF (R2523)')}</span>
            {types.map(ct => {
              const nodesWithComp = selNodes.filter(n => n.components.some(c => c.type === ct))
              const allOn = nodesWithComp.every(n => n.components.find(c => c.type === ct)?.props.enabled !== false)
              const shortName = ct.includes('.') ? ct.split('.').pop()! : ct
              return (
                <span key={ct}
                  title={`선택된 노드의 ${ct} 컴포넌트를 일괄 ${allOn ? t('batch.c_head.s_deact', '비활성화') : t('batch.c_head.s_act', '활성화')} (R2523)`}
                  onClick={async () => {
                    if (!sceneFile.root) return
                    const newEnabled = !allOn
                    await patchComponents(
                      c => c.type === ct,
                      c => ({ ...c, props: { ...c.props, enabled: newEnabled, _enabled: newEnabled } }),
                      `${ct} ${newEnabled ? t('batch.c_head.s_act', '활성화') : t('batch.c_head.s_deact', '비활성화')} (${nodesWithComp.length}개)`,
                    )
                  }}
                  style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${allOn ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`, borderRadius: 2, color: allOn ? '#34d399' : '#f87171', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >{shortName} {allOn ? '●' : '○'}</span>
              )
            })}
          </div>
        )
      })()}
      {/* R2505: 컴포넌트 일괄 추가 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const doBatchAdd = async () => {
          const ct = batchAddComp.trim()
          if (!ct || !sceneFile.root) return
          await patchNodes(n => {
            if (n.components.some(c => c.type === ct)) return { ...n} // 이미 있으면 스킵
            return { ...n, components: [...n.components, { type: ct, props: {} }]}
          }, `${ct} 일괄 추가 (${uuids.length}개)`)
          setBatchAddComp('')
        }
        const QUICK_COMPS = ['cc.Widget', 'cc.Layout', 'cc.Button', 'cc.Toggle', 'cc.Mask', 'cc.BlockInputEvents', 'cc.AudioSource']
        return (
          <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#38bdf8', fontWeight: 600, marginBottom: 3 }}>{t('batch.c_head.j_comp_batch_add_r2505', '⊕ 컴포넌트 일괄 추가 (R2505)')}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
              {QUICK_COMPS.map(ct => (
                <span key={ct} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', background: 'rgba(56,189,248,0.06)' }}
                  onClick={async () => {
                    if (!sceneFile.root) return
                    await patchNodes(n => {
                      if (n.components.some(c => c.type === ct)) return n
                      return { ...n, components: [...n.components, { type: ct, props: {} }]}
                    }, `${ct.split('.').pop()} 일괄 추가`)
                  }}
                  title={`${ct} 일괄 추가`}
                >{ct.split('.').pop()}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <input value={batchAddComp} onChange={e => setBatchAddComp(e.target.value)}
                placeholder={t('batch.c_head.p_comp_cc_widget', '컴포넌트 타입 (예: cc.Widget)')}
                onKeyDown={e => { if (e.key === 'Enter') doBatchAdd() }}
                style={{ flex: 1, fontSize: 9, padding: '2px 4px', borderRadius: 3, background: 'var(--bg-input, #1a1a2e)', border: '1px solid #334', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }} />
              <span onClick={doBatchAdd} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', lineHeight: 1.6 }}>{t('batch.c_head.j_add', '추가')}</span>
            </div>
          </div>
        )
      })()}
      {/* R2506: 컴포넌트 일괄 제거 */}
      {/* R2506: 컴포넌트 일괄 제거 */}
      {commonCompTypes.length > 0 && uuids.length >= 1 && sceneFile.root && (() => {
        const doBatchRem = async (ct: string) => {
          if (!ct || !sceneFile.root) return
          await patchNodes(n => {
            return { ...n, components: n.components.filter(c => c.type !== ct)}
          }, `${ct.split('.').pop()} 일괄 제거 (${uuids.length}개)`)
          setBatchRemComp('')
        }
        return (
          <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#f87171', fontWeight: 600, marginBottom: 3 }}>{t('batch.c_head.j_comp_batch_remove_r2506', '⊖ 컴포넌트 일괄 제거 (R2506)')}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
              {commonCompTypes.map(ct => (
                <span key={ct} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', background: 'rgba(248,113,113,0.06)' }}
                  onClick={() => doBatchRem(ct)}
                  title={`${ct} 공통 컴포넌트 일괄 제거`}
                >{ct.split('.').pop()} ×</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <input value={batchRemComp} onChange={e => setBatchRemComp(e.target.value)}
                placeholder={t('batch.c_head.p_remove_comp', '제거할 컴포넌트 타입')}
                onKeyDown={e => { if (e.key === 'Enter') doBatchRem(batchRemComp.trim()) }}
                style={{ flex: 1, fontSize: 9, padding: '2px 4px', borderRadius: 3, background: 'var(--bg-input, #1a1a2e)', border: '1px solid #334', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }} />
              <span onClick={() => doBatchRem(batchRemComp.trim())} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', lineHeight: 1.6 }}>{t('batch.c_head.j_remove', '제거')}</span>
            </div>
          </div>
        )
      })()}
      {/* R1698: 공통 컴포넌트 표시 */}
      {commonCompTypes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', alignSelf: 'center' }}>{t('batch.c_head.j_common', '공통:')}</span>
          {commonCompTypes.map(t => (
            <span key={t} style={{ fontSize: 8, padding: '0 4px', borderRadius: 3, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>
              {t.includes('.') ? t.split('.').pop() : t}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
